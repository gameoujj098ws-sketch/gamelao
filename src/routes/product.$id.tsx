import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ShoppingCart, Package, Minus, Plus, Copy, Facebook, MessageCircle, Twitter, Bell, CheckCircle2, ClipboardList, Boxes, AlignLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { formatKip } from "@/lib/format";
import { Input } from "@/components/ui/input";
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
type Pack = { id: string; name: string; price: number; image_url: string | null };
type Field = { id: string; label: string };

function ProductPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user, reloadProfile } = useSession();
  const [p, setP] = useState<Product | null>(null);
  const [stock, setStock] = useState(0);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [packId, setPackId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const loadStock = (pid: string) =>
    supabase.from("product_stock").select("id", { count: "exact", head: true }).eq("product_id", pid).eq("sold", false)
      .then(({ count }) => setStock(count ?? 0));

  useEffect(() => {
    supabase.from("products").select("*").eq("id", id).maybeSingle().then(({ data }) => {
      setP(data as Product | null);
      if (data && !(data as Product).is_service) loadStock(id);
      if (data && (data as Product).is_service) {
        supabase.from("service_packages").select("id,name,price,image_url").eq("product_id", id).order("sort").then(({ data: pk }) => setPacks(pk ?? []));
        supabase.from("service_fields").select("id,label").eq("product_id", id).order("sort").then(({ data: f }) => setFields(f ?? []));
      }
    });
  }, [id]);

  const selectedPack = packs.find((x) => x.id === packId) ?? null;
  const unitPrice = p ? (p.is_service ? (selectedPack ? selectedPack.price : p.price) : p.price) : 0;
  const discount = p?.original_price && p.original_price > p.price
    ? Math.round((1 - p.price / p.original_price) * 100) : 0;
  const available = p ? (p.is_service || stock > 0) : false;
  const maxQty = p?.is_service ? 1 : Math.max(stock, 1);

  const fieldsFilled = fields.length === 0 || fields.every((f) => (answers[f.id] ?? "").trim().length > 0);
  const packOk = packs.length === 0 || !!packId;
  const canBuy = p ? (p.is_service ? packOk && fieldsFilled && (fields.length > 0 || note.trim().length > 0 || fields.length === 0) : available) : false;

  const buy = async () => {
    if (!p) return;
    if (!user) return navigate({ to: "/auth" });
    setLoading(true);
    statusDialog.loading("ລໍຖ້າບຶດໜຶ່ງ...", "ກຳລັງດຳເນີນການ");
    try {
      if (p.is_service) {
        if (packs.length > 0 && !packId) throw new Error("ກະລຸນາເລືອກແພັກເກດ");
        const list = fields.length > 0
          ? fields.map((f) => ({ label: f.label, value: (answers[f.id] ?? "").trim() }))
          : [{ label: p.service_field_label || "ຂໍ້ມູນ", value: note.trim() }];
        if (list.some((x) => !x.value)) throw new Error("ກະລຸນາໃສ່ຂໍ້ມູນໃຫ້ຄົບ");
        const { error } = await supabase.rpc("purchase_service_package", {
          _product_id: p.id, _package_id: packId, _answers: list,
        });
        if (error) throw error;
        statusDialog.success("ສຳເລັດ", "ຄຳສັ່ງຊື້ຂອງທ່ານກຳລັງດຳເນີນການ ລໍຖ້າແອັດມິນ");
        setAnswers({});
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
          <div className="card-soft rounded-3xl p-3 relative">
            {p.is_service && (
              <span className="absolute -top-2 right-4 z-10 bg-primary text-primary-foreground text-xs font-bold px-4 py-2 rounded-full flex items-center gap-1.5 shadow-lg">
                <Bell className="h-3.5 w-3.5" />ບໍລິການ
              </span>
            )}
            <div className="relative rounded-2xl overflow-hidden bg-muted aspect-square">
              {p.image_url ? (
                <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-6xl">🎮</div>
              )}
              {discount > 0 && (
                <span className="absolute top-3 right-3 bg-destructive text-destructive-foreground text-xs font-bold px-3 py-1 rounded-full">-{discount}%</span>
              )}
            </div>
          </div>

          <h1 className="text-xl font-extrabold px-1">{p.name}</h1>
          <div className="flex items-baseline gap-2 px-1">
            <span className="text-3xl font-extrabold text-primary">{formatKip(unitPrice)}</span>
            {discount > 0 && <span className="text-muted-foreground line-through text-sm">{formatKip(p.original_price!)}</span>}
          </div>
          <div className="flex items-center gap-4 text-xs px-1">
            <span className="flex items-center gap-1.5 font-medium">
              <span className={`h-2 w-2 rounded-full animate-pulse ${available ? "bg-success" : "bg-destructive"}`} />
              <span className={available ? "text-success" : "text-destructive"}>{available ? "ພ້ອມຂາຍ" : "ໝົດ"}</span>
            </span>
            {!p.is_service && (
              <span className="flex items-center gap-1.5 text-primary font-medium">
                <Package className="h-3.5 w-3.5" />ເຫຼືອ {stock} ອັນ
              </span>
            )}
          </div>

          <div className="card-soft rounded-3xl p-4">
            <div className="font-bold mb-1 flex items-center gap-2"><AlignLeft className="h-4 w-4 text-primary" />ລາຍລະອຽດ</div>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{p.description || "ບໍ່ມີລາຍລະອຽດ"}</p>
          </div>

          {p.is_service && packs.length > 0 && (
            <div className="card-soft rounded-3xl p-4 space-y-3">
              <div className="font-bold flex items-center gap-2"><Boxes className="h-4 w-4 text-primary" />ເລືອກແພັກເກດ</div>
              <div className="grid grid-cols-2 gap-3">
                {packs.map((k) => {
                  const on = packId === k.id;
                  return (
                    <button key={k.id} onClick={() => setPackId(k.id)}
                      className={`relative rounded-2xl border-2 p-3 text-center transition ${on ? "border-primary bg-primary/5" : "border-border"}`}>
                      {on && <CheckCircle2 className="absolute top-1.5 right-1.5 h-5 w-5 text-primary" />}
                      <div className="aspect-square rounded-xl overflow-hidden bg-muted mb-2">
                        {k.image_url ? <img src={k.image_url} alt={k.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-2xl">🎁</div>}
                      </div>
                      <div className="font-bold text-sm truncate">{k.name}</div>
                      <div className="text-destructive font-extrabold">{formatKip(k.price)}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {p.is_service && (
            <div className="card-soft rounded-3xl p-4 space-y-3">
              <div className="font-bold flex items-center gap-2"><ClipboardList className="h-4 w-4 text-primary" />ຕື່ມຂໍ້ມູນການສັ່ງຊື້</div>
              {fields.length > 0 ? (
                fields.map((f) => (
                  <div key={f.id} className="space-y-1">
                    <Label className="text-sm">{f.label} <span className="text-destructive">*</span></Label>
                    <Input value={answers[f.id] ?? ""} onChange={(e) => setAnswers({ ...answers, [f.id]: e.target.value })} placeholder="ໃສ່ຂໍ້ມູນໃຫ້ຖືກ" className="rounded-2xl" />
                  </div>
                ))
              ) : (
                <>
                  <Label className="text-sm">{p.service_field_label || "ຂໍ້ມູນທີ່ຕ້ອງການ (ຊື່ຜູ້ໃຊ້ເກມ ຯລຯ)"} <span className="text-destructive">*</span></Label>
                  <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="rounded-2xl" />
                </>
              )}
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
              <span className="text-xl font-extrabold text-primary">{formatKip(unitPrice * (p.is_service ? 1 : qty))}</span>
            </div>
            <button
              onClick={buy}
              disabled={loading || !available || !canBuy}
              className="w-full bg-primary text-primary-foreground rounded-full h-12 flex items-center justify-center gap-2 font-bold active:scale-[.99] disabled:opacity-50"
            >
              {p.is_service ? <Bell className="h-5 w-5" /> : <ShoppingCart className="h-5 w-5" />}
              {p.is_service ? "ຢືນຢັນສັ່ງບໍລິການ" : "ຢືນຢັນຊື້ສິນຄ້າ"}
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
