import { createServerFn } from "@tanstack/react-start";

type VerifyInput = { imageDataUrl: string; expectedAmount: number; qrStartedAt?: number };
type Extracted = {
  recipient_name?: string | null;
  amount?: number | null;
  date_iso?: string | null;
  qr_recipient_name?: string | null;
  qr_amount?: number | null;
  qr_date_iso?: string | null;
};
type VerifyResult = { ok: boolean; reason?: string; extracted?: Extracted };

const DEFAULT_NAME = "SOMYONE KHAMKHEUNG";

function normalizeName(s: string | null | undefined) {
  return (s ?? "").toUpperCase().replace(/[^A-Z ]/g, " ").replace(/\s+/g, " ").trim();
}

/** Read the admin-configured receiver account name from site settings. */
async function loadExpectedName(): Promise<string> {
  try {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];
    if (!url || !key) return DEFAULT_NAME;
    const res = await fetch(`${url}/rest/v1/site_settings?id=eq.1&select=qr_account_name`, {
      headers: { apikey: key },
    });
    if (!res.ok) return DEFAULT_NAME;
    const rows = (await res.json()) as Array<{ qr_account_name?: string | null }>;
    const name = normalizeName(rows?.[0]?.qr_account_name);
    return name || DEFAULT_NAME;
  } catch {
    return DEFAULT_NAME;
  }
}

function makeNameChecker(expected: string) {
  const tokens = normalizeName(expected).split(" ").filter((t) => t.length > 2);
  return (s: string | null | undefined) => {
    const n = normalizeName(s);
    if (!n || tokens.length === 0) return false;
    return tokens.every((t) => n.includes(t));
  };
}

export const verifySlip = createServerFn({ method: "POST" })
  .inputValidator((data: VerifyInput) => {
    if (!data || typeof data.imageDataUrl !== "string" || !data.imageDataUrl.startsWith("data:"))
      throw new Error("invalid_image");
    if (typeof data.expectedAmount !== "number" || data.expectedAmount <= 0)
      throw new Error("invalid_amount");
    return data;
  })
  .handler(async ({ data }): Promise<VerifyResult> => {
    const EXPECTED_NAME = await loadExpectedName();
    const containsExpectedName = makeNameChecker(EXPECTED_NAME);
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { ok: false, reason: "ระบบตรวจสอบไม่พร้อมใช้งาน" };

    const prompt = `คุณคือระบบตรวจสอบสลิปโอนเงินธนาคารลาว/ไทย
วิเคราะห์ภาพสลิปนี้และดึงข้อมูล 2 ชุด:
(A) ข้อความบนสลิป: ชื่อผู้รับ (recipient_name), จำนวนเงิน (amount, ตัวเลขล้วน), วันที่-เวลาโอน (date_iso, รูปแบบ ISO 8601 พร้อมโซนเวลา ถ้าไม่มีให้ใช้ +07:00)
(B) ข้อมูลจาก QR Code ในสลิป (ถ้ามีและอ่านได้): qr_recipient_name, qr_amount, qr_date_iso
ตอบเป็น JSON เท่านั้น ไม่มีคำอธิบายอื่น รูปแบบ:
{"recipient_name":"...","amount":0,"date_iso":"...","qr_recipient_name":"...","qr_amount":0,"qr_date_iso":"..."}
ค่าที่ไม่ทราบให้ใส่ null`;

    let extracted: Extracted = {};
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: data.imageDataUrl } },
              ],
            },
          ],
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        console.error("[verify-slip] gateway error", res.status, txt);
        return { ok: false, reason: "ไม่สามารถตรวจสอบสลิปได้ ลองใหม่อีกครั้ง" };
      }
      const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = json.choices?.[0]?.message?.content ?? "";
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) return { ok: false, reason: "อ่านสลิปไม่ได้ ลองถ่ายใหม่ให้ชัด" };
      extracted = JSON.parse(match[0]) as Extracted;
    } catch (e) {
      console.error("[verify-slip] failed", e);
      return { ok: false, reason: "ไม่สามารถตรวจสอบสลิปได้ ลองใหม่อีกครั้ง" };
    }

    // 1. Name check (slip text)
    if (!containsExpectedName(extracted.recipient_name)) {
      return { ok: false, reason: `ชื่อผู้รับไม่ตรง ต้องเป็น ${EXPECTED_NAME}`, extracted };
    }

    // 2. Amount check
    const amt = Number(extracted.amount ?? 0);
    if (!amt || Math.abs(amt - data.expectedAmount) > 0.5) {
      return {
        ok: false,
        reason: `จำนวนเงินไม่ตรง (สลิป ${amt.toLocaleString()} ≠ ${data.expectedAmount.toLocaleString()})`,
        extracted,
      };
    }

    // 3. Transfer time must fall inside the QR session window
    const started = typeof data.qrStartedAt === "number" && data.qrStartedAt > 0 ? data.qrStartedAt : Date.now();
    const WINDOW_MS = 5 * 60 * 1000;
    const CLOCK_SKEW_MS = 90 * 1000; // slip clocks are rarely exact
    const windowFrom = started - CLOCK_SKEW_MS;
    const windowTo = started + WINDOW_MS + CLOCK_SKEW_MS;
    const fmt = (ms: number) =>
      new Date(ms).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", hour12: false });

    const d = extracted.date_iso ? new Date(extracted.date_iso) : null;
    if (!d || isNaN(d.getTime())) {
      return { ok: false, reason: "อ่านวันที่-เวลาบนสลิปไม่ได้ ถ่ายสลิปให้ชัดอีกครั้ง", extracted };
    }
    if (d.getTime() < windowFrom || d.getTime() > windowTo) {
      return {
        ok: false,
        reason: `วันที่-เวลาบนสลิป (${fmt(d.getTime())}) ไม่ตรงกับเวลาที่สร้าง QR (${fmt(started)}) ต้องโอนภายใน 5 นาทีหลังสร้าง QR`,
        extracted,
      };
    }

    // 4. QR cross-check (if QR fields present, they must agree with 1-3)
    if (extracted.qr_recipient_name || extracted.qr_amount || extracted.qr_date_iso) {
      if (extracted.qr_recipient_name && !containsExpectedName(extracted.qr_recipient_name)) {
        return { ok: false, reason: `ข้อมูลใน QR ของสลิป: ชื่อผู้รับไม่ตรง ต้องเป็น ${EXPECTED_NAME}`, extracted };
      }
      if (extracted.qr_amount != null) {
        const qa = Number(extracted.qr_amount);
        if (Math.abs(qa - data.expectedAmount) > 0.5) {
          return { ok: false, reason: "ข้อมูลใน QR ของสลิป: จำนวนเงินไม่ตรง", extracted };
        }
      }
      if (extracted.qr_date_iso) {
        const qd = new Date(extracted.qr_date_iso);
        if (!isNaN(qd.getTime()) && (qd.getTime() < windowFrom || qd.getTime() > windowTo)) {
          return { ok: false, reason: "ข้อมูลใน QR ของสลิป: วันที่-เวลาไม่ตรงกับเวลาที่สร้าง QR", extracted };
        }
      }
    }

    return { ok: true, extracted };
  });
