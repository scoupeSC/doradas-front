'use client'

import { useState } from 'react'
import { getStorageImageUrl } from '@/lib/storageImageUrl'

interface BoletaTicketProps {
  qrUrl: string
  barcode: string
  numero: number
  imagenUrl?: string | null
  rifaNombre: string
  estado: string
  clienteInfo?: {
    nombre: string
    identificacion?: string
  } | null
  deuda?: number | string | null
  reservadaHasta?: string | null
  precio?: number | null
  nota?: string | null
}

export default function BoletaTicket(props: BoletaTicketProps) {
  const {
    qrUrl,
    barcode,
    numero,
    imagenUrl,
    rifaNombre,
    estado,
    clienteInfo,
    deuda,
    reservadaHasta,
    precio,
    nota,
  } = props

  const [imageError, setImageError] = useState(false)
  const imagen = getStorageImageUrl(imagenUrl ?? null) ?? imagenUrl
  const hasImagen = Boolean(imagen && imagen.trim())

  // --- Helpers ---
  const estadoNorm = (estado ?? '').toString().trim().toUpperCase()
  const deudaNum =
    typeof deuda === 'number'
      ? deuda
      : deuda
      ? Number(String(deuda).replace(/[^0-9.-]/g, '')) || null
      : null
  const tieneCliente = Boolean(clienteInfo && (clienteInfo.nombre || clienteInfo.identificacion))

  const formatDateDisplay = (d?: string | null) => {
    if (!d) return undefined
    try {
      const dt = new Date(d)
      if (isNaN(dt.getTime())) return d
      return dt.toLocaleString('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return d
    }
  }

  // Calcular días de caducidad dinámicamente
  const diasCaducidad = (() => {
    if (!reservadaHasta) return null
    try {
      const hasta = new Date(reservadaHasta)
      const ahora = new Date()
      const diffMs = hasta.getTime() - ahora.getTime()
      const dias = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
      return dias
    } catch {
      return null
    }
  })()

  const esReservada = estadoNorm === 'RESERVADA'
  const esCancelada = estadoNorm === 'ANULADA' || estadoNorm === 'CANCELADA'

  const estadoPagadoWords = new Set(['CON_PAGO', 'PAGADA', 'PAGADO', 'VENDIDA'])
  const esPagada = (estadoPagadoWords.has(estadoNorm) || (tieneCliente && deudaNum === 0)) && tieneCliente

  const esAbonada =
    estadoNorm === 'ABONADA' || (tieneCliente && typeof deudaNum === 'number' && deudaNum > 0)

  const badge = (label: string, className: string) => (
    <div
      className={`w-full py-1 text-center font-extrabold text-[11px] ${className}`}
      style={{ letterSpacing: '0.5px' }}
    >
      {label}
    </div>
  )

  const baseText = 'text-[9px] text-left space-y-1 text-black leading-snug'

  const renderEstado = () => {
    if (esCancelada) {
      return (
        <div className={baseText} style={{ wordSpacing: '3px', letterSpacing: '0.6px' }}>
          {badge('BOLETA CANCELADA', 'bg-red-600 text-white')}
          <p className="font-bold">Esta boleta no tiene validez</p>
        </div>
      )
    }

    if (esReservada && tieneCliente) {
      return (
        <div className={baseText} style={{ wordSpacing: '3px', letterSpacing: '0.6px' }}>
          {badge('RESERVADA', 'bg-blue-600 text-white')}
          {typeof deudaNum === 'number' && deudaNum > 0 && (
            <p className="font-extrabold">
              Deuda: ${deudaNum.toLocaleString('es-CO')}
            </p>
          )}
          <p className="font-semibold">A nombre de:</p>
          <p>{clienteInfo?.nombre ?? '—'}</p>
          <p>CC. {clienteInfo?.identificacion ?? '—'}</p>
          <p className="font-bold" style={{ wordSpacing: '1px' }}>
            Reservada hasta: {formatDateDisplay(reservadaHasta) ?? '—'}
          </p>
        </div>
      )
    }

    if (esReservada && !tieneCliente) {
      return (
        <div className={baseText} style={{ wordSpacing: '3px', letterSpacing: '0.6px' }}>
          {badge('BLOQUEADA', 'bg-amber-200 text-black')}
          <p className="font-semibold">Boleta bloqueada momentáneamente</p>
        </div>
      )
    }

    if (esPagada) {
      return (
        <div className={baseText} style={{ wordSpacing: '3px', letterSpacing: '0.6px' }}>
          {badge('PAGADA', 'bg-green-700 text-white')}
          <p className="font-semibold">A nombre de:</p>
          <p>{clienteInfo?.nombre ?? '—'}</p>
          <p>CC. {clienteInfo?.identificacion ?? '—'}</p>
        </div>
      )
    }

    if (esAbonada) {
      return (
        <div className={baseText} style={{ wordSpacing: '3px', letterSpacing: '0.6px' }}>
          {badge('ABONADA', 'bg-orange-400 text-black')}
          <p className="font-extrabold">
            Deuda: {typeof deudaNum === 'number' ? `$${deudaNum.toLocaleString('es-CO')}` : '—'}
          </p>
          <p className="font-semibold">A nombre de:</p>
          <p>{clienteInfo?.nombre ?? '—'}</p>
          <p>CC. {clienteInfo?.identificacion ?? '—'}</p>
        </div>
      )
    }

    return (
      <div className={baseText} style={{ wordSpacing: '3px', letterSpacing: '0.6px' }}>
        {badge('DISPONIBLE', 'bg-emerald-300 text-black')}
      </div>
    )
  }

  // Dimensiones fijas 800×352 — necesario para que html2canvas capture completo.
  // El wrapper padre (ResponsiveBoletaWrapper) se encarga de escalar visualmente.
  return (
    <div
      className="boleta-ticket flex border-2 border-black overflow-hidden bg-white"
      style={{ width: '800px', height: '352px', minWidth: '800px' }}
    >
      {/* LEFT */}
      <div
        className="flex-shrink-0 p-2 flex flex-col justify-between border-r-2 border-black"
        style={{
          width: '210px',
          height: '352px',
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontKerning: 'none',
          fontVariantLigatures: 'none',
          overflow: 'hidden',
          whiteSpace: 'normal',
          wordBreak: 'break-word',
        }}
      >
        {/* Condiciones */}
        <div
          className="text-[9px] text-black font-semibold leading-snug text-left"
          style={{ overflowWrap: 'break-word', wordBreak: 'break-word', wordSpacing: '3px', letterSpacing: '0.6px' }}
        >
          <p>- Boleta sin pagar no juega</p>
          {diasCaducidad !== null ? (
            <p>- {diasCaducidad} días de caducidad</p>
          ) : (
            <p>- Válida hasta el día del sorteo</p>
          )}
          <p>- Juega hasta quedar en poder del público</p>
        </div>

        {/* Estado */}
        <div className="flex-1 flex items-center mt-1 mb-1 overflow-hidden">
          <div className="w-full" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
            {renderEstado()}
          </div>
        </div>

        {/* QR */}
        <div className="flex justify-center mb-1">
          <img
            src={qrUrl}
            alt="QR"
            style={{ width: '72px', height: '72px', border: '1px solid #000' }}
          />
        </div>

        {/* Nota */}
        {nota && (
          <div
            className="text-center text-[8px] italic text-slate-600"
            style={{ maxHeight: '24px', overflow: 'hidden', lineHeight: '10px' }}
          >
            {nota}
          </div>
        )}

        {/* Número y precio */}
        <div className="text-center mt-1">
          <div className="text-lg font-extrabold text-black leading-tight">
            #{numero.toString().padStart(4, '0')}
          </div>
          {typeof precio === 'number' && precio > 0 && (
            <div className="text-[11px] font-bold text-black leading-snug">
              ${precio.toLocaleString('es-CO')}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT — 800 - 210 = 590px (621px recortaba ~31px con overflow:hidden) */}
      <div className="flex-shrink-0 h-full" style={{ width: '590px' }}>
        {hasImagen && !imageError && imagen ? (
          <img
            src={imagen}
            className="w-full h-full object-contain object-left"
            onError={() => setImageError(true)}
            alt={rifaNombre}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-white">
            <div className="text-center text-black">
              <p className="text-xl font-bold">{rifaNombre}</p>
              <p>Boleta #{numero.toString().padStart(4, '0')}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}