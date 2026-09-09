import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

/** Normalize an account name for comparison (case/space/punctuation insensitive). */
function norm(v: string) {
  return v.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function pick(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  const nested = obj["data"];
  if (nested && typeof nested === "object") {
    const n = nested as Record<string, unknown>;
    for (const k of keys) if (n[k] !== undefined && n[k] !== null) return n[k];
  }
  return undefined;
}

function toAmount(v: unknown): number | null {
  if (typeof v === "number") return Math.round(v);
  if (typeof v === "string") {
    const cleaned = v.replace(/[^0-9.]/g, "");
    const n = Number(cleaned);
    if (Number.isFinite(n)) return Math.round(n);
  }
  return null;
}

export const Route = createFileRoute("/api/public/lao-qr")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: cfgRow } = await supabaseAdmin
          .from("payment_config")
          .select("merchant_name,timeout_minutes,webhook_secret")
          .eq("id", 1)
          .maybeSingle();
        const cfg = (cfgRow ?? {}) as { merchant_name?: string; timeout_minutes?: number; webhook_secret?: string | null };
        const merchant = cfg.merchant_name || "SOMYONE KHAMKHEUNG MR.";
        const timeoutMin = cfg.timeout_minutes || 15;
        const secret = cfg.webhook_secret || process.env["LAO_QR_WEBHOOK_SECRET"] || null;

        // Verify the caller when a shared secret is configured.
        if (secret) {
          const provided = request.headers.get("x-signature") ?? request.headers.get("x-webhook-signature") ?? "";
          const expected = createHmac("sha256", secret).update(raw).digest("hex");
          const a = Buffer.from(provided);
          const b = Buffer.from(expected);
          const bearerOk = (request.headers.get("authorization") ?? "") === `Bearer ${secret}`;
          if (!bearerOk && (a.length !== b.length || !timingSafeEqual(a, b))) {
            return new Response("invalid signature", { status: 401 });
          }
        }

        let body: Record<string, unknown>;
        try {
          body = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          return new Response("bad json", { status: 400 });
        }

        const reference = String(pick(body, ["reference", "intent_id", "order_id", "bill_number"]) ?? "");
        const bankRef = String(pick(body, ["transaction_id", "txn_id", "reference_no", "bank_ref", "trace"]) ?? "") || null;
        const amount = toAmount(pick(body, ["amount", "amount_paid", "total"]));
        const accountName = String(pick(body, ["account_name", "receiver_name", "to_account_name", "merchant_name"]) ?? "");
        const timeRaw = pick(body, ["transaction_time", "paid_at", "timestamp", "datetime"]);
        const txnTime = timeRaw ? new Date(String(timeRaw)) : new Date();

        if (!reference) return new Response("missing reference", { status: 400 });

        const { data: intentRow } = await supabaseAdmin
          .from("payment_intents")
          .select("id,amount,created_at,expires_at,status")
          .eq("id", reference)
          .maybeSingle();
        if (!intentRow) return new Response("unknown transaction", { status: 404 });
        const intent = intentRow as { id: string; amount: number; created_at: string; expires_at: string; status: string };
        if (intent.status !== "pending") return Response.json({ ok: true, already: intent.status });

        const created = new Date(intent.created_at).getTime();
        const paidAt = Number.isNaN(txnTime.getTime()) ? Date.now() : txnTime.getTime();

        const nameOk = norm(accountName) === norm(merchant) && /MR/.test(norm(accountName));
        const amountOk = amount !== null && amount === Math.round(intent.amount);
        const timeOk = paidAt >= created - 2 * 60_000 && paidAt <= created + timeoutMin * 60_000;
        const ok = nameOk && amountOk && timeOk;

        const { data: settled, error } = await supabaseAdmin.rpc("settle_payment_intent", {
          _id: intent.id,
          _ok: ok,
          _bank_ref: bankRef,
          _payload: body as never,
          _reason: ok ? null : `name=${nameOk} amount=${amountOk} time=${timeOk}`,
        });
        if (error) {
          console.error("[laoqr] settle failed", error);
          return new Response("settle failed", { status: 500 });
        }

        return Response.json({ ok, result: settled });
      },
    },
  },
});
