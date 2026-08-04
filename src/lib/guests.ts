const RELATIONSHIPS: Record<string, string> = {
  friend: "Amigo",
  family: "Familiar",
  brother: "Hermano",
  sister: "Hermana",
  son: "Hijo",
  daughter: "Hija",
  parent: "Padre/Madre",
  partner: "Pareja",
  other: "Invitado",
};

export function relationshipLabel(value: string | null | undefined): string {
  if (!value) return "Invitado";
  return RELATIONSHIPS[value] ?? value;
}

/**
 * Name shown to the barber. Guest appointments read as
 * "Juan (Amigo de Pedro)" so it's obvious who booked them.
 */
export function displayAppointmentName(
  clientName: string,
  guestName: string | null | undefined,
  guestRelationship: string | null | undefined
): string {
  if (!guestName) return clientName;
  const owner = clientName.split(" ")[0];
  return `${guestName} (${relationshipLabel(guestRelationship)} de ${owner})`;
}
