import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ShoppingCart, Package, Minus, Plus, Copy, Facebook, MessageCircle, Twitter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { formatKip } from "@/lib/format";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StatusDialog, statusDialog } from "@/components/app/StatusDialog";
import { BottomNav } from "@/components/app/Layout";

export const Route = createFileRoute("/product/$id")({
  head: () => ({
    meta: [
      { title: "ລາຍລະອຽດສິນຄ້າ | Game Lao" },
      { name: "description", content: "ເບິ່ງລາຍລະອຽດສິນຄ້າ, ລາຄາ ແລະ ຈຳນວນສະຕ໊ອກ ກ່ອນຢືນຢັນການຊື້" },
      { property: "og:title", content: "ລາຍລະອຽດສິນຄ້າ | Game Lao" },
      { property: "og:description", content: "ເບິ່ງລາຍລະອຽດສິນຄ້າ ແລະ ຢືນຢັນການຊື້" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProductPage,
});

type Product = {
  id: string; name: string; price: number; original_price: number | null;
  description: string | null; image_url: string | null; is_service: boolean;
  service_field_label: string | null;
};

function ProductPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user, reloadProfile } = useSession();
  const [p, setP] = useState<Product | null>(null);
  const [stock, setStock] = useState(0);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const loadStock = (pid: string) =>
    supabase.from("product_stock").select("id", { count: "exact", head: true }).eq("product_id", pid).eq("sold", false)
      .then(({ count }) => setStock(count ?? 0));

  useEffect(() => {
    supabase.from("products").select("*").eq("id", id).maybeSingle().then(({ data }) => {
      setP(data as Product | null);
      if (data && !(data as Product).is_service) loadStock(id);
    });
  }, [id]);

  const discount = p?.original_price && p.original_price > p.price
    ? Math.round((1 - p.price / p.original_price) * 100) : 0;
  const available = p ? (p.is_service || stock > 0) : false;
  const maxQty = p?.is_service ? 1 : Math.max(stock, 1);

  const buy = async () => {
    if (!p) return;
    if (!user) return navigate({ to: "/auth" });
    setLoading(true);
    try {
      if (p.is_service) {
        if (!note.trim()) throw new Error("ກະລຸນາໃສ່ຂໍ້ມູນ");
        const { error } = await supabase.rpc("purchase_service", { _product_id: p.id, _note: note });
        if (error) throw error;
        statusDialog.success("ສຳເລັດ", "ຄຳສັ່ງຊື້ຂອງທ່ານກຳລັງດຳເນີນການ ລໍຖ້າແອັດມິນ");
      } else {
        const results: string[] = [];
        for (let i = 0; i < qty; i++) {
          const { data, error } = await supabase.rpc("purchase_product", { _product_id: p.id });
          if (error) throw error;
          results.push((data as { game_data: string }).game_data);
        }
        statusDialog.success("ຊື້ສຳເລັດ", `ຂໍ້ມູນ:\n${results.join("\n")}`);
        loadStock(p.id);
      }
      reloadProfile();
      setNote("");
      setQty(1);
    } catch (e: unknown) {
      const msg = (e as Error).message;
      const map: Record<string, string> = {
        insufficient_balance: "ຍອດເງີນບໍ່ພຽງພໍ",
        out_of_stock: "ສິນຄ້າໝົດແລ້ວ",
        not_authenticated: "ກະລຸນາເຂົ້າສູ່ລະບົບ",
      };
      statusDialog.error("ລົ້ມເຫຼວ", map[msg] || msg);
    } finally {
      setLoading(false);
    }
  };

  const share = (kind: string) => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (kind === "copy") {
      navigator.clipboard.writeText(url);
      statusDialog.success("ສຳເລັດ", "ຄັດລອກລິ້ງແລ້ວ");
      return;
    }
    const links: Record<string, string> = {
      fb: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      line: `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}`,
      tw: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}`,
    };
    window.open(links[kind], "_blank");
  };

  return (
    <div className="min-h-screen pt-16 pb-32 bg-background">
      <header className="fixed top-0 inset-x-0 z-40 bg-card/95 backdrop-blur border-b border-border h-14 px-2 flex items-center gap-2">
        <button onClick={() => navigate({ to: "/" })} className="h-10 px-3 rounded-2xl flex items-center gap-2 text-sm font-medium">
          <ArrowLeft className="h-5 w-5" />ກັບຄືນ
        </button>
      </header>

      {!p ? (
        <div className="p-6 text-center text-sm text-muted-foreground">ບໍ່ພົບສິນຄ້າ</div>
      ) : (
        <main className="max-w-md mx-auto p-3 space-y-3">
          <div className="relative rounded-3xl overflow-hidden bg-muted aspect-square">
            {p.image_url ? (
              <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-6xl">🎮</div>
            )}
            {discount > 0 && (
              <span className="absolute top-3 right-3 bg-destructive text-destructive-foreground text-xs font-bold px-3 py-1 rounded-full">-{discount}%</span>
            )}
          </div>

          <h1 className="text-xl font-extrabold">{p.name}</h1>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-primary">{formatKip(p.price)}</span>
            {discount > 0 && <span className="text-muted-foreground line-through text-sm">{formatKip(p.original_price!)}</span>}
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 font-medium">
              <span className={`h-2 w-2 rounded-full ${available ? "bg-success" : "bg-destructive"}`} />
              <span className={available ? "text-success" : "text-destructive"}>{available ? "ພ້ອມຂາຍ" : "ໝົດ"}</span>
            </span>
            {!p.is_service && (
              <span className="flex items-center gap-1.5 text-primary font-medium">
                <Package className="h-3.5 w-3.5" />ເຫຼືອ {stock} ອັນ
              </span>
            )}
          </div>

          <div className="card-soft rounded-3xl p-4">
            <div className="font-bold mb-1">ລາຍລະອຽດສິນຄ້າ</div>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{p.description || "ບໍ່ມີລາຍລະອຽດ"}</p>
          </div>

          {p.is_service && (
            <div className="card-soft rounded-3xl p-4 space-y-2">
              <Label className="font-bold">{p.service_field_label || "ຂໍ້ມູນທີ່ຕ້ອງການ (ຊື່ຜູ້ໃຊ້ເກມ ຯລຯ)"}</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="rounded-2xl" />
            </div>
          )}

          <div className="card-soft rounded-3xl p-4">
            <div className="font-bold mb-3">ແບ່ງປັນສິນຄ້ານີ້</div>
            <div className="grid grid-cols-4 gap-2 text-xs">
              <ShareBtn icon={<Facebook className="h-5 w-5 text-primary" />} label="FB" onClick={() => share("fb")} />
              <ShareBtn icon={<MessageCircle className="h-5 w-5 text-success" />} label="Line" onClick={() => share("line")} />
              <ShareBtn icon={<Twitter className="h-5 w-5 text-primary" />} label="Twitter" onClick={() => share("tw")} />
              <ShareBtn icon={<Copy className="h-5 w-5 text-muted-foreground" />} label="ຄັດລອກ" onClick={() => share("copy")} />
            </div>
          </div>

          <div className="card-soft rounded-3xl p-4 space-y-3">
            {!p.is_service && (
              <div className="flex items-center justify-between">
                <span className="font-medium">ຈຳນວນ</span>
                <div className="flex items-center gap-4">
                  <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground">
                    <Minus className="h-5 w-5" />
                  </button>
                  <span className="font-bold w-6 text-center">{qty}</span>
                  <button onClick={() => setQty((q) => Math.min(maxQty, q + 1))} className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                    <Plus className="h-5 w-5" />
                  </button>
                </div>
              </div>
            )}
            <div className="border-t border-border pt-3 flex items-center justify-between">
              <span className="font-medium">ລວມທັງໝົດ</span>
              <span className="text-xl font-extrabold text-primary">{formatKip(p.price * (p.is_service ? 1 : qty))}</span>
            </div>
            <button
              onClick={buy}
              disabled={loading || !available}
              className="w-full bg-primary text-primary-foreground rounded-full h-12 flex items-center justify-center gap-2 font-bold active:scale-[.99] disabled:opacity-50"
            >
              <ShoppingCart className="h-5 w-5" />ຢືນຢັນຊື້ສິນຄ້າ
            </button>
          </div>
        </main>
      )}

      <BottomNav
        onTopup={() => navigate({ to: "/topup" })}
        onProducts={() => navigate({ to: "/" })}
        onHistory={() => navigate({ to: user ? "/history" : "/auth" })}
        onHelp={() => navigate({ to: "/" })}
      />
      <StatusDialog />
    </div>
  );
}

function ShareBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1 py-1">
      {icon}
      <span className="text-muted-foreground">{label}</span>
    </button>
  );
}
