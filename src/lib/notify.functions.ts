import { createServerFn } from "@tanstack/react-start";

export type NotifyKind =
  | "purchase"
  | "service_order"
  | "topup_qr"
  | "topup_card"
  | "topup_code"
  | "register"
  | "spin";

type NotifyInput = { kind: NotifyKind; title: string; lines: string[] };

const KINDS: NotifyKind[] = [
  "purchase", "service_order", "topup_qr", "topup_card", "topup_code", "register", "spin",
];

const COLORS: Record<NotifyKind, number> = {
  purchase: 0x22c55e,
  service_order: 0x3b82f6,
  topup_qr: 0x0ea5e9,
  topup_card: 0xf59e0b,
  topup_code: 0x8b5cf6,
  register: 0x14b8a6,
  spin: 0xec4899,
};

async function loadWebhook(): Promise<string | null> {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];
  if (!url || !key) return null;
  const res = await fetch(`${url}/rest/v1/site_settings?id=eq.1&select=discord_webhook`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as Array<{ discord_webhook?: string | null }>;
  const hook = rows?.[0]?.discord_webhook ?? null;
  return hook && hook.startsWith("https://") ? hook : null;
}

/** Fire a Discord webhook message for shop activity (purchase / top-up / order / register). */
export const notifyDiscord = createServerFn({ method: "POST" })
  .inputValidator((data: NotifyInput) => {
    if (!data || !KINDS.includes(data.kind)) throw new Error("invalid_kind");
    if (typeof data.title !== "string" || data.title.length > 200) throw new Error("invalid_title");
    const lines = Array.isArray(data.lines) ? data.lines.slice(0, 12).map((l) => String(l).slice(0, 300)) : [];
    return { kind: data.kind, title: data.title.slice(0, 200), lines };
  })
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    try {
      const hook = await loadWebhook();
      if (!hook) return { ok: false };
      const res = await fetch(hook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: "Game Lao",
          embeds: [
            {
              title: data.title,
              description: data.lines.join("\n") || "-",
              color: COLORS[data.kind],
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      });
      return { ok: res.ok };
    } catch (e) {
      console.error("[notify] failed", e);
      return { ok: false };
    }
  });
