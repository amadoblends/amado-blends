/**
 * Post types for the client carousel.
 *
 * Lives outside `lib/actions/carousel.ts` on purpose: that file is a
 * `"use server"` module and those may only export async functions, so a
 * plain constant there crashes the route at runtime.
 */
export const CAROUSEL_TYPES = [
  { value: "promocion", label: "Promoción", emoji: "🎉" },
  { value: "oferta", label: "Oferta", emoji: "🏷️" },
  { value: "vacaciones", label: "Vacaciones", emoji: "🌴" },
  { value: "cerrado", label: "Día cerrado", emoji: "🚫" },
  { value: "holiday", label: "Feriado", emoji: "📅" },
  { value: "horario", label: "Horario especial", emoji: "🕐" },
  { value: "servicio", label: "Nuevo servicio", emoji: "✂️" },
  { value: "aviso", label: "Aviso importante", emoji: "📢" },
  { value: "info", label: "Información", emoji: "ℹ️" },
] as const;

export const CAROUSEL_TYPE_VALUES = [
  "promocion",
  "oferta",
  "vacaciones",
  "cerrado",
  "holiday",
  "horario",
  "servicio",
  "aviso",
  "info",
] as const;

export type CarouselType = (typeof CAROUSEL_TYPE_VALUES)[number];
