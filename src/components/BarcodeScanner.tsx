import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, X, SwitchCamera } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
}

export function BarcodeScanner({ open, onClose, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceIdx, setDeviceIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const reader = new BrowserMultiFormatReader();

    (async () => {
      try {
        // Request permission first so labels populate
        const tmp = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
        });
        tmp.getTracks().forEach((t) => t.stop());

        const all = await BrowserMultiFormatReader.listVideoInputDevices();
        if (cancelled) return;
        if (all.length === 0) {
          setError("لا توجد كاميرا متاحة");
          return;
        }
        setDevices(all);

        // Prefer back camera
        let idx = all.findIndex((d) => /back|rear|environment|خلف/i.test(d.label));
        if (idx === -1) idx = all.length - 1;
        if (deviceIdx !== 0) idx = deviceIdx;
        setDeviceIdx(idx);

        const controls = await reader.decodeFromVideoDevice(
          all[idx].deviceId,
          videoRef.current!,
          (result) => {
            if (result) {
              const text = result.getText();
              onDetected(text);
              controls.stop();
              onClose();
            }
          },
        );
        controlsRef.current = controls;
      } catch (e) {
        if (!cancelled) {
          const msg = (e as Error).message || "تعذر فتح الكاميرا";
          setError(msg);
          toast.error("تعذر فتح الكاميرا: " + msg);
        }
      }
    })();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, deviceIdx]);

  const switchCamera = () => {
    if (devices.length < 2) return;
    controlsRef.current?.stop();
    setDeviceIdx((i) => (i + 1) % devices.length);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            مسح الباركود بالكاميرا
          </DialogTitle>
        </DialogHeader>
        <div className="relative bg-black">
          <video
            ref={videoRef}
            className="w-full aspect-square object-cover"
            playsInline
            muted
          />
          {/* Scan overlay */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="w-3/4 h-24 rounded-lg border-2 border-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
          </div>
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-4 text-center text-sm text-white">
              {error}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 p-4">
          <p className="text-xs text-muted-foreground">
            وجّه الكاميرا نحو الباركود
          </p>
          <div className="flex gap-2">
            {devices.length > 1 && (
              <Button size="sm" variant="outline" onClick={switchCamera}>
                <SwitchCamera className="ml-1 h-4 w-4" /> تبديل
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={onClose}>
              <X className="ml-1 h-4 w-4" /> إغلاق
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
