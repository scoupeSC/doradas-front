'use client'

import { getPrincipalGift } from '@/utils/formatBoletaNumeros'

function pad(n: number) {
  return String(n).padStart(4, '0')
}

type Props = {
  numeros?: number[] | null
  numero?: number | null
  numeroPrincipal?: number | null
  compact?: boolean
}

/** Muestra número principal y de regalo con etiquetas visibles. */
export default function PrincipalGiftLabel({
  numeros,
  numero,
  numeroPrincipal,
  compact = false,
}: Props) {
  const { principal, gift } = getPrincipalGift(numeros, numero, numeroPrincipal)

  if (principal == null) {
    return <span className="font-medium text-slate-500">—</span>
  }

  if (gift == null) {
    return (
      <span className="font-bold text-slate-900 tabular-nums">#{pad(principal)}</span>
    )
  }

  if (compact) {
    return (
      <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm">
        <span className="inline-flex items-center gap-1">
          <span className="rounded bg-amber-500 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
            Principal
          </span>
          <span className="font-bold tabular-nums text-slate-900">#{pad(principal)}</span>
        </span>
        <span className="text-slate-300">·</span>
        <span className="inline-flex items-center gap-1">
          <span className="rounded bg-emerald-600 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
            Regalo
          </span>
          <span className="font-semibold tabular-nums text-slate-700">#{pad(gift)}</span>
        </span>
      </span>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="shrink-0 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          Principal
        </span>
        <span className="text-base font-bold tabular-nums text-slate-900">#{pad(principal)}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="shrink-0 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          Regalo
        </span>
        <span className="text-sm font-semibold tabular-nums text-slate-700">#{pad(gift)}</span>
      </div>
    </div>
  )
}
