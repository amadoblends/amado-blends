"use client";

import { useRef, useCallback, useState } from "react";
import { haptic, MIN_HOUR_H, MAX_HOUR_H } from "@/lib/calendar-density";

/**
 * Pinch-to-zoom for the day timeline.
 *
 * Only ever changes pixels-per-hour. Duration, position and availability are
 * derived from minutes, so nothing about the schedule moves — the ruler just
 * gets longer or shorter.
 *
 * Anchored on the midpoint between the fingers: the time under your fingers
 * stays under your fingers, which is what makes a zoom feel attached to the
 * content rather than to the scroll position.
 */
export function usePinchZoom({
  hourH,
  onZoom,
  containerRef,
}: {
  hourH: number;
  onZoom: (next: number) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const pinch = useRef<{
    startDistance: number;
    startHourH: number;
    /** Minutes-from-top under the midpoint when the gesture began. */
    anchorOffsetPx: number;
    anchorViewportY: number;
  } | null>(null);

  const [pinching, setPinching] = useState(false);

  const distance = (t: React.TouchList) =>
    Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length !== 2) return;
      const el = containerRef.current;
      if (!el) return;

      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const rect = el.getBoundingClientRect();

      pinch.current = {
        startDistance: distance(e.touches),
        startHourH: hourH,
        anchorOffsetPx: midY - rect.top,
        anchorViewportY: midY,
      };
      setPinching(true);
      haptic(6);
    },
    [hourH, containerRef]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const p = pinch.current;
      if (!p || e.touches.length !== 2) return;
      // Stop the page from scrolling or Safari from zooming the whole document
      e.preventDefault();

      const ratio = distance(e.touches) / p.startDistance;
      const next = Math.min(MAX_HOUR_H, Math.max(MIN_HOUR_H, p.startHourH * ratio));
      if (Math.abs(next - p.startHourH) < 1) return;

      onZoom(next);

      // Keep the pinched moment under the fingers by absorbing the growth
      // into the page scroll.
      const grownBy = (p.anchorOffsetPx / p.startHourH) * next - p.anchorOffsetPx;
      if (Math.abs(grownBy) > 0.5) window.scrollBy(0, grownBy);
    },
    [onZoom]
  );

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length < 2 && pinch.current) {
      pinch.current = null;
      setPinching(false);
    }
  }, []);

  return { pinching, onTouchStart, onTouchMove, onTouchEnd };
}

export interface DragState {
  appointmentId: string;
  /** Where it would land, in minutes from midnight. */
  proposedMins: number;
  durationMins: number;
  valid: boolean;
  reason?: string;
}

/**
 * Long-press then drag to move an appointment.
 *
 * The press has to be held before the drag arms, so scrolling the day never
 * picks a card up by accident. While dragging, the proposed time snaps to the
 * configured increment and is validated on every step — an invalid target is
 * shown as invalid and refuses the drop rather than failing after the fact.
 */
export function useAppointmentDrag({
  hourH,
  dayStartMins,
  snapMinutes,
  containerRef,
  validate,
  onDrop,
}: {
  hourH: number;
  dayStartMins: number;
  snapMinutes: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Whether the appointment may start at these minutes. */
  validate: (startMins: number, durationMins: number, appointmentId: string) => {
    ok: boolean;
    reason?: string;
  };
  onDrop: (appointmentId: string, startMins: number) => void;
}) {
  const [drag, setDrag] = useState<DragState | null>(null);

  const press = useRef<{
    id: string;
    durationMins: number;
    originMins: number;
    startY: number;
    timer: ReturnType<typeof setTimeout> | null;
    armed: boolean;
  } | null>(null);

  const lastValid = useRef<boolean | null>(null);

  const cancelPress = useCallback(() => {
    if (press.current?.timer) clearTimeout(press.current.timer);
    press.current = null;
  }, []);

  const snap = useCallback(
    (mins: number) => Math.round(mins / snapMinutes) * snapMinutes,
    [snapMinutes]
  );

  const onTouchStart = useCallback(
    (e: React.TouchEvent, appointmentId: string, startMins: number, durationMins: number) => {
      if (e.touches.length !== 1) return;
      const y = e.touches[0].clientY;

      press.current = {
        id: appointmentId,
        durationMins,
        originMins: startMins,
        startY: y,
        armed: false,
        timer: setTimeout(() => {
          if (!press.current) return;
          press.current.armed = true;
          const v = validate(startMins, durationMins, appointmentId);
          lastValid.current = v.ok;
          setDrag({
            appointmentId,
            proposedMins: startMins,
            durationMins,
            valid: v.ok,
            reason: v.reason,
          });
          haptic(14);
        }, 380),
      };
    },
    [validate]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const p = press.current;
      if (!p) return;

      const y = e.touches[0].clientY;
      const dy = y - p.startY;

      // Before the long press completes, any real movement is a scroll
      if (!p.armed) {
        if (Math.abs(dy) > 8) cancelPress();
        return;
      }

      e.preventDefault();

      const movedMins = (dy / hourH) * 60;
      const proposed = Math.max(
        dayStartMins,
        Math.min(24 * 60 - p.durationMins, snap(p.originMins + movedMins))
      );

      const v = validate(proposed, p.durationMins, p.id);
      // One tick when crossing between valid and invalid, not on every pixel
      if (lastValid.current !== null && v.ok !== lastValid.current) haptic(v.ok ? 10 : [4, 30, 4]);
      lastValid.current = v.ok;

      setDrag((prev) =>
        prev && prev.proposedMins === proposed && prev.valid === v.ok
          ? prev
          : {
              appointmentId: p.id,
              proposedMins: proposed,
              durationMins: p.durationMins,
              valid: v.ok,
              reason: v.reason,
            }
      );
    },
    [hourH, dayStartMins, snap, validate, cancelPress]
  );

  const onTouchEnd = useCallback(() => {
    const p = press.current;
    const d = drag;
    cancelPress();
    lastValid.current = null;

    if (!p?.armed || !d) {
      setDrag(null);
      return;
    }

    // An invalid target simply doesn't accept the drop
    if (d.valid && d.proposedMins !== p.originMins) {
      haptic([10, 40, 16]);
      onDrop(d.appointmentId, d.proposedMins);
    } else if (!d.valid) {
      haptic([4, 40, 4]);
    }
    setDrag(null);
  }, [drag, cancelPress, onDrop]);

  return { drag, onTouchStart, onTouchMove, onTouchEnd, cancelPress };
}
