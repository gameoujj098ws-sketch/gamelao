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
  const [method, setMethod] = useState<Method>("menu");
  const [amount, setAmount] = useState(10000);
  const [custom, setCustom] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [code, setCode] = useState("");
  const [card, setCard] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("site_settings").select("qr_url").eq("id", 1).maybeSingle().then(({ data }) => {
      setQrUrl((data as { qr_url: string | null } | null)?.qr_url ?? null);
    });
  }, []);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
  }, [loading, user, nav]);

  const finalAmount = custom ? parseInt(custom) || 0 : amount;

  const submitSlip = async () => {
    if (!user) return;
    if (!file) return statusDialog.error("ລົ້ມເຫຼວ", "ກະລຸນາແນບຮູບສະລິບ");
    if (finalAmount < 1000) return statusDialog.error("ລົ້ມເຫຼວ", "ຈຳນວນເງີນບໍ່ຖືກຕ້ອງ");
    setBusy(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const up = await supabase.storage.from("slips").upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
      if (up.error) throw new Error(up.error.message);
      const ins = await supabase.from("topups").insert({ user_id: user.id, amount: finalAmount, slip_url: path, method: "qr", status: "pending" });
      if (ins.error) throw new Error(ins.error.message);
      statusDialog.success("ສຳເລັດ", "ສົ່ງສະລິບໃຫ້ແອັດມິນແລ້ວ ລໍຖ້າອະນຸມັດ");
      setFile(null); setMethod("menu"); reloadProfile();
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
    if (method === "qr-pay") setMethod("qr-amount");
    else if (method === "menu") nav({ to: "/" });
    else setMethod("menu");
  };

  return (
    <div className="min-h-screen pb-8">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur border-b">
        <div className="max-w-md mx-auto flex items-center gap-2 p-3">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={back}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="font-bold text-lg flex-1">ເຕີມເງີນ</h1>
          {profile && (
            <div className="flex items-center gap-1.5 bg-primary/10 text-primary rounded-full px-3 py-1.5 text-sm font-bold">
              <Wallet className="h-4 w-4" />{formatKip(profile.wallet_balance)}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-4">
        {method === "menu" && (
          <>
            <div className="text-sm text-muted-foreground">ເລືອກຊ່ອງທາງເຕີມເງີນ</div>
            <MethodCard icon={<CreditCard className="h-6 w-6" />} title="ບັດເຕີມເງີນ (Auto)" subtitle="ຄ່າທຳນຽມ 40% • ຮັບ 6,000₭ ຕໍ່ໃບ" badge="40%" onClick={() => setMethod("card")} />
            <MethodCard icon={<Ticket className="h-6 w-6" />} title="ໃຊ້ໂຄດເຕີມເງີນ" subtitle="ເງີນເຂົ້າກະເປົ໋າທັນທີ" onClick={() => setMethod("code")} />
            <MethodCard icon={<QrCode className="h-6 w-6" />} title="ໂອນຜ່ານ QR Code" subtitle="ແນບສະລິບ ລໍຖ້າແອັດມິນອະນຸມັດ" onClick={() => setMethod("qr-amount")} />
          </>
        )}

        {method === "card" && (
          <div className="glass rounded-3xl p-5 space-y-4">
            <div className="rounded-2xl bg-primary/10 border border-primary/30 p-3 text-xs space-y-1">
              <div className="font-semibold">ບັດເຕີມເງີນ (14 ຫຼັກ)</div>
              <div>• ໜຶ່ງບັດ = 10,000 ກີບ</div>
              <div>• ຄ່າທຳນຽມ 40% → ຮັບຈິງ <b>6,000 ກີບ</b></div>
            </div>
            <div>
              <Label>ເລກບັດ (14 ຫຼັກ)</Label>
              <Input inputMode="numeric" maxLength={14} value={card} onChange={(e) => setCard(e.target.value.replace(/\D/g, ""))} placeholder="12345678901234" />
            </div>
            <Button className="w-full rounded-2xl" disabled={busy || card.length !== 14} onClick={submitCard}>ສົ່ງບັດ</Button>
          </div>
        )}

        {method === "code" && (
          <div className="glass rounded-3xl p-5 space-y-4">
            <div>
              <Label>ໂຄດເຕີມເງີນ</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="XXXX-XXXX-XXXX" />
            </div>
            <Button className="w-full rounded-2xl" disabled={busy} onClick={submitCode}>ໃຊ້ໂຄດ</Button>
          </div>
        )}

        {method === "qr-amount" && (
          <div className="glass rounded-3xl p-5 space-y-4">
            <Label>ເລືອກຈຳນວນເງີນ</Label>
            <div className="grid grid-cols-3 gap-2">
              {PRESETS.map((p) => (
                <Button key={p} variant={amount === p && !custom ? "default" : "outline"} className="rounded-2xl" onClick={() => { setAmount(p); setCustom(""); }}>
                  {p.toLocaleString()}
                </Button>
              ))}
            </div>
            <div>
              <Label>ຫຼືປ້ອນເອງ (₭)</Label>
              <Input type="number" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="ຈຳນວນ" />
            </div>
            <Button className="w-full rounded-2xl" disabled={finalAmount < 1000} onClick={() => setMethod("qr-pay")}>
              ສ້າງ QR Code ({formatKip(finalAmount)})
            </Button>
          </div>
        )}

        {method === "qr-pay" && (
          <div className="glass rounded-3xl p-5 space-y-4">
            <div className="text-center">
              <div className="text-sm text-muted-foreground">ຈຳນວນທີ່ຕ້ອງໂອນ</div>
              <div className="text-3xl font-extrabold text-primary">{formatKip(finalAmount)}</div>
            </div>
            <div className="rounded-2xl border-2 bg-white p-4 flex items-center justify-center">
              {qrUrl ? (
                <img src={qrUrl} alt="QR" className="w-64 h-64 object-contain" />
              ) : (
                <div className="w-64 h-64 flex items-center justify-center text-xs text-muted-foreground border-2 border-dashed rounded-lg text-center p-4">
                  ແອັດມິນຍັງບໍ່ໄດ້ຕັ້ງ QR
                </div>
              )}
            </div>
            <label className="flex items-center gap-2 border-2 border-dashed rounded-2xl p-4 cursor-pointer hover:bg-accent/50">
              <Upload className="h-5 w-5 text-primary" />
              <span className="text-sm flex-1 truncate">{file ? file.name : "ແນບຮູບສະລິບການໂອນ"}</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            <Button className="w-full rounded-2xl" disabled={busy || !file} onClick={submitSlip}>ສົ່ງໃຫ້ແອັດມິນກວດສອບ</Button>
          </div>
        )}
      </main>
      <StatusDialog />
    </div>
  );
}

function MethodCard({ icon, title, subtitle, onClick, badge }: { icon: React.ReactNode; title: string; subtitle: string; onClick: () => void; badge?: string }) {
  return (
    <button onClick={onClick} className="w-full glass rounded-3xl p-4 flex items-center gap-3 text-left active:scale-[.98] transition">
      <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="font-bold flex items-center gap-2">
          {title}
          {badge && <span className="text-[10px] bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded-full">{badge}</span>}
        </div>
        <div className="text-xs text-muted-foreground truncate">{subtitle}</div>
      </div>
    </button>
  );
}
