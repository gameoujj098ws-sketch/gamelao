import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PaymentIntentInfo = {
  id: string;
  amount: number;
  createdAt: string;
  expiresAt: string;
  qrPayload: string;
  merchantName: string;
  timeoutMinutes: number;
};

export type PaymentStatus = {
  status: "pending" | "success" | "failed" | "expired" | "cancelled";
  amount: number;
  bankRef: string | null;
  expiresAt: string;
};

type Cfg = {
  api_url: string | null;
  api_key: string | null;
  merchant_name: string;
  timeout_minutes: number;
  enabled: boolean;
};

/** EMVCo TLV helper */
function tlv(id: string, value: string) {
  return id + String(value.length).padStart(2, "0") + value;
}
function crc16(input: string) {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Local Lao QR (EMVCo dynamic) payload used when no provider endpoint is configured. */
function buildLaoQr(merchant: string, amount: number, reference: string) {
  const body =
    tlv("00", "01") +
    tlv("01", "12") +
    tlv("29", tlv("00", "LAOQR") + tlv("01", merchant.slice(0, 25))) +
    tlv("52", "0000") +
    tlv("53", "418") +
    tlv("54", amount.toFixed(2)) +
    tlv("58", "LA") +
    tlv("59", merchant.slice(0, 25)) +
    tlv("60", "VIENTIANE") +
    tlv("62", tlv("05", reference.replace(/-/g, "").slice(0, 20)));
  const withCrcId = body + "6304";
  return withCrcId + crc16(withCrcId);
}

async function loadConfig(): Promise<Cfg> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("payment_config").select("*").eq("id", 1).maybeSingle();
  const row = (data ?? {}) as Partial<Cfg>;
  return {
    api_url: row.api_url ?? process.env["LAO_QR_API_URL"] ?? null,
    api_key: row.api_key ?? process.env["LAO_QR_API_KEY"] ?? null,
    merchant_name: row.merchant_name || process.env["MERCHANT_NAME"] || "SOMYONE KHAMKHEUNG MR.",
    timeout_minutes: row.timeout_minutes || Number(process.env["PAYMENT_TIMEOUT_MINUTES"] ?? 15),
    enabled: row.enabled ?? true,
  };
}

/** Ask the provider for a QR payload; returns null when unavailable. */
async function requestProviderQr(cfg: Cfg, amount: number, reference: string) {
  if (!cfg.api_url || !cfg.api_key) return null;
  try {
    const res = await fetch(cfg.api_url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${cfg.api_key}`,
        "x-api-key": cfg.api_key,
      },
      body: JSON.stringify({
        amount,
        currency: "LAK",
        reference,
        merchant_name: cfg.merchant_name,
        expires_in_minutes: cfg.timeout_minutes,
      }),
    });
    if (res.status === 401 || res.status === 403) throw new Error("invalid_api_key");
    if (!res.ok) throw new Error(`provider_${res.status}`);
    const j = (await res.json()) as Record<string, unknown>;
    const nested = (j["data"] ?? {}) as Record<string, unknown>;
    const payload =
      j["qr"] ?? j["qr_code"] ?? j["qrCode"] ?? j["payload"] ?? j["emv"] ?? nested["qr"] ?? nested["qrCode"] ?? nested["payload"];
    const txn = j["transaction_id"] ?? j["txn_id"] ?? j["id"] ?? nested["transaction_id"] ?? nested["id"];
    if (typeof payload !== "string" || payload.length < 10) return null;
    return { payload, txn: typeof txn === "string" ? txn : null };
  } catch (e) {
    console.error("[laoqr] provider error", e);
    if ((e as Error).message === "invalid_api_key") throw new Error("invalid_api_key");
    return null;
  }
}

/** Create (or resume) the caller's single pending top-up transaction and return its Lao QR payload. */
export const createTopupIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { amount: number }) => {
    const amount = Math.floor(Number(data?.amount));
    if (!Number.isFinite(amount) || amount < 1000) throw new Error("invalid_amount");
    return { amount };
  })
  .handler(async ({ data, context }): Promise<PaymentIntentInfo> => {
    const cfg = await loadConfig();
    if (!cfg.enabled) throw new Error("payment_disabled");

    const { data: created, error } = await context.supabase.rpc("create_payment_intent", { _amount: data.amount });
    if (error) throw new Error(error.message);
    const intent = created as { id: string; amount: number; created_at: string; expires_at: string };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("payment_intents")
      .select("qr_payload")
      .eq("id", intent.id)
      .maybeSingle();

    let payload = (row as { qr_payload: string | null } | null)?.qr_payload ?? null;
    if (!payload) {
      const provider = await requestProviderQr(cfg, intent.amount, intent.id);
      payload = provider?.payload ?? buildLaoQr(cfg.merchant_name, intent.amount, intent.id);
      await supabaseAdmin
        .from("payment_intents")
        .update({ qr_payload: payload, provider_txn_id: provider?.txn ?? null })
        .eq("id", intent.id);
    }

    return {
      id: intent.id,
      amount: intent.amount,
      createdAt: intent.created_at,
      expiresAt: intent.expires_at,
      qrPayload: payload,
      merchantName: cfg.merchant_name,
      timeoutMinutes: cfg.timeout_minutes,
    };
  });

/** Poll the status of one of the caller's transactions. */
export const getTopupIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => {
    if (!data?.id || typeof data.id !== "string") throw new Error("invalid_id");
    return data;
  })
  .handler(async ({ data, context }): Promise<PaymentStatus> => {
    const { data: row, error } = await context.supabase
      .from("payment_intents")
      .select("status,amount,bank_ref,expires_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("not_found");
    const r = row as { status: string; amount: number; bank_ref: string | null; expires_at: string };
    let status = r.status;
    if (status === "pending" && new Date(r.expires_at).getTime() < Date.now()) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.rpc("expire_payment_intents");
      status = "expired";
    }
    return {
      status: status as PaymentStatus["status"],
      amount: r.amount,
      bankRef: r.bank_ref,
      expiresAt: r.expires_at,
    };
  });

/** Cancel the caller's pending transaction. */
export const cancelTopupIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => {
    if (!data?.id) throw new Error("invalid_id");
    return data;
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.rpc("cancel_payment_intent", { _id: data.id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Admin-only: check that the configured provider endpoint + API key work. */
export const testPaymentApi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: boolean; message: string }> => {
    const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (error) throw new Error(error.message);
    if (!isAdmin) throw new Error("forbidden");

    const cfg = await loadConfig();
    if (!cfg.api_url || !cfg.api_key) {
      return { ok: false, message: "ຍັງບໍ່ໄດ້ຕັ້ງ API URL ຫຼື API Key (ລະບົບຈະສ້າງ Lao QR ພາຍໃນເອງ)" };
    }
    try {
      const r = await requestProviderQr(cfg, 1000, "TEST-" + Date.now());
      if (!r) return { ok: false, message: "ເຊື່ອມຕໍ່ໄດ້ ແຕ່ຮູບແບບຄຳຕອບບໍ່ຖືກຕ້ອງ" };
      return { ok: true, message: "API Key ຖືກຕ້ອງ ໃຊ້ງານໄດ້" };
    } catch (e) {
      return { ok: false, message: (e as Error).message === "invalid_api_key" ? "API Key ບໍ່ຖືກຕ້ອງ" : "ເຊື່ອມຕໍ່ API ບໍ່ໄດ້" };
    }
  });
