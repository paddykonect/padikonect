"use client";

import jsQR from "jsqr";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

interface QrScannerProps {
  onResult: (text: string) => void;
  /** What to type instead when there's no camera (default: a padi code). */
  fallbackLabel?: string;
}

// Figma "Scan padi" viewfinder (node 360:1027): dark panel, lime corner
// brackets and a glowing scan line. Decodes frames with jsQR so it works in
// every browser with a camera (BarcodeDetector isn't universal).
export function QrScanner({ onResult, fallbackLabel = "a padi code" }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onResultRef = useRef(onResult);
  const [state, setState] = useState<"starting" | "scanning" | "blocked" | "unsupported">("starting");

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState("unsupported");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      } catch {
        setState("blocked");
        return;
      }
      const video = videoRef.current;
      if (!video || stopped) return;
      video.srcObject = stream;
      await video.play().catch(() => undefined);
      setState("scanning");
      tick();
    }

    function tick() {
      if (stopped) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });
          if (code?.data) {
            onResultRef.current(code.data);
            return;
          }
        }
      }
      frame = requestAnimationFrame(tick);
    }

    void start();
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const corner = "absolute size-[38px] border-accent";
  return (
    <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-[20px] bg-[#14231b]">
      <video ref={videoRef} playsInline muted className={`absolute inset-0 size-full object-cover ${state === "scanning" ? "" : "hidden"}`} />
      <canvas ref={canvasRef} className="hidden" />
      {state !== "scanning" && (
        <div className="flex flex-col items-center gap-3 px-8 text-center">
          <Image src="/icons/scan/camera.svg" alt="" width={40} height={40} />
          {state === "blocked" && <p className="font-body text-[13px] text-white/80">Camera access is blocked. Allow it in your browser settings, or enter {fallbackLabel} below.</p>}
          {state === "unsupported" && <p className="font-body text-[13px] text-white/80">This browser can&apos;t use the camera. Enter {fallbackLabel} below instead.</p>}
        </div>
      )}
      <span className={`${corner} left-[22px] top-[22px] rounded-tl-lg border-l-4 border-t-4`} />
      <span className={`${corner} right-[22px] top-[22px] rounded-tr-lg border-r-4 border-t-4`} />
      <span className={`${corner} bottom-[22px] left-[22px] rounded-bl-lg border-b-4 border-l-4`} />
      <span className={`${corner} bottom-[22px] right-[22px] rounded-br-lg border-b-4 border-r-4`} />
      <span className="absolute inset-x-[22px] top-1/2 h-0.5 bg-accent/85 shadow-[0px_0px_10px_2px_rgba(215,230,0,0.6)]" />
    </div>
  );
}
