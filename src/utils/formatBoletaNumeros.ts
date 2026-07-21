/** Formatea uno o varios números de boleta: `#2809 · #7633` */
export function formatBoletaNumeros(
  numeros: number[] | null | undefined,
  fallback?: number | null
): string {
  const list =
    Array.isArray(numeros) && numeros.length > 0
      ? numeros
      : fallback != null
        ? [fallback]
        : []
  if (list.length === 0) return '—'
  return list.map((n) => `#${String(n).padStart(4, '0')}`).join(' · ')
}

/** Solo cifras del número de boleta (quita #, espacios y letras). */
export function sanitizeBoletaSearchDigits(term: string, maxDigits = 4): string {
  return String(term || '')
    .replace(/\D/g, '')
    .slice(0, maxDigits)
}

/**
 * Calidad del match para ordenar resultados (menor = mejor).
 * 0 = exacto, 1 = empieza igual, 2 = contiene, Infinity = no coincide.
 */
export function scoreBoletaSearchMatch(
  numeros: number[] | null | undefined,
  term: string,
  fallbackNumero?: number | null
): number {
  const raw = sanitizeBoletaSearchDigits(term)
  if (!raw) return 0
  const list =
    Array.isArray(numeros) && numeros.length > 0
      ? numeros
      : fallbackNumero != null
        ? [fallbackNumero]
        : []
  const terminoLimpio = raw.replace(/^0+/, '') || '0'
  const termNum = Number(terminoLimpio)

  let best = Infinity
  for (const n of list) {
    const num = Number(n)
    const numStr = String(num)
    const padded = numStr.padStart(4, '0')
    const rawPadded = raw.padStart(4, '0')

    if (num === termNum || numStr === raw || padded === raw || padded === rawPadded) {
      best = Math.min(best, 0)
    } else if (padded.startsWith(raw) || padded.startsWith(rawPadded) || numStr.startsWith(terminoLimpio)) {
      best = Math.min(best, 1)
    } else if (
      numStr.includes(terminoLimpio) ||
      padded.includes(raw) ||
      padded.includes(terminoLimpio)
    ) {
      best = Math.min(best, 2)
    }
  }
  return best
}

/** True si el término de búsqueda coincide con alguno de los números (con o sin ceros). */
export function searchMatchesNumeros(
  numeros: number[] | null | undefined,
  term: string,
  fallbackNumero?: number | null
): boolean {
  const raw = sanitizeBoletaSearchDigits(term)
  // Sin cifras no hay match de número (evita que búsquedas por nombre marquen todo)
  if (!raw) return false
  return scoreBoletaSearchMatch(numeros, raw, fallbackNumero) < Infinity
}

/** True si algún número del par es exactamente el buscado. */
export function isExactBoletaNumberMatch(
  numeros: number[] | null | undefined,
  term: string,
  fallbackNumero?: number | null
): boolean {
  return scoreBoletaSearchMatch(numeros, term, fallbackNumero) === 0
}

export function normalizeNumeros(
  numeros: number[] | null | undefined,
  fallback?: number | null
): number[] {
  if (Array.isArray(numeros) && numeros.length > 0) {
    return numeros.map(Number)
  }
  if (fallback != null) return [Number(fallback)]
  return []
}

export function resolveNumeroPrincipal(
  numeros: number[] | null | undefined,
  fallbackNumero?: number | null,
  numeroPrincipal?: number | null
): number | null {
  const list = normalizeNumeros(numeros, fallbackNumero)
  if (numeroPrincipal != null && list.includes(Number(numeroPrincipal))) {
    return Number(numeroPrincipal)
  }
  if (fallbackNumero != null) return Number(fallbackNumero)
  return list[0] ?? null
}

export function orderNumerosByPrincipal(
  numeros: number[] | null | undefined,
  fallbackNumero?: number | null,
  numeroPrincipal?: number | null
): number[] {
  const list = normalizeNumeros(numeros, fallbackNumero)
  const principal = resolveNumeroPrincipal(list, fallbackNumero, numeroPrincipal)
  if (principal == null || !list.includes(principal)) return list
  return [principal, ...list.filter((n) => n !== principal)]
}

export function getPrincipalGift(
  numeros: number[] | null | undefined,
  fallbackNumero?: number | null,
  numeroPrincipal?: number | null
): { principal: number | null; gift: number | null; ordered: number[] } {
  const ordered = orderNumerosByPrincipal(numeros, fallbackNumero, numeroPrincipal)
  return {
    principal: ordered[0] ?? null,
    gift: ordered[1] ?? null,
    ordered,
  }
}
