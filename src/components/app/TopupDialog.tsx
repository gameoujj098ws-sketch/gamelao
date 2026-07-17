import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { statusDialog } from "./StatusDialog";
import { formatKip } from "@/lib/format";
import { Upload } from "lucide-react";

const PRESETS = [10000, 20000, 50000, 60000, 100000, 200000];

export function TopupDialog({
  open,
  onOpenChange,
  userId,
  qrUrl,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  userId: string;
  qrUrl?: string | null;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState<number>(10000);
  const [custom, setCustom] = useState("");
  const [showQr, setShowQr] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const finalAmount = custom ? parseInt(custom) || 0 : amount;

  const submitSlip = async () => {
    if (!file) return statusDialog.error("ລົ້ມເຫຼວ", "ກະລຸນາແນບຮູບສະລິບ");
    if (finalAmount < 1000) return statusDialog.error("ລົ້ມເຫຼວ", "ຈຳນວນເງີນບໍ່ຖືກຕ້ອງ");
    setLoading(true);
    try {
      const path = `${userId}/${Date.now()}-${file.name}`;
      const up = await supabase.storage.from("slips").upload(path, file);
      if (up.error) throw up.error;
      const { error } = await supabase.from("topups").insert({
        user_id: userId,
        amount: finalAmount,
        slip_url: path,
        method: "qr",
        status: "pending",
      });
      if (error) throw error;
      onOpenChange(false);
      setFile(null);
      setShowQr(false);
      statusDialog.success("ສຳເລັດ", "ສົ່ງສະລິບໃຫ້ແອັດມິນແລ້ວ ລໍຖ້າອະນຸມັດ");
      onDone();
    } catch (e: unknown) {
      statusDialog.error("ລົ້ມເຫຼວ", (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const submitCode = async () => {
    if (!code.trim()) return statusDialog.error("ລົ້ມເຫຼວ", "ກະລຸນາໃສ່ໂຄດ");
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("redeem_code", { _code: code.trim() });
      if (error) throw error;
      onOpenChange(false);
      setCode("");
      statusDialog.success("ສຳເລັດ", `ເຕີມເງີນສຳເລັດ +${formatKip((data as { amount: number }).amount)}`);
      onDone();
    } catch (e: unknown) {
      statusDialog.error("ລົ້ມເຫຼວ", (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>ເຕີມເງີນເຂົ້າກະເປົ໋າ</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="qr">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="qr">QR Code</TabsTrigger>
            <TabsTrigger value="code">ໃສ່ໂຄດ</TabsTrigger>
          </TabsList>
          <TabsContent value="qr" className="space-y-3 pt-3">
            {!showQr ? (
              <>
                <Label>ເລືອກຈຳນວນເງີນ</Label>
                <div className="grid grid-cols-3 gap-2">
                  {PRESETS.map((p) => (
                    <Button
                      key={p}
                      variant={amount === p && !custom ? "default" : "outline"}
                      size="sm"
                      onClick={() => { setAmount(p); setCustom(""); }}
                    >
                      {p.toLocaleString()}
                    </Button>
                  ))}
                </div>
                <div>
                  <Label>ຫຼືປ້ອນເອງ (₭)</Label>
                  <Input type="number" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="ຈຳນວນ" />
                </div>
                <Button className="w-full" onClick={() => setShowQr(true)} disabled={finalAmount < 1000}>
                  ສ້າງ QR Code ({formatKip(finalAmount)})
                </Button>
              </>
            ) : (
              <>
                <div className="rounded-xl border-2 bg-muted/50 p-4 flex flex-col items-center gap-2">
                  {qrUrl ? (
                    <img src={qrUrl} alt="QR" className="w-48 h-48 object-contain" />
                  ) : (
                    <div className="w-48 h-48 flex items-center justify-center text-xs text-muted-foreground border-2 border-dashed rounded-lg">
                      ແອັດມິນຍັງບໍ່ໄດ້ຕັ້ງ QR
                    </div>
                  )}
                  <div className="font-bold">{formatKip(finalAmount)}</div>
                </div>
                <label className="flex items-center gap-2 border-2 border-dashed rounded-lg p-3 cursor-pointer">
                  <Upload className="h-4 w-4" />
                  <span className="text-sm flex-1">{file ? file.name : "ແນບຮູບສະລິບ"}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </label>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setShowQr(false)}>ກັບຄືນ</Button>
                  <Button className="flex-1" disabled={loading} onClick={submitSlip}>ສົ່ງໃຫ້ແອັດມິນ</Button>
                </div>
              </>
            )}
          </TabsContent>
          <TabsContent value="code" className="space-y-3 pt-3">
            <div>
              <Label>ໂຄດເຕີມເງີນ</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            <Button className="w-full" disabled={loading} onClick={submitCode}>ໃຊ້ໂຄດ</Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
