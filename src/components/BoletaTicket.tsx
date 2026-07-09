'use client'

import { useState, useEffect } from 'react'
import { getStorageImageUrl } from '@/lib/storageImageUrl'
import {
  BOLETA_WIDTH,
  BOLETA_LEFT_WIDTH,
  BOLETA_RIGHT_WIDTH,
  BOLETA_DEFAULT_HEIGHT,
  boletaHeightForImage,
} from '@/constants/boletaDimensions'

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
  hideQr?: boolean
  hideIdentificacion?: boolean
}

export default function BoletaTicket(props: BoletaTicketProps) {
  const {
    qrUrl,
    numero,
    imagenUrl,
    rifaNombre,
    estado,
    clienteInfo,
    deuda,
    reservadaHasta,
    precio,
    nota,
    hideQr = false,
    hideIdentificacion = false,
  } = props

  const [imageError, setImageError] = useState(false)
  const [ticketHeight, setTicketHeight] = useState(BOLETA_DEFAULT_HEIGHT)
  const imagen = getStorageImageUrl(imagenUrl ?? null) ?? imagenUrl
  const hasImagen = Boolean(imagen && imagen.trim())

  useEffect(() => {
    if (!hasImagen || !imagen) {
      setTicketHeight(BOLETA_DEFAULT_HEIGHT)
      return
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      setTicketHeight(boletaHeightForImage(img.naturalWidth, img.naturalHeight))
    }
    img.onerror = () => setTicketHeight(BOLETA_DEFAULT_HEIGHT)
    img.src = imagen
  }, [imagen, hasImagen])

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

  const diasCaducidad = (() => {
    if (!reservadaHasta) return null
    try {
      const hasta = new Date(reservadaHasta)
      const ahora = new Date()
      const diffMs = hasta.getTime() - ahora.getTime()
      return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
    } catch {
      return null
    }
  })()

  const esReservada = estadoNorm === 'RESERVADA'
  const esCancelada = estadoNorm === 'ANULADA' || estadoNorm === 'CANCELADA'
  const estadoPagadoWords = new Set(['CON_PAGO', 'PAGADA', 'PAGADO', 'VENDIDA'])
  const esPagada =
    (estadoPagadoWords.has(estadoNorm) || (tieneCliente && deudaNum === 0)) && tieneCliente
  const esAbonada =
    estadoNorm === 'ABONADA' || (tieneCliente && typeof deudaNum === 'number' && deudaNum > 0)

  const badge = (label: string, variant: string) => (
    <div className={`boleta-ticket__badge boleta-ticket__badge--${variant}`}>{label}</div>
  )

  const renderEstado = () => {
    if (esCancelada) {
      return (
        <div className="boleta-ticket__body">
          {badge('Boleta cancelada', 'cancelada')}
          <p className="mt-1 text-neutral-400">Esta boleta no tiene validez</p>
        </div>
      )
    }

    if (esReservada && tieneCliente) {
      return (
        <div className="boleta-ticket__body">
          {badge('Reservada', 'reservada')}
          {typeof deudaNum === 'number' && deudaNum > 0 && (
            <p className="boleta-ticket__deuda mt-1">
              Deuda: ${deudaNum.toLocaleString('es-CO')}
            </p>
          )}
          <p className="boleta-ticket__label">A nombre de</p>
          <p className="boleta-ticket__name">{clienteInfo?.nombre ?? '—'}</p>
          {!hideIdentificacion && (
            <p className="boleta-ticket__id">CC. {clienteInfo?.identificacion ?? '—'}</p>
          )}
          <p className="mt-1 text-neutral-400">
            Hasta: {formatDateDisplay(reservadaHasta) ?? '—'}
          </p>
        </div>
      )
    }

    if (esReservada && !tieneCliente) {
      return (
        <div className="boleta-ticket__body">
          {badge('Bloqueada', 'bloqueada')}
          <p className="mt-1 text-neutral-400">Boleta bloqueada momentáneamente</p>
        </div>
      )
    }

    if (esPagada) {
      return (
        <div className="boleta-ticket__body">
          {badge('Pagada', 'pagada')}
          <p className="boleta-ticket__label">A nombre de</p>
          <p className="boleta-ticket__name">{clienteInfo?.nombre ?? '—'}</p>
          {!hideIdentificacion && (
            <p className="boleta-ticket__id">CC. {clienteInfo?.identificacion ?? '—'}</p>
          )}
        </div>
      )
    }

    if (esAbonada) {
      return (
        <div className="boleta-ticket__body">
          {badge('Abonada', 'abonada')}
          <p className="boleta-ticket__deuda mt-1">
            Deuda:{' '}
            {typeof deudaNum === 'number' ? `$${deudaNum.toLocaleString('es-CO')}` : '—'}
          </p>
          <p className="boleta-ticket__label">A nombre de</p>
          <p className="boleta-ticket__name">{clienteInfo?.nombre ?? '—'}</p>
          {!hideIdentificacion && (
            <p className="boleta-ticket__id">CC. {clienteInfo?.identificacion ?? '—'}</p>
          )}
        </div>
      )
    }

    return (
      <div className="boleta-ticket__body">
        {badge('Disponible', 'disponible')}
      </div>
    )
  }

  return (
    <div
      className="boleta-ticket"
      style={{
        width: `${BOLETA_WIDTH}px`,
        height: `${ticketHeight}px`,
        minWidth: `${BOLETA_WIDTH}px`,
      }}
    >
      <div
        className="boleta-ticket__left"
        style={{ width: `${BOLETA_LEFT_WIDTH}px`, height: `${ticketHeight}px` }}
      >
        <div className="boleta-ticket__rules">
          <p>Boleta sin pagar no juega</p>
          {diasCaducidad !== null ? (
            <p>{diasCaducidad} días de caducidad</p>
          ) : (
            <p>Válida hasta el día del sorteo</p>
          )}
          <p>Juega hasta quedar en poder del público</p>
        </div>

        <div className="boleta-ticket__content">{renderEstado()}</div>

        {!hideQr && (
          <div className="boleta-ticket__qr-wrap">
            <img src={qrUrl} alt="QR" className="boleta-ticket__qr" />
          </div>
        )}

        {nota && <div className="boleta-ticket__nota">{nota}</div>}

        <div className="boleta-ticket__footer">
          <div className="boleta-ticket__numero">#{numero.toString().padStart(4, '0')}</div>
          {typeof precio === 'number' && precio > 0 && (
            <div className="boleta-ticket__precio">${precio.toLocaleString('es-CO')}</div>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 h-full" style={{ width: `${BOLETA_RIGHT_WIDTH}px` }}>
        {hasImagen && !imageError && imagen ? (
          <img
            src={imagen}
            className="block w-full h-full"
            style={{ objectFit: 'fill' }}
            onLoad={(e) => {
              const img = e.currentTarget
              if (img.naturalWidth > 0) {
                setTicketHeight(boletaHeightForImage(img.naturalWidth, img.naturalHeight))
              }
            }}
            onError={() => setImageError(true)}
            alt={rifaNombre}
          />
        ) : (
          <div className="boleta-ticket__right-fallback">
            <div className="text-center">
              <p>{rifaNombre}</p>
              <p>Boleta #{numero.toString().padStart(4, '0')}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
