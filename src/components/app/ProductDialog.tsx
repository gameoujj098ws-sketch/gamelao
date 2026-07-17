import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { statusDialog } from "./StatusDialog";
import { formatKip } from "@/lib/format";

export type Product = {
  id: string;
  name: string;
  price: number;
  original_price: number | null;
  description: string | null;
  image_url: string | null;
  is_service: boolean;
  service_field_label: string | null;
  category_id: string | null;
  hidden_from_home: boolean;
};

export function ProductDialog({
  product,
  onOpenChange,
  onPurchased,
  isLoggedIn,
  onRequireLogin,
}: {
  product: Product | null;
  onOpenChange: (o: boolean) => void;
  onPurchased: () => void;
  isLoggedIn: boolean;
  onRequireLogin: () => void;
}) {
  const [note, setNote] = useState("");
  const [stock, setStock] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (product && !product.is_service) {
      supabase
        .from("product_stock")
        .select("id", { count: "exact", head: true })
        .eq("product_id", product.id)
        .eq("sold", false)
        .then(({ count }) => setStock(count ?? 0));
    }
    setNote("");
  }, [product]);

  if (!product) return null;

  const buy = async () => {
    if (!isLoggedIn) return onRequireLogin();
    setLoading(true);
    try {
      if (product.is_service) {
        if (!note.trim()) throw new Error("ກະລຸນາໃສ່ຂໍ້ມູນ");
        const { error } = await supabase.rpc("purchase_service", { _product_id: product.id, _note: note });
        if (error) throw error;
        statusDialog.success("ສຳເລັດ", "ຄຳສັ່ງຊື້ຂອງທ່ານກຳລັງດຳເນີນການ ລໍຖ້າແອັດມິນ");
      } else {
        const { data, error } = await supabase.rpc("purchase_product", { _product_id: product.id });
        if (error) throw error;
        statusDialog.success("ຊື້ສຳເລັດ", `ຂໍ້ມູນ: ${(data as { game_data: string }).game_data}`);
      }
      onOpenChange(false);
      onPurchased();
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

  return (
    <Dialog open={!!product} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{product.name}</DialogTitle>
        </DialogHeader>
        {product.image_url && (
          <img src={product.image_url} alt={product.name} className="w-full aspect-video object-cover rounded-lg" />
        )}
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold text-primary">{formatKip(product.price)}</span>
          {product.original_price && product.original_price > product.price && (
            <span className="line-through text-destructive text-sm">{formatKip(product.original_price)}</span>
          )}
        </div>
        {product.description && <p className="text-sm text-muted-foreground whitespace-pre-line">{product.description}</p>}
        {!product.is_service && <div className="text-xs text-muted-foreground">ໃນສະຕ໊ອກ: {stock} ຊິ້ນ</div>}
        {product.is_service && (
          <div>
            <Label>{product.service_field_label || "ຂໍ້ມູນທີ່ຕ້ອງການ (ຊື່ຜູ້ໃຊ້ເກມ ຯລຯ)"}</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          </div>
        )}
        <Button className="w-full" disabled={loading} onClick={buy}>
          ຊື້ດຽວນີ້ ({formatKip(product.price)})
        </Button>
      </DialogContent>
    </Dialog>
  );
}

// dummy import to avoid unused
Input;
