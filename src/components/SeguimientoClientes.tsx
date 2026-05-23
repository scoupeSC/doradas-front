'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  seguimientoClientesApi,
  ClienteSeguimiento,
  BoletaSeguimiento,
  EstadoBoleta,
  FiltroNotificado,
} from '@/lib/seguimientoClientesApi'
import { normalizarTelefono } from '@/utils/telefono'

/* ─── helpers ─────────────────────────────────────────────────────────────── */
const COP = (v: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(v)

const fmtDate = (d: string | null) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const fmtDateTime = (d: string | null) => {
  if (!d) return '—'
  return new Date(d).toLocaleString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const estadoColor: Record<string, string> = {
  RESERVADA: 'bg-amber-100 text-amber-700 border border-amber-200',
  ABONADA:   'bg-blue-100  text-blue-700  border border-blue-200',
  PAGADA:    'bg-emerald-100 text-emerald-700 border border-emerald-200',
}
const estadoIcon: Record<string, string> = {
  RESERVADA: '📌',
  ABONADA:   '💳',
  PAGADA:    '✅',
}

/* ─── Fila de boleta ─────────────────────────────────────────────────────── */
function FilaBoleta({ b }: { b: BoletaSeguimiento }) {
  const pct = b.precio_boleta > 0
    ? Math.min(100, Math.round((Number(b.abono_total) / Number(b.precio_boleta)) * 100))
    : 0

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
      <td className="py-2 px-3 font-mono font-semibold text-slate-700 text-sm whitespace-nowrap">
        #{String(b.numero).padStart(4, '0')}
      </td>
      <td className="py-2 px-3">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${estadoColor[b.estado] || 'bg-slate-100 text-slate-600'}`}>
          <span>{estadoIcon[b.estado] || '🔹'}</span>
          {b.estado}
        </span>
      </td>
      <td className="py-2 px-3 text-slate-500 text-xs whitespace-nowrap">
        {b.rifa_nombre}
      </td>
      <td className="py-2 px-3 text-right text-slate-700 font-medium text-sm whitespace-nowrap">
        {COP(Number(b.precio_boleta))}
      </td>
      <td className="py-2 px-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden min-w-[48px]">
            <div
              className={`h-full rounded-full ${pct >= 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-blue-500' : 'bg-slate-300'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-emerald-700 font-semibold text-sm whitespace-nowrap">{COP(Number(b.abono_total))}</span>
        </div>
      </td>
      <td className="py-2 px-3 text-right font-semibold text-sm whitespace-nowrap">
        {Number(b.saldo_pendiente) > 0
          ? <span className="text-rose-600">{COP(Number(b.saldo_pendiente))}</span>
          : <span className="text-emerald-600">—</span>}
      </td>
      <td className="py-2 px-3 text-xs text-slate-400 whitespace-nowrap">
        {fmtDate(b.boleta_created_at)}
      </td>
    </tr>
  )
}

/* ─── Tarjeta de cliente ─────────────────────────────────────────────────── */
function TarjetaCliente({ cliente }: { cliente: ClienteSeguimiento }) {
  const [expandida, setExpandida] = useState(false)

  const totalDeuda = cliente.boletas.reduce(
    (acc, b) => acc + Number(b.saldo_pendiente), 0
  )
  const totalAbonado = cliente.boletas.reduce(
    (acc, b) => acc + Number(b.abono_total), 0
  )
  const totalPrecio = cliente.boletas.reduce(
    (acc, b) => acc + Number(b.precio_boleta), 0
  )
  const conteos = {
    RESERVADA: cliente.boletas.filter(b => b.estado === 'RESERVADA').length,
    ABONADA:   cliente.boletas.filter(b => b.estado === 'ABONADA').length,
    PAGADA:    cliente.boletas.filter(b => b.estado === 'PAGADA').length,
  }

  const telNorm = normalizarTelefono(cliente.telefono)
  const waUrl = telNorm ? `https://wa.me/${telNorm}` : null

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* ── Cabecera del cliente ── */}
      <div
        className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50/70 transition-colors select-none"
        onClick={() => setExpandida(v => !v)}
      >
        {/* Avatar inicial */}
        <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">
          {(cliente.nombre || '?')[0].toUpperCase()}
        </div>

        {/* Nombre + tel */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 text-sm truncate">{cliente.nombre}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-500 text-xs">{cliente.telefono || '—'}</span>
            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                WhatsApp
              </a>
            )}
          </div>
        </div>

        {/* Badges estado */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {conteos.RESERVADA > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
              📌 {conteos.RESERVADA} res.
            </span>
          )}
          {conteos.ABONADA > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
              💳 {conteos.ABONADA} abon.
            </span>
          )}
          {conteos.PAGADA > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
              ✅ {conteos.PAGADA} pag.
            </span>
          )}
        </div>

        {/* Resumen financiero */}
        <div className="text-right shrink-0 space-y-0.5">
          {totalDeuda > 0 ? (
            <p className="text-rose-600 font-bold text-sm">{COP(totalDeuda)} pendiente</p>
          ) : (
            <p className="text-emerald-600 font-bold text-sm">Al día ✓</p>
          )}
          {totalAbonado > 0 && totalDeuda > 0 && (
            <p className="text-slate-400 text-xs">{COP(totalAbonado)} abonado de {COP(totalPrecio)}</p>
          )}
        </div>

        {/* Recordatorio info */}
        <div className="text-right shrink-0 min-w-[130px]">
          {cliente.total_notificaciones === 0 ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-500 border border-slate-200">
              🔕 Sin notificar
            </span>
          ) : (
            <div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-violet-100 text-violet-700 border border-violet-200">
                🔔 {cliente.total_notificaciones}x notificado
              </span>
              <p className="text-slate-400 text-xs mt-0.5 leading-tight">
                último: {fmtDateTime(cliente.ultima_notificacion)}
              </p>
            </div>
          )}
        </div>

        {/* Fecha cliente */}
        <div className="text-right shrink-0 min-w-[90px]">
          <p className="text-slate-400 text-xs">Cliente desde</p>
          <p className="text-slate-600 text-xs font-medium">{fmtDate(cliente.cliente_created_at)}</p>
        </div>

        {/* Chevron expand */}
        <div className={`transition-transform duration-200 shrink-0 ${expandida ? 'rotate-180' : ''}`}>
          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* ── Tabla de boletas ── */}
      {expandida && (
        <div className="border-t border-slate-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <th className="py-2 px-3 text-left">Boleta</th>
                <th className="py-2 px-3 text-left">Estado</th>
                <th className="py-2 px-3 text-left">Rifa</th>
                <th className="py-2 px-3 text-right">Precio</th>
                <th className="py-2 px-3 text-left">Abonado</th>
                <th className="py-2 px-3 text-right">Saldo</th>
                <th className="py-2 px-3 text-left">Fecha compra</th>
              </tr>
            </thead>
            <tbody>
              {cliente.boletas.map(b => (
                <FilaBoleta key={b.boleta_id} b={b} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ─── Componente principal ───────────────────────────────────────────────── */

const ABONO_MAX = 120000
const ABONO_STEP = 5000

/** Doble slider de rango para filtrar el monto abonado */
function RangeSlider({
  min, max, onCommit,
}: {
  min: number
  max: number
  onCommit: (min: number, max: number) => void
}) {
  const [localMin, setLocalMin] = useState(min)
  const [localMax, setLocalMax] = useState(max)

  // Sincroniza si el padre resetea los valores
  useEffect(() => { setLocalMin(min) }, [min])
  useEffect(() => { setLocalMax(max) }, [max])

  const pctMin = (localMin / ABONO_MAX) * 100
  const pctMax = (localMax / ABONO_MAX) * 100

  const handleMinChange = (v: number) => {
    const clamped = Math.min(v, localMax - ABONO_STEP)
    setLocalMin(clamped)
  }
  const handleMaxChange = (v: number) => {
    const clamped = Math.max(v, localMin + ABONO_STEP)
    setLocalMax(clamped)
  }
  const commit = () => onCommit(localMin, localMax)

  return (
    <div className="w-full">
      {/* Etiquetas de valor */}
      <div className="flex justify-between text-xs font-semibold text-blue-700 mb-1.5">
        <span>{COP(localMin)}</span>
        <span>{localMax >= ABONO_MAX ? `hasta ${COP(ABONO_MAX)}` : COP(localMax)}</span>
      </div>

      {/* Track + thumbs */}
      <div className="relative h-5 flex items-center">
        {/* track base */}
        <div className="absolute w-full h-1.5 bg-slate-200 rounded-full" />
        {/* track fill activo */}
        <div
          className="absolute h-1.5 bg-blue-500 rounded-full pointer-events-none"
          style={{ left: `${pctMin}%`, width: `${pctMax - pctMin}%` }}
        />

        {/* input MIN */}
        <input
          type="range"
          min={0}
          max={ABONO_MAX}
          step={ABONO_STEP}
          value={localMin}
          onChange={e => handleMinChange(Number(e.target.value))}
          onMouseUp={commit}
          onTouchEnd={commit}
          className="absolute w-full appearance-none bg-transparent pointer-events-none
            [&::-webkit-slider-thumb]:pointer-events-auto
            [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-white
            [&::-webkit-slider-thumb]:border-2
            [&::-webkit-slider-thumb]:border-blue-500
            [&::-webkit-slider-thumb]:shadow-sm
            [&::-webkit-slider-thumb]:cursor-grab
            [&::-webkit-slider-thumb]:appearance-none
            [&::-moz-range-thumb]:pointer-events-auto
            [&::-moz-range-thumb]:w-4
            [&::-moz-range-thumb]:h-4
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-white
            [&::-moz-range-thumb]:border-2
            [&::-moz-range-thumb]:border-blue-500
            [&::-moz-range-thumb]:cursor-grab"
          style={{ zIndex: localMin > ABONO_MAX - ABONO_STEP ? 5 : 3 }}
        />

        {/* input MAX */}
        <input
          type="range"
          min={0}
          max={ABONO_MAX}
          step={ABONO_STEP}
          value={localMax}
          onChange={e => handleMaxChange(Number(e.target.value))}
          onMouseUp={commit}
          onTouchEnd={commit}
          className="absolute w-full appearance-none bg-transparent pointer-events-none
            [&::-webkit-slider-thumb]:pointer-events-auto
            [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-white
            [&::-webkit-slider-thumb]:border-2
            [&::-webkit-slider-thumb]:border-blue-500
            [&::-webkit-slider-thumb]:shadow-sm
            [&::-webkit-slider-thumb]:cursor-grab
            [&::-webkit-slider-thumb]:appearance-none
            [&::-moz-range-thumb]:pointer-events-auto
            [&::-moz-range-thumb]:w-4
            [&::-moz-range-thumb]:h-4
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-white
            [&::-moz-range-thumb]:border-2
            [&::-moz-range-thumb]:border-blue-500
            [&::-moz-range-thumb]:cursor-grab"
          style={{ zIndex: 4 }}
        />
      </div>

      {/* Escala */}
      <div className="flex justify-between text-[10px] text-slate-400 mt-1">
        <span>$0</span>
        <span>$30k</span>
        <span>$60k</span>
        <span>$90k</span>
        <span>$120k</span>
      </div>
    </div>
  )
}

export default function SeguimientoClientes() {
  const [clientes, setClientes]       = useState<ClienteSeguimiento[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [page, setPage]               = useState(1)
  const [totalPages, setTotalPages]   = useState(1)
  const [total, setTotal]             = useState(0)

  // Filtros
  const [search, setSearch]               = useState('')
  const [estadoBoleta, setEstadoBoleta]   = useState<EstadoBoleta>('todas')
  const [notificado, setNotificado]       = useState<FiltroNotificado>('todos')
  const [abonoMin, setAbonoMin]           = useState(0)
  const [abonoMax, setAbonoMax]           = useState(ABONO_MAX)

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchData = useCallback(async (
    p = 1,
    s = search,
    eb = estadoBoleta,
    nt = notificado,
    amin = abonoMin,
    amax = abonoMax,
  ) => {
    try {
      setLoading(true)
      setError(null)
      const res = await seguimientoClientesApi.getSeguimiento({
        page:  p,
        limit: 20,
        search: s,
        estadoBoleta: eb,
        notificado:   nt,
        abonoMin: eb === 'ABONADA' ? amin : undefined,
        abonoMax: eb === 'ABONADA' ? amax : undefined,
      })
      setClientes(res.clientes)
      setTotal(res.paginacion.total)
      setTotalPages(res.paginacion.total_pages)
      setPage(p)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }, [search, estadoBoleta, notificado, abonoMin, abonoMax])

  // Carga inicial
  useEffect(() => { fetchData(1) }, [])

  // Búsqueda con debounce
  const handleSearch = (v: string) => {
    setSearch(v)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => fetchData(1, v, estadoBoleta, notificado, abonoMin, abonoMax), 400)
  }

  const handleEstado = (v: EstadoBoleta) => {
    setEstadoBoleta(v)
    // reset slider when leaving ABONADA
    const min = 0, max = ABONO_MAX
    if (v !== 'ABONADA') { setAbonoMin(min); setAbonoMax(max) }
    fetchData(1, search, v, notificado, min, max)
  }

  const handleNotificado = (v: FiltroNotificado) => {
    setNotificado(v)
    fetchData(1, search, estadoBoleta, v, abonoMin, abonoMax)
  }

  const handleSliderCommit = (min: number, max: number) => {
    setAbonoMin(min)
    setAbonoMax(max)
    fetchData(1, search, estadoBoleta, notificado, min, max)
  }

  const handlePage = (p: number) => fetchData(p)

  /* ── render ─────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-5">
      {/* ── Barra de filtros ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3">
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          {/* Buscador */}
          <div className="relative flex-1 min-w-[220px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar por nombre, celular o # boleta…"
              value={search}
              onChange={e => handleSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50 placeholder:text-slate-400"
            />
            {search && (
              <button
                onClick={() => handleSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Estado boleta */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            {(['todas', 'RESERVADA', 'ABONADA', 'PAGADA'] as EstadoBoleta[]).map(e => (
              <button
                key={e}
                onClick={() => handleEstado(e)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  estadoBoleta === e
                    ? 'bg-white text-indigo-700 shadow-sm font-semibold'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {e === 'todas' ? 'Todas' : e === 'RESERVADA' ? '📌 Reservadas' : e === 'ABONADA' ? '💳 Abonadas' : '✅ Pagadas'}
              </button>
            ))}
          </div>

          {/* Notificado */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            {(['todos', 'si', 'no'] as FiltroNotificado[]).map(n => (
              <button
                key={n}
                onClick={() => handleNotificado(n)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  notificado === n
                    ? 'bg-white text-violet-700 shadow-sm font-semibold'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {n === 'todos' ? 'Todos' : n === 'si' ? '🔔 Notificados' : '🔕 Sin notificar'}
              </button>
            ))}
          </div>

          {/* Botón refrescar */}
          <button
            onClick={() => fetchData(page)}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            Actualizar
          </button>
        </div>

        {/* Conteo */}
        <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
          {loading ? (
            <span>Cargando…</span>
          ) : (
            <span>
              <strong className="text-slate-700">{total.toLocaleString('es-CO')}</strong> clientes encontrados
              {search && <> · búsqueda: <em>"{search}"</em></>}
              {estadoBoleta === 'ABONADA' && (abonoMin > 0 || abonoMax < ABONO_MAX) && (
                <> · abono: <em>{COP(abonoMin)} – {COP(abonoMax)}</em></>
              )}
            </span>
          )}
        </div>

        {/* ── Slider de rango de abono (solo visible en filtro ABONADA) ── */}
        {estadoBoleta === 'ABONADA' && (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
              </svg>
              <span className="text-xs font-semibold text-slate-600">Filtrar por monto abonado</span>
              {(abonoMin > 0 || abonoMax < ABONO_MAX) && (
                <button
                  onClick={() => { setAbonoMin(0); setAbonoMax(ABONO_MAX); fetchData(1, search, estadoBoleta, notificado, 0, ABONO_MAX) }}
                  className="ml-auto text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Limpiar rango
                </button>
              )}
            </div>
            <div className="px-1">
              <RangeSlider min={abonoMin} max={abonoMax} onCommit={handleSliderCommit} />
            </div>
          </div>
        )}
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-rose-700 text-sm flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}

      {/* ── Skeleton loader ── */}
      {loading && clientes.length === 0 && (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 h-16 animate-pulse" />
          ))}
        </div>
      )}

      {/* ── Lista ── */}
      {!loading && clientes.length === 0 && !error && (
        <div className="text-center py-16 text-slate-400">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="font-medium">No se encontraron clientes</p>
          <p className="text-sm mt-1">Prueba con otros filtros o búsqueda</p>
        </div>
      )}

      {clientes.length > 0 && (
        <div className="space-y-3">
          {clientes.map(c => (
            <TarjetaCliente key={c.cliente_id} cliente={c} />
          ))}
        </div>
      )}

      {/* ── Paginación ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-4 py-3">
          <button
            onClick={() => handlePage(page - 1)}
            disabled={page <= 1 || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            Anterior
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4))
              const pg = start + i
              if (pg > totalPages) return null
              return (
                <button
                  key={pg}
                  onClick={() => handlePage(pg)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                    pg === page
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {pg}
                </button>
              )
            })}
          </div>

          <button
            onClick={() => handlePage(page + 1)}
            disabled={page >= totalPages || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Siguiente
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
