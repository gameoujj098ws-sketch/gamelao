import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { formatKip } from "@/lib/format";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppShell } from "@/components/app/AppShell";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "ປະຫວັດຄຳສັ່ງຊື້ | Game Lao" },
      { name: "description", content: "ເບິ່ງປະຫວັດການຊື້ສິນຄ້າ, ສິນຄ້າບໍລິການ ແລະ ການເຕີມເງີນຂອງທ່ານ" },
      { property: "og:title", content: "ປະຫວັດຄຳສັ່ງຊື້ | Game Lao" },
      { property: "og:description", content: "ເບິ່ງປະຫວັດການຊື້ສິນຄ້າ ແລະ ການເຕີມເງີນຂອງທ່ານ" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HistoryPage,
});

const statusText: Record<string, string> = {
  pending: "ລໍຖ້າ", approved: "ອະນຸມັດ", rejected: "ປະຕິເສດ", completed: "ສຳເລັດ", failed: "ບໍ່ສຳເລັດ",
};
const statusColor = (s: string) => ({
  pending: "text-yellow-600", approved: "text-green-600", completed: "text-green-600",
  rejected: "text-red-600", failed: "text-red-600",
} as Record<string, string>)[s] || "";

function HistoryPage() {
  const navigate = useNavigate();
  const { user, loading } = useSession();
  const [orders, setOrders] = useState<{ id: string; product_name: string; price: number; game_data: string | null; created_at: string }[]>([]);
  const [services, setServices] = useState<{ id: string; product_name: string; price: number; status: string; created_at: string }[]>([]);
  const [topups, setTopups] = useState<{ id: string; amount: number; status: string; created_at: string; method: string }[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).then(({ data }) => setOrders(data ?? []));
    supabase.from("service_orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).then(({ data }) => setServices(data ?? []));
    supabase.from("topups").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).then(({ data }) => setTopups(data ?? []));
  }, [user]);

  return (
    <AppShell>
      <div className="max-w-md mx-auto px-3 flex items-center gap-2">
        <button onClick={() => navigate({ to: "/" })} className="h-10 w-10 rounded-2xl bg-card shadow-sm flex items-center justify-center active:scale-95 transition">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-extrabold">ປະຫວັດ</h1>
      </div>

      <main className="max-w-md mx-auto p-3">
        <Tabs defaultValue="purchases">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="purchases">ຊື້ສິນຄ້າ</TabsTrigger>
            <TabsTrigger value="services">ບໍລິການ</TabsTrigger>
            <TabsTrigger value="topups">ເຕີມເງີນ</TabsTrigger>
          </TabsList>
          <TabsContent value="purchases" className="space-y-2 pt-3">
            {orders.length === 0 && <div className="text-center text-sm text-muted-foreground py-6">ຍັງບໍ່ມີປະຫວັດ</div>}
            {orders.map((o) => (
              <div key={o.id} className="glass rounded-2xl p-3 text-sm">
                <div className="font-semibold">{o.product_name}</div>
                <div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</div>
                <div className="flex justify-between mt-1"><span>ລາຄາ</span><span>{formatKip(o.price)}</span></div>
                {o.game_data && <div className="mt-1 p-2 bg-muted rounded text-xs break-all">{o.game_data}</div>}
              </div>
            ))}
          </TabsContent>
          <TabsContent value="services" className="space-y-2 pt-3">
            {services.length === 0 && <div className="text-center text-sm text-muted-foreground py-6">ຍັງບໍ່ມີປະຫວັດ</div>}
            {services.map((o) => (
              <div key={o.id} className="glass rounded-2xl p-3 text-sm">
                <div className="font-semibold">{o.product_name}</div>
                <div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</div>
                <div className="flex justify-between mt-1"><span>ລາຄາ</span><span>{formatKip(o.price)}</span></div>
                <div className={`text-sm font-semibold mt-1 ${statusColor(o.status)}`}>{statusText[o.status] || o.status}</div>
              </div>
            ))}
          </TabsContent>
          <TabsContent value="topups" className="space-y-2 pt-3">
            {topups.length === 0 && <div className="text-center text-sm text-muted-foreground py-6">ຍັງບໍ່ມີປະຫວັດ</div>}
            {topups.map((t) => (
              <div key={t.id} className="glass rounded-2xl p-3 text-sm flex justify-between">
                <div>
                  <div className="font-semibold">{formatKip(t.amount)}</div>
                  <div className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()} · {t.method}</div>
                </div>
                <div className={`text-sm font-semibold ${statusColor(t.status)}`}>{statusText[t.status] || t.status}</div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </main>
    </AppShell>
  );
}
