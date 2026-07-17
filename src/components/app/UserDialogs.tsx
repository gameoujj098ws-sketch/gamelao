import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { statusDialog } from "./StatusDialog";
import { formatKip } from "@/lib/format";
import type { Profile } from "@/hooks/useSession";

export function HistoryDialog({ open, onOpenChange, userId }: { open: boolean; onOpenChange: (o: boolean) => void; userId: string }) {
  const [orders, setOrders] = useState<{ id: string; product_name: string; price: number; game_data: string | null; created_at: string }[]>([]);
  const [services, setServices] = useState<{ id: string; product_name: string; price: number; status: string; created_at: string }[]>([]);
  const [topups, setTopups] = useState<{ id: string; amount: number; status: string; created_at: string; method: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    supabase.from("orders").select("*").eq("user_id", userId).order("created_at", { ascending: false }).then(({ data }) => setOrders(data ?? []));
    supabase.from("service_orders").select("*").eq("user_id", userId).order("created_at", { ascending: false }).then(({ data }) => setServices(data ?? []));
    supabase.from("topups").select("*").eq("user_id", userId).order("created_at", { ascending: false }).then(({ data }) => setTopups(data ?? []));
  }, [open, userId]);

  const statusText: Record<string, string> = {
    pending: "ລໍຖ້າ", approved: "ອະນຸມັດ", rejected: "ປະຕິເສດ", completed: "ສຳເລັດ", failed: "ບໍ່ສຳເລັດ",
  };
  const statusColor = (s: string) => ({
    pending: "text-yellow-600", approved: "text-green-600", completed: "text-green-600",
    rejected: "text-red-600", failed: "text-red-600",
  } as Record<string, string>)[s] || "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>ປະຫວັດ</DialogTitle></DialogHeader>
        <Tabs defaultValue="purchases">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="purchases">ຊື້ສິນຄ້າ</TabsTrigger>
            <TabsTrigger value="services">ບໍລິການ</TabsTrigger>
            <TabsTrigger value="topups">ເຕີມເງີນ</TabsTrigger>
          </TabsList>
          <TabsContent value="purchases" className="space-y-2 pt-2">
            {orders.length === 0 && <div className="text-center text-sm text-muted-foreground py-4">ຍັງບໍ່ມີປະຫວັດ</div>}
            {orders.map((o) => (
              <div key={o.id} className="border rounded-lg p-3 text-sm">
                <div className="font-semibold">{o.product_name}</div>
                <div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</div>
                <div className="flex justify-between mt-1"><span>ລາຄາ</span><span>{formatKip(o.price)}</span></div>
                {o.game_data && <div className="mt-1 p-2 bg-muted rounded text-xs break-all">{o.game_data}</div>}
              </div>
            ))}
          </TabsContent>
          <TabsContent value="services" className="space-y-2 pt-2">
            {services.length === 0 && <div className="text-center text-sm text-muted-foreground py-4">ຍັງບໍ່ມີປະຫວັດ</div>}
            {services.map((o) => (
              <div key={o.id} className="border rounded-lg p-3 text-sm">
                <div className="font-semibold">{o.product_name}</div>
                <div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</div>
                <div className="flex justify-between mt-1"><span>ລາຄາ</span><span>{formatKip(o.price)}</span></div>
                <div className={`text-sm font-semibold mt-1 ${statusColor(o.status)}`}>{statusText[o.status] || o.status}</div>
              </div>
            ))}
          </TabsContent>
          <TabsContent value="topups" className="space-y-2 pt-2">
            {topups.length === 0 && <div className="text-center text-sm text-muted-foreground py-4">ຍັງບໍ່ມີປະຫວັດ</div>}
            {topups.map((t) => (
              <div key={t.id} className="border rounded-lg p-3 text-sm flex justify-between">
                <div>
                  <div className="font-semibold">{formatKip(t.amount)}</div>
                  <div className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()} · {t.method}</div>
                </div>
                <div className={`text-sm font-semibold ${statusColor(t.status)}`}>{statusText[t.status] || t.status}</div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export function MessagesDialog({ open, onOpenChange, userId }: { open: boolean; onOpenChange: (o: boolean) => void; userId: string }) {
  const [msgs, setMsgs] = useState<{ id: string; content: string; from_admin: boolean; created_at: string }[]>([]);
  const load = async () => {
    const { data } = await supabase.from("messages").select("*").eq("user_id", userId).order("created_at", { ascending: true });
    setMsgs(data ?? []);
    if (data?.some((m) => m.from_admin && !m.read)) {
      await supabase.from("messages").update({ read: true }).eq("user_id", userId).eq("from_admin", true).eq("read", false);
    }
  };
  useEffect(() => { if (open) load(); }, [open, userId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>ຂໍ້ຄວາມຈາກແອັດມິນ</DialogTitle></DialogHeader>
        <div className="space-y-2">
          {msgs.length === 0 && <div className="text-center text-sm text-muted-foreground py-4">ຍັງບໍ່ມີຂໍ້ຄວາມ</div>}
          {msgs.map((m) => (
            <div key={m.id} className={`rounded-lg p-3 text-sm ${m.from_admin ? "bg-accent" : "bg-primary text-primary-foreground ml-8"}`}>
              <div className="whitespace-pre-line">{m.content}</div>
              <div className="text-xs opacity-70 mt-1">{new Date(m.created_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ProfileDialog({ open, onOpenChange, profile, onUpdated }: { open: boolean; onOpenChange: (o: boolean) => void; profile: Profile; onUpdated: () => void }) {
  const [username, setUsername] = useState(profile.username);
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setLoading(true);
    try {
      if (username !== profile.username) {
        const { error } = await supabase.from("profiles").update({ username }).eq("id", profile.id);
        if (error) throw error;
      }
      if (pw) {
        const { error } = await supabase.auth.updateUser({ password: pw });
        if (error) throw error;
      }
      statusDialog.success("ສຳເລັດ", "ບັນທຶກໂປຣໄຟລ໌ແລ້ວ");
      onOpenChange(false);
      onUpdated();
    } catch (e: unknown) {
      statusDialog.error("ລົ້ມເຫຼວ", (e as Error).message);
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>ໂປຣໄຟລ໌</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>ອີເມວ</Label><Input value={profile.email} disabled /></div>
          <div><Label>ຊື່ຜູ້ໃຊ້</Label><Input value={username} onChange={(e) => setUsername(e.target.value)} /></div>
          <div><Label>ລະຫັດຜ່ານໃໝ່ (ຖ້າຢາກປ່ຽນ)</Label><Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
          <Button className="w-full" disabled={loading} onClick={save}>ບັນທຶກ</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
