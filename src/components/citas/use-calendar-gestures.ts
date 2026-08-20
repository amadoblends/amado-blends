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
    /** Distance from the rail's top to the pinch midpoint, in *hours*. */
    anchorHours: number;
    /** Where on the screen that point was, and must stay. */
    anchorViewportY: number;
    /** Page offset of the rail's top, measured once. */
    railPageTop: number;
    frame: number;
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
        // Held in hours, not pixels: the whole point is that it survives a
        // change of scale.
        anchorHours: (midY - rect.top) / hourH,
        anchorViewportY: midY,
        railPageTop: rect.top + window.scrollY,
        frame: 0,
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
      // Stop the page scrolling, and Safari zooming the whole document
      e.preventDefault();

      const ratio = distance(e.touches) / p.startDistance;
      const next = Math.min(MAX_HOUR_H, Math.max(MIN_HOUR_H, p.startHourH * ratio));

      /*
       * The scroll correction is computed as an ABSOLUTE target, not a delta.
       *
       * Nudging with scrollBy on every touchmove was the source of the
       * jitter: each frame's rounding error accumulated, and any scroll the
       * browser applied in between was counted twice, so the content drifted
       * and fought the fingers. Working out where the anchored hour *should*
       * be and going straight there is self-correcting — every frame starts
       * from the truth rather than from the last guess.
       */
      const target = p.railPageTop + p.anchorHours * next - p.anchorViewportY;

      // One update per frame; touchmove fires far more often than that
      if (p.frame) cancelAnimationFrame(p.frame);
      p.frame = requestAnimationFrame(() => {
        onZoom(next);
        window.scrollTo(0, Math.max(0, target));
        if (pinch.current) pinch.current.frame = 0;
      });
    },
    [onZoom]
  );

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length < 2 && pinch.current) {
      if (pinch.current.frame) cancelAnimationFrame(pinch.current.frame);
      pinch.current = null;
      setPinching(false);
    }
  }, []);

  return { pinching, onTouchStart, onTouchMove, onTouchEnd };
}

export interface DragState {
  appointmentId: string;
  /** Where a drop would land, snapped, in minutes from midnight. */
  proposedMins: number;
  durationMins: number;
  valid: boolean;
  reason?: string;
}

interface PressState {
  id: string;
  durationMins: number;
  originMins: number;
  /** Finger position in *page* coordinates, so scrolling can't shift it. */
  startPageY: number;
  lastPageY: number;
  armed: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  frame: number;
  /** Latest snapped position — what a drop would commit. */
  snappedMins: number;
  lastValid: boolean | null;
  /** Auto-scroll while the finger rests in an edge zone. */
  edgeTimer: ReturnType<typeof setInterval> | null;
  edgeStep: number;
}

/**
 * Long-press then drag to move an appointment.
 *
 * ── Following the finger ─────────────────────────────────────────────────
 * The card's position is written straight to the DOM as a transform inside a
 * requestAnimationFrame, not through React state. Re-rendering the whole
 * timeline on every touchmove is what made the block trail behind the finger:
 * React has to reconcile a day's worth of cards before the ghost moves a
 * single pixel. Now the pixels move first and React finds out afterwards,
 * only when the snapped time actually changes.
 *
 * The visual follows the finger *exactly* — it is not snapped. Only the time
 * a drop would commit to is snapped, and that is what the ghost's label
 * shows. Snapping the visual was the other half of the jumpiness: the card
 * lurched between increments instead of tracking the hand.
 *
 * Every position is held in page coordinates, so scrolling — the edge
 * auto-scroll, or anything the browser does on its own — moves the calendar
 * under a card that stays put under the finger.
 */
export function useAppointmentDrag({
  hourH,
  dayStartMins,
  snapMinutes,
  validate,
  onDrop,
}: {
  hourH: number;
  dayStartMins: number;
  snapMinutes: number;
  /** Whether the appointment may start at these minutes. */
  validate: (startMins: number, durationMins: number, appointmentId: string) => {
    ok: boolean;
    reason?: string;
  };
  onDrop: (appointmentId: string, startMins: number) => void;
}) {
  const [drag, setDrag] = useState<DragState | null>(null);

  /** The ghost element, moved directly rather than re-rendered. */
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const press = useRef<PressState | null>(null);

  const clearEdgeScroll = useCallback(() => {
    const p = press.current;
    if (p?.edgeTimer) {
      clearInterval(p.edgeTimer);
      p.edgeTimer = null;
    }
  }, []);

  const cancelPress = useCallback(() => {
    const p = press.current;
    if (p?.timer) clearTimeout(p.timer);
    if (p?.frame) cancelAnimationFrame(p.frame);
    if (p?.edgeTimer) clearInterval(p.edgeTimer);
    press.current = null;
  }, []);

  const snap = useCallback(
    (mins: number) => Math.round(mins / snapMinutes) * snapMinutes,
    [snapMinutes]
  );

  /**
   * Recomputes from the current finger position and paints.
   *
   * Separate from the touch handler because the edge auto-scroll re-runs it
   * on a timer: the finger can be holding still while the page moves, and the
   * card has to keep tracking the finger through that.
   */
  const apply = useCallback(() => {
    const p = press.current;
    if (!p?.armed) return;

    const movedMins = ((p.lastPageY - p.startPageY) / hourH) * 60;
    const latest = p.originMins + movedMins;

    // Kept inside the day, leaving room for the whole appointment
    const upperBound = 24 * 60 - p.durationMins;
    const raw = Math.max(dayStartMins, Math.min(upperBound, latest));
    const snapped = Math.max(dayStartMins, Math.min(upperBound, snap(raw)));

    // The pixels move now, on their own frame, ahead of any React work
    if (p.frame) cancelAnimationFrame(p.frame);
    p.frame = requestAnimationFrame(() => {
      const el = ghostRef.current;
      if (el) {
        const px = ((raw - dayStartMins) / 60) * hourH;
        el.style.transform = `translate3d(0, ${px}px, 0)`;
      }
      if (press.current) press.current.frame = 0;
    });

    // React only hears about it when the committed time would change
    if (snapped === p.snappedMins) return;
    p.snappedMins = snapped;

    const v = validate(snapped, p.durationMins, p.id);
    // One tick when crossing between valid and invalid, not on every pixel
    if (p.lastValid !== null && v.ok !== p.lastValid) haptic(v.ok ? 10 : [4, 30, 4]);
    p.lastValid = v.ok;

    setDrag((prev) =>
      prev && prev.proposedMins === snapped && prev.valid === v.ok
        ? prev
        : {
            appointmentId: p.id,
            proposedMins: snapped,
            durationMins: p.durationMins,
            valid: v.ok,
            reason: v.reason,
          }
    );
  }, [hourH, dayStartMins, snap, validate]);

  const onTouchStart = useCallback(
    (e: React.TouchEvent, appointmentId: string, startMins: number, durationMins: number) => {
      if (e.touches.length !== 1) return;
      const pageY = e.touches[0].clientY + window.scrollY;

      press.current = {
        id: appointmentId,
        durationMins,
        originMins: startMins,
        startPageY: pageY,
        lastPageY: pageY,
        armed: false,
        frame: 0,
        snappedMins: startMins,
        lastValid: null,
        edgeTimer: null,
        edgeStep: 0,
        timer: setTimeout(() => {
          const p = press.current;
          if (!p) return;
          p.armed = true;
          const v = validate(startMins, durationMins, appointmentId);
          p.lastValid = v.ok;
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
      if (!p || e.touches.length !== 1) return;

      const viewportY = e.touches[0].clientY;
      const pageY = viewportY + window.scrollY;

      // Before the long press completes, any real movement is a scroll
      if (!p.armed) {
        if (Math.abs(pageY - p.startPageY) > 8) cancelPress();
        return;
      }

      // Armed: this gesture belongs to the drag, not to the page
      e.preventDefault();
      p.lastPageY = pageY;

      /*
       * Auto-scroll only near the top and bottom edges, at a speed set by how
       * far into the edge zone the finger is. It runs on an interval rather
       * than off touchmove, so it keeps going while the finger holds still
       * against the edge.
       */
      const EDGE = 90;
      const overTop = EDGE - viewportY;
      const overBottom = EDGE - (window.innerHeight - viewportY);
      p.edgeStep =
        overTop > 0
          ? -Math.round((overTop / EDGE) * 12)
          : overBottom > 0
            ? Math.round((overBottom / EDGE) * 12)
            : 0;

      if (p.edgeStep === 0) {
        clearEdgeScroll();
      } else if (!p.edgeTimer) {
        p.edgeTimer = setInterval(() => {
          const cur = press.current;
          if (!cur?.armed || cur.edgeStep === 0) return;
          window.scrollBy(0, cur.edgeStep);
          // The finger hasn't moved; the page under it has
          cur.lastPageY += cur.edgeStep;
          apply();
        }, 16);
      }

      apply();
    },
    [cancelPress, clearEdgeScroll, apply]
  );

  const onTouchEnd = useCallback(() => {
    const p = press.current;
    const d = drag;
    cancelPress();

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

  return { drag, ghostRef, onTouchStart, onTouchMove, onTouchEnd, cancelPress };
}
