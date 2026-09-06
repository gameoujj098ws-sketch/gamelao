import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { statusDialog } from "./StatusDialog";
import { formatKip } from "@/lib/format";
import { Gift, Loader2 } from "lucide-react";

type Prize = { id: string; label: string; amount: number; weight: number; sort: number };

/** Mini-game wheel shown under the services section. Hidden when admin disables it. */
export function SpinWheel({ onSpun, onNeedLogin, canSpin }: { onSpun: () => void; onNeedLogin: () => void; canSpin: boolean }) {
  const [enabled, setEnabled] = useState(false);
  const [cost, setCost] = useState(0);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [busy, setBusy] = useState(false);
  const [angle, setAngle] = useState(0);
  const spinRef = useRef(0);

  useEffect(() => {
    const load = async () => {
      const [{ data: s }, { data: p }] = await Promise.all([
        supabase.from("site_settings").select("spin_enabled,spin_cost").eq("id", 1).maybeSingle(),
        supabase.from("spin_prizes").select("*").order("sort"),
      ]);
      const st = s as { spin_enabled: boolean; spin_cost: number } | null;
      setEnabled(!!st?.spin_enabled);
      setCost(Number(st?.spin_cost ?? 0));
      setPrizes((p as Prize[]) ?? []);
    };
    load();
    const ch = supabase
      .channel("spin-config")
      .on("postgres_changes", { event: "*", schema: "public", table: "site_settings" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "spin_prizes" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  if (!enabled || prizes.length === 0) return null;

  const slice = 360 / prizes.length;

  const spin = async () => {
    if (!canSpin) return onNeedLogin();
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("spin_wheel");
      if (error) throw error;
      const res = data as { prize_id: string; label: string; amount: number; cost: number };
      const idx = Math.max(0, prizes.findIndex((p) => p.id === res.prize_id));
      spinRef.current += 6;
      const target = spinRef.current * 360 + (360 - (idx * slice + slice / 2));
      setAngle(target);
      await new Promise((r) => setTimeout(r, 3200));
      onSpun();
      statusDialog.success(
        res.amount > 0 ? "ຍິນດີດ້ວຍ!" : "ເສຍດາຍ",
        res.amount > 0 ? `ທ່ານໄດ້ຮັບ ${res.label} (+${formatKip(res.amount)})` : `ທ່ານໄດ້ ${res.label}`,
      );
    } catch (e) {
      const msg = (e as Error).message;
      const map: Record<string, string> = {
        insufficient_balance: "ຍອດເງີນບໍ່ພຽງພໍ",
        minigame_disabled: "ມິນິເກມປິດຢູ່",
        user_banned: "ບັນຊີຂອງທ່ານຖືກແບນ",
        not_authenticated: "ກະລຸນາເຂົ້າສູ່ລະບົບ",
        no_prizes: "ຍັງບໍ່ໄດ້ຕັ້ງລາງວັນ",
      };
      statusDialog.error("ລົ້ມເຫຼວ", map[msg] || msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card-soft rounded-3xl p-4 space-y-4 rise-in">
      <div className="flex items-center gap-2">
        <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center float-soft">
          <Gift className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="font-extrabold">ວົງລໍ້ໂຊກດີ</div>
          <div className="text-xs text-muted-foreground">ໝຸນ 1 ຄັ້ງ {formatKip(cost)}</div>
        </div>
      </div>

      <div className="relative mx-auto w-[240px] h-[240px]">
        <div className="absolute left-1/2 -translate-x-1/2 -top-1 z-10 h-0 w-0 border-x-8 border-x-transparent border-t-[14px] border-t-primary" />
        <div
          className="h-full w-full rounded-full border-4 border-primary/30 shadow-inner transition-transform duration-[3000ms] ease-[cubic-bezier(.15,.9,.15,1)]"
          style={{
            transform: `rotate(${angle}deg)`,
            background: `conic-gradient(${prizes
              .map((_, i) => {
                const c = i % 2 === 0 ? "color-mix(in oklab, var(--color-primary) 75%, white)" : "color-mix(in oklab, var(--color-primary) 25%, white)";
                return `${c} ${i * slice}deg ${(i + 1) * slice}deg`;
              })
              .join(", ")})`,
          }}
        >
          {prizes.map((p, i) => (
            <div
              key={p.id}
              className="absolute inset-0 flex justify-center"
              style={{ transform: `rotate(${i * slice + slice / 2}deg)` }}
            >
              <span className="mt-3 text-[11px] font-bold text-white drop-shadow max-w-[70px] truncate">{p.label}</span>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={spin}
        disabled={busy}
        className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2 active:scale-[.98] transition disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Gift className="h-5 w-5" />}
        {busy ? "ກຳລັງໝຸນ..." : `ໝຸນວົງລໍ້ (${formatKip(cost)})`}
      </button>
    </div>
  );
}
