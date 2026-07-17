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
      <DialogContent className="max-w-sm p-0 overflow-hidden gap-0 [&>button.absolute]:hidden">
        <div className="relative">
          <button onClick={() => setOpen(false)} className="absolute top-2 right-2 z-10 bg-black/60 text-white rounded-full p-1.5">
            <X className="h-4 w-4" />
          </button>
          {ad.link ? (
            <a href={ad.link} target="_blank" rel="noopener noreferrer"><img src={ad.image_url} alt="ad" className="w-full" /></a>
          ) : (
            <img src={ad.image_url} alt="ad" className="w-full" />
          )}
        </div>
        <div className="p-3 grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>ປິດ</Button>
          <Button variant="secondary" size="sm" onClick={snooze}><BellOff className="h-4 w-4 mr-1" />ປິດ 1 ຊົ່ວໂມງ</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
