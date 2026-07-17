import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { formatKip } from "@/lib/format";
import { Header, BottomNav } from "@/components/app/Layout";
import { AuthDialog } from "@/components/app/AuthDialog";
import { TopupDialog } from "@/components/app/TopupDialog";
import { HistoryDialog, MessagesDialog, ProfileDialog } from "@/components/app/UserDialogs";
import { ProductDialog, type Product } from "@/components/app/ProductDialog";
import { AdminDialog } from "@/components/app/AdminDialog";
import { AdPopup } from "@/components/app/AdPopup";
import { StatusDialog, statusDialog } from "@/components/app/StatusDialog";
import { Megaphone, Trophy } from "lucide-react";

export const Route = createFileRoute("/")({ component: Index });

type Settings = {
  site_name: string; logo_url: string | null; slide_url: string | null;
  announcement: string; qr_url: string | null; help_link: string | null; primary_color: string | null;
};
type Category = { id: string; name: string; image_url: string | null };
type Spender = { username: string; total: number; times: number };

function Index() {
  const { user, profile, isAdmin, reloadProfile } = useSession();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState({ members: 0, visits: 0, available: 0, sold: 0 });
  const [spenders, setSpenders] = useState<Spender[]>([]);
  const [unread, setUnread] = useState(0);
  const [activeCat, setActiveCat] = useState<string | null>(null);

  const [authOpen, setAuthOpen] = useState(false);
  const [topupOpen, setTopupOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);
  const [profOpen, setProfOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);

  const trackedRef = useRef(false);

  useEffect(() => {
    supabase.from("site_settings").select("*").eq("id", 1).maybeSingle().then(({ data }) => setSettings(data as Settings));
    supabase.from("categories").select("id,name,image_url").order("sort").then(({ data }) => setCats(data ?? []));
    supabase.from("products").select("*").order("created_at", { ascending: false }).then(({ data }) => setProducts(data ?? []));
    supabase.from("public_stats").select("*").maybeSingle().then(({ data }) => data && setStats(data as never));
    supabase.rpc("top_spenders").then(({ data }) => setSpenders((data as Spender[]) ?? []));
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
    <div className="min-h-screen pb-20" style={settings?.primary_color ? ({ ["--primary" as string]: settings.primary_color } as React.CSSProperties) : undefined}>
      <Header
        siteName={settings?.site_name || "Roblox ID Shop"} logoUrl={settings?.logo_url} profile={profile} unreadMsgs={unread} isAdmin={isAdmin}
        onLogin={() => setAuthOpen(true)} onProfile={() => openIfAuth(() => setProfOpen(true))}
        onHistory={() => openIfAuth(() => setHistoryOpen(true))} onTopup={() => openIfAuth(() => setTopupOpen(true))}
        onAdmin={() => setAdminOpen(true)} onMessages={() => openIfAuth(() => setMsgOpen(true))} helpLink={settings?.help_link}
      />

      <main className="max-w-3xl mx-auto p-3 space-y-4">
        <div className="border-2 border-dashed rounded-2xl aspect-[16/8] flex items-center justify-center bg-card">
          {settings?.slide_url ? (
            <img src={settings.slide_url} alt="" className="w-full h-full object-cover rounded-2xl" />
          ) : (
            <span className="text-muted-foreground text-sm">ຍັງບໍ່ໄດ້ໃສ່ຮູບສະໄລ້</span>
          )}
        </div>

        <div className="flex items-center gap-2 bg-card border rounded-full px-3 py-2 overflow-hidden">
          <Megaphone className="h-4 w-4 text-primary shrink-0" />
          <div className="overflow-hidden flex-1">
            <div className="marquee whitespace-nowrap text-sm">{settings?.announcement || "ຍິນດີຕ້ອນຮັບເຂົ້າສູ່ຮ້ານຂາຍໄອດີເກມ Roblox"}</div>
          </div>
        </div>

        <section>
          <h2 className="font-bold mb-2">ໝວດໝູ່ສິນຄ້າທັງໝົດ</h2>
          {cats.length === 0 ? (
            <div className="text-sm text-muted-foreground border rounded-lg p-4 text-center">ຍັງບໍ່ໄດ້ເພີ່ມໝວດ</div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setActiveCat(null)} className={`border rounded-xl p-2 flex gap-2 items-center ${!activeCat ? "ring-2 ring-primary" : ""}`}>
                <div className="w-14 h-14 rounded-lg bg-primary/20 flex items-center justify-center">🏠</div>
                <div className="text-sm font-medium">ທັງໝົດ</div>
              </button>
              {cats.map((c) => (
                <button key={c.id} onClick={() => setActiveCat(c.id)} className={`border rounded-xl p-2 flex gap-2 items-center ${activeCat === c.id ? "ring-2 ring-primary" : ""}`}>
                  {c.image_url ? <img src={c.image_url} className="w-14 h-14 rounded-lg object-cover" alt="" /> : <div className="w-14 h-14 rounded-lg bg-accent" />}
                  <div className="text-sm font-medium text-left flex-1 truncate">{c.name}</div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="font-bold mb-2">{activeCat ? cats.find((c) => c.id === activeCat)?.name : "ສິນຄ້າແນະນຳ"}</h2>
          {shownProducts.length === 0 ? (
            <div className="text-sm text-muted-foreground border rounded-lg p-4 text-center">ຍັງບໍ່ໄດ້ເພີ່ມສິນຄ້າ</div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {shownProducts.map((p) => <ProductCard key={p.id} p={p} onClick={() => setSelected(p)} />)}
            </div>
          )}
        </section>

        {!activeCat && (
          <section>
            <h2 className="font-bold mb-2">ສິນຄ້າບໍລິການ</h2>
            {servicesShown.length === 0 ? (
              <div className="text-sm text-muted-foreground border rounded-lg p-4 text-center">ຍັງບໍ່ໄດ້ເພີ່ມສິນຄ້າບໍລິການ</div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {servicesShown.map((p) => <ProductCard key={p.id} p={p} onClick={() => setSelected(p)} />)}
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
            <div className="text-sm text-muted-foreground border rounded-lg p-4 text-center">ຍັງບໍ່ມີຂໍ້ມູນ</div>
          ) : (
            <div className="space-y-1">
              {spenders.slice(0, 3).map((s, i) => (
                <div key={i} className="flex items-center gap-2 border rounded-lg p-2 bg-card">
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
        onProducts={() => document.getElementById("cats")?.scrollIntoView({ behavior: "smooth" }) ?? window.scrollTo({ top: 500, behavior: "smooth" })}
        onHistory={() => openIfAuth(() => setHistoryOpen(true))}
        onHelp={() => settings?.help_link ? window.open(settings.help_link, "_blank") : statusDialog.error("ຍັງບໍ່ໄດ້ຕັ້ງ", "ແອັດມິນຍັງບໍ່ໄດ້ຕັ້ງລິ້ງຊ່ວຍເຫຼືອ")}
      />

      <AdPopup />
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
      {user && <TopupDialog open={topupOpen} onOpenChange={setTopupOpen} userId={user.id} qrUrl={settings?.qr_url} onDone={reloadProfile} />}
      {user && <HistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} userId={user.id} />}
      {user && <MessagesDialog open={msgOpen} onOpenChange={setMsgOpen} userId={user.id} />}
      {user && profile && <ProfileDialog open={profOpen} onOpenChange={setProfOpen} profile={profile} onUpdated={reloadProfile} />}
      {isAdmin && <AdminDialog open={adminOpen} onOpenChange={setAdminOpen} />}
      <ProductDialog product={selected} onOpenChange={(o) => !o && setSelected(null)} onPurchased={reloadProfile} isLoggedIn={!!user} onRequireLogin={() => { setSelected(null); setAuthOpen(true); }} />
      <StatusDialog />
    </div>
  );
}

function ProductCard({ p, onClick }: { p: Product; onClick: () => void }) {
  return (
    <button onClick={onClick} className="border rounded-xl overflow-hidden bg-card text-left flex flex-col hover:shadow-md transition-shadow">
      <div className="aspect-square bg-muted">
        {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-4xl">🎮</div>}
      </div>
      <div className="p-2 space-y-0.5">
        <div className="text-sm font-medium truncate">{p.name}</div>
        <div className="flex items-baseline gap-1">
          <span className="text-primary font-bold text-sm">{formatKip(p.price)}</span>
          {p.original_price && p.original_price > p.price && (
            <span className="text-destructive line-through text-xs">{formatKip(p.original_price)}</span>
          )}
        </div>
      </div>
    </button>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="border rounded-xl p-3 bg-card">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-bold">{value.toLocaleString()}</div>
    </div>
  );
}
