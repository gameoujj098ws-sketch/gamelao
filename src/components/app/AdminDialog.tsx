import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { statusDialog } from "./StatusDialog";
import { formatKip } from "@/lib/format";
import { Eye, Plus, Pencil, Trash2, Check, X, Send } from "lucide-react";

type Category = { id: string; name: string; image_url: string | null; sort: number };
type Product = {
  id: string; name: string; price: number; original_price: number | null;
  description: string | null; image_url: string | null; is_service: boolean;
  service_field_label: string | null; category_id: string | null; hidden_from_home: boolean;
};

export function AdminDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>ລະບົບຈັດການແອັດມິນ</DialogTitle></DialogHeader>
        <Tabs defaultValue="stats" className="w-full">
          <TabsList className="grid grid-cols-4 lg:grid-cols-8 w-full h-auto">
            <TabsTrigger value="stats">ສະຖິຕິ</TabsTrigger>
            <TabsTrigger value="topups">ອະນຸມັດເງີນ</TabsTrigger>
            <TabsTrigger value="orders">ອໍເດີ</TabsTrigger>
            <TabsTrigger value="services">ບໍລິການ</TabsTrigger>
            <TabsTrigger value="categories">ໝວດ</TabsTrigger>
            <TabsTrigger value="products">ສິນຄ້າ</TabsTrigger>
            <TabsTrigger value="users">ຜູ້ໃຊ້</TabsTrigger>
            <TabsTrigger value="settings">ຕັ້ງຄ່າ</TabsTrigger>
          </TabsList>
          <TabsContent value="stats"><AdminStats /></TabsContent>
          <TabsContent value="topups"><AdminTopups /></TabsContent>
          <TabsContent value="orders"><AdminOrders /></TabsContent>
          <TabsContent value="services"><AdminServices /></TabsContent>
          <TabsContent value="categories"><AdminCategories /></TabsContent>
          <TabsContent value="products"><AdminProducts /></TabsContent>
          <TabsContent value="users"><AdminUsers /></TabsContent>
          <TabsContent value="settings"><AdminSettings /></TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function AdminStats() {
  const [s, setS] = useState({ members: 0, visits: 0, revenue: 0, monthRevenue: 0, orderCount: 0 });
  useEffect(() => {
    (async () => {
      const [m, v, tp, tpMonth, oc] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("page_views").select("*", { count: "exact", head: true }),
        supabase.from("topups").select("amount").eq("status", "approved"),
        supabase.from("topups").select("amount").eq("status", "approved").gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString()),
        supabase.from("orders").select("*", { count: "exact", head: true }),
      ]);
      setS({
        members: m.count ?? 0, visits: v.count ?? 0,
        revenue: (tp.data ?? []).reduce((a, b) => a + Number(b.amount), 0),
        monthRevenue: (tpMonth.data ?? []).reduce((a, b) => a + Number(b.amount), 0),
        orderCount: oc.count ?? 0,
      });
    })();
  }, []);
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 py-3">
      <Stat label="ສະມາຊິກທັງໝົດ" value={s.members} />
      <Stat label="ຜູ້ຊົມ" value={s.visits} />
      <Stat label="ອໍເດີ" value={s.orderCount} />
      <Stat label="ລາຍຮັບເດືອນ" value={formatKip(s.monthRevenue)} />
      <Stat label="ລາຍຮັບລວມ" value={formatKip(s.revenue)} />
    </div>
  );
}
function Stat({ label, value }: { label: string; value: number | string }) {
  return <div className="rounded-xl border p-4 bg-card"><div className="text-xs text-muted-foreground">{label}</div><div className="text-lg font-bold">{value}</div></div>;
}

function AdminTopups() {
  const [rows, setRows] = useState<{ id: string; user_id: string; amount: number; slip_url: string; status: string; created_at: string; profiles: { username: string; email: string } | null }[]>([]);
  const [slipUrls, setSlipUrls] = useState<Record<string, string>>({});
  const load = async () => {
    const { data } = await supabase.from("topups").select("*, profiles(username,email)").eq("status", "pending").order("created_at");
    setRows(data as never ?? []);
    const urls: Record<string, string> = {};
    for (const r of data ?? []) {
      const { data: sig } = await supabase.storage.from("slips").createSignedUrl(r.slip_url ?? "", 3600);
      if (sig) urls[r.id] = sig.signedUrl;
    }
    setSlipUrls(urls);
  };
  useEffect(() => { load(); }, []);
  const act = async (id: string, ok: boolean) => {
    const { error } = await supabase.rpc(ok ? "approve_topup" : "reject_topup", { _topup_id: id });
    if (error) return statusDialog.error("ລົ້ມເຫຼວ", error.message);
    statusDialog.success("ສຳເລັດ", ok ? "ອະນຸມັດແລ້ວ" : "ປະຕິເສດແລ້ວ");
    load();
  };
  return (
    <div className="space-y-2 py-3">
      {rows.length === 0 && <div className="text-center text-sm text-muted-foreground py-6">ບໍ່ມີລາຍການລໍຖ້າ</div>}
      {rows.map((r) => (
        <div key={r.id} className="border rounded-lg p-3 flex gap-3 items-start">
          {slipUrls[r.id] && <a href={slipUrls[r.id]} target="_blank" rel="noopener noreferrer"><img src={slipUrls[r.id]} alt="slip" className="w-20 h-20 object-cover rounded" /></a>}
          <div className="flex-1 text-sm">
            <div className="font-semibold">{r.profiles?.username} <span className="text-xs text-muted-foreground">({r.profiles?.email})</span></div>
            <div>{formatKip(r.amount)}</div>
            <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
            <div className="flex gap-2 mt-2">
              <Button size="sm" onClick={() => act(r.id, true)}><Check className="h-4 w-4" />ອະນຸມັດ</Button>
              <Button size="sm" variant="destructive" onClick={() => act(r.id, false)}><X className="h-4 w-4" />ປະຕິເສດ</Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AdminOrders() {
  const [rows, setRows] = useState<{ id: string; product_name: string; price: number; game_data: string | null; created_at: string; profiles: { username: string } | null }[]>([]);
  useEffect(() => {
    supabase.from("orders").select("*, profiles(username)").order("created_at", { ascending: false }).limit(100)
      .then(({ data }) => setRows(data as never ?? []));
  }, []);
  return (
    <div className="space-y-2 py-3">
      {rows.length === 0 && <div className="text-center text-sm text-muted-foreground py-6">ຍັງບໍ່ມີອໍເດີ</div>}
      {rows.map((r) => (
        <div key={r.id} className="border rounded-lg p-3 text-sm">
          <div className="font-semibold">{r.product_name} — {formatKip(r.price)}</div>
          <div className="text-xs text-muted-foreground">{r.profiles?.username} · {new Date(r.created_at).toLocaleString()}</div>
          {r.game_data && <div className="mt-1 p-2 bg-muted rounded text-xs break-all cursor-pointer" onClick={() => { navigator.clipboard.writeText(r.game_data!); statusDialog.success("ຄັດລອກແລ້ວ", ""); }}>{r.game_data}</div>}
        </div>
      ))}
    </div>
  );
}

function AdminServices() {
  const [rows, setRows] = useState<{ id: string; user_id: string; product_name: string; price: number; customer_note: string; status: string; created_at: string; profiles: { username: string } | null }[]>([]);
  const [msgOpen, setMsgOpen] = useState<string | null>(null);
  const [msgText, setMsgText] = useState("");
  const load = async () => {
    const { data } = await supabase.from("service_orders").select("*, profiles(username)").order("created_at", { ascending: false }).limit(100);
    setRows(data as never ?? []);
  };
  useEffect(() => { load(); }, []);

  const resolve = async (id: string, ok: boolean) => {
    const { error } = await supabase.rpc("resolve_service_order", { _order_id: id, _success: ok });
    if (error) return statusDialog.error("ລົ້ມເຫຼວ", error.message);
    statusDialog.success("ສຳເລັດ", "");
    load();
  };
  const sendMsg = async (userId: string) => {
    if (!msgText.trim()) return;
    const { error } = await supabase.from("messages").insert({ user_id: userId, content: msgText, from_admin: true });
    if (error) return statusDialog.error("ລົ້ມເຫຼວ", error.message);
    setMsgOpen(null); setMsgText("");
    statusDialog.success("ສົ່ງແລ້ວ", "");
  };
  return (
    <div className="space-y-2 py-3">
      {rows.length === 0 && <div className="text-center text-sm text-muted-foreground py-6">ຍັງບໍ່ມີອໍເດີບໍລິການ</div>}
      {rows.map((r) => (
        <div key={r.id} className="border rounded-lg p-3 text-sm">
          <div className="font-semibold">{r.product_name} — {formatKip(r.price)}</div>
          <div className="text-xs text-muted-foreground">{r.profiles?.username} · {new Date(r.created_at).toLocaleString()} · {r.status}</div>
          <div className="mt-1 p-2 bg-muted rounded text-xs cursor-pointer" onClick={() => { navigator.clipboard.writeText(r.customer_note); statusDialog.success("ຄັດລອກແລ້ວ", ""); }}>{r.customer_note}</div>
          {r.status === "pending" && (
            <div className="flex gap-2 mt-2">
              <Button size="sm" onClick={() => resolve(r.id, true)}><Check className="h-4 w-4" />ສຳເລັດ</Button>
              <Button size="sm" variant="destructive" onClick={() => resolve(r.id, false)}><X className="h-4 w-4" />ປະຕິເສດ</Button>
              <Button size="sm" variant="outline" onClick={() => setMsgOpen(r.user_id)}><Send className="h-4 w-4" />ຂໍ້ຄວາມ</Button>
            </div>
          )}
          {msgOpen === r.user_id && (
            <div className="mt-2 space-y-2">
              <Textarea value={msgText} onChange={(e) => setMsgText(e.target.value)} placeholder="ຂໍ້ຄວາມ..." />
              <Button size="sm" onClick={() => sendMsg(r.user_id)}>ສົ່ງ</Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function AdminCategories() {
  const [rows, setRows] = useState<Category[]>([]);
  const [form, setForm] = useState({ name: "", image_url: "" });
  const load = () => supabase.from("categories").select("*").order("sort").then(({ data }) => setRows(data ?? []));
  useEffect(() => { load(); }, []);
  const add = async () => {
    if (!form.name) return;
    const { error } = await supabase.from("categories").insert({ name: form.name, image_url: form.image_url || null });
    if (error) return statusDialog.error("ລົ້ມເຫຼວ", error.message);
    setForm({ name: "", image_url: "" }); load();
  };
  const del = async (id: string) => {
    if (!confirm("ລົບ?")) return;
    await supabase.from("categories").delete().eq("id", id); load();
  };
  return (
    <div className="space-y-3 py-3">
      <div className="border rounded-lg p-3 space-y-2">
        <div className="font-semibold text-sm">ເພີ່ມໝວດ</div>
        <Input placeholder="ຊື່ໝວດ" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input placeholder="ລິ້ງຮູບ (ບໍ່ບັງຄັບ)" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
        <Button size="sm" onClick={add}><Plus className="h-4 w-4" />ເພີ່ມ</Button>
      </div>
      {rows.map((r) => (
        <div key={r.id} className="border rounded-lg p-2 flex items-center gap-2">
          {r.image_url && <img src={r.image_url} className="w-12 h-12 rounded object-cover" alt="" />}
          <div className="flex-1 text-sm font-medium">{r.name}</div>
          <Button size="sm" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      ))}
    </div>
  );
}

function AdminProducts() {
  const [rows, setRows] = useState<Product[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [stockFor, setStockFor] = useState<string | null>(null);
  const [stockText, setStockText] = useState("");
  const load = async () => {
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from("products").select("*").order("created_at", { ascending: false }),
      supabase.from("categories").select("*").order("sort"),
    ]);
    setRows(p ?? []); setCats(c ?? []);
  };
  useEffect(() => { load(); }, []);
  const save = async () => {
    if (!editing?.name) return;
    const payload = {
      name: editing.name, price: Number(editing.price) || 0,
      original_price: editing.original_price ? Number(editing.original_price) : null,
      description: editing.description || null, image_url: editing.image_url || null,
      is_service: !!editing.is_service, service_field_label: editing.service_field_label || null,
      category_id: editing.category_id || null, hidden_from_home: !!editing.hidden_from_home,
    };
    const { error } = editing.id
      ? await supabase.from("products").update(payload).eq("id", editing.id)
      : await supabase.from("products").insert(payload);
    if (error) return statusDialog.error("ລົ້ມເຫຼວ", error.message);
    setEditing(null); load();
  };
  const del = async (id: string) => { if (!confirm("ລົບ?")) return; await supabase.from("products").delete().eq("id", id); load(); };
  const addStock = async (productId: string) => {
    const lines = stockText.split("\n").map((s) => s.trim()).filter(Boolean);
    if (!lines.length) return;
    const { error } = await supabase.from("product_stock").insert(lines.map((game_data) => ({ product_id: productId, game_data })));
    if (error) return statusDialog.error("ລົ້ມເຫຼວ", error.message);
    setStockFor(null); setStockText("");
    statusDialog.success("ເພີ່ມສະຕ໊ອກແລ້ວ", `+${lines.length} ຊິ້ນ`);
  };

  return (
    <div className="space-y-3 py-3">
      <Button onClick={() => setEditing({ is_service: false, hidden_from_home: false })}><Plus className="h-4 w-4" />ເພີ່ມສິນຄ້າ</Button>
      {rows.map((r) => (
        <div key={r.id} className="border rounded-lg p-3">
          <div className="flex gap-2 items-start">
            {r.image_url && <img src={r.image_url} className="w-14 h-14 rounded object-cover" alt="" />}
            <div className="flex-1 text-sm">
              <div className="font-semibold">{r.name} {r.is_service && <span className="text-xs bg-primary/20 px-1 rounded">ບໍລິການ</span>} {r.hidden_from_home && <span className="text-xs bg-muted px-1 rounded">ຊ່ອນ</span>}</div>
              <div>{formatKip(r.price)}</div>
            </div>
            <div className="flex gap-1">
              {!r.is_service && <Button size="sm" variant="outline" onClick={() => setStockFor(r.id)}><Plus className="h-4 w-4" /></Button>}
              <Button size="sm" variant="outline" onClick={() => setEditing(r)}><Pencil className="h-4 w-4" /></Button>
              <Button size="sm" variant="outline" onClick={() => del(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>
          {stockFor === r.id && (
            <div className="mt-2 space-y-2">
              <Textarea rows={4} placeholder="ໜຶ່ງໄອດີຕໍ່ໜຶ່ງແຖວ" value={stockText} onChange={(e) => setStockText(e.target.value)} />
              <Button size="sm" onClick={() => addStock(r.id)}>ບັນທຶກສະຕ໊ອກ</Button>
            </div>
          )}
        </div>
      ))}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "ແກ້ໄຂ" : "ເພີ່ມ"}ສິນຄ້າ</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-2">
              <div className="flex items-center gap-2"><Switch checked={!!editing.is_service} onCheckedChange={(v) => setEditing({ ...editing, is_service: v })} /><Label>ສິນຄ້າບໍລິການ</Label></div>
              <div><Label>ໝວດ</Label>
                <select className="w-full border rounded-md h-9 px-2 bg-background" value={editing.category_id ?? ""} onChange={(e) => setEditing({ ...editing, category_id: e.target.value || null })}>
                  <option value="">-</option>
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div><Label>ຊື່ສິນຄ້າ</Label><Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div><Label>ລາຄາ (₭)</Label><Input type="number" value={editing.price ?? ""} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} /></div>
              <div><Label>ລາຄາເດີມ / ຂີດຄ້ຽນ</Label><Input type="number" value={editing.original_price ?? ""} onChange={(e) => setEditing({ ...editing, original_price: Number(e.target.value) })} /></div>
              <div><Label>ລາຍລະອຽດ</Label><Textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
              <div><Label>ລິ້ງຮູບ</Label><Input value={editing.image_url ?? ""} onChange={(e) => setEditing({ ...editing, image_url: e.target.value })} /></div>
              {editing.is_service && <div><Label>ປ້າຍຊ່ອງກອກ (ບໍລິການ)</Label><Input value={editing.service_field_label ?? ""} onChange={(e) => setEditing({ ...editing, service_field_label: e.target.value })} /></div>}
              <div className="flex items-center gap-2"><Switch checked={!!editing.hidden_from_home} onCheckedChange={(v) => setEditing({ ...editing, hidden_from_home: v })} /><Label>ຊ່ອນຈາກໜ້າຫຼັກ (ໃຫ້ຢູ່ໃນໝວດເທົ່ານັ້ນ)</Label></div>
              <Button className="w-full" onClick={save}>ບັນທຶກ</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdminUsers() {
  const [rows, setRows] = useState<{ id: string; username: string; email: string; wallet_balance: number }[]>([]);
  const [view, setView] = useState<typeof rows[number] | null>(null);
  const [newBal, setNewBal] = useState("");
  const load = () => supabase.from("profiles").select("*").order("created_at", { ascending: false }).then(({ data }) => setRows(data ?? []));
  useEffect(() => { load(); }, []);
  const setWallet = async () => {
    if (!view) return;
    const { error } = await supabase.rpc("admin_set_wallet", { _user_id: view.id, _new_balance: Number(newBal) });
    if (error) return statusDialog.error("ລົ້ມເຫຼວ", error.message);
    statusDialog.success("ບັນທຶກແລ້ວ", ""); setView(null); load();
  };
  const del = async (id: string) => {
    if (!confirm("ລົບບັນຊີນີ້?")) return;
    const { error } = await supabase.from("profiles").delete().eq("id", id);
    if (error) return statusDialog.error("ລົ້ມເຫຼວ", error.message);
    load();
  };
  return (
    <div className="space-y-2 py-3">
      {rows.map((r) => (
        <div key={r.id} className="border rounded-lg p-3 flex items-center gap-2 text-sm">
          <div className="flex-1"><div className="font-semibold">{r.username}</div><div className="text-xs text-muted-foreground">{r.email} · {formatKip(r.wallet_balance)}</div></div>
          <Button size="sm" variant="outline" onClick={() => { setView(r); setNewBal(String(r.wallet_balance)); }}><Eye className="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" onClick={() => del(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      ))}
      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>ຂໍ້ມູນຜູ້ໃຊ້</DialogTitle></DialogHeader>
          {view && <div className="space-y-2">
            <div><Label>ຊື່ຜູ້ໃຊ້</Label><Input value={view.username} disabled /></div>
            <div><Label>ອີເມວ</Label><Input value={view.email} disabled /></div>
            <div><Label>ຍອດເງີນ (₭)</Label><Input type="number" value={newBal} onChange={(e) => setNewBal(e.target.value)} /></div>
            <Button className="w-full" onClick={setWallet}>ບັນທຶກຍອດເງີນ</Button>
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdminSettings() {
  const [s, setS] = useState<Record<string, string>>({});
  const [ad, setAd] = useState({ image_url: "", link: "" });
  const [codeForm, setCodeForm] = useState({ code: "", amount: "" });
  useEffect(() => {
    supabase.from("site_settings").select("*").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) setS(Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v == null ? "" : String(v)])));
    });
  }, []);
  const save = async () => {
    const { error } = await supabase.from("site_settings").upsert({
      id: 1, site_name: s.site_name, logo_url: s.logo_url || null, slide_url: s.slide_url || null,
      announcement: s.announcement, qr_url: s.qr_url || null, help_link: s.help_link || null,
      primary_color: s.primary_color || null, discord_webhook: s.discord_webhook || null,
    });
    if (error) return statusDialog.error("ລົ້ມເຫຼວ", error.message);
    statusDialog.success("ບັນທຶກແລ້ວ", "");
  };
  const addAd = async () => {
    if (!ad.image_url) return;
    await supabase.from("ads").update({ active: false }).eq("active", true);
    const { error } = await supabase.from("ads").insert({ image_url: ad.image_url, link: ad.link || null, active: true });
    if (error) return statusDialog.error("ລົ້ມເຫຼວ", error.message);
    statusDialog.success("ບັນທຶກໂຄສະນາ", ""); setAd({ image_url: "", link: "" });
  };
  const addCode = async () => {
    if (!codeForm.code || !codeForm.amount) return;
    const { error } = await supabase.from("redeem_codes").insert({ code: codeForm.code, amount: Number(codeForm.amount) });
    if (error) return statusDialog.error("ລົ້ມເຫຼວ", error.message);
    statusDialog.success("ສ້າງໂຄດແລ້ວ", ""); setCodeForm({ code: "", amount: "" });
  };

  return (
    <div className="space-y-4 py-3">
      <Section title="ຊື່ເວັບ / ໂລໂກ້ / ສະໄລ້">
        <Input placeholder="ຊື່ເວັບ" value={s.site_name ?? ""} onChange={(e) => setS({ ...s, site_name: e.target.value })} />
        <Input placeholder="ລິ້ງໂລໂກ້" value={s.logo_url ?? ""} onChange={(e) => setS({ ...s, logo_url: e.target.value })} />
        <Input placeholder="ລິ້ງຮູບສະໄລ້" value={s.slide_url ?? ""} onChange={(e) => setS({ ...s, slide_url: e.target.value })} />
      </Section>
      <Section title="ຊ່ອງປະກາດ">
        <Textarea placeholder="ຂໍ້ຄວາມປະກາດ" value={s.announcement ?? ""} onChange={(e) => setS({ ...s, announcement: e.target.value })} />
      </Section>
      <Section title="QR Code ເຕີມເງີນ"><Input placeholder="ລິ້ງຮູບ QR" value={s.qr_url ?? ""} onChange={(e) => setS({ ...s, qr_url: e.target.value })} /></Section>
      <Section title="ຊ່ວຍເຫຼືອ / ຕິດຕໍ່ແອັດມິນ"><Input placeholder="ລິ້ງ (ເຊັ່ນ Telegram, Line)" value={s.help_link ?? ""} onChange={(e) => setS({ ...s, help_link: e.target.value })} /></Section>
      <Section title="ສີເວັບ (hex)"><Input placeholder="#7c3aed" value={s.primary_color ?? ""} onChange={(e) => setS({ ...s, primary_color: e.target.value })} /></Section>
      <Section title="Discord Webhook"><Input placeholder="https://discord.com/api/webhooks/..." value={s.discord_webhook ?? ""} onChange={(e) => setS({ ...s, discord_webhook: e.target.value })} /></Section>
      <Button className="w-full" onClick={save}>ບັນທຶກຕັ້ງຄ່າ</Button>

      <Section title="ໂຄສະນາ (Popup)">
        <Input placeholder="ລິ້ງຮູບໂຄສະນາ" value={ad.image_url} onChange={(e) => setAd({ ...ad, image_url: e.target.value })} />
        <Input placeholder="ລິ້ງເມື່ອກົດ (ບໍ່ບັງຄັບ)" value={ad.link} onChange={(e) => setAd({ ...ad, link: e.target.value })} />
        <Button size="sm" onClick={addAd}>ຕັ້ງໂຄສະນາໃໝ່</Button>
      </Section>
      <Section title="ໂຄດເຕີມເງີນ">
        <Input placeholder="ໂຄດ" value={codeForm.code} onChange={(e) => setCodeForm({ ...codeForm, code: e.target.value })} />
        <Input placeholder="ຈຳນວນ (₭)" type="number" value={codeForm.amount} onChange={(e) => setCodeForm({ ...codeForm, amount: e.target.value })} />
        <Button size="sm" onClick={addCode}>ສ້າງໂຄດ</Button>
      </Section>
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="border rounded-lg p-3 space-y-2"><div className="font-semibold text-sm">{title}</div>{children}</div>;
}
