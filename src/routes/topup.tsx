import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatKip } from "@/lib/format";
import { statusDialog, StatusDialog } from "@/components/app/StatusDialog";
import { ArrowLeft, CreditCard, Ticket, QrCode, Upload, Wallet, Clock } from "lucide-react";
import { verifySlip } from "@/lib/verify-slip.functions";

const QR_SESSION_KEY = "qr_topup_session_v1";
const QR_TTL_MS = 15 * 60 * 1000;
const RECIPIENT_NAME = "SOMYONE KHAMKHEUNG";

type QrSession = { amount: number; startedAt: number };
function readQrSession(): QrSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(QR_SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as QrSession;
    if (!s?.amount || !s?.startedAt) return null;
    if (Date.now() - s.startedAt >= QR_TTL_MS) {
      localStorage.removeItem(QR_SESSION_KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}
function writeQrSession(s: QrSession) {
  localStorage.setItem(QR_SESSION_KEY, JSON.stringify(s));
}
function clearQrSession() {
  localStorage.removeItem(QR_SESSION_KEY);
}
export { readQrSession as readActiveQrSession };

async function fileToDataUrl(f: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(f);
  });
}

export const Route = createFileRoute("/topup")({ component: TopupPage });

const PRESETS = [10000, 20000, 50000, 100000, 200000, 500000];

type Method = "menu" | "card" | "code" | "qr-amount" | "qr-pay";

function TopupPage() {
  const nav = useNavigate();
  const { user, profile, reloadProfile, loading } = useSession();
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrOn, setQrOn] = useState(true);
  const [cardOn, setCardOn] = useState(true);
  const [method, setMethod] = useState<Method>("menu");
  const [amount, setAmount] = useState(10000);
  const [custom, setCustom] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [code, setCode] = useState("");
  const [card, setCard] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessionStart, setSessionStart] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const restoredRef = useRef(false);

  useEffect(() => {
    supabase.from("site_settings").select("qr_url,qr_enabled,card_enabled").eq("id", 1).maybeSingle().then(({ data }) => {
      const d = data as { qr_url: string | null; qr_enabled: boolean; card_enabled: boolean } | null;
      setQrUrl(d?.qr_url ?? null);
      setQrOn(d?.qr_enabled ?? true);
      setCardOn(d?.card_enabled ?? true);
    });
  }, []);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
  }, [loading, user, nav]);

  useEffect(() => {
    if (restoredRef.current) return;
    const s = readQrSession();
    if (s) {
      restoredRef.current = true;
      setAmount(s.amount);
      setCustom("");
      setSessionStart(s.startedAt);
      setMethod("qr-pay");
    }
  }, []);

  useEffect(() => {
    if (method !== "qr-pay" || !sessionStart) return;
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n - sessionStart >= QR_TTL_MS) {
        clearQrSession();
        setSessionStart(null);
        setFile(null);
        setMethod("qr-amount");
        statusDialog.error("ໝົດເວລາ", "QR Code ໝົດອາຍຸແລ້ວ ກະລຸນາສ້າງໃໝ່");
      }
    }, 1000);
    return () => clearInterval(t);
  }, [method, sessionStart]);

  const finalAmount = sessionStart ? amount : (custom ? parseInt(custom) || 0 : amount);
  const remainingMs = sessionStart ? Math.max(0, QR_TTL_MS - (now - sessionStart)) : QR_TTL_MS;
  const mm = String(Math.floor(remainingMs / 60000)).padStart(2, "0");
  const ss = String(Math.floor((remainingMs % 60000) / 1000)).padStart(2, "0");

  const startQrSession = () => {
    const s: QrSession = { amount: finalAmount, startedAt: Date.now() };
    writeQrSession(s);
    setSessionStart(s.startedAt);
    setNow(s.startedAt);
    setMethod("qr-pay");
  };

  const cancelQrSession = () => {
    clearQrSession();
    setSessionStart(null);
    setFile(null);
    setMethod("qr-amount");
  };

  const submitSlip = async (picked?: File) => {
    const slip = picked ?? file;
    if (!user) return;
    if (!slip) return statusDialog.error("ລົ້ມເຫຼວ", "ກະລຸນາແນບຮູບສະລິບ");
    
    if (finalAmount < 1000) return statusDialog.error("ລົ້ມເຫຼວ", "ຈຳນວນເງີນບໍ່ຖືກຕ້ອງ");
    setBusy(true);
    try {
      statusDialog.loading("ລໍຖ້າບຶດໜຶ່ງ...", "ກຳລັງກວດສອບສະລິບ");
      const dataUrl = await fileToDataUrl(slip);
      const verdict = await verifySlip({ data: { imageDataUrl: dataUrl, expectedAmount: finalAmount } });
      if (!verdict.ok) {
        statusDialog.error("ສະລິບບໍ່ຖືກຕ້ອງ", verdict.reason ?? "ບໍ່ສາມາດກວດສອບສະລິບໄດ້");
        return;
      }

      const ext = (slip.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const up = await supabase.storage.from("slips").upload(path, slip, { contentType: slip.type || "image/jpeg", upsert: false });
      if (up.error) throw new Error(up.error.message);

      const ins = await supabase.from("topups").insert({ user_id: user.id, amount: finalAmount, slip_url: path, method: "qr", status: "approved" });
      if (ins.error) throw new Error(ins.error.message);

      if (profile) {
        await supabase.from("profiles").update({ wallet_balance: (profile.wallet_balance ?? 0) + finalAmount }).eq("id", user.id);
      }

      clearQrSession();
      setSessionStart(null);
      setFile(null);
      setMethod("menu");
      reloadProfile();
      statusDialog.success("ສຳເລັດ", `ເຕີມເງີນສຳເລັດ +${formatKip(finalAmount)}`);
    } catch (e) {
      statusDialog.error("ລົ້ມເຫຼວ", (e as Error).message);
    } finally { setBusy(false); }
  };


  const submitCode = async () => {
    if (!code.trim()) return statusDialog.error("ລົ້ມເຫຼວ", "ກະລຸນາໃສ່ໂຄດ");
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("redeem_code", { _code: code.trim() });
      if (error) throw error;
      statusDialog.success("ສຳເລັດ", `ເຕີມເງີນສຳເລັດ +${formatKip((data as { amount: number }).amount)}`);
      setCode(""); setMethod("menu"); reloadProfile();
    } catch (e) { statusDialog.error("ລົ້ມເຫຼວ", (e as Error).message); }
    finally { setBusy(false); }
  };

  const submitCard = async () => {
    if (!/^\d{14}$/.test(card.trim())) return statusDialog.error("ລົ້ມເຫຼວ", "ບັດຕ້ອງເປັນຕົວເລກ 14 ຫຼັກ");
    setBusy(true);
    try {
      const { error } = await supabase.rpc("submit_card_topup", { _card: card.trim() });
      if (error) throw error;
      statusDialog.success("ສຳເລັດ", "ສົ່ງບັດໃຫ້ແອັດມິນແລ້ວ (ຮັບ 6,000₭ ຫຼັງອະນຸມັດ)");
      setCard(""); setMethod("menu");
    } catch (e) { statusDialog.error("ລົ້ມເຫຼວ", (e as Error).message); }
    finally { setBusy(false); }
  };

  const back = () => {
    if (method === "qr-pay") return; // locked until slip submitted or expired
    if (method === "menu") nav({ to: "/" });
    else setMethod("menu");
  };


  const titles: Record<Method, string> = {
    menu: "ເຕີມເງີນ",
    card: "ເຕີມດ້ວຍບັດ",
    code: "ເຕີມດ້ວຍໂຄດ",
    "qr-amount": "ເລືອກຈຳນວນເງີນ",
    "qr-pay": "ໂອນຜ່ານ QR",
  };

  return (
    <AppShell>
      <main className="max-w-md mx-auto px-4 space-y-4">
        <div className="flex items-center gap-2">
          {method !== "qr-pay" && (
            <button onClick={back} className="h-10 w-10 rounded-2xl bg-card shadow-sm flex items-center justify-center active:scale-95 transition">
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <h1 className="text-xl font-extrabold flex-1">{titles[method]}</h1>
        </div>

        {method === "menu" && (
          <>
            <div className="rounded-3xl bg-primary text-primary-foreground p-5 shadow-lg">
              <div className="text-xs opacity-80 flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" />ຍອດເງີນໃນກະເປົ໋າ</div>
              <div className="text-3xl font-extrabold mt-1">{formatKip(profile?.wallet_balance ?? 0)}</div>
            </div>
            <div className="text-sm font-semibold text-muted-foreground">ເລືອກຊ່ອງທາງເຕີມເງີນ</div>
            {cardOn && <MethodCard icon={<CreditCard className="h-6 w-6" />} title="ບັດເຕີມເງີນ" subtitle="ໜຶ່ງໃບ 10,000₭ • ຮັບ 6,000₭" badge="ຄ່າທຳນຽມ 40%" onClick={() => setMethod("card")} />}
            <MethodCard icon={<Ticket className="h-6 w-6" />} title="ໃຊ້ໂຄດເຕີມເງີນ" subtitle="ເງີນເຂົ້າກະເປົ໋າທັນທີ" badge="ທັນທີ" onClick={() => setMethod("code")} />
            {qrOn && <MethodCard icon={<QrCode className="h-6 w-6" />} title="ໂອນຜ່ານ QR Code" subtitle="ແນບສະລິບ ກວດສອບອັດຕະໂນມັດ" badge="Auto" onClick={() => setMethod("qr-amount")} />}
          </>
        )}

        {method === "card" && (
          <div className="rounded-3xl bg-card shadow-lg p-5 space-y-4">
            <div className="rounded-2xl bg-primary/10 border border-primary/25 p-4 text-xs space-y-1.5">
              <div className="font-bold text-primary text-sm">ຄ່າທຳນຽມບັດ 40%</div>
              <div>• ໜຶ່ງບັດ = 10,000 ກີບ</div>
              <div>• ຮັບຈິງເຂົ້າກະເປົ໋າ <b>6,000 ກີບ</b></div>
              <div>• ຫຼັງແອັດມິນອະນຸມັດ ເງີນຈະເຂົ້າທັນທີ</div>
            </div>
            <div className="space-y-1.5">
              <Label>ເລກບັດ 14 ຫຼັກ</Label>
              <div className="relative">
                <Input
                  inputMode="numeric"
                  maxLength={14}
                  className="h-14 rounded-2xl text-lg tracking-[0.15em] font-bold pr-11"
                  value={card}
                  onChange={(e) => setCard(e.target.value.replace(/\D/g, ""))}
                  placeholder="00000000000000"
                />
                {card.length === 14 && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-[color:var(--color-success)]/15 text-[color:var(--color-success)] flex items-center justify-center">
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">{card.length}/14 ຫຼັກ</div>
            </div>
            <Button className="w-full h-13 rounded-2xl text-base font-bold" disabled={busy || card.length !== 14} onClick={submitCard}>
              ເຕີມເງີນ
            </Button>
          </div>
        )}

        {method === "code" && (
          <div className="rounded-3xl bg-card shadow-lg p-5 space-y-4">
            <div className="space-y-1.5">
              <Label>ໂຄດເຕີມເງີນ</Label>
              <Input className="h-14 rounded-2xl text-lg font-bold tracking-wider" value={code} onChange={(e) => setCode(e.target.value)} placeholder="XXXX-XXXX-XXXX" />
            </div>
            <Button className="w-full h-13 rounded-2xl text-base font-bold" disabled={busy || !code.trim()} onClick={submitCode}>ໃຊ້ໂຄດ</Button>
          </div>
        )}

        {method === "qr-amount" && (
          <div className="rounded-3xl bg-card shadow-lg p-5 space-y-4">
            <Label>ເລືອກຈຳນວນເງີນ</Label>
            <div className="grid grid-cols-2 gap-2.5">
              {PRESETS.map((p) => {
                const active = amount === p && !custom;
                return (
                  <button
                    key={p}
                    onClick={() => { setAmount(p); setCustom(""); }}
                    className={`h-16 rounded-2xl border-2 flex flex-col items-center justify-center transition active:scale-95 ${active ? "border-primary bg-primary/10 text-primary" : "border-border bg-background"}`}
                  >
                    <span className="text-lg font-extrabold">{p.toLocaleString()}</span>
                    <span className="text-[11px] text-muted-foreground">ກີບ</span>
                  </button>
                );
              })}
            </div>
            <div className="space-y-1.5">
              <Label>ຫຼືປ້ອນເອງ (₭)</Label>
              <Input type="number" className="h-13 rounded-2xl font-bold" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="ຈຳນວນເງີນ" />
            </div>
            <Button className="w-full h-13 rounded-2xl text-base font-bold" disabled={finalAmount < 1000} onClick={startQrSession}>
              ສ້າງ QR Code ({formatKip(finalAmount)})
            </Button>
          </div>
        )}

        {method === "qr-pay" && (
          <div className="rounded-3xl bg-card shadow-lg overflow-hidden">
            <div className="bg-primary text-primary-foreground p-4 text-center space-y-1">
              <div className="inline-flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1 text-sm font-bold">
                <Clock className="h-4 w-4" /> {mm}:{ss}
              </div>
              <div className="text-xs opacity-85">ຈຳນວນທີ່ຕ້ອງໂອນ</div>
              <div className="text-3xl font-extrabold">{formatKip(finalAmount)}</div>
              <div className="text-xs opacity-85">ຜູ້ຮັບ: <b>{RECIPIENT_NAME}</b></div>
            </div>
            <div className="p-5 space-y-4">
              <div className="rounded-2xl border-2 border-dashed p-4 flex items-center justify-center bg-white">
                {qrUrl ? (
                  <img src={qrUrl} alt="QR ໂອນເງີນ" className="w-60 h-60 object-contain" />
                ) : (
                  <div className="w-60 h-60 flex items-center justify-center text-xs text-muted-foreground text-center p-4">
                    ແອັດມິນຍັງບໍ່ໄດ້ຕັ້ງ QR
                  </div>
                )}
              </div>
              <label className={`flex items-center gap-3 border-2 border-dashed rounded-2xl p-4 cursor-pointer transition ${busy ? "opacity-60" : "hover:bg-accent/50"}`}>
                <Upload className="h-5 w-5 text-primary shrink-0" />
                <span className="text-sm flex-1 truncate">{busy ? "ກຳລັງກວດສອບສະລິບ..." : file ? file.name : "ແນບຮູບສະລິບ (ກວດສອບອັດຕະໂນມັດ)"}</span>
                <input type="file" accept="image/*" className="hidden" disabled={busy} onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); if (f) submitSlip(f); }} />
              </label>
              <Button variant="ghost" className="w-full rounded-2xl text-destructive" onClick={cancelQrSession}>ຍົກເລີກ ແລະ ເລີ່ມໃໝ່</Button>
            </div>
          </div>
        )}
      </main>
    </AppShell>
  );
}

function MethodCard({ icon, title, subtitle, onClick, badge }: { icon: React.ReactNode; title: string; subtitle: string; onClick: () => void; badge?: string }) {
  return (
    <button onClick={onClick} className="w-full rounded-3xl bg-card shadow-md p-4 flex items-center gap-3 text-left active:scale-[.98] transition hover:shadow-lg">
      <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="font-bold">{title}</div>
        <div className="text-xs text-muted-foreground truncate">{subtitle}</div>
      </div>
      {badge && <span className="text-[10px] bg-primary/10 text-primary px-2 py-1 rounded-full font-bold shrink-0">{badge}</span>}
    </button>
  );
}
