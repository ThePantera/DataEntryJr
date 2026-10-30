/** "2027-12-31" ↔ DATE column (stored as UTC midnight). */
export function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function formatDateOnly(value: Date | null): string | null {
  return value === null ? null : value.toISOString().slice(0, 10);
}
