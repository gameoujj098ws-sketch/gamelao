import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, X, AlertTriangle, HelpCircle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

type Kind = "success" | "error" | "loading" | "confirm";
type Status = {
  open: boolean;
  kind: Kind;
  title: string;
  detail: string;
  confirmText?: string;
  cancelText?: string;
  resolve?: (v: boolean) => void;
};
let listeners: Array<() => void> = [];
let state: Status = { open: false, kind: "success", title: "", detail: "" };
const emit = () => listeners.forEach((l) => l());

export const statusDialog = {
  success: (title: string, detail = "") => { state = { open: true, kind: "success", title, detail }; emit(); },
  error: (title: string, detail = "") => { state = { open: true, kind: "error", title, detail }; emit(); },
  loading: (title = "ລໍຖ້າບຶດໜຶ່ງ...", detail = "") => { state = { open: true, kind: "loading", title, detail }; emit(); },
  confirm: (title: string, detail = "", confirmText = "ຢືນຢັນ", cancelText = "ຍົກເລີກ") =>
    new Promise<boolean>((resolve) => {
      state = { open: true, kind: "confirm", title, detail, confirmText, cancelText, resolve };
      emit();
    }),
  close: () => {
    state.resolve?.(false);
    state = { ...state, open: false, resolve: undefined };
    emit();
  },
};

export function StatusDialog() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((n) => n + 1);
    listeners.push(l);
    return () => { listeners = listeners.filter((x) => x !== l); };
  }, []);

  const { kind, open, title, detail } = state;
  const loading = kind === "loading";
  const confirming = kind === "confirm";

  const ring =
    kind === "success" ? "border-[color:var(--color-success)]/35 text-[color:var(--color-success)]"
      : kind === "error" ? "border-destructive/35 text-destructive"
      : kind === "confirm" ? "border-primary/35 text-primary"
      : "border-primary/25 text-primary";

  const accept = () => {
    state.resolve?.(true);
    state = { ...state, open: false, resolve: undefined };
    emit();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !loading && statusDialog.close()}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[320px] rounded-[28px] border-0 p-6 text-center shadow-2xl [&>button]:hidden"
      >
        <div className="flex flex-col items-center gap-4">
          <div className={`h-[86px] w-[86px] rounded-full border-[5px] flex items-center justify-center ${ring}`}>
            {loading ? <Loader2 className="h-11 w-11 animate-spin" strokeWidth={2.5} />
              : kind === "success" ? <Check className="h-12 w-12" strokeWidth={3} />
              : kind === "error" ? <X className="h-12 w-12" strokeWidth={3} />
              : <HelpCircle className="h-12 w-12" strokeWidth={2.5} />}
          </div>

          <div className="space-y-1.5">
            <div className="text-xl font-extrabold leading-tight">{title}</div>
            {detail && <div className="text-sm text-muted-foreground whitespace-pre-line">{detail}</div>}
          </div>

          {confirming ? (
            <div className="flex w-full gap-2 pt-1">
              <Button variant="outline" className="flex-1 rounded-2xl h-11 font-bold" onClick={() => statusDialog.close()}>
                {state.cancelText}
              </Button>
              <Button className="flex-1 rounded-2xl h-11 font-bold" onClick={accept}>
                {state.confirmText}
              </Button>
            </div>
          ) : loading ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5" />ຫ້າມປິດໜ້ານີ້
            </div>
          ) : (
            <Button className="w-full rounded-2xl h-11 font-bold" onClick={() => statusDialog.close()}>
              ຕົກລົງ
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
