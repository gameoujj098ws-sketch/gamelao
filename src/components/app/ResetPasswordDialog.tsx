import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { statusDialog } from "./StatusDialog";

export function ResetPasswordDialog() {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Detect recovery link on load (Supabase parses hash into a session and fires PASSWORD_RECOVERY)
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    if (hash.includes("type=recovery")) setOpen(true);

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setOpen(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async () => {
    if (pw.length < 6) return statusDialog.error("ລົ້ມເຫຼວ", "ລະຫັດຕ້ອງມີຢ່າງໜ້ອຍ 6 ຕົວອັກສອນ");
    if (pw !== confirm) return statusDialog.error("ລົ້ມເຫຼວ", "ລະຫັດຢືນຢັນບໍ່ຕົງກັນ");
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      setOpen(false);
      setPw("");
      setConfirm("");
      if (typeof window !== "undefined" && window.location.hash) {
        history.replaceState(null, "", window.location.pathname + window.location.search);
      }
      statusDialog.success("ສຳເລັດ", "ປ່ຽນລະຫັດຜ່ານສຳເລັດ");
    } catch (e: unknown) {
      statusDialog.error("ລົ້ມເຫຼວ", (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>ຕັ້ງລະຫັດຜ່ານໃໝ່</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>ລະຫັດຜ່ານໃໝ່</Label>
            <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
          </div>
          <div>
            <Label>ຢືນຢັນລະຫັດຜ່ານໃໝ່</Label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <Button className="w-full" disabled={loading} onClick={submit}>
            ບັນທຶກ
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
