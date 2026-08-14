import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { Header, BottomNav } from "@/components/app/Layout";
import { StatusDialog, statusDialog } from "@/components/app/StatusDialog";

export type ShellSettings = {
  site_name: string;
  logo_url: string | null;
  help_link: string | null;
  primary_color: string | null;
};

/** Shared floating header + bottom nav shell used on every page except /admin and /auth. */
export function AppShell({
  children,
  onProducts,
}: {
  children: ReactNode;
  onProducts?: () => void;
}) {
  const navigate = useNavigate();
  const { user, profile, isAdmin } = useSession();
  const [settings, setSettings] = useState<ShellSettings | null>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const load = () =>
      supabase
        .from("site_settings")
        .select("site_name,logo_url,help_link,primary_color")
        .eq("id", 1)
        .maybeSingle()
        .then(({ data }) => setSettings(data as ShellSettings));
    load();
    const ch = supabase
      .channel("shell-settings")
      .on("postgres_changes", { event: "*", schema: "public", table: "site_settings" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);


  useEffect(() => {
    if (!user) { setUnread(0); return; }
    const load = () =>
      supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("from_admin", true)
        .eq("read", false)
        .then(({ count }) => setUnread(count ?? 0));
    load();
    const ch = supabase
      .channel(`shell-msgs-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `user_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const openAuth = () => navigate({ to: "/auth" });
  const ifAuth = (fn: () => void) => (user ? fn() : openAuth());

  return (
    <div
      className="min-h-screen pt-[92px] pb-28"
      style={themeVars(settings?.primary_color)}
    >

      <Header
        siteName={settings?.site_name || "Game Lao"}
        logoUrl={settings?.logo_url}
        profile={profile}
        unreadMsgs={unread}
        isAdmin={isAdmin}
        onLogin={openAuth}
        onProfile={() => ifAuth(() => navigate({ to: "/profile" }))}
        onHistory={() => ifAuth(() => navigate({ to: "/history" }))}
        onTopup={() => ifAuth(() => navigate({ to: "/topup" }))}
        onAdmin={() => navigate({ to: "/admin" })}
        onMessages={() => ifAuth(() => navigate({ to: "/messages" }))}
        helpLink={settings?.help_link}
      />

      {children}

      <BottomNav
        onTopup={() => ifAuth(() => navigate({ to: "/topup" }))}
        onProducts={onProducts ?? (() => navigate({ to: "/" }))}
        onHistory={() => ifAuth(() => navigate({ to: "/history" }))}
        onHelp={() =>
          settings?.help_link
            ? window.open(settings.help_link, "_blank")
            : statusDialog.error("ຍັງບໍ່ໄດ້ຕັ້ງ", "ແອັດມິນຍັງບໍ່ໄດ້ຕັ້ງລິ້ງຊ່ວຍເຫຼືອ")
        }
      />

      <StatusDialog />
    </div>
  );
}
