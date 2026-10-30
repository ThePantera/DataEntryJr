/** Lowercase without accents, so "pina" finds "Piña" and "limon" finds "limón". */
export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
