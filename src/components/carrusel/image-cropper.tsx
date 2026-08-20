"use client";

import { useCallback, useRef, useState } from "react";
import { Move, RotateCcw, Scissors, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  cropStyle,
  panCrop,
  normalizeCrop,
  DEFAULT_CROP,
  MIN_ZOOM,
  MAX_ZOOM,
  type CarouselCrop,
} from "@/lib/carousel-crop";

/**
 * Choosing which part of an image the carousel shows.
 *
 * ── Why framing rather than cutting ──────────────────────────────────────
 * The file is never modified. What the barber sets is a focal point and a
 * zoom, which is exactly what `background-position` and `background-size`
 * consume — so the preview below isn't an approximation of the result, it is
 * the result, rendered by the same CSS the client's app will use. That also
 * means the framing can be changed again later without re-uploading, and no
 * quality is ever lost to a re-encode.
 *
 * The preview carries the real chrome too — the gradient, the type chip, the
 * title, the button — because an image can look fine on its own and still put
 * a face directly behind the headline.
 */
export function ImageCropper({
  imageUrl,
  crop: value,
  onChange,
  title,
  description,
  buttonLabel,
  typeLabel,
  typeEmoji,
}: {
  imageUrl: string;
  crop: CarouselCrop;
  onChange: (next: CarouselCrop) => void;
  /** The real slide content, so the preview is the whole picture. */
  title: string;
  description?: string | null;
  buttonLabel?: string | null;
  typeLabel: string;
  typeEmoji: string;
}) {
  const crop = normalizeCrop(value);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const pan = useCallback(
    (clientX: number, clientY: number) => {
      const from = drag.current;
      const frame = frameRef.current;
      if (!from || !frame) return;

      const rect = frame.getBoundingClientRect();
      onChange(
        panCrop(crop, clientX - from.x, clientY - from.y, rect.width, rect.height)
      );
      drag.current = { x: clientX, y: clientY };
    },
    [crop, onChange]
  );

  const start = (x: number, y: number) => {
    drag.current = { x, y };
    setDragging(true);
  };
  const stop = () => {
    drag.current = null;
    setDragging(false);
  };

  const style = cropStyle(crop);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <Scissors size={13} className="text-brand shrink-0" />
        <p className="text-xs font-bold text-foreground">Encuadre</p>
        <p className="text-[11px] text-muted">· Arrastra la imagen para moverla</p>
      </div>

      {/*
        * The editing frame is the slide's real shape, so nothing can be framed
        * here that wouldn't fit there.
        */}
      <div
        ref={frameRef}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          start(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (drag.current) {
            e.preventDefault();
            pan(e.clientX, e.clientY);
          }
        }}
        onPointerUp={stop}
        onPointerCancel={stop}
        className={cn(
          "relative w-full overflow-hidden rounded-2xl border-2 border-dashed touch-none select-none",
          dragging ? "border-brand cursor-grabbing" : "border-border cursor-grab"
        )}
        style={{
          aspectRatio: "398 / 168",
          backgroundImage: `url('${imageUrl}')`,
          backgroundRepeat: "no-repeat",
          ...style,
        }}
      >
        {!dragging && (
          <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="flex items-center gap-1.5 bg-black/55 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-full">
              <Move size={12} /> Arrastra para encuadrar
            </span>
          </span>
        )}
      </div>

      {/* Zoom */}
      <div className="flex items-center gap-2.5">
        <ZoomIn size={14} className="text-muted shrink-0" />
        <input
          type="range"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.05}
          value={crop.zoom}
          onChange={(e) => onChange({ ...crop, zoom: Number(e.target.value) })}
          className="flex-1 accent-[var(--brand)]"
          aria-label="Zoom de la imagen"
        />
        <span className="text-[11px] font-bold text-muted tnum w-9 text-right">
          {crop.zoom.toFixed(1)}×
        </span>
        <button
          type="button"
          onClick={() => onChange(DEFAULT_CROP)}
          title="Restablecer encuadre"
          aria-label="Restablecer encuadre"
          className="w-8 h-8 rounded-lg border border-border bg-background flex items-center justify-center text-muted shrink-0"
        >
          <RotateCcw size={13} />
        </button>
      </div>

      {/* The client's view, chrome and all */}
      <div>
        <p className="text-[11px] font-bold text-muted uppercase tracking-wide mb-1.5">
          Así lo verá tu cliente
        </p>
        <SlidePreview
          imageUrl={imageUrl}
          crop={crop}
          title={title}
          description={description}
          buttonLabel={buttonLabel}
          typeLabel={typeLabel}
          typeEmoji={typeEmoji}
        />
      </div>
    </div>
  );
}

/**
 * A copy of the client's slide, down to the gradient and the padding.
 *
 * Kept deliberately faithful: the point of a preview is to be trusted, and a
 * preview that differs anywhere is worse than none — it teaches you to check
 * the real thing anyway.
 */
export function SlidePreview({
  imageUrl,
  crop,
  title,
  description,
  buttonLabel,
  typeLabel,
  typeEmoji,
}: {
  imageUrl: string | null;
  crop: CarouselCrop;
  title: string;
  description?: string | null;
  buttonLabel?: string | null;
  typeLabel: string;
  typeEmoji: string;
}) {
  const style = cropStyle(normalizeCrop(crop));

  return (
    <div
      className="relative w-full overflow-hidden rounded-3xl border border-border"
      style={
        imageUrl
          ? {
              backgroundImage: `linear-gradient(100deg, rgba(11,11,13,0.94) 5%, rgba(11,11,13,0.7) 55%, rgba(11,11,13,0.35) 100%), url('${imageUrl}')`,
              ...style,
            }
          : {
              backgroundImage:
                "linear-gradient(100deg, rgba(11,11,13,0.95) 5%, rgba(11,11,13,0.6) 50%, rgba(255,106,61,0.35) 130%)",
            }
      }
    >
      <div className="p-5 pr-24 min-h-[168px] flex flex-col justify-center">
        <span className="inline-flex self-start items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-brand bg-brand/15 px-2 py-1 rounded-full mb-2">
          {typeEmoji} {typeLabel}
        </span>

        <p className="text-[22px] leading-[1.15] font-black text-white uppercase break-words">
          {title || "Título del anuncio"}
        </p>

        {description && (
          <p className="text-xs text-white/70 mt-1.5 line-clamp-2 max-w-[85%]">{description}</p>
        )}

        {buttonLabel && (
          <span className="mt-3 inline-flex self-start bg-brand text-white text-xs font-bold px-4 py-2 rounded-xl">
            {buttonLabel}
          </span>
        )}
      </div>
    </div>
  );
}
