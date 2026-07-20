import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { statusDialog, StatusDialog } from "@/components/app/StatusDialog";
import { LogIn, UserPlus, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "ເຂົ້າສູ່ລະບົບ / ສະໝັກ — Game Lao" },
      { name: "description", content: "ເຂົ້າສູ່ລະບົບ ຫຼື ສະໝັກສະມາຊິກເພື່ອຊື້ໄອດີເກມ Roblox" },
    ],
  }),
});

function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [logo, setLogo] = useState<string | null>(null);
  const [siteName, setSiteName] = useState("Game Lao");

  useEffect(() => {
    supabase.from("site_settings").select("logo_url, site_name").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) { setLogo(data.logo_url); setSiteName(data.site_name || "Game Lao"); }
    });
    // if already logged in, bounce to home
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background p-4 flex flex-col gap-4">
      {/* Floating header pill */}
      <div className="glass rounded-3xl p-3 flex items-center gap-3 shadow-lg">
        {logo ? (
          <img src={logo} alt="" className="h-12 w-12 rounded-2xl object-cover" />
        ) : (
          <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground font-black">
            {siteName[0]}
          </div>
        )}
        <div className="flex-1 grid grid-cols-2 gap-2">
          <button
            onClick={() => setTab("login")}
            className={`rounded-2xl py-2 text-sm font-bold transition ${tab === "login" ? "bg-gradient-to-b from-primary to-primary/80 text-primary-foreground shadow" : "bg-white/70 dark:bg-white/10 text-foreground border border-primary/30"}`}
          >
            ເຂົ້າສູ່ລະບົບ
          </button>
          <button
            onClick={() => setTab("register")}
            className={`rounded-2xl py-2 text-sm font-bold transition ${tab === "register" ? "bg-gradient-to-b from-primary to-primary/80 text-primary-foreground shadow" : "bg-white/70 dark:bg-white/10 text-foreground border border-primary/30"}`}
          >
            ສະໝັກ
          </button>
        </div>
      </div>

      <Link to="/" className="inline-flex items-center gap-1 text-primary text-sm self-start bg-primary/10 rounded-full px-3 py-1.5">
        <ArrowLeft className="h-4 w-4" /> ໜ້າຫຼັກ
      </Link>

      <div className="glass rounded-3xl overflow-hidden shadow-lg">
        <div className="bg-gradient-to-b from-primary to-primary/70 text-primary-foreground p-5">
          <div className="flex items-center gap-2 text-2xl font-black">
            {tab === "login" ? <><LogIn className="h-6 w-6" /> ເຂົ້າສູ່ລະບົບ</> : <><UserPlus className="h-6 w-6" /> ສະໝັກສະມາຊິກ</>}
          </div>
          <div className="text-sm opacity-90 mt-1">
            {tab === "login" ? (
              <>ຍັງບໍ່ມີບັນຊີ? <button onClick={() => setTab("register")} className="underline font-semibold">ສະໝັກສະມາຊິກ</button></>
            ) : (
              <>ມີບັນຊີແລ້ວ? <button onClick={() => setTab("login")} className="underline font-semibold">ເຂົ້າສູ່ລະບົບ</button></>
            )}
          </div>
        </div>
        <div className="p-5 bg-card">
          {tab === "login" ? <LoginForm /> : <RegisterForm onDone={() => setTab("login")} />}
        </div>
      </div>
      <StatusDialog />
    </div>
  );
}

function LoginForm() {
  const navigate = useNavigate();
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      let email = id.trim();
      if (!email) throw new Error("ກະລຸນາໃສ່ຂໍ້ມູນ");
      if (!email.includes("@")) {
        const { data } = await supabase.from("profiles").select("email").eq("username", email).maybeSingle();
        if (!data) throw new Error("ບໍ່ພົບບັນຊີນີ້");
        email = data.email;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
      if (error) throw error;
      statusDialog.success("ສຳເລັດ", "ເຂົ້າສູ່ລະບົບສຳເລັດ");
      navigate({ to: "/" });
    } catch (e) {
      statusDialog.error("ລົ້ມເຫຼວ", (e as Error).message);
    } finally { setLoading(false); }
  };

  const forgot = async () => {
    const email = id.trim();
    if (!email || !email.includes("@")) return statusDialog.error("ລົ້ມເຫຼວ", "ໃສ່ອີເມວກ່ອນ");
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    if (error) statusDialog.error("ລົ້ມເຫຼວ", error.message);
    else statusDialog.success("ສຳເລັດ", "ສົ່ງລິ້ງຣີເຊັດລະຫັດໄປທີ່ອີເມວແລ້ວ");
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="font-bold">ຊື່ຜູ້ໃຊ້ ຫຼື ອີເມວ <span className="text-destructive">*</span></Label>
        <Input value={id} onChange={(e) => setId(e.target.value)} placeholder="Username" className="rounded-2xl h-12 mt-1" />
      </div>
      <div>
        <Label className="font-bold">ລະຫັດຜ່ານ <span className="text-destructive">*</span></Label>
        <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="**********" className="rounded-2xl h-12 mt-1" />
      </div>
      <Button className="w-full h-12 rounded-2xl bg-gradient-to-b from-primary to-primary/80 text-lg font-bold" disabled={loading} onClick={submit}>
        <LogIn className="h-5 w-5" /> ເຂົ້າສູ່ລະບົບ
      </Button>
      <button type="button" onClick={forgot} className="text-sm text-primary underline w-full text-center">ລືມລະຫັດຜ່ານ?</button>
    </div>
  );
}

function RegisterForm({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({ username: "", email: "", pw: "", confirm: "" });
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (f.pw !== f.confirm) return statusDialog.error("ລົ້ມເຫຼວ", "ລະຫັດຢືນຢັນບໍ່ຕົງກັນ");
    if (f.username.length < 3) return statusDialog.error("ລົ້ມເຫຼວ", "ຊື່ຜູ້ໃຊ້ຢ່າງໜ້ອຍ 3 ຕົວ");
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: f.email.trim(),
        password: f.pw,
        options: { emailRedirectTo: window.location.origin, data: { username: f.username.trim() } },
      });
      if (error) throw error;
      statusDialog.success("ສຳເລັດ", "ສະໝັກສະມາຊິກສຳເລັດ ກະລຸນາເຂົ້າສູ່ລະບົບ");
      onDone();
    } catch (e) {
      statusDialog.error("ລົ້ມເຫຼວ", (e as Error).message);
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="font-bold">ຊື່ຜູ້ໃຊ້ <span className="text-destructive">*</span></Label>
        <Input value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} placeholder="Username" className="rounded-2xl h-12 mt-1" />
      </div>
      <div>
        <Label className="font-bold">ອີເມວ <span className="text-destructive">*</span></Label>
        <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="user@gmail.com" className="rounded-2xl h-12 mt-1" />
      </div>
      <div>
        <Label className="font-bold">ລະຫັດຜ່ານ <span className="text-destructive">*</span></Label>
        <Input type="password" value={f.pw} onChange={(e) => setF({ ...f, pw: e.target.value })} placeholder="**********" className="rounded-2xl h-12 mt-1" />
      </div>
      <div>
        <Label className="font-bold">ຢືນຢັນລະຫັດຜ່ານ <span className="text-destructive">*</span></Label>
        <Input type="password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} placeholder="**********" className="rounded-2xl h-12 mt-1" />
      </div>
      <Button className="w-full h-12 rounded-2xl bg-gradient-to-b from-primary to-primary/80 text-lg font-bold" disabled={loading} onClick={submit}>
        <UserPlus className="h-5 w-5" /> ສະໝັກສະມາຊິກ
      </Button>
    </div>
  );
}
