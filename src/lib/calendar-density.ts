"use client";

import { useState, useEffect, useCallback } from "react";

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

const KEY = "calendarDensity.v1";

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
