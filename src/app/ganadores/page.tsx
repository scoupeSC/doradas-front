'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { API_BASE_URL } from '@/config/api'
import { getStorageImageUrl } from '@/lib/storageImageUrl'
import GanadorAsignarDirecto from '@/components/ganadores/GanadorAsignarDirecto'
import {
  BOLETA_WIDTH,
  BOLETA_LEFT_WIDTH,
  BOLETA_RIGHT_WIDTH,
  BOLETA_DEFAULT_HEIGHT,
} from '@/constants/boletaDimensions'

interface VentaInfo {
  monto_total: number
  abono_total: number
  saldo_pendiente: number
  estado_venta: string
}

interface BoletaResult {
  encontrada: boolean
  disponible?: boolean
  mensaje?: string
  boleta?: {
    id: string
    numero: number
    estado: string
    rifa_id: string
    rifa_nombre: string
    precio_boleta?: number
    rifa_imagen_url?: string | null
    nota?: string | null
    cliente_nombre?: string | null
    venta?: VentaInfo | null
  }
}

interface ClienteForm {
  nombre: string
  telefono: string
  email: string
  direccion: string
  identificacion: string
}

const MEDIOS_PAGO = [
  { id: 'd397d917-c0d0-4c61-b2b3-2ebfab7deeb7', nombre: 'Efectivo' },
  { id: 'db94562d-bb01-42a3-9414-6e369a1a70ba', nombre: 'PSE' },
]

export default function GanadoresPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ id: string; nombre: string; rol: string } | null>(null)
  const [numeroBoleta, setNumeroBoleta] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [resultado, setResultado] = useState<BoletaResult | null>(null)
  const [error, setError] = useState('')

  // Form para asignar ganador
  const [cliente, setCliente] = useState<ClienteForm>({
    nombre: '', telefono: '', email: '', direccion: '', identificacion: ''
  })
  const [montoAbono, setMontoAbono] = useState('')
  const [medioPagoId, setMedioPagoId] = useState(MEDIOS_PAGO[0].id)
  const [asignando, setAsignando] = useState(false)
  const [exito, setExito] = useState<string | null>(null)
  const [modo, setModo] = useState<'buscar' | 'directo'>('buscar')

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')
    if (!token || !userData) { router.push('/login'); return }
    try {
      const parsed = JSON.parse(userData)
      if (parsed.rol?.toUpperCase() !== 'SUPER_ADMIN') {
        router.push('/dashboard')
        return
      }
      setUser(parsed)
    } catch { router.push('/login') }
  }, [router])

  const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('token')
    const res = await fetch(`${API_BASE_URL}/api${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || `Error ${res.status}`)
    return data
  }

  const buscarBoleta = async () => {
    const num = parseInt(numeroBoleta, 10)
    if (!num || num <= 0) { setError('Ingresa un número válido'); return }
    setError('')
    setResultado(null)
    setExito(null)
    setBuscando(true)
    try {
      const data = await apiRequest(`/ventas/ganadores/buscar-boleta?numero=${num}`)
      setResultado(data.data)
      if (data.data.encontrada && data.data.disponible && data.data.boleta?.precio_boleta) {
        setMontoAbono(String(data.data.boleta.precio_boleta))
      }
    } catch (err: any) {
      setError(err.message || 'Error buscando boleta')
    } finally {
      setBuscando(false)
    }
  }

  const asignarGanador = async () => {
    if (!resultado?.boleta || !resultado.disponible) return
    if (!cliente.nombre.trim()) { setError('El nombre es requerido'); return }
    if (!cliente.telefono.trim()) { setError('El teléfono es requerido'); return }
    const monto = parseFloat(montoAbono)
    if (!monto || monto <= 0) { setError('El monto del abono debe ser mayor a 0'); return }
    setError('')
    setAsignando(true)
    try {
      const data = await apiRequest('/ventas/ganadores/asignar', {
        method: 'POST',
        body: JSON.stringify({
          rifa_id: resultado.boleta.rifa_id,
          boleta_id: resultado.boleta.id,
          cliente: {
            nombre: cliente.nombre.trim().toUpperCase(),
            telefono: cliente.telefono.trim(),
            email: cliente.email.trim() || null,
            direccion: cliente.direccion.trim() || null,
            identificacion: cliente.identificacion.trim() || null,
          },
          monto_abono: monto,
          medio_pago_id: medioPagoId,
        }),
      })
      const boletaPrevia = resultado!.boleta!
      setResultado({
        encontrada: true,
        disponible: false,
        boleta: {
          ...boletaPrevia,
          estado: data.data.estado_boleta || data.data.estado_venta,
          cliente_nombre: data.data.cliente_nombre,
          venta: {
            monto_total: boletaPrevia.precio_boleta || 0,
            abono_total: data.data.monto_abono,
            saldo_pendiente: Math.max((boletaPrevia.precio_boleta || 0) - data.data.monto_abono, 0),
            estado_venta: data.data.estado_venta
          }
        }
      })
      setExito(`🏆 ${data.data.cliente_nombre} — Boleta ${String(data.data.boleta_numero).padStart(4, '0')}`)
      setCliente({ nombre: '', telefono: '', email: '', direccion: '', identificacion: '' })
      setMontoAbono('')
      setNumeroBoleta('')
    } catch (err: any) {
      setError(err.message || 'Error al procesar ganador')
    } finally {
      setAsignando(false)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-yellow-50/30">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <button onClick={() => router.push('/dashboard')} className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div className="w-9 h-9 bg-gradient-to-br from-yellow-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-600/20">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-semibold text-slate-900 leading-tight">Ganadores</h1>
              </div>
            </div>
            <span className="text-xs text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full font-semibold border border-amber-200">SUPER ADMIN</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Submódulos */}
        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => { setModo('buscar'); setError(''); setExito(null) }}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              modo === 'buscar'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Buscar Boleta
          </button>
          <button
            type="button"
            onClick={() => { setModo('directo'); setError(''); setExito(null) }}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              modo === 'directo'
                ? 'bg-amber-500 text-white shadow-md'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Asignar Directo
          </button>
        </div>

        {modo === 'directo' ? (
          <GanadorAsignarDirecto />
        ) : (
        <>
        {/* Buscar boleta */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 mb-6">
          <h2 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Buscar Boleta
          </h2>
          <div className="flex gap-3">
            <input
              type="number"
              value={numeroBoleta}
              onChange={(e) => setNumeroBoleta(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && buscarBoleta()}
              placeholder="Número de boleta..."
              className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 transition-all"
              min="1"
            />
            <button
              onClick={buscarBoleta}
              disabled={buscando || !numeroBoleta}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl text-sm font-medium hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              {buscando ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : 'Buscar'}
            </button>
          </div>
        </div>

        {/* Mensajes */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-6 flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {error}
          </div>
        )}

        {exito && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm mb-6 flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
            {exito}
          </div>
        )}

        {/* Resultado: boleta no encontrada */}
        {resultado && !resultado.encontrada && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center">
            <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-slate-500 text-sm">{resultado.mensaje}</p>
          </div>
        )}

        {/* Resultado: boleta ya asignada — estilo BoletaTicket sin QR, cédula ni teléfono */}
        {resultado?.encontrada && !resultado.disponible && resultado.boleta && (() => {
          const b = resultado.boleta!
          const estadoNorm = (b.estado ?? '').toUpperCase()
          const deuda = b.venta?.saldo_pendiente ?? 0
          const imagen = getStorageImageUrl(b.rifa_imagen_url ?? null) ?? b.rifa_imagen_url
          const esPagada = estadoNorm === 'PAGADA' || estadoNorm === 'CON_PAGO'
          const esAbonada = estadoNorm === 'ABONADA'
          const esReservada = estadoNorm === 'RESERVADA'

          return (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              {/* Ticket card */}
              <div className="flex border-2 border-black bg-white mx-auto overflow-hidden" style={{ maxWidth: `${BOLETA_WIDTH}px`, height: `${BOLETA_DEFAULT_HEIGHT}px` }}>
                {/* LEFT SIDE */}
                <div className="flex-shrink-0 p-2 flex flex-col justify-between border-r-2 border-black" style={{ width: `${BOLETA_LEFT_WIDTH}px`, height: `${BOLETA_DEFAULT_HEIGHT}px`, fontFamily: 'Arial, Helvetica, sans-serif' }}>
                  {/* Conditions */}
                  <div className="text-[9px] text-black font-semibold leading-snug text-left" style={{ wordSpacing: '3px', letterSpacing: '0.6px' }}>
                    <p>- Boleta sin pagar no juega</p>
                    <p>- Válida hasta el día del sorteo</p>
                    <p>- Juega hasta quedar en poder del público</p>
                  </div>

                  {/* Estado */}
                  <div className="flex-1 flex items-center mt-1 mb-1 overflow-hidden">
                    <div className="w-full text-[9px] text-left space-y-1 text-black leading-snug" style={{ wordSpacing: '3px', letterSpacing: '0.6px' }}>
                      {/* Badge */}
                      <div className={`w-full py-1 text-center font-extrabold text-[11px] ${
                        esPagada ? 'bg-green-700 text-white' :
                        esAbonada ? 'bg-orange-400 text-black' :
                        esReservada ? 'bg-blue-600 text-white' :
                        'bg-slate-200 text-black'
                      }`} style={{ letterSpacing: '0.5px' }}>
                        {esPagada ? 'PAGADA' : esAbonada ? 'ABONADA' : estadoNorm}
                      </div>

                      {/* Deuda (only for abonada) */}
                      {esAbonada && deuda > 0 && (
                        <p className="font-extrabold">Deuda: ${deuda.toLocaleString('es-CO')}</p>
                      )}

                      {/* Client name — NO cedula, NO teléfono */}
                      <p className="font-semibold">A nombre de:</p>
                      <p>{b.cliente_nombre ?? '—'}</p>
                    </div>
                  </div>

                  {/* Nota */}
                  {b.nota && (
                    <div className="text-center text-[8px] italic text-slate-600" style={{ maxHeight: '24px', overflow: 'hidden', lineHeight: '10px' }}>
                      {b.nota}
                    </div>
                  )}

                  {/* Number + Price */}
                  <div className="text-center mt-1">
                    <div className="text-lg font-extrabold text-black leading-tight">
                      #{b.numero.toString().padStart(4, '0')}
                    </div>
                    {typeof b.precio_boleta === 'number' && b.precio_boleta > 0 && (
                      <div className="text-[11px] font-bold text-black leading-snug">
                        ${b.precio_boleta.toLocaleString('es-CO')}
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT SIDE — Rifa Image */}
                <div className="flex-shrink-0 h-full" style={{ width: `${BOLETA_RIGHT_WIDTH}px` }}>
                  {imagen ? (
                    <img src={imagen} alt={b.rifa_nombre} className="block w-full h-full" style={{ objectFit: 'fill' }} crossOrigin="anonymous" />
                  ) : (
                    <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                      <span className="text-slate-400 text-sm">{b.rifa_nombre}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })()}

        {/* Resultado: boleta disponible → Ticket preview + Formulario */}
        {resultado?.encontrada && resultado.disponible && resultado.boleta && (() => {
          const b = resultado.boleta!
          const imagen = getStorageImageUrl(b.rifa_imagen_url ?? null) ?? b.rifa_imagen_url
          return (
          <div className="space-y-6">
            {/* Ticket preview */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="flex border-2 border-black bg-white mx-auto overflow-hidden" style={{ maxWidth: `${BOLETA_WIDTH}px`, height: `${BOLETA_DEFAULT_HEIGHT}px` }}>
                <div className="flex-shrink-0 p-2 flex flex-col justify-between border-r-2 border-black" style={{ width: `${BOLETA_LEFT_WIDTH}px`, height: `${BOLETA_DEFAULT_HEIGHT}px`, fontFamily: 'Arial, Helvetica, sans-serif' }}>
                  <div className="text-[9px] text-black font-semibold leading-snug text-left" style={{ wordSpacing: '3px', letterSpacing: '0.6px' }}>
                    <p>- Boleta sin pagar no juega</p>
                    <p>- Válida hasta el día del sorteo</p>
                    <p>- Juega hasta quedar en poder del público</p>
                  </div>
                  <div className="flex-1 flex items-center mt-1 mb-1">
                    <div className="w-full text-[9px] text-left space-y-1 text-black leading-snug" style={{ wordSpacing: '3px', letterSpacing: '0.6px' }}>
                      <div className="w-full py-1 text-center font-extrabold text-[11px] bg-emerald-300 text-black" style={{ letterSpacing: '0.5px' }}>DISPONIBLE</div>
                    </div>
                  </div>
                  <div className="text-center mt-1">
                    <div className="text-lg font-extrabold text-black leading-tight">#{b.numero.toString().padStart(4, '0')}</div>
                    {typeof b.precio_boleta === 'number' && b.precio_boleta > 0 && (
                      <div className="text-[11px] font-bold text-black leading-snug">${b.precio_boleta.toLocaleString('es-CO')}</div>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0 h-full" style={{ width: `${BOLETA_RIGHT_WIDTH}px` }}>
                  {imagen ? (
                    <img src={imagen} alt={b.rifa_nombre} className="block w-full h-full" style={{ objectFit: 'fill' }} crossOrigin="anonymous" />
                  ) : (
                    <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                      <span className="text-slate-400 text-sm">{b.rifa_nombre}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">

            <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Datos del Ganador
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={cliente.nombre}
                  onChange={(e) => setCliente(prev => ({ ...prev, nombre: e.target.value }))}
                  placeholder="Nombre completo"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Teléfono *</label>
                <input
                  type="text"
                  value={cliente.telefono}
                  onChange={(e) => setCliente(prev => ({ ...prev, telefono: e.target.value }))}
                  placeholder="3001234567"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Cédula</label>
                <input
                  type="text"
                  value={cliente.identificacion}
                  onChange={(e) => setCliente(prev => ({ ...prev, identificacion: e.target.value }))}
                  placeholder="Identificación"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Dirección</label>
                <input
                  type="text"
                  value={cliente.direccion}
                  onChange={(e) => setCliente(prev => ({ ...prev, direccion: e.target.value }))}
                  placeholder="Ciudad / Dirección"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                />
              </div>
            </div>

            <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Pago
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Monto del Abono *</label>
                <input
                  type="number"
                  value={montoAbono}
                  onChange={(e) => setMontoAbono(e.target.value)}
                  placeholder="60000"
                  min="1"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                />
                {resultado.boleta.precio_boleta && montoAbono && (
                  <p className="text-xs mt-1 text-slate-400">
                    {parseFloat(montoAbono) >= resultado.boleta.precio_boleta
                      ? '✅ Pago completo'
                      : `⚠️ Abono parcial — saldo: $${(resultado.boleta.precio_boleta - parseFloat(montoAbono)).toLocaleString('es-CO')}`
                    }
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Medio de Pago</label>
                <select
                  value={medioPagoId}
                  onChange={(e) => setMedioPagoId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 bg-white"
                >
                  {MEDIOS_PAGO.map(mp => (
                    <option key={mp.id} value={mp.id}>{mp.nombre}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={asignarGanador}
              disabled={asignando || !cliente.nombre || !cliente.telefono || !montoAbono}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl text-sm font-semibold hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center gap-2"
            >
              {asignando ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  Confirmar Ganador
                </>
              )}
            </button>
          </div>
          </div>
          )
        })()}
        </>
        )}
      </main>
    </div>
  )
}
