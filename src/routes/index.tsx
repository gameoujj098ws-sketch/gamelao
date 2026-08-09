import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { formatKip } from "@/lib/format";
import { Header, BottomNav } from "@/components/app/Layout";
import { readActiveQrSession } from "@/routes/topup";




import { AdPopup } from "@/components/app/AdPopup";
import { StatusDialog, statusDialog } from "@/components/app/StatusDialog";
import { Megaphone, Trophy, ShoppingCart, Package, Users, TrendingUp, CheckCircle2, ShoppingBag, Bell } from "lucide-react";

export const Route = createFileRoute("/")({ component: Index });

type Settings = {
  site_name: string; logo_url: string | null; slide_url: string | null;
  announcement: string; qr_url: string | null; help_link: string | null; primary_color: string | null;
};
type Product = {
  id: string; name: string; price: number; original_price: number | null;
  description: string | null; image_url: string | null; is_service: boolean;
  service_field_label: string | null; category_id: string | null; hidden_from_home: boolean;
};
type Category = { id: string; name: string; image_url: string | null };
type Spender = { username: string; total: number; times: number };

function Index() {
  const navigate = useNavigate();
  const { user, profile, isAdmin } = useSession();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [stats, setStats] = useState({ members: 0, visits: 0, available: 0, sold: 0 });
  const [spenders, setSpenders] = useState<Spender[]>([]);
  const [unread, setUnread] = useState(0);
  const [activeCat, setActiveCat] = useState<string | null>(null);

  const openAuth = () => navigate({ to: "/auth" });
  const goTopup = () => (user ? navigate({ to: "/topup" }) : openAuth());

  useEffect(() => {
    if (readActiveQrSession()) navigate({ to: "/topup" });
  }, [navigate]);

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

  const openIfAuth = (fn: () => void) => (user ? fn() : openAuth());

  const homeProducts = products.filter((p) => !p.hidden_from_home);
  const shownProducts = activeCat ? products.filter((p) => p.category_id === activeCat) : homeProducts.filter((p) => !p.is_service);
  const servicesShown = homeProducts.filter((p) => p.is_service);

  return (
    <div className="min-h-screen pb-28 pt-20" style={settings?.primary_color ? ({ ["--primary" as string]: settings.primary_color } as React.CSSProperties) : undefined}>
      <Header
        siteName={settings?.site_name || "Roblox ID Shop"} logoUrl={settings?.logo_url} profile={profile} unreadMsgs={unread} isAdmin={isAdmin}
        onLogin={openAuth} onProfile={() => openIfAuth(() => navigate({ to: "/profile" }))}
        onHistory={() => openIfAuth(() => navigate({ to: "/history" }))} onTopup={goTopup}
        onAdmin={() => navigate({ to: "/admin" })} onMessages={() => openIfAuth(() => navigate({ to: "/messages" }))} helpLink={settings?.help_link}
      />

      <main className="max-w-3xl mx-auto p-3 space-y-4">
        <div className="border-2 border-dashed border-primary/40 rounded-3xl aspect-[16/8] flex items-center justify-center bg-card/60 backdrop-blur">
          {settings?.slide_url ? (
            <img src={settings.slide_url} alt="" className="w-full h-full object-cover rounded-3xl" />
          ) : (
            <span className="text-muted-foreground text-sm">ຍັງບໍ່ໄດ້ໃສ່ຮູບສະໄລ້</span>
          )}
        </div>

        <div className="flex items-center gap-3 bg-primary/5 border border-primary/15 rounded-full pl-1.5 pr-3 py-1.5 overflow-hidden">
          <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
            <Megaphone className="h-4 w-4" />
          </div>
          <div className="overflow-hidden flex-1">
            <div className="marquee whitespace-nowrap text-sm">{settings?.announcement || "ຍິນດີຕ້ອນຮັບເຂົ້າສູ່ຮ້ານຂາຍໄອດີເກມ Roblox"}</div>
          </div>
        </div>

        <section>
          <SectionTitle title="ໝວດໝູ່ແນະນຳສຳລັບລູກຄ້າ" subtitle="ເລືອກໝວດໝູ່ທີ່ແນະນຳ" />
          {cats.length === 0 ? (
            <div className="text-sm text-muted-foreground card-soft rounded-2xl p-4 text-center">ຍັງບໍ່ໄດ້ເພີ່ມໝວດ</div>
          ) : (
            <div className="space-y-3">
              {cats.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveCat(activeCat === c.id ? null : c.id)}
                  className={`w-full card-soft rounded-3xl overflow-hidden text-left block p-2 ${activeCat === c.id ? "ring-2 ring-primary" : ""}`}
                >
                  <div className="relative aspect-[16/7] bg-muted rounded-2xl overflow-hidden">
                    {c.image_url ? (
                      <img src={c.image_url} alt={c.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl">🎮</div>
                    )}
                    <span className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-3 py-1 rounded-full font-medium">
                      {c.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 p-2 pt-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold truncate">{c.name}</div>
                      <div className="text-xs text-muted-foreground truncate">ກົດເພື່ອເບິ່ງສິນຄ້າໃນໝວດໝູ່ນີ້</div>
                    </div>
                    <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <ShoppingBag className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section>
          <SectionTitle
            title={activeCat ? cats.find((c) => c.id === activeCat)?.name ?? "" : "ສິນຄ້າແນະນຳສຳລັບລູກຄ້າ"}
            subtitle="ເລືອກຊື້ສິນຄ້າຍອດນິຍົມ"
          />
          {shownProducts.length === 0 ? (
            <div className="text-sm text-muted-foreground card-soft rounded-2xl p-4 text-center">ຍັງບໍ່ໄດ້ເພີ່ມສິນຄ້າ</div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {shownProducts.map((p) => <ProductCard key={p.id} p={p} stock={stockMap[p.id] ?? 0} onClick={() => navigate({ to: "/product/$id", params: { id: p.id } })} />)}
            </div>
          )}
        </section>

        {!activeCat && (
          <section>
            <SectionTitle title="ສິນຄ້າບໍລິການ" subtitle="ສິນຄ້າທີ່ຕ້ອງກรອກຂໍ້ມູນ" />
            {servicesShown.length === 0 ? (
              <div className="text-sm text-muted-foreground card-soft rounded-2xl p-4 text-center">ຍັງບໍ່ໄດ້ເພີ່ມສິນຄ້າບໍລິການ</div>

            ) : (
              <div className="grid grid-cols-2 gap-3">
                {servicesShown.map((p) => <ProductCard key={p.id} p={p} stock={-1} onClick={() => navigate({ to: "/product/$id", params: { id: p.id } })} />)}
              </div>
            )}
          </section>
        )}

        <section>
          <SectionTitle title="ສະຖິຕິ" />
          <div className="grid grid-cols-2 gap-3">
            <StatBox laoLabel="ຜູ້ໃຊ້ທັງໝົດ" enLabel="User all in shop" value={stats.members} icon={<Users />} />
            <StatBox laoLabel="ຍອດເຂົ້າຊົມເວັບໄຊ" enLabel="Visits to our store" value={stats.visits} icon={<TrendingUp />} />
            <StatBox laoLabel="ພ້ອມຈຳໜ່າຍ" enLabel="Ready for sale" value={stats.available} icon={<CheckCircle2 />} />
            <StatBox laoLabel="ຍອດຂາຍສິນຄ້າ" enLabel="Product already sold" value={stats.sold} icon={<ShoppingCart />} />
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-3"><span className="h-6 w-1.5 rounded-full bg-primary" /><h2 className="font-extrabold text-lg flex items-center gap-1"><Trophy className="h-4 w-4 text-yellow-500" />ຜູ້ເຕີມເງີນສູງສຸດ</h2></div>
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
        onTopup={goTopup}
        onProducts={() => window.scrollTo({ top: 400, behavior: "smooth" })}
        onHistory={() => openIfAuth(() => navigate({ to: "/history" }))}
        onHelp={() => settings?.help_link ? window.open(settings.help_link, "_blank") : statusDialog.error("ຍັງບໍ່ໄດ້ຕັ້ງ", "ແອັດມິນຍັງບໍ່ໄດ້ຕັ້ງລິ້ງຊ່ວຍເຫຼືອ")}
      />

      <AdPopup />
      <StatusDialog />
    </div>
  );
}

function ProductCard({ p, stock, onClick }: { p: Product; stock: number; onClick: () => void }) {
  const available = p.is_service || stock > 0;
  const isService = p.is_service;
  const discount = p.original_price && p.original_price > p.price
    ? Math.round((1 - p.price / p.original_price) * 100) : 0;
  return (
    <div className="card-soft rounded-3xl overflow-hidden flex flex-col">
      <button onClick={onClick} className="relative block aspect-square bg-muted/60 overflow-hidden text-left">
        {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-4xl">🎮</div>}
        {discount > 0 && (
          <span className="absolute top-2 right-2 bg-destructive text-destructive-foreground text-[11px] font-bold px-2.5 py-0.5 rounded-full">-{discount}%</span>
        )}
      </button>
      <div className="p-3 space-y-2">
        <button onClick={onClick} className="block w-full text-left text-sm font-bold truncate">{p.name}</button>
        <div className="flex items-baseline gap-1.5">
          <span className="text-primary font-extrabold text-xl">{formatKip(p.price)}</span>
          {discount > 0 && (
            <span className="text-muted-foreground line-through text-xs">{formatKip(p.original_price!)}</span>
          )}
        </div>
        <button
          onClick={onClick}
          disabled={!available}
          className="w-full bg-primary text-primary-foreground rounded-full py-2 flex items-center justify-center gap-1.5 font-bold text-sm active:scale-[.98] disabled:opacity-50 disabled:bg-muted disabled:text-muted-foreground"
        >
          {isService ? <Bell className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
          {isService ? "ສັ່ງຈຳເນີ" : "ຊື້ສິນຄ້າ"}
        </button>
        <div className="flex items-center justify-between text-[11px] pt-0.5">
          {isService ? (
            <span className="flex items-center gap-1 text-primary font-medium">
              <Bell className="h-3 w-3" />ສິນຄ້າບໍລິການ
            </span>
          ) : (
            <>
              <span className="flex items-center gap-1 font-medium">
                <span className={`h-2 w-2 rounded-full ${available ? "bg-success" : "bg-destructive"}`} />
                <span className={available ? "text-success" : "text-destructive"}>{available ? "ພ້ອມຂາຍ" : "ໝົດ"}</span>
              </span>
              <span className="flex items-center gap-1 text-primary">
                <Package className="h-3 w-3" />ເຫຼືອ {stock} ອັນ
              </span>
            </>
          )}
        </div>
      </div>

    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="h-6 w-1.5 rounded-full bg-primary" />
      <div>
        <h2 className="font-extrabold text-lg leading-tight">{title}</h2>
        {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
      </div>
    </div>
  );
}

function StatBox({ laoLabel, enLabel, value, icon }: { laoLabel: string; enLabel: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="relative glass rounded-3xl p-4 overflow-hidden">
      <div className="absolute -right-2 -bottom-2 text-primary/10 [&>svg]:h-24 [&>svg]:w-24">{icon}</div>
      <div className="relative">
        <div className="text-sm font-bold text-foreground/80 mb-1">{laoLabel}</div>
        <div className="text-4xl font-extrabold text-primary leading-none mb-1">{value.toLocaleString()}</div>
        <div className="text-xs text-muted-foreground">{enLabel}</div>
      </div>
    </div>
  );
}
