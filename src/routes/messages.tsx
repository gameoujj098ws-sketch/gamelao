import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { AppShell } from "@/components/app/AppShell";

export const Route = createFileRoute("/messages")({
  head: () => ({
    meta: [
      { title: "ຂໍ້ຄວາມຈາກແອັດມິນ | Game Lao" },
      { name: "description", content: "ອ່ານຂໍ້ຄວາມແຈ້ງເຕືອນ ແລະ ການຕິດຕໍ່ຈາກແອັດມິນຮ້ານ" },
      { property: "og:title", content: "ຂໍ້ຄວາມຈາກແອັດມິນ | Game Lao" },
      { property: "og:description", content: "ອ່ານຂໍ້ຄວາມແຈ້ງເຕືອນຈາກແອັດມິນຮ້ານ" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MessagesPage,
});

function MessagesPage() {
  const navigate = useNavigate();
  const { user, loading } = useSession();
  const [msgs, setMsgs] = useState<{ id: string; content: string; from_admin: boolean; created_at: string }[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase.from("messages").select("*").eq("user_id", user.id).order("created_at", { ascending: true });
      setMsgs(data ?? []);
      if (data?.some((m) => m.from_admin && !m.read)) {
        await supabase.from("messages").update({ read: true }).eq("user_id", user.id).eq("from_admin", true).eq("read", false);
      }
    };
    load();
  }, [user]);

  return (
    <AppShell>
      <div className="max-w-md mx-auto px-3 flex items-center gap-2">
        <button onClick={() => navigate({ to: "/" })} className="h-10 w-10 rounded-2xl bg-card shadow-sm flex items-center justify-center active:scale-95 transition">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-extrabold">ຂໍ້ຄວາມຈາກແອັດມິນ</h1>
      </div>

      <main className="max-w-md mx-auto p-3 space-y-2">
        {msgs.length === 0 && <div className="text-center text-sm text-muted-foreground py-8">ຍັງບໍ່ມີຂໍ້ຄວາມ</div>}
        {msgs.map((m) => (
          <div key={m.id} className={`rounded-2xl p-3 text-sm ${m.from_admin ? "glass" : "bg-primary text-primary-foreground ml-8"}`}>
            <div className="whitespace-pre-line">{m.content}</div>
            <div className="text-xs opacity-70 mt-1">{new Date(m.created_at).toLocaleString()}</div>
          </div>
        ))}
      </main>
    </AppShell>
  );
}
