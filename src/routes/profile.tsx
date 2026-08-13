import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { formatKip } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { statusDialog } from "@/components/app/StatusDialog";
import { AppShell } from "@/components/app/AppShell";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "ໂປຣໄຟລ໌ຂອງທ່ານ | Game Lao" },
      { name: "description", content: "ແກ້ໄຂຊື່ຜູ້ໃຊ້, ປ່ຽນລະຫັດຜ່ານ ແລະ ເບິ່ງຍອດເງີນໃນກະເປົາຂອງທ່ານ" },
      { property: "og:title", content: "ໂປຣໄຟລ໌ຂອງທ່ານ | Game Lao" },
      { property: "og:description", content: "ແກ້ໄຂຂໍ້ມູນບັນຊີ ແລະ ເບິ່ງຍອດເງີນຂອງທ່ານ" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const { user, profile, loading, reloadProfile } = useSession();
  const [username, setUsername] = useState("");
  const [pw, setPw] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (profile) setUsername(profile.username);
  }, [profile]);

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      if (username !== profile.username) {
        const { error } = await supabase.from("profiles").update({ username }).eq("id", profile.id);
        if (error) throw error;
      }
      if (pw) {
        const { error } = await supabase.auth.updateUser({ password: pw });
        if (error) throw error;
      }
      setPw("");
      reloadProfile();
      statusDialog.success("ສຳເລັດ", "ບັນທຶກໂປຣໄຟລ໌ແລ້ວ");
    } catch (e: unknown) {
      statusDialog.error("ລົ້ມເຫຼວ", (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-md mx-auto px-3 flex items-center gap-2">
        <button onClick={() => navigate({ to: "/" })} className="h-10 w-10 rounded-2xl bg-card shadow-sm flex items-center justify-center active:scale-95 transition">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-extrabold">ໂປຣໄຟລ໌</h1>
      </div>

      <main className="max-w-md mx-auto p-3 space-y-4">
        {profile && (
          <div className="rounded-3xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground p-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 rounded-full bg-white/20 flex items-center justify-center text-xl font-bold">
                {profile.username.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold truncate">{profile.username}</div>
                <div className="text-xs opacity-80 truncate">{profile.email}</div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 bg-white/15 rounded-2xl px-3 py-2">
              <Wallet className="h-4 w-4" />
              <span className="text-xs opacity-80">ຍອດເງີນ</span>
              <span className="ml-auto font-bold">{formatKip(profile.wallet_balance)}</span>
            </div>
          </div>
        )}

        <div className="glass rounded-3xl p-4 space-y-3">
          <div><Label>ອີເມວ</Label><Input value={profile?.email ?? ""} disabled /></div>
          <div><Label>ຊື່ຜູ້ໃຊ້</Label><Input value={username} onChange={(e) => setUsername(e.target.value)} /></div>
          <div><Label>ລະຫັດຜ່ານໃໝ່ (ຖ້າຢາກປ່ຽນ)</Label><Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
          <Button className="w-full rounded-2xl h-11" disabled={saving || !profile} onClick={save}>ບັນທຶກ</Button>
        </div>
      </main>
    </AppShell>
  );
}
