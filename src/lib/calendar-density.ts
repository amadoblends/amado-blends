"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/**
 * How much vertical space one hour of the day occupies.
 *
 * This is purely visual. It changes how many hours fit on screen — never how
 * long an appointment is: a 45-minute service always covers 45 minutes of the
 * rail, at every density.
 */
export type Density = "compact" | "normal" | "comfortable";

export const HOUR_HEIGHT: Record<Density, number> = {
  compact: 64,
  normal: 96,
  comfortable: 132,
};

export const DENSITY_LABEL: Record<Density, string> = {
  compact: "Compacta",
  normal: "Normal",
  comfortable: "Amplia",
};

export const DENSITIES: Density[] = ["compact", "normal", "comfortable"];

/** Pinch limits, in pixels per hour. */
export const MIN_HOUR_H = 44;
export const MAX_HOUR_H = 220;

/** How far a dragged appointment snaps. */
export type SnapMinutes = 5 | 10 | 15 | 20 | 30;
export const SNAP_OPTIONS: SnapMinutes[] = [5, 10, 15, 20, 30];

const KEY = "calendarDensity.v1";
const ZOOM_KEY = "calendarZoom.v1";
const SNAP_KEY = "calendarSnap.v1";

function read(): Density {
  if (typeof window === "undefined") return "normal";
  try {
    const v = localStorage.getItem(KEY);
    return v === "compact" || v === "comfortable" || v === "normal" ? v : "normal";
  } catch {
    return "normal";
  }
}

/**
 * Density lives on the device, not the account: it's about the screen in your
 * hand. Starts at "normal" on the server so the markup matches on hydration.
 */
export function useDensity(): [Density, (d: Density) => void] {
  const [density, setDensityState] = useState<Density>("normal");

  useEffect(() => {
    const saved = read();
    if (saved !== "normal") setDensityState(saved);
  }, []);

  const setDensity = useCallback((d: Density) => {
    setDensityState(d);
    try {
      localStorage.setItem(KEY, d);
    } catch {
      // storage blocked — the choice just won't persist
    }
  }, []);

  return [density, setDensity];
}

/**
 * Pixels per hour, as a continuous value the pinch gesture can drive.
 *
 * Seeded from the density preset the first time, then remembered on its own —
 * once someone has pinched to a scale they like, a preset shouldn't override
 * it on the next visit.
 */
export function useZoom(density: Density): [number, (h: number) => void, () => void] {
  const [hourH, setHourH] = useState<number>(HOUR_HEIGHT[density]);
  const touched = useRef(false);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(ZOOM_KEY));
      if (saved >= MIN_HOUR_H && saved <= MAX_HOUR_H) {
        touched.current = true;
        setHourH(saved);
        return;
      }
    } catch {
      // storage blocked — the preset stands
    }
    setHourH(HOUR_HEIGHT[density]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Choosing a preset is a deliberate override of any pinched value
  useEffect(() => {
    if (!touched.current) return;
    setHourH(HOUR_HEIGHT[density]);
    try {
      localStorage.setItem(ZOOM_KEY, String(HOUR_HEIGHT[density]));
    } catch {
      // ignore
    }
  }, [density]);

  const set = useCallback((h: number) => {
    const clamped = Math.min(MAX_HOUR_H, Math.max(MIN_HOUR_H, Math.round(h)));
    touched.current = true;
    setHourH(clamped);
    try {
      localStorage.setItem(ZOOM_KEY, String(clamped));
    } catch {
      // ignore
    }
  }, []);

  const reset = useCallback(() => {
    touched.current = false;
    setHourH(HOUR_HEIGHT[density]);
    try {
      localStorage.removeItem(ZOOM_KEY);
    } catch {
      // ignore
    }
  }, [density]);

  return [hourH, set, reset];
}

/** How far a dragged appointment snaps, remembered on the device. */
export function useSnap(): [SnapMinutes, (m: SnapMinutes) => void] {
  const [snap, setSnapState] = useState<SnapMinutes>(15);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(SNAP_KEY)) as SnapMinutes;
      if (SNAP_OPTIONS.includes(saved)) setSnapState(saved);
    } catch {
      // ignore
    }
  }, []);

  const setSnap = useCallback((m: SnapMinutes) => {
    setSnapState(m);
    try {
      localStorage.setItem(SNAP_KEY, String(m));
    } catch {
      // ignore
    }
  }, []);

  return [snap, setSnap];
}

/**
 * A short tick when a drag starts, crosses into a valid slot, or lands.
 *
 * `navigator.vibrate` is Android-only — iOS Safari has never implemented it,
 * and there is no web API that reaches the Taptic Engine. So this is a real
 * improvement on Android and a no-op on iPhone rather than something that
 * pretends to work.
 */
export function haptic(pattern: number | number[] = 8): void {
  if (typeof navigator === "undefined") return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // some browsers throw when the page isn't focused
  }
}
