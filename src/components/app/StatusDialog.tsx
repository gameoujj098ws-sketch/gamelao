import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

type Status = { open: boolean; success: boolean; title: string; detail: string };
let listeners: Array<() => void> = [];
let state: Status = { open: false, success: true, title: "", detail: "" };

export const statusDialog = {
  success: (title: string, detail = "") => {
    state = { open: true, success: true, title, detail };
    listeners.forEach((l) => l());
  },
  error: (title: string, detail = "") => {
    state = { open: true, success: false, title, detail };
    listeners.forEach((l) => l());
  },
  close: () => {
    state = { ...state, open: false };
    listeners.forEach((l) => l());
  },
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
  return (
    <Dialog open={state.open} onOpenChange={(o) => !o && statusDialog.close()}>
      <DialogContent className="max-w-xs text-center">
        <div className="flex flex-col items-center gap-3 py-2">
          {state.success ? (
            <CheckCircle2 className="h-14 w-14 text-[color:var(--color-success)]" />
          ) : (
            <XCircle className="h-14 w-14 text-destructive" />
          )}
          <div className="text-lg font-bold">{state.title}</div>
          {state.detail && <div className="text-sm text-muted-foreground whitespace-pre-line">{state.detail}</div>}
          <Button className="w-full" onClick={() => statusDialog.close()}>
            ຕົກລົງ
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
