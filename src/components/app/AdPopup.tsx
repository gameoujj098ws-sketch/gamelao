import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, BellOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const SNOOZE_KEY = "ad_snooze_until";

export function AdPopup() {
  const [ad, setAd] = useState<{ image_url: string; link: string | null } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const snooze = parseInt(localStorage.getItem(SNOOZE_KEY) || "0");
    if (Date.now() < snooze) return;
    supabase.from("ads").select("image_url, link").eq("active", true).order("created_at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => {
        if (data?.image_url) { setAd(data); setOpen(true); }
      });
  }, []);

  const snooze = () => {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + 60 * 60 * 1000));
    setOpen(false);
  };

  if (!ad) return null;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="w-auto max-w-[90vw] sm:max-w-[420px] p-0 bg-transparent border-0 shadow-none gap-0 [&>button.absolute]:hidden"
      >
        <div className="relative inline-block">
          <button
            onClick={() => setOpen(false)}
            aria-label="ປິດ"
            className="absolute -top-2 -left-2 z-10 h-9 w-9 rounded-full bg-card text-foreground shadow-lg border flex items-center justify-center active:scale-95 transition"
          >
            <X className="h-5 w-5" />
          </button>
          {ad.link ? (
            <a href={ad.link} target="_blank" rel="noopener noreferrer" className="block">
              <img src={ad.image_url} alt="ad" className="block w-auto h-auto max-w-full max-h-[70vh] rounded-3xl shadow-2xl" />
            </a>
          ) : (
            <img src={ad.image_url} alt="ad" className="block w-auto h-auto max-w-full max-h-[70vh] rounded-3xl shadow-2xl" />
          )}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="secondary" size="sm" className="rounded-2xl" onClick={() => setOpen(false)}>ປິດ</Button>
          <Button size="sm" className="rounded-2xl" onClick={snooze}><BellOff className="h-4 w-4 mr-1" />ປິດ 1 ຊົ່ວໂມງ</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
