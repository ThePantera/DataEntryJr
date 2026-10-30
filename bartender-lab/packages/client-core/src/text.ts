const ACCENTS: Record<string, string> = {
  á: 'a',
  à: 'a',
  ä: 'a',
  â: 'a',
  ã: 'a',
  å: 'a',
  é: 'e',
  è: 'e',
  ë: 'e',
  ê: 'e',
  í: 'i',
  ì: 'i',
  ï: 'i',
  î: 'i',
  ó: 'o',
  ò: 'o',
  ö: 'o',
  ô: 'o',
  õ: 'o',
  ú: 'u',
  ù: 'u',
  ü: 'u',
  û: 'u',
  ñ: 'n',
  ç: 'c',
};

/**
 * Lowercase without accents, so "pina" finds "Piña" and "limon" finds "limón". Uses an explicit
 * map instead of String.prototype.normalize, which is not available in every mobile JS engine.
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[áàäâãåéèëêíìïîóòöôõúùüûñç]/g, (char) => ACCENTS[char] ?? char)
    .trim();
}
