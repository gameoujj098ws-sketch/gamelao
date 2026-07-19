import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { formatKip } from "@/lib/format";
import { Header, BottomNav } from "@/components/app/Layout";
import { AuthDialog } from "@/components/app/AuthDialog";
import { TopupDialog } from "@/components/app/TopupDialog";
import { HistoryDialog, MessagesDialog, ProfileDialog } from "@/components/app/UserDialogs";
import { ProductDialog, type Product } from "@/components/app/ProductDialog";
import { AdPopup } from "@/components/app/AdPopup";
import { StatusDialog, statusDialog } from "@/components/app/StatusDialog";
import { Megaphone, Trophy, ShoppingCart, Package, Users, TrendingUp, CheckCircle2, ShoppingBag, Bell } from "lucide-react";

export const Route = createFileRoute("/")({ component: Index });

type Settings = {
  site_name: string; logo_url: string | null; slide_url: string | null;
  announcement: string; qr_url: string | null; help_link: string | null; primary_color: string | null;
};
type Category = { id: string; name: string; image_url: string | null };
type Spender = { username: string; total: number; times: number };

function Index() {
  const navigate = useNavigate();
  const { user, profile, isAdmin, reloadProfile } = useSession();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [stats, setStats] = useState({ members: 0, visits: 0, available: 0, sold: 0 });
  const [spenders, setSpenders] = useState<Spender[]>([]);
  const [unread, setUnread] = useState(0);
  const [activeCat, setActiveCat] = useState<string | null>(null);

  const [authOpen, setAuthOpen] = useState(false);
  const [topupOpen, setTopupOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);
  const [profOpen, setProfOpen] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);

  const trackedRef = useRef(false);

  const loadStock = async () => {
    const { data } = await supabase.from("product_stock").select("product_id").eq("sold", false);
    const map: Record<string, number> = {};
    (data ?? []).forEach((r: { product_id: string }) => { map[r.product_id] = (map[r.product_id] ?? 0) + 1; });
    setStockMap(map);
  };

  useEffect(() => {
    supabase.from("site_settings").select("*").eq("id", 1).maybeSingle().then(({ data }) => setSettings(data as Settings));
    supabase.from("categories").select("id,name,image_url").order("sort").then(({ data }) => setCats(data ?? []));
    supabase.from("products").select("*").order("created_at", { ascending: false }).then(({ data }) => setProducts(data ?? []));
    supabase.from("public_stats").select("*").maybeSingle().then(({ data }) => data && setStats(data as never));
    supabase.rpc("top_spenders").then(({ data }) => setSpenders((data as Spender[]) ?? []));
    loadStock();
    if (!trackedRef.current) {
      trackedRef.current = true;
      supabase.from("page_views").insert({}).then(() => {});
    }
  }, []);

  useEffect(() => {
    if (!user) { setUnread(0); return; }
    const load = () => supabase.from("messages").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("from_admin", true).eq("read", false).then(({ count }) => setUnread(count ?? 0));
    load();
    const ch = supabase.channel("msgs").on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `user_id=eq.${user.id}` }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const openIfAuth = (fn: () => void) => (user ? fn() : setAuthOpen(true));

  const homeProducts = products.filter((p) => !p.hidden_from_home);
  const shownProducts = activeCat ? products.filter((p) => p.category_id === activeCat) : homeProducts.filter((p) => !p.is_service);
  const servicesShown = homeProducts.filter((p) => p.is_service);

  return (
    <div className="min-h-screen pb-28 pt-20" style={settings?.primary_color ? ({ ["--primary" as string]: settings.primary_color } as React.CSSProperties) : undefined}>
      <Header
        siteName={settings?.site_name || "Roblox ID Shop"} logoUrl={settings?.logo_url} profile={profile} unreadMsgs={unread} isAdmin={isAdmin}
        onLogin={() => setAuthOpen(true)} onProfile={() => openIfAuth(() => setProfOpen(true))}
        onHistory={() => openIfAuth(() => setHistoryOpen(true))} onTopup={() => openIfAuth(() => setTopupOpen(true))}
        onAdmin={() => navigate({ to: "/admin" })} onMessages={() => openIfAuth(() => setMsgOpen(true))} helpLink={settings?.help_link}
      />

      <main className="max-w-3xl mx-auto p-3 space-y-4">
        <div className="border-2 border-dashed border-primary/40 rounded-3xl aspect-[16/8] flex items-center justify-center bg-card/60 backdrop-blur">
          {settings?.slide_url ? (
            <img src={settings.slide_url} alt="" className="w-full h-full object-cover rounded-3xl" />
          ) : (
            <span className="text-muted-foreground text-sm">ຍັງບໍ່ໄດ້ໃສ່ຮູບສະໄລ້</span>
          )}
        </div>

        <div className="flex items-center gap-2 glass rounded-2xl px-3 py-2 overflow-hidden">
          <Megaphone className="h-4 w-4 text-primary shrink-0" />
          <div className="overflow-hidden flex-1">
            <div className="marquee whitespace-nowrap text-sm">{settings?.announcement || "ຍິນດີຕ້ອນຮັບເຂົ້າສູ່ຮ້ານຂາຍໄອດີເກມ Roblox"}</div>
          </div>
        </div>

        <section>
          <h2 className="font-bold mb-2">ໝວດໝູ່ສິນຄ້າທັງໝົດ</h2>
          {cats.length === 0 ? (
            <div className="text-sm text-muted-foreground glass rounded-2xl p-4 text-center">ຍັງບໍ່ໄດ້ເພີ່ມໝວດ</div>
          ) : (
            <div className="space-y-3">
              {cats.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveCat(activeCat === c.id ? null : c.id)}
                  className={`w-full glass rounded-3xl overflow-hidden text-left block ${activeCat === c.id ? "ring-2 ring-primary" : ""}`}
                >
                  <div className="relative aspect-[16/6] bg-muted">
                    {c.image_url ? (
                      <img src={c.image_url} alt={c.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl">🎮</div>
                    )}
                    <span className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-3 py-1 rounded-full font-medium">
                      {c.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 p-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold truncate">{c.name}</div>
                      <div className="text-xs text-muted-foreground truncate">ຂອງ{c.name}</div>
                    </div>
                    <div className="h-11 w-11 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                      <ShoppingBag className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="font-bold text-2xl mb-1">{activeCat ? cats.find((c) => c.id === activeCat)?.name : "ສິນຄ້າແນະນຳສຳລັບລູກຄ້າ"}</h2>
          <div className="text-sm text-muted-foreground mb-3">ເລືອກຊື້ສິນຄ້າຍອດນິຍົມ</div>
          {shownProducts.length === 0 ? (
            <div className="text-sm text-muted-foreground glass rounded-2xl p-4 text-center">ຍັງບໍ່ໄດ້ເພີ່ມສິນຄ້າ</div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {shownProducts.map((p) => <ProductCard key={p.id} p={p} stock={stockMap[p.id] ?? 0} onClick={() => setSelected(p)} />)}
            </div>
          )}
        </section>

        {!activeCat && (
          <section>
            <h2 className="font-bold mb-2">ສິນຄ້າບໍລິການ</h2>
            {servicesShown.length === 0 ? (
              <div className="text-sm text-muted-foreground glass rounded-2xl p-4 text-center">ຍັງບໍ່ໄດ້ເພີ່ມສິນຄ້າບໍລິການ</div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {servicesShown.map((p) => <ProductCard key={p.id} p={p} stock={-1} onClick={() => setSelected(p)} />)}
              </div>
            )}
          </section>
        )}

        <section>
          <h2 className="font-bold mb-2">ສະຖິຕິ</h2>
          <div className="grid grid-cols-2 gap-2">
            <StatBox label="ສະມາຊິກທັງໝົດ" value={stats.members} />
            <StatBox label="ຜູ້ຊົມເວັບ" value={stats.visits} />
            <StatBox label="ສິນຄ້າພ້ອມຂາຍ" value={stats.available} />
            <StatBox label="ຂາຍໄປແລ້ວ" value={stats.sold} />
          </div>
        </section>

        <section>
          <h2 className="font-bold mb-2 flex items-center gap-1"><Trophy className="h-4 w-4 text-yellow-500" />ຜູ້ເຕີມເງີນສູງສຸດ</h2>
          {spenders.length === 0 ? (
            <div className="text-sm text-muted-foreground glass rounded-2xl p-4 text-center">ຍັງບໍ່ມີຂໍ້ມູນ</div>
          ) : (
            <div className="space-y-1">
              {spenders.slice(0, 3).map((s, i) => (
                <div key={i} className="flex items-center gap-2 glass rounded-2xl p-2">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm ${i === 0 ? "bg-yellow-400" : i === 1 ? "bg-gray-300" : "bg-orange-400"}`}>{i + 1}</div>
                  <div className="flex-1 font-medium text-sm">{s.username}</div>
                  <div className="text-xs text-muted-foreground">{s.times} ຄັ້ງ</div>
                  <div className="font-semibold text-sm">{formatKip(s.total)}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <BottomNav
        onTopup={() => openIfAuth(() => setTopupOpen(true))}
        onProducts={() => window.scrollTo({ top: 400, behavior: "smooth" })}
        onHistory={() => openIfAuth(() => setHistoryOpen(true))}
        onHelp={() => settings?.help_link ? window.open(settings.help_link, "_blank") : statusDialog.error("ຍັງບໍ່ໄດ້ຕັ້ງ", "ແອັດມິນຍັງບໍ່ໄດ້ຕັ້ງລິ້ງຊ່ວຍເຫຼືອ")}
      />

      <AdPopup />
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
      {user && <TopupDialog open={topupOpen} onOpenChange={setTopupOpen} userId={user.id} qrUrl={settings?.qr_url} onDone={reloadProfile} />}
      {user && <HistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} userId={user.id} />}
      {user && <MessagesDialog open={msgOpen} onOpenChange={setMsgOpen} userId={user.id} />}
      {user && profile && <ProfileDialog open={profOpen} onOpenChange={setProfOpen} profile={profile} onUpdated={reloadProfile} />}
      <ProductDialog product={selected} onOpenChange={(o) => !o && setSelected(null)} onPurchased={() => { reloadProfile(); loadStock(); }} isLoggedIn={!!user} onRequireLogin={() => { setSelected(null); setAuthOpen(true); }} />
      <StatusDialog />
    </div>
  );
}

function ProductCard({ p, stock, onClick }: { p: Product; stock: number; onClick: () => void }) {
  const available = p.is_service || stock > 0;
  return (
    <div className="glass rounded-3xl overflow-hidden flex flex-col">
      <div className="aspect-square bg-muted/50 m-2 rounded-2xl overflow-hidden">
        {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-4xl">🎮</div>}
      </div>
      <div className="px-3 pb-3 space-y-1.5">
        <div className="text-sm font-semibold truncate">{p.name}</div>
        <div className="flex items-baseline gap-1">
          <span className="text-primary font-extrabold text-lg">{formatKip(p.price)}</span>
          {p.original_price && p.original_price > p.price && (
            <span className="text-destructive line-through text-xs">{formatKip(p.original_price)}</span>
          )}
        </div>
        <button
          onClick={onClick}
          disabled={!available}
          className="w-full bg-gradient-to-b from-primary/80 to-primary text-primary-foreground rounded-2xl py-2 flex items-center justify-center gap-1.5 font-bold text-sm shadow-md active:scale-[.98] disabled:opacity-50 disabled:from-muted disabled:to-muted disabled:text-muted-foreground"
        >
          <ShoppingCart className="h-4 w-4" />ຊື້ສິນຄ້າ
        </button>
        <div className="flex items-center justify-between text-xs pt-0.5">
          <span className="flex items-center gap-1 text-primary font-medium">
            <span className={`h-2 w-2 rounded-full ${available ? "bg-green-500" : "bg-red-500"}`} />
            {available ? "ພ້ອມຂາຍ" : "ໝົດ"}
          </span>
          {!p.is_service && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Package className="h-3 w-3" />ເຫຼືອ {stock} ອັນ
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass rounded-2xl p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-bold">{value.toLocaleString()}</div>
    </div>
  );
}
