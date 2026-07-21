import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, Wallet, User, Clock, Wallet2, LogOut, Shield, HelpCircle, MessageSquare, Home, ShoppingBag, ChevronRight } from "lucide-react";
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

  const MenuItem = ({ icon, label, onClick, badge = 0 }: { icon: React.ReactNode; label: string; onClick: () => void; badge?: number }) => (
    <button
      onClick={() => { setOpen(false); onClick(); }}
      className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-accent text-left transition"
    >
      <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">{icon}</div>
      <span className="flex-1 font-medium text-sm">{label}</span>
      {badge > 0 && (
        <span className="bg-destructive text-destructive-foreground text-xs rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center font-bold">{badge}</span>
      )}
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );

  return (
    <header className="fixed top-3 inset-x-3 z-40 glass rounded-3xl h-14 px-3 flex items-center gap-2 shadow-lg">
      <div className="flex items-center gap-2 min-w-0 shrink-0">
        {logoUrl ? <img src={logoUrl} alt="" className="h-10 w-10 rounded-xl object-cover" /> : <div className="h-10 w-10 rounded-xl bg-primary" />}
      </div>
      <div className="font-bold truncate flex-1 text-sm">{siteName}</div>
      {profile ? (
        <div className="flex items-center gap-1.5 bg-white/70 dark:bg-white/10 rounded-2xl px-3 py-1.5 text-sm font-bold shadow-inner">
          <Wallet className="h-4 w-4 text-primary" />
          <span>{formatKip(profile.wallet_balance)}</span>
        </div>
      ) : (
        <Button size="sm" variant="secondary" className="rounded-2xl" onClick={onLogin}>ເຂົ້າສູ່ລະບົບ</Button>
      )}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button size="icon" variant="ghost" className="relative rounded-2xl bg-white/50 dark:bg-white/10">
            <Menu className="h-5 w-5" />
            {unreadMsgs > 0 && <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" />}
          </Button>
        </SheetTrigger>
        <SheetContent className="w-[300px] p-0 flex flex-col">
          <SheetHeader className="p-4 pb-2">
            <SheetTitle>ເມນູ</SheetTitle>
          </SheetHeader>
          {profile ? (
            <>
              <div className="px-4 pb-3">
                <div className="rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground p-4 shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center text-lg font-bold">
                      {profile.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold truncate">{profile.username}</div>
                      <div className="text-xs opacity-80 truncate">{profile.email}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 bg-white/15 rounded-xl px-3 py-2">
                    <Wallet className="h-4 w-4" />
                    <span className="text-xs opacity-80">ຍອດເງີນ</span>
                    <span className="ml-auto font-bold">{formatKip(profile.wallet_balance)}</span>
                  </div>
                </div>
              </div>
              <div className="px-3 space-y-0.5 flex-1 overflow-y-auto">
                <MenuItem icon={<MessageSquare className="h-4 w-4" />} label="ຂໍ້ຄວາມ" onClick={onMessages} badge={unreadMsgs} />
                <MenuItem icon={<User className="h-4 w-4" />} label="ໂປຣໄຟລ໌" onClick={onProfile} />
                <MenuItem icon={<Clock className="h-4 w-4" />} label="ປະຫວັດຄຳສັ່ງຊື້" onClick={onHistory} />
                <MenuItem icon={<Wallet2 className="h-4 w-4" />} label="ເຕີມເງີນ" onClick={onTopup} />
                {isAdmin && <MenuItem icon={<Shield className="h-4 w-4" />} label="ຈັດການແອັດມິນ" onClick={onAdmin} />}
                {helpLink && <MenuItem icon={<HelpCircle className="h-4 w-4" />} label="ຊ່ວຍເຫຼືອ" onClick={() => window.open(helpLink, "_blank")} />}
              </div>
              <div className="p-3 border-t">
                <Button
                  variant="destructive"
                  className="w-full rounded-2xl h-11 font-semibold"
                  onClick={async () => { setOpen(false); await supabase.auth.signOut(); }}
                >
                  <LogOut className="h-4 w-4 mr-2" />ອອກຈາກລະບົບ
                </Button>
              </div>
            </>
          ) : (
            <div className="p-4 space-y-2">
              <Button className="w-full rounded-2xl h-11" onClick={() => { setOpen(false); onLogin(); }}>ເຂົ້າສູ່ລະບົບ / ສະໝັກ</Button>
              {helpLink && <MenuItem icon={<HelpCircle className="h-4 w-4" />} label="ຊ່ວຍເຫຼືອ" onClick={() => window.open(helpLink, "_blank")} />}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </header>
  );
}

export function BottomNav({ onTopup, onProducts, onHistory, onHelp }: { onTopup: () => void; onProducts: () => void; onHistory: () => void; onHelp: () => void }) {
  return (
    <nav className="fixed bottom-3 inset-x-3 z-40 glass rounded-3xl h-16 grid grid-cols-5 items-center px-2 shadow-lg">
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
    <button onClick={onClick} className={`flex flex-col items-center gap-0.5 text-xs ${primary ? "text-primary-foreground font-bold" : "text-muted-foreground"}`}>
      <div className={primary ? "bg-primary text-primary-foreground rounded-full p-3 -mt-8 shadow-xl ring-4 ring-background" : ""}>{icon}</div>
      <span className={primary ? "text-primary font-semibold" : ""}>{label}</span>
    </button>
  );
}
