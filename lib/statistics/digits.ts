export function extractFinalDigit(
  quote: number,
  pipSize: number
): { digit: number; precision: number } | null {
  if (!Number.isFinite(quote) || !Number.isFinite(pipSize) || pipSize <= 0) {
    return null;
  }

  const precision = Math.max(
    0,
    Math.round(Math.log10(1 / pipSize))
  );

  const factor = 10 ** precision;
  const rounded = Math.round(quote * factor) / factor;
  const fixed = rounded.toFixed(precision);
  const lastChar = fixed[fixed.length - 1];

  if (!/^[0-9]$/.test(lastChar)) return null;

  return { digit: Number(lastChar), precision };
}

export function extractFinalDigitFromString(quote: string): number | null {
  const trimmed = quote.trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return null;
  const last = trimmed.replace('-', '')[trimmed.replace('-', '').length - 1];
  return /^[0-9]$/.test(last) ? Number(last) : null;
}

export function formatDigitDebug(
  quote: number,
  pipSize: number
): string {
  const result = extractFinalDigit(quote, pipSize);
  if (!result) return '—';
  return `digit=${result.digit}, precision=${result.precision}, pip=${pipSize}`;
      }
