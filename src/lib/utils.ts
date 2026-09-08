import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Convert Eastern Arabic numerals (٠-٩) to English numerals (0-9)
 */
export function toEnglishDigits(str: string): string {
  if (!str) return '';
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return str.replace(/[٠-٩]/g, (w) => String(arabicDigits.indexOf(w)));
}

/**
 * Format any date string strictly as English numbers in DD/MM/YYYY format
 */
export function formatDateEn(dateString?: string): string {
  if (!dateString) return '';
  if (dateString.includes('نشط حالياً') || dateString.includes('شغال حالياً')) return 'نشط حالياً';

  const clean = toEnglishDigits(String(dateString).trim());

  // Try parsing ISO / standard Date
  try {
    const d = new Date(clean);
    if (!isNaN(d.getTime()) && clean.length >= 8 && !clean.includes('أغسطس') && !clean.includes('يناير')) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
  } catch {}

  // Month dictionary
  const monthMap: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
    يناير: 1, فبراير: 2, مارس: 3, أبريل: 4, ابريل: 4, مايو: 5, يونيو: 6, يوليو: 7, أغسطس: 8, اغسطس: 8, سبتمبر: 9, أكتوبر: 10, اكتوبر: 10, نوفمبر: 11, ديسمبر: 12
  };

  // Match e.g. "26 أغسطس 2026" or "26 Aug 2026"
  const textMatch = clean.match(/(\d{1,2})\s+([A-Za-z\u0621-\u064A]+)\s+(\d{4})/);
  if (textMatch) {
    const day = String(parseInt(textMatch[1], 10)).padStart(2, '0');
    const monthStr = textMatch[2].toLowerCase();
    let monthNum = 1;
    for (const [k, v] of Object.entries(monthMap)) {
      if (monthStr.includes(k)) {
        monthNum = v;
        break;
      }
    }
    const month = String(monthNum).padStart(2, '0');
    const year = textMatch[3];
    return `${day}/${month}/${year}`;
  }

  // Match YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = String(parseInt(isoMatch[2], 10)).padStart(2, '0');
    const day = String(parseInt(isoMatch[3], 10)).padStart(2, '0');
    return `${day}/${month}/${year}`;
  }

  // Match DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const day = String(parseInt(dmyMatch[1], 10)).padStart(2, '0');
    const month = String(parseInt(dmyMatch[2], 10)).padStart(2, '0');
    const year = dmyMatch[3];
    return `${day}/${month}/${year}`;
  }

  return clean;
}

/**
 * Backward-compatible wrapper that guarantees DD/MM/YYYY format with English numerals
 */
export function formatDateArabic(dateString?: string): string {
  return formatDateEn(dateString);
}
