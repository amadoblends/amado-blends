/**
 * Read-side rules about appointment status. Kept free of any server imports so
 * client components can share them with the data layer.
 */

/**
 * An appointment counts towards revenue once the barber marks it completed,
 * or once its time has passed without being cancelled / marked no-show.
 *
 * This used to be a blocking UPDATE on every dashboard, calendar and report
 * load, which both slowed navigation down and silently rewrote statuses the
 * barber never chose. Nothing is mutated here.
 */
export function countsAsAttended(a: { status: string; ends_at: string }): boolean {
  if (a.status === "completada") return true;
  if (a.status === "cancelada" || a.status === "no_show") return false;
  return new Date(a.ends_at).getTime() < Date.now();
}
