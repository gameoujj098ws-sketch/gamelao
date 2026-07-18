import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useSession } from "@/hooks/useSession";
import { AdminPanel } from "@/components/app/AdminDialog";
import { StatusDialog } from "@/components/app/StatusDialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({ meta: [{ title: "ຈັດການແອັດມິນ" }] }),
});

function AdminPage() {
  const { isAdmin, loading, user } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate({ to: "/" });
  }, [loading, user, isAdmin, navigate]);

  if (loading || !isAdmin) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">ກຳລັງໂຫຼດ...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-card/80 backdrop-blur border-b h-14 px-3 flex items-center gap-2">
        <Button size="icon" variant="ghost" onClick={() => navigate({ to: "/" })}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="font-bold text-lg">ຈັດການແອັດມິນ</div>
      </header>
      <main className="max-w-5xl mx-auto p-3 pb-10">
        <AdminPanel />
      </main>
      <StatusDialog />
    </div>
  );
}
