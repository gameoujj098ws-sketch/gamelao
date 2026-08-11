import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

type Kind = "success" | "error" | "loading";
type Status = { open: boolean; kind: Kind; title: string; detail: string };
let listeners: Array<() => void> = [];
let state: Status = { open: false, kind: "success", title: "", detail: "" };
const emit = () => listeners.forEach((l) => l());

export const statusDialog = {
  success: (title: string, detail = "") => { state = { open: true, kind: "success", title, detail }; emit(); },
  error: (title: string, detail = "") => { state = { open: true, kind: "error", title, detail }; emit(); },
  loading: (title: string, detail = "") => { state = { open: true, kind: "loading", title, detail }; emit(); },
  close: () => { state = { ...state, open: false }; emit(); },
};

export function StatusDialog() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((n) => n + 1);
    listeners.push(l);
    return () => {
      listeners = listeners.filter((x) => x !== l);
    };
  }, []);
  const loading = state.kind === "loading";
  return (
    <Dialog open={state.open} onOpenChange={(o) => !o && !loading && statusDialog.close()}>
      <DialogContent className="max-w-xs text-center rounded-3xl">
        <div className="flex flex-col items-center gap-3 py-2">
          {loading ? (
            <Loader2 className="h-14 w-14 text-primary animate-spin" />
          ) : state.kind === "success" ? (
            <CheckCircle2 className="h-14 w-14 text-[color:var(--color-success)]" />
          ) : (
            <XCircle className="h-14 w-14 text-destructive" />
          )}
          <div className="text-lg font-bold">{state.title}</div>
          {state.detail && <div className="text-sm text-muted-foreground whitespace-pre-line">{state.detail}</div>}
          {!loading && (
            <Button className="w-full rounded-2xl" onClick={() => statusDialog.close()}>
              ຕົກລົງ
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
