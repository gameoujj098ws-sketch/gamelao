import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { statusDialog } from "./StatusDialog";

export function AuthDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [tab, setTab] = useState("login");
  const [loading, setLoading] = useState(false);
  const [login, setLogin] = useState({ id: "", password: "" });
  const [reg, setReg] = useState({ username: "", email: "", password: "", confirm: "" });

  const doLogin = async () => {
    setLoading(true);
    try {
      let email = login.id.trim();
      if (!email.includes("@")) {
        const { data } = await supabase.from("profiles").select("email").eq("username", email).maybeSingle();
        if (!data) throw new Error("ບໍ່ພົບບັນຊີນີ້");
        email = data.email;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password: login.password });
      if (error) throw error;
      onOpenChange(false);
      statusDialog.success("ສຳເລັດ", "ເຂົ້າສູ່ລະບົບສຳເລັດ");
    } catch (e: unknown) {
      statusDialog.error("ລົ້ມເຫຼວ", (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const doRegister = async () => {
    if (reg.password !== reg.confirm) {
      statusDialog.error("ລົ້ມເຫຼວ", "ລະຫັດຢືນຢັນບໍ່ຕົງກັນ");
      return;
    }
    if (!reg.username || reg.username.length < 3) {
      statusDialog.error("ລົ້ມເຫຼວ", "ຊື່ຜູ້ໃຊ້ຕ້ອງມີຢ່າງໜ້ອຍ 3 ຕົວອັກສອນ");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: reg.email.trim(),
        password: reg.password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { username: reg.username.trim() },
        },
      });
      if (error) throw error;
      onOpenChange(false);
      statusDialog.success("ສຳເລັດ", "ສະໝັກສະມາຊິກສຳເລັດ ກະລຸນາເຂົ້າສູ່ລະບົບ");
      setTab("login");
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
          <DialogTitle>ບັນຊີຂອງທ່ານ</DialogTitle>
        </DialogHeader>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="login">ເຂົ້າສູ່ລະບົບ</TabsTrigger>
            <TabsTrigger value="register">ສະໝັກ</TabsTrigger>
          </TabsList>
          <TabsContent value="login" className="space-y-3 pt-3">
            <div>
              <Label>ຊື່ຜູ້ໃຊ້ ຫຼື ອີເມວ</Label>
              <Input value={login.id} onChange={(e) => setLogin({ ...login, id: e.target.value })} />
            </div>
            <div>
              <Label>ລະຫັດຜ່ານ</Label>
              <Input type="password" value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} />
            </div>
            <Button className="w-full" disabled={loading} onClick={doLogin}>ເຂົ້າສູ່ລະບົບ</Button>
          </TabsContent>
          <TabsContent value="register" className="space-y-3 pt-3">
            <div>
              <Label>ຊື່ຜູ້ໃຊ້</Label>
              <Input value={reg.username} onChange={(e) => setReg({ ...reg, username: e.target.value })} />
            </div>
            <div>
              <Label>ອີເມວ</Label>
              <Input type="email" value={reg.email} onChange={(e) => setReg({ ...reg, email: e.target.value })} />
            </div>
            <div>
              <Label>ລະຫັດຜ່ານ</Label>
              <Input type="password" value={reg.password} onChange={(e) => setReg({ ...reg, password: e.target.value })} />
            </div>
            <div>
              <Label>ຢືນຢັນລະຫັດຜ່ານ</Label>
              <Input type="password" value={reg.confirm} onChange={(e) => setReg({ ...reg, confirm: e.target.value })} />
            </div>
            <Button className="w-full" disabled={loading} onClick={doRegister}>ສະໝັກສະມາຊິກ</Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
