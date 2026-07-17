import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, Wallet, User, Clock, Wallet2, LogOut, Shield, HelpCircle, MessageSquare, Home, ShoppingBag } from "lucide-react";
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
  const item = (icon: React.ReactNode, label: string, onClick: () => void, danger = false, badge = 0) => (
    <button onClick={() => { setOpen(false); onClick(); }} className={`w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent text-left ${danger ? "text-destructive" : ""}`}>
      {icon}<span className="flex-1">{label}</span>
      {badge > 0 && <span className="bg-destructive text-destructive-foreground text-xs rounded-full min-w-5 h-5 px-1 flex items-center justify-center">{badge}</span>}
    </button>
  );

  return (
    <header className="sticky top-0 z-40 bg-card/95 backdrop-blur border-b h-14 px-3 flex items-center gap-2">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {logoUrl ? <img src={logoUrl} alt="" className="h-8 w-8 rounded object-cover" /> : <div className="h-8 w-8 rounded bg-primary" />}
        <div className="font-bold truncate">{siteName}</div>
      </div>
      {profile ? (
        <div className="flex items-center gap-1 bg-accent rounded-full px-3 py-1.5 text-sm font-semibold">
          <Wallet className="h-4 w-4 text-primary" />
          {formatKip(profile.wallet_balance)}
        </div>
      ) : (
        <Button size="sm" variant="secondary" onClick={onLogin}>ເຂົ້າສູ່ລະບົບ</Button>
      )}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button size="icon" variant="ghost" className="relative">
            <Menu className="h-5 w-5" />
            {unreadMsgs > 0 && <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" />}
          </Button>
        </SheetTrigger>
        <SheetContent className="w-[280px] p-3">
          <SheetHeader><SheetTitle>ເມນູ</SheetTitle></SheetHeader>
          {profile ? (
            <div className="mt-3 space-y-1">
              <div className="p-3 rounded-lg bg-accent">
                <div className="font-semibold">{profile.username}</div>
                <div className="text-xs text-muted-foreground">{profile.email}</div>
                <div className="mt-1 text-sm">{formatKip(profile.wallet_balance)}</div>
              </div>
              {item(<MessageSquare className="h-4 w-4" />, "ຂໍ້ຄວາມ", onMessages, false, unreadMsgs)}
              {item(<User className="h-4 w-4" />, "ໂປຣໄຟລ໌", onProfile)}
              {item(<Clock className="h-4 w-4" />, "ປະຫວັດ", onHistory)}
              {item(<Wallet2 className="h-4 w-4" />, "ເຕີມເງີນ", onTopup)}
              {isAdmin && item(<Shield className="h-4 w-4" />, "ຈັດການແອັດມິນ", onAdmin)}
              {helpLink && item(<HelpCircle className="h-4 w-4" />, "ຊ່ວຍເຫຼືອ", () => window.open(helpLink, "_blank"))}
              {item(<LogOut className="h-4 w-4" />, "ອອກຈາກລະບົບ", async () => { await supabase.auth.signOut(); }, true)}
            </div>
          ) : (
            <div className="mt-3 space-y-1">
              <Button className="w-full" onClick={() => { setOpen(false); onLogin(); }}>ເຂົ້າສູ່ລະບົບ / ສະໝັກ</Button>
              {helpLink && item(<HelpCircle className="h-4 w-4" />, "ຊ່ວຍເຫຼືອ", () => window.open(helpLink, "_blank"))}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </header>
  );
}

export function BottomNav({ onTopup, onProducts, onHistory, onHelp }: { onTopup: () => void; onProducts: () => void; onHistory: () => void; onHelp: () => void }) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur border-t h-16 grid grid-cols-5 items-center px-2">
      <NavBtn icon={<Wallet2 className="h-5 w-5" />} label="ເຕີມເງີນ" onClick={onTopup} />
      <NavBtn icon={<ShoppingBag className="h-5 w-5" />} label="ສິນຄ້າ" onClick={onProducts} />
      <NavBtn icon={<Home className="h-6 w-6" />} label="ໜ້າຫຼັກ" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} primary />
      <NavBtn icon={<Clock className="h-5 w-5" />} label="ປະຫວັດ" onClick={onHistory} />
      <NavBtn icon={<HelpCircle className="h-5 w-5" />} label="ຊ່ວຍເຫຼືອ" onClick={onHelp} />
    </nav>
  );
}
function NavBtn({ icon, label, onClick, primary = false }: { icon: React.ReactNode; label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-0.5 text-xs ${primary ? "text-primary font-bold" : "text-muted-foreground"}`}>
      <div className={primary ? "bg-primary text-primary-foreground rounded-full p-2 -mt-6 shadow-lg" : ""}>{icon}</div>
      <span>{label}</span>
    </button>
  );
}
