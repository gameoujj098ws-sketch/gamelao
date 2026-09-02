import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { Ban, LogOut } from "lucide-react";

/** Full-screen blocking overlay shown to banned accounts. Nothing else is clickable. */
export function BanGate() {
  const { profile } = useSession();
  if (!profile?.banned) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-3xl bg-card shadow-2xl border border-destructive/30 p-6 text-center space-y-4 animate-in fade-in zoom-in-95">
        <div className="mx-auto h-20 w-20 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
          <Ban className="h-10 w-10" strokeWidth={2.5} />
        </div>
        <div>
          <div className="text-2xl font-extrabold text-destructive">ບັນຊີຂອງທ່ານຖືກແບນ</div>
          <div className="text-sm text-muted-foreground mt-1">ທ່ານບໍ່ສາມາດໃຊ້ງານເວັບໄດ້ອີກ</div>
        </div>
        <div className="rounded-2xl bg-muted p-3 text-left text-sm space-y-1">
          <div><span className="text-muted-foreground">ຊື່ຜູ້ໃຊ້: </span><b>{profile.username}</b></div>
          <div className="break-all"><span className="text-muted-foreground">ອີເມວ: </span><b>{profile.email}</b></div>
          <div><span className="text-muted-foreground">ເຫດຜົນ: </span><b>{profile.ban_reason || "ບໍ່ໄດ້ລະບຸ"}</b></div>
        </div>
        <button
          onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }}
          className="w-full h-12 rounded-2xl bg-destructive text-destructive-foreground font-bold flex items-center justify-center gap-2 active:scale-[.98] transition"
        >
          <LogOut className="h-5 w-5" /> ອອກຈາກລະບົບ
        </button>
      </div>
    </div>
  );
}
