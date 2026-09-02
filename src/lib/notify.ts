import { notifyDiscord, type NotifyKind } from "@/lib/notify.functions";

/** Fire-and-forget Discord notification; never blocks or breaks the UI flow. */
export function notify(kind: NotifyKind, title: string, lines: (string | null | undefined)[]) {
  const clean = lines.filter((l): l is string => !!l && l.trim().length > 0);
  void notifyDiscord({ data: { kind, title, lines: clean } }).catch(() => {});
}
