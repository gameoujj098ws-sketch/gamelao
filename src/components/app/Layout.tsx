import { useState } from "react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Wallet, User, Clock, Wallet2, LogOut, Shield, Headphones, MessageCircle, Home,
  Gamepad2, CreditCard, Plus, History, LayoutGrid,
} from "lucide-react";
import { formatKip } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/hooks/useSession";

export function Header({
  siteName, logoUrl, profile, unreadMsgs, isAdmin,
  onLogin, onProfile, onHistory, onTopup, onAdmin, onMessages, helpLink,
}: {
  siteName: string; logoUrl?: string | null; profile: Profile | null; unreadMsgs: number; isAdmin: boolean;
  onLogin: () => void; onProfile: () => void; onHistory: () => void; onTopup: () => void; onAdmin: () => void; onMessages: () => void;
  helpLink?: string | null;
}) {
  const [open, setOpen] = useState(false);

  const MenuItem = ({ icon, label, onClick, badge = 0, danger = false }: { icon: React.ReactNode; label: string; onClick: () => void; badge?: number; danger?: boolean }) => (
    <button
      onClick={() => { setOpen(false); onClick(); }}
      className={`w-full flex items-center gap-3.5 px-4 py-3 text-left transition active:scale-[.99] hover:bg-accent/50 ${danger ? "text-destructive" : ""}`}
    >
      <span className={`shrink-0 ${danger ? "text-destructive" : "text-primary"}`}>{icon}</span>
      <span className="flex-1 text-[17px] font-semibold">{label}</span>
      {badge > 0 && (
        <span className="bg-destructive text-destructive-foreground text-xs rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center font-bold">{badge}</span>
      )}
    </button>
  );


  return (
    <div className="fixed top-2 inset-x-2 z-40">
      <header className="glass rounded-[26px] h-[74px] px-3 flex items-center gap-2 shadow-lg">
        <div className="flex items-center min-w-0 flex-1">
          {logoUrl ? (
            <img src={logoUrl} alt={siteName} className="h-14 w-auto max-w-[140px] object-contain" />
          ) : (
            <div className="h-14 w-14 rounded-2xl bg-primary" />
          )}
        </div>

        {profile ? (
          <div className="flex items-center gap-2 bg-card rounded-[20px] pl-1.5 pr-3.5 py-1.5 shadow-sm">
            <span className="h-11 w-11 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shrink-0">
              <Wallet className="h-6 w-6" />
            </span>
            <span className="font-extrabold text-lg whitespace-nowrap">{formatKip(profile.wallet_balance)}</span>
          </div>
        ) : (
          <Button className="rounded-2xl h-11 px-5 font-bold" onClick={onLogin}>ເຂົ້າສູ່ລະບົບ</Button>
        )}

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button className="relative h-12 w-12 shrink-0 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-md active:scale-95 transition">
              <LayoutGrid className="h-6 w-6" />
              {unreadMsgs > 0 && <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-destructive ring-2 ring-card animate-pulse" />}
            </button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="w-[300px] max-w-[86vw] p-0 flex flex-col bg-card border rounded-3xl shadow-2xl overflow-hidden top-[86px] right-2 bottom-auto h-auto max-h-[calc(100vh-110px)] data-[state=open]:animate-in data-[state=closed]:animate-out"
          >
            <SheetTitle className="px-4 pt-4 pb-2 text-[15px] font-bold text-muted-foreground">{siteName}</SheetTitle>
            {profile ? (
              <div className="py-1 flex-1 overflow-y-auto">
                <MenuItem icon={<Plus className="h-5 w-5" />} label="ເຕີມເງີນ" onClick={onTopup} />
                <MenuItem icon={<MessageCircle className="h-5 w-5" />} label="ຂໍ້ຄວາມ" onClick={onMessages} badge={unreadMsgs} />
                <MenuItem icon={<User className="h-5 w-5" />} label="ໂປຣໄຟລ໌" onClick={onProfile} />
                <MenuItem icon={<Wallet2 className="h-5 w-5" />} label="ປະຫວັດເຕີມເງີນ" onClick={onHistory} />
                <MenuItem icon={<History className="h-5 w-5" />} label="ປະຫວັດຊື້ສິນຄ້າ" onClick={onHistory} />
                {helpLink && <MenuItem icon={<Headphones className="h-5 w-5" />} label="ຕິດຕໍ່ພວກເຮົາ" onClick={() => window.open(helpLink, "_blank")} />}
                {isAdmin && (
                  <>
                    <div className="my-1 border-t border-border" />
                    <MenuItem icon={<Shield className="h-5 w-5" />} label="ໜ້າແອັດມິນ" onClick={onAdmin} />
                  </>
                )}
                <div className="my-1 border-t border-border" />
                <MenuItem icon={<LogOut className="h-5 w-5" />} label="ອອກຈາກລະບົບ" danger onClick={async () => { await supabase.auth.signOut(); }} />
              </div>
            ) : (
              <div className="p-4 space-y-2">
                <Button className="w-full rounded-2xl h-11" onClick={() => { setOpen(false); onLogin(); }}>ເຂົ້າສູ່ລະບົບ / ສະໝັກ</Button>
                {helpLink && <MenuItem icon={<Headphones className="h-5 w-5" />} label="ຕິດຕໍ່ພວກເຮົາ" onClick={() => window.open(helpLink, "_blank")} />}
              </div>
            )}
          </SheetContent>

        </Sheet>
      </header>
    </div>
  );
}

export function BottomNav({ onTopup, onProducts, onHistory, onHelp }: { onTopup: () => void; onProducts: () => void; onHistory: () => void; onHelp: () => void }) {
  return (
    <nav className="fixed bottom-3 inset-x-3 z-40 glass rounded-3xl h-16 grid grid-cols-5 items-center px-2">
      <NavBtn icon={<CreditCard className="h-5 w-5" />} label="ເຕີມເງີນ" onClick={onTopup} />
      <NavBtn icon={<Gamepad2 className="h-5 w-5" />} label="ສິນຄ້າ" onClick={onProducts} />
      <NavBtn icon={<Home className="h-6 w-6" />} label="ໜ້າຫຼັກ" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} primary />
      <NavBtn icon={<Clock className="h-5 w-5" />} label="ປະຫວັດ" onClick={onHistory} />
      <NavBtn icon={<Headphones className="h-5 w-5" />} label="ຊ່ວຍເຫຼືອ" onClick={onHelp} />
    </nav>
  );
}
function NavBtn({ icon, label, onClick, primary = false }: { icon: React.ReactNode; label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-0.5 text-[11px] text-muted-foreground">
      <div className={primary ? "bg-primary text-primary-foreground rounded-full p-3.5 -mt-8 shadow-xl ring-4 ring-background" : ""}>{icon}</div>
      <span className={primary ? "text-primary font-semibold" : ""}>{label}</span>
    </button>
  );
}
