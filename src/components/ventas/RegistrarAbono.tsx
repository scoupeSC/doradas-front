'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ventasApi } from '@/lib/ventasApi'
import { getStorageImageUrl } from '@/lib/storageImageUrl'
import ReciboAbono, { ReciboAbonoData } from './ReciboAbono'
import BoletaTicket from '@/components/BoletaTicket'
import ResponsiveBoletaWrapper from '@/components/ResponsiveBoletaWrapper'
import { formatearInputPesos, parsearInputPesos } from '@/utils/formatPesos'
import { downloadBoletaImage } from '@/utils/downloadBoletaImage'
import { generarWhatsAppChatLink } from '@/utils/telefono'
import { WHATSAPP_VENTAS_ACTIVO } from '@/config/features'

interface Props {
  ventaId: string
  onBack: () => void
  onAbonoRegistrado: () => void
}

type ExitoReciente = { tipo: 'abono' | 'pago_total'; monto: number; boletaNumeros?: number[] } | null

type AccionGestionar = null | 'abonar' | 'cancelar'

// Estado de abono multi-boleta: mapa boletaId → monto a abonar
type BoletasSeleccionadas = Record<string, number>

interface AbonoBoletaHistorial {
  id: string
  monto: number
  moneda: string
  estado: string
  referencia: string | null
  metodo_pago: string
  notas: string | null
  fecha: string
}

interface BoletaVenta {
  id: string
  numero: number
  estado: string
  bloqueo_hasta?: string | null
  precio_boleta?: number
  total_pagado_boleta?: number
  saldo_pendiente_boleta?: number
  qr_url?: string
  imagen_url?: string
  nota?: string | null
  abonos?: AbonoBoletaHistorial[]
}

interface VentaNormalizada {
  id: string
  monto_total: number
  total_pagado: number
  saldo_pendiente: number
  estado_venta: string
  nombre: string
  telefono: string
  email?: string
  cliente_identificacion?: string
  rifa_nombre?: string
  created_at?: string
  vendedor_nombre?: string | null
  vendedor_email?: string | null
  abonos: Array<{ id: string; monto: number; created_at: string; metodo_pago?: string }>
  boletas?: BoletaVenta[]
}

function normalizarVenta(d: any): VentaNormalizada {
  const totalVenta = Number(d.total_venta ?? d.monto_total ?? 0)
  const totalPagado = Number(d.total_pagado ?? 0)
  return {
    id: d.id,
    monto_total: totalVenta,
    total_pagado: totalPagado,
    saldo_pendiente: d.saldo_pendiente ?? totalVenta - totalPagado,
    estado_venta: d.estado_venta ?? 'PENDIENTE',
    nombre: d.cliente_nombre ?? d.nombre ?? '',
    telefono: d.cliente_telefono ?? d.telefono ?? '',
    email: d.cliente_email ?? d.email,
    cliente_identificacion: d.cliente_identificacion ?? '',
    rifa_nombre: d.rifa_nombre ?? '',
    created_at: d.created_at,
    vendedor_nombre: d.vendedor_nombre ?? null,
    vendedor_email: d.vendedor_email ?? null,
    abonos: d.abonos ?? [],
    boletas: d.boletas ?? [],
  }
}

function buildReciboData(
  venta: VentaNormalizada,
  opts: { tipo: 'abono' | 'pago_total'; montoRegistrado: number; metodoPago: string; notas?: string }
): ReciboAbonoData {
  return {
    tipo: opts.tipo,
    montoRegistrado: opts.montoRegistrado,
    totalVenta: venta.monto_total,
    totalPagado: venta.total_pagado,
    saldoPendiente: venta.saldo_pendiente,
    clienteNombre: venta.nombre,
    clienteTelefono: venta.telefono,
    clienteEmail: venta.email,
    metodoPago: opts.metodoPago,
    notas: opts.notas,
    ventaId: venta.id,
    boletas: (venta.boletas || []).map((b) => ({
      numero: b.numero,
      estado: b.estado,
      precioBoleta: b.precio_boleta || 0,
      totalPagado: b.total_pagado_boleta || 0,
      saldoPendiente: b.saldo_pendiente_boleta || 0,
    })),
  }
}

function estadoBoletaTicket(b: BoletaVenta): string {
  if (b.estado === 'PAGADA') return 'PAGADA'
  if (b.estado === 'ABONADA' || ((b.total_pagado_boleta ?? 0) > 0 && (b.saldo_pendiente_boleta ?? 0) > 0)) {
    return 'ABONADA'
  }
  if (b.estado === 'RESERVADA') return 'RESERVADA'
  return b.estado
}

const MEDIOS_PAGO = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'transferencia', label: 'PSE' },
]

export default function RegistrarAbono({ ventaId, onBack, onAbonoRegistrado }: Props) {
  const [venta, setVenta] = useState<VentaNormalizada | null>(null)
  const [loading, setLoading] = useState(true)
  const [accion, setAccion] = useState<AccionGestionar>(null)
  const [monto, setMonto] = useState<number>(0)
  const [metodoPago, setMetodoPago] = useState<string>('')
  const [notas, setNotas] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmarCancelar, setConfirmarCancelar] = useState(false)
  const [pagarTodo, setPagarTodo] = useState(false)
  const [exitoReciente, setExitoReciente] = useState<ExitoReciente>(null)
  const [reciboData, setReciboData] = useState<ReciboAbonoData | null>(null)
  const [mostrarReciboModal, setMostrarReciboModal] = useState(false)
  const [boletasDescargaIds, setBoletasDescargaIds] = useState<string[]>([])
  const [boletasSeleccionadas, setBoletasSeleccionadas] = useState<BoletasSeleccionadas>({})
  const [historialExpandido, setHistorialExpandido] = useState<Record<string, boolean>>({})
  const [mostrarConfirmacionAbono, setMostrarConfirmacionAbono] = useState(false)

  useEffect(() => {
    cargarDetalle()
  }, [ventaId])

  const cargarDetalle = async (opts?: { silent?: boolean }): Promise<VentaNormalizada | null> => {
    try {
      if (!opts?.silent) setLoading(true)
      setError(null)
      const response = await ventasApi.getVentaDetalleFinanciero(ventaId)
      const normalized = normalizarVenta(response.data)
      setVenta(normalized)
      if (!opts?.silent) {
        setPagarTodo(false)
        setMonto(0)
        setNotas('')
      }
      return normalized
    } catch (err: any) {
      setError(err?.message || 'Error cargando detalle')
      return null
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }

  const descargarBoleta = useCallback(async (boletaNumero: number, identificacion: string, elementId: string) => {
    try {
      const cc = (identificacion || 'SIN_CC').replace(/\s+/g, '_')
      await downloadBoletaImage({
        elementId,
        fileName: `boleta_${boletaNumero.toString().padStart(4, '0')}_CC_${cc}.png`,
      })
    } catch (err) {
      console.error('Error descargando boleta:', err)
    }
  }, [])

  const descargarTodasBoletas = useCallback(
    async (boletas: BoletaVenta[], identificacion: string) => {
      for (const b of boletas) {
        await descargarBoleta(b.numero, identificacion, `boleta-print-${b.id}`)
        await new Promise((r) => setTimeout(r, 500))
      }
    },
    [descargarBoleta]
  )

  const registrarAbono = async () => {
    if (!venta) return

    // Determinar si es multi-boleta o general
    const boletasIds = Object.keys(boletasSeleccionadas)
    const hayBoletasSeleccionadas = boletasIds.length > 0

    if (hayBoletasSeleccionadas) {
      // MODO MULTI-BOLETA: validar cada monto individual
      const boletasAbono: Array<{ boleta_id: string; monto: number }> = []
      let totalMulti = 0

      for (const bId of boletasIds) {
        const montoB = Number(boletasSeleccionadas[bId])
        if (isNaN(montoB) || montoB <= 0) continue // ignorar sin monto

        const boletaInfo = venta.boletas?.find(b => b.id === bId)
        if (!boletaInfo) continue

        const saldoB = boletaInfo.saldo_pendiente_boleta ?? 0
        if (montoB > saldoB + 0.01) {
          setError(`El monto de la boleta #${boletaInfo.numero.toString().padStart(4, '0')} ($${montoB.toLocaleString('es-CO')}) excede su saldo ($${saldoB.toLocaleString('es-CO')})`)
          return
        }

        boletasAbono.push({ boleta_id: bId, monto: montoB })
        totalMulti += montoB
      }

      if (boletasAbono.length === 0) {
        setError('Ingresa al menos un monto para abonar')
        return
      }

      if (!metodoPago || metodoPago.trim() === '') {
        setError('Debe seleccionar un método de pago')
        return
      }

      setProcesando(true)
      setError(null)
      try {
        const notasAbono = notas.trim() || undefined
        await ventasApi.registrarAbono(ventaId, {
          monto: totalMulti,
          metodo_pago: metodoPago,
          notas: notasAbono,
          boletas_abono: boletasAbono
        })
        const ventaActualizada = await cargarDetalle({ silent: true })
        if (!ventaActualizada) return

        setBoletasSeleccionadas({})
        setMonto(0)
        setNotas('')
        setAccion(null)

        const numerosAbonados = boletasAbono.map((ba) => {
          const b = ventaActualizada.boletas?.find((x) => x.id === ba.boleta_id)
          return b?.numero ?? 0
        })

        const esPagoTotal = ventaActualizada.saldo_pendiente <= 0
        const mpLabel = MEDIOS_PAGO.find((m) => m.id === metodoPago)?.label || metodoPago

        setBoletasDescargaIds(boletasAbono.map((ba) => ba.boleta_id))
        setExitoReciente({
          tipo: esPagoTotal ? 'pago_total' : 'abono',
          monto: totalMulti,
          boletaNumeros: numerosAbonados,
        })
        setReciboData(
          buildReciboData(ventaActualizada, {
            tipo: esPagoTotal ? 'pago_total' : 'abono',
            montoRegistrado: totalMulti,
            metodoPago: mpLabel,
            notas: notasAbono,
          })
        )
        setMostrarReciboModal(false)
      } catch (err: any) {
        const responseData = err?.response?.data
        let mensajeError = 'Error registrando abono'
        if (responseData?.details && Array.isArray(responseData.details)) {
          const detalles = responseData.details.map((d: any) => `${d.field}: ${d.message}`).join(', ')
          mensajeError = `${responseData.message || 'Error de validación'}: ${detalles}`
        } else {
          mensajeError = responseData?.message || responseData?.error || err?.message || 'Error registrando abono'
        }
        setError(mensajeError)
      } finally {
        setProcesando(false)
      }
    } else {
      // MODO GENERAL (sin boletas seleccionadas)
      const montoValidado = Number(monto)
      if (isNaN(montoValidado) || montoValidado <= 0) {
        setError('El monto debe ser un número mayor a 0')
        return
      }

      if (montoValidado > venta.saldo_pendiente) {
        setError('El monto no puede superar el saldo pendiente')
        return
      }

      if (!metodoPago || metodoPago.trim() === '') {
        setError('Debe seleccionar un método de pago')
        return
      }

      setProcesando(true)
      setError(null)
      try {
        const notasAbono = notas.trim() || undefined
        await ventasApi.registrarAbono(ventaId, {
          monto: montoValidado,
          metodo_pago: metodoPago,
          notas: notasAbono
        })
        const ventaActualizada = await cargarDetalle({ silent: true })
        if (!ventaActualizada) return

        setMonto(0)
        setNotas('')
        setAccion(null)

        const esPagoTotal = ventaActualizada.saldo_pendiente <= 0
        const mpLabelGen = MEDIOS_PAGO.find((m) => m.id === metodoPago)?.label || metodoPago

        setBoletasDescargaIds((ventaActualizada.boletas || []).map((b) => b.id))
        setExitoReciente({
          tipo: esPagoTotal ? 'pago_total' : 'abono',
          monto: montoValidado,
        })
        setReciboData(
          buildReciboData(ventaActualizada, {
            tipo: esPagoTotal ? 'pago_total' : 'abono',
            montoRegistrado: montoValidado,
            metodoPago: mpLabelGen,
            notas: notasAbono,
          })
        )
        setMostrarReciboModal(false)
      } catch (err: any) {
        const responseData = err?.response?.data
        let mensajeError = 'Error registrando abono'
        if (responseData?.details && Array.isArray(responseData.details)) {
          const detalles = responseData.details.map((d: any) => `${d.field}: ${d.message}`).join(', ')
          mensajeError = `${responseData.message || 'Error de validación'}: ${detalles}`
        } else {
          mensajeError = responseData?.message || responseData?.error || err?.message || 'Error registrando abono'
        }
        setError(mensajeError)
      } finally {
        setProcesando(false)
      }
    }
  }

  const cancelarTotalidad = async () => {
    setProcesando(true)
    setError(null)
    try {
      // Si tu backend tiene endpoint para cancelar venta, úsalo aquí:
      // await ventasApi.cancelarVenta(ventaId)
      setConfirmarCancelar(false)
      setAccion(null)
      onAbonoRegistrado()
    } catch (err: any) {
      setError(err?.message || 'Error al cancelar')
    } finally {
      setProcesando(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
        <p className="text-slate-600">Cargando detalle de la venta...</p>
      </div>
    )
  }

  if (error && !venta) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="bg-red-50 text-red-700 px-4 py-2 rounded mb-4 text-sm">{error}</div>
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
        >
          ← Volver
        </button>
      </div>
    )
  }

  if (!venta) return null

  const cerrarExitoYVolver = () => {
    setExitoReciente(null)
    setReciboData(null)
    setMostrarReciboModal(false)
    setBoletasDescargaIds([])
    onAbonoRegistrado()
  }

  const whatsappChatLink = venta ? generarWhatsAppChatLink(venta.telefono) : null

  if (exitoReciente && reciboData && venta) {
    const boletasParaDescarga = (venta.boletas || []).filter((b) => boletasDescargaIds.includes(b.id))
    const identificacion = venta.cliente_identificacion || 'SIN_CC'

    return (
      <div className="pb-28 sm:pb-8">
        {mostrarReciboModal && reciboData && (
          <ReciboAbono
            data={reciboData}
            onClose={() => setMostrarReciboModal(false)}
          />
        )}

        {/* Resumen del abono */}
        <div className="bg-white rounded-lg shadow-sm border border-green-200 p-6 mb-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-green-100 rounded-full mb-3">
              <span className="text-3xl">{exitoReciente.tipo === 'pago_total' ? '🎉' : '✅'}</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900">
              {exitoReciente.tipo === 'pago_total' ? '¡Pago completado!' : 'Abono registrado exitosamente'}
            </h2>
            <p className="text-slate-600 mt-1">
              Se registró <span className="font-semibold text-green-700">${exitoReciente.monto.toLocaleString('es-CO')}</span>
              {exitoReciente.boletaNumeros && exitoReciente.boletaNumeros.length > 0 && (
                <> en {exitoReciente.boletaNumeros.length} boleta{exitoReciente.boletaNumeros.length > 1 ? 's' : ''}</>
              )}
            </p>
            {venta.saldo_pendiente > 0 ? (
              <p className="text-sm text-orange-700 mt-2">
                Saldo pendiente: <span className="font-semibold">${venta.saldo_pendiente.toLocaleString('es-CO')}</span>
              </p>
            ) : (
              <p className="text-sm text-green-700 font-semibold mt-2">¡Cuenta saldada!</p>
            )}
          </div>
        </div>

        {/* Boletas actualizadas */}
        {boletasParaDescarga.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h3 className="text-lg font-medium text-slate-900">
                Boletas actualizadas ({boletasParaDescarga.length})
              </h3>
              {boletasParaDescarga.length > 1 && (
                <button
                  type="button"
                  onClick={() => descargarTodasBoletas(boletasParaDescarga, identificacion)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                >
                  Descargar Todas
                </button>
              )}
            </div>

            <div className="space-y-6">
              {boletasParaDescarga.map((b) => (
                <div key={b.id} className="border border-slate-200 rounded-lg p-4 overflow-visible">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div>
                      <span className="font-bold text-slate-900">
                        Boleta #{b.numero.toString().padStart(4, '0')}
                      </span>
                      <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                        {b.estado}
                      </span>
                      {(b.saldo_pendiente_boleta ?? 0) > 0 && (
                        <span className="ml-2 text-xs text-orange-700">
                          Saldo: ${(b.saldo_pendiente_boleta ?? 0).toLocaleString('es-CO')}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => descargarBoleta(b.numero, identificacion, `boleta-print-${b.id}`)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-medium"
                      >
                        Descargar
                      </button>
                      <Link
                        href={`/boletas/${b.id}/print`}
                        target="_blank"
                        className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-xs font-medium"
                      >
                        Imprimir
                      </Link>
                    </div>
                  </div>
                  <ResponsiveBoletaWrapper id={`boleta-print-${b.id}`}>
                    <BoletaTicket
                      qrUrl={b.qr_url || `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=boleta-${b.id}`}
                      barcode=""
                      numero={b.numero}
                      imagenUrl={b.imagen_url}
                      rifaNombre={venta.rifa_nombre || ''}
                      estado={estadoBoletaTicket(b)}
                      clienteInfo={{
                        nombre: venta.nombre,
                        identificacion: venta.cliente_identificacion,
                      }}
                      deuda={b.saldo_pendiente_boleta ?? 0}
                      reservadaHasta={b.bloqueo_hasta}
                      precio={b.precio_boleta ?? null}
                      nota={b.nota}
                    />
                  </ResponsiveBoletaWrapper>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Barra de acciones fija en móvil para que no se corte el contenido final */}
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-sm border-t border-slate-200 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:static sm:bg-transparent sm:border-0 sm:backdrop-blur-none sm:px-0 sm:py-0 sm:pb-0">
          <div className="max-w-5xl mx-auto flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => setMostrarReciboModal(true)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Ver recibo
            </button>
            {WHATSAPP_VENTAS_ACTIVO && whatsappChatLink && (
              <a
                href={whatsappChatLink}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium inline-flex items-center gap-2"
              >
                Abrir WhatsApp del cliente
              </a>
            )}
            <button
              type="button"
              onClick={cerrarExitoYVolver}
              className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
            >
              Continuar
            </button>
          </div>
        </div>
      </div>
    )
  }

  const mostrarFormularioAbono = accion === 'abonar'
  const mostrarFormularioCancelar = accion === 'cancelar'

  // Calcular cantidad de transacciones de abono (agrupando por fecha/hora)
  // Si varios abonos tienen la misma fecha/hora (o muy cercana), se cuentan como 1 transacción
  const cantidadTransaccionesAbono = (() => {
    if (venta.abonos.length === 0) return 0
    
    // Agrupar abonos por fecha/hora redondeada a minutos (misma transacción)
    const grupos = new Set<string>()
    for (const abono of venta.abonos) {
      const fecha = new Date(abono.created_at)
      // Redondear a minutos para agrupar abonos de la misma transacción
      const clave = `${fecha.getFullYear()}-${fecha.getMonth()}-${fecha.getDate()}-${fecha.getHours()}-${fecha.getMinutes()}`
      grupos.add(clave)
    }
    return grupos.size
  })()

  // Mapa para obtener datos de boleta desde un abono (usando boleta_id)
  const boletasPorId: Record<string, {
    id: string
    numero: number
    estado: string
    bloqueo_hasta?: string | null
    precio_boleta?: number
    total_pagado_boleta?: number
    saldo_pendiente_boleta?: number
    qr_url?: string
    imagen_url?: string
  }> = {}
  if (venta.boletas) {
    for (const b of venta.boletas) {
      boletasPorId[b.id] = b
    }
  }

  return (
    <div className="space-y-6">
      {/* Botón Volver */}
      <div className="flex justify-start">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium"
        >
          ← Volver a ventas
        </button>
      </div>

      {/* ⚠️ ADVERTENCIA DE VENDEDOR — siempre visible al ingresar */}
      <div className={`rounded-xl border-2 p-5 flex items-start gap-4 shadow-md ${
        venta.vendedor_nombre
          ? 'bg-amber-50 border-amber-400'
          : 'bg-blue-50 border-blue-400'
      }`}>
        <div className="text-4xl flex-shrink-0 mt-0.5">
          {venta.vendedor_nombre ? '⚠️' : '🌐'}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-base font-extrabold uppercase tracking-wide mb-1 ${
            venta.vendedor_nombre ? 'text-amber-800' : 'text-blue-800'
          }`}>
            {venta.vendedor_nombre
              ? 'Esta venta fue registrada por:'
              : 'Venta Online'}
          </p>
          {venta.vendedor_nombre ? (
            <>
              <p className="text-2xl font-black text-amber-900 leading-tight">
                {venta.vendedor_nombre.toUpperCase()}
              </p>
              {venta.vendedor_email && (
                <p className="text-sm text-amber-700 mt-0.5">{venta.vendedor_email}</p>
              )}
            </>
          ) : (
            <p className="text-sm text-blue-800 font-semibold mt-1">
              Esta venta fue realizada por el cliente a través del canal online. No tiene vendedor asignado.
            </p>
          )}
        </div>
      </div>

      {/* Boletas en cards */}
      {venta.boletas && venta.boletas.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Boletas de esta venta</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {venta.boletas.map((boleta) => (
              <div
                key={boleta.id}
                className="border-2 border-slate-200 rounded-xl p-4 text-center hover:border-slate-300 transition-colors bg-slate-50/50 flex flex-col gap-2"
              >
                <div className="text-2xl font-bold text-slate-800">#{boleta.numero.toString().padStart(4, '0')}</div>

                <span className="inline-flex items-center justify-center px-2 py-1 rounded-full text-xs font-semibold
                  bg-slate-100 text-slate-700">
                  {boleta.estado}
                </span>

                {boleta.imagen_url || boleta.qr_url ? (
                  <div className="mt-2 h-16 flex items-center justify-center">
                    <img
                      src={getStorageImageUrl(boleta.imagen_url) ?? getStorageImageUrl(boleta.qr_url) ?? boleta.imagen_url ?? boleta.qr_url}
                      alt={`Boleta ${boleta.numero.toString().padStart(4, '0')}`}
                      className="max-h-14 w-auto object-contain"
                    />
                  </div>
                ) : null}

                <div className="text-[11px] text-left space-y-1 mt-1 text-slate-700">
                  {typeof boleta.precio_boleta === 'number' && (
                    <div>Precio: ${boleta.precio_boleta.toLocaleString('es-CO')}</div>
                  )}
                  {typeof boleta.total_pagado_boleta === 'number' && (
                    <div>Pagado: ${boleta.total_pagado_boleta.toLocaleString('es-CO')}</div>
                  )}
                  {typeof boleta.saldo_pendiente_boleta === 'number' && (
                    <div className="font-semibold text-orange-700">
                      Saldo: ${boleta.saldo_pendiente_boleta.toLocaleString('es-CO')}
                    </div>
                  )}
                  {boleta.estado === 'RESERVADA' && boleta.bloqueo_hasta && (
                    <div className="text-[10px] text-amber-700">
                      Reservada hasta:{' '}
                      {new Date(boleta.bloqueo_hasta).toLocaleString()}
                    </div>
                  )}
                </div>

                {/* Selección multi-boleta para abonar */}
                {typeof boleta.saldo_pendiente_boleta === 'number' && boleta.saldo_pendiente_boleta > 0 && (
                  <div className="mt-2 space-y-1.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={boleta.id in boletasSeleccionadas}
                        onChange={(e) => {
                          setBoletasSeleccionadas(prev => {
                            const next = { ...prev }
                            if (e.target.checked) {
                              next[boleta.id] = 0
                            } else {
                              delete next[boleta.id]
                            }
                            return next
                          })
                          if (e.target.checked && accion !== 'abonar') {
                            setAccion('abonar')
                            setError(null)
                          }
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs font-medium text-slate-700">Seleccionar</span>
                    </label>
                    {boleta.id in boletasSeleccionadas && (
                      <div className="space-y-1">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={formatearInputPesos(boletasSeleccionadas[boleta.id] || 0)}
                          onChange={(e) => {
                            const val = parsearInputPesos(e.target.value)
                            setBoletasSeleccionadas(prev => ({ ...prev, [boleta.id]: Math.min(val, boleta.saldo_pendiente_boleta!) }))
                          }}
                          placeholder="$ 0"
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 bg-white text-black"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setBoletasSeleccionadas(prev => ({
                              ...prev,
                              [boleta.id]: boleta.saldo_pendiente_boleta!
                            }))
                          }}
                          className="w-full px-2 py-1 text-[10px] font-medium rounded bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                        >
                          ✅ Pagar total (${boleta.saldo_pendiente_boleta.toLocaleString('es-CO')})
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {boleta.estado === 'PAGADA' && (
                  <div className="mt-2 text-xs text-green-700 font-semibold text-center bg-green-50 rounded-lg py-1">
                    ✅ Pagada
                  </div>
                )}

                {/* Historial de abonos por boleta */}
                {boleta.abonos && boleta.abonos.length > 0 && (
                  <div className="mt-2 w-full">
                    <button
                      type="button"
                      onClick={() => setHistorialExpandido(prev => ({
                        ...prev,
                        [boleta.id]: !prev[boleta.id]
                      }))}
                      className="w-full text-[11px] text-blue-600 hover:text-blue-800 font-medium flex items-center justify-center gap-1"
                    >
                      <span>{historialExpandido[boleta.id] ? '▼' : '▶'}</span>
                      <span>Historial ({boleta.abonos.length} abono{boleta.abonos.length !== 1 ? 's' : ''})</span>
                    </button>
                    {historialExpandido[boleta.id] && (
                      <div className="mt-1 space-y-1 text-left">
                        {boleta.abonos.map((abono, idx) => (
                          <div key={abono.id} className="bg-white border border-slate-200 rounded-lg p-2 text-[10px]">
                            <div className="flex justify-between items-start">
                              <span className="text-slate-500">#{idx + 1}</span>
                              <span className="font-semibold text-green-700">
                                ${Number(abono.monto).toLocaleString('es-CO')}
                              </span>
                            </div>
                            <div className="text-slate-500 mt-0.5">
                              {new Date(abono.fecha).toLocaleDateString('es-CO')} {new Date(abono.fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div className="text-slate-600">
                              {abono.metodo_pago}
                            </div>
                            {abono.notas && (
                              <div className="text-slate-400 italic mt-0.5 truncate">
                                {abono.notas}
                              </div>
                            )}
                          </div>
                        ))}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-1.5 text-[10px] text-center font-semibold text-blue-800">
                          Total abonado: ${boleta.abonos.reduce((sum, a) => sum + Number(a.monto), 0).toLocaleString('es-CO')}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cliente y datos de la venta */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Información de la venta</h2>
        
        {/* Cliente */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="text-xs text-blue-600 uppercase tracking-wide mb-1">Cliente</div>
          <div className="font-medium text-blue-900">{venta.nombre}</div>
          <div className="text-sm text-blue-800">{venta.telefono}</div>
          {venta.email && <div className="text-sm text-blue-700">{venta.email}</div>}
        </div>

        {/* Información financiera */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4 text-sm">
          <div>
            <div className="text-slate-500 text-xs mb-1">Total</div>
            <div className="font-medium text-lg">${venta.monto_total.toLocaleString('es-CO')}</div>
          </div>
          <div>
            <div className="text-slate-500 text-xs mb-1">Pagado</div>
            <div className="font-medium text-lg text-green-600">${venta.total_pagado.toLocaleString('es-CO')}</div>
          </div>
          <div>
            <div className="text-slate-500 text-xs mb-1">Saldo pendiente</div>
            <div className="font-medium text-lg text-orange-600">${venta.saldo_pendiente.toLocaleString('es-CO')}</div>
          </div>
          <div>
            <div className="text-slate-500 text-xs mb-1">Estado</div>
            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold">
              {venta.estado_venta}
            </span>
          </div>
        </div>

        {/* Información adicional */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 pt-4 border-t border-slate-200 text-sm">
          {venta.created_at && (
            <div>
              <div className="text-slate-500 text-xs mb-1">Fecha de creación</div>
              <div className="font-medium text-slate-700">
                {new Date(venta.created_at).toLocaleDateString()}
              </div>
              <div className="text-xs text-slate-500">
                {new Date(venta.created_at).toLocaleTimeString()}
              </div>
            </div>
          )}
          <div>
            <div className="text-slate-500 text-xs mb-1">Boletas</div>
            <div className="font-medium text-slate-700">
              {venta.boletas?.length || 0} boleta{(venta.boletas?.length || 0) !== 1 ? 's' : ''}
            </div>
          </div>
          <div>
            <div className="text-slate-500 text-xs mb-1">Transacciones de abono</div>
            <div className="font-medium text-slate-700">
              {cantidadTransaccionesAbono} {cantidadTransaccionesAbono === 1 ? 'transacción' : 'transacciones'}
            </div>
          </div>
          {venta.abonos.length > 0 && (() => {
            const ultimoAbono = venta.abonos[venta.abonos.length - 1]
            return (
              <div>
                <div className="text-slate-500 text-xs mb-1">Último abono</div>
                <div className="font-medium text-slate-700">
                  {new Date(ultimoAbono.created_at).toLocaleDateString()}
                </div>
                <div className="text-xs text-slate-500">
                  {new Date(ultimoAbono.created_at).toLocaleTimeString()}
                </div>
              </div>
            )
          })()}
          {venta.monto_total > 0 && (
            <div>
              <div className="text-slate-500 text-xs mb-1">Porcentaje pagado</div>
              <div className="font-medium text-slate-700">
                {Math.round((venta.total_pagado / venta.monto_total) * 100)}%
              </div>
              <div className="text-xs text-slate-500">
                {venta.total_pagado > 0 ? 'Pagado' : 'Sin pagos'}
              </div>
            </div>
          )}
          <div>
            <div className="text-slate-500 text-xs mb-1">ID Venta</div>
            <div className="font-mono text-xs text-slate-600">
              {venta.id.slice(0, 8)}...
            </div>
          </div>
        </div>
      </div>


      {/* Acciones: Seleccionar boletas o Cancelar */}
      {!mostrarFormularioAbono && !mostrarFormularioCancelar && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">¿Qué deseas hacer?</h3>
          <p className="text-sm text-slate-500 mb-4">Selecciona las boletas arriba con checkbox y asigna el monto a abonar a cada una, o usa las opciones:</p>
          <div className="flex flex-wrap gap-4">
            {/* Botón seleccionar todas */}
            {venta.boletas && venta.boletas.filter(b => (b.saldo_pendiente_boleta ?? 0) > 0).length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const pendientes = venta.boletas?.filter(b => (b.saldo_pendiente_boleta ?? 0) > 0) || []
                  const todosSeleccionados = pendientes.every(b => b.id in boletasSeleccionadas)
                  if (todosSeleccionados) {
                    setBoletasSeleccionadas({})
                  } else {
                    const nuevas: BoletasSeleccionadas = {}
                    for (const b of pendientes) {
                      nuevas[b.id] = 0
                    }
                    setBoletasSeleccionadas(nuevas)
                  }
                  setAccion('abonar')
                  setError(null)
                }}
                className="px-6 py-3 border-2 border-blue-200 text-blue-700 rounded-xl hover:bg-blue-50 font-medium transition-colors"
              >
                {venta.boletas?.filter(b => (b.saldo_pendiente_boleta ?? 0) > 0).every(b => b.id in boletasSeleccionadas)
                  ? '☑️ Deseleccionar todas'
                  : '☐ Seleccionar todas las boletas'}
              </button>
            )}
            {/* Pagar todo de todas */}
            {venta.boletas && venta.boletas.filter(b => (b.saldo_pendiente_boleta ?? 0) > 0).length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const nuevas: BoletasSeleccionadas = {}
                  for (const b of (venta.boletas || []).filter(x => (x.saldo_pendiente_boleta ?? 0) > 0)) {
                    nuevas[b.id] = b.saldo_pendiente_boleta!
                  }
                  setBoletasSeleccionadas(nuevas)
                  setAccion('abonar')
                  setError(null)
                }}
                className="px-6 py-3 border-2 border-green-200 text-green-700 rounded-xl hover:bg-green-50 font-medium transition-colors"
              >
                ✅ Pagar total de todas
              </button>
            )}
            <button
              type="button"
              onClick={() => setAccion('cancelar')}
              className="px-6 py-3 border-2 border-red-200 text-red-700 rounded-xl hover:bg-red-50 font-medium transition-colors"
            >
              Cancelar venta
            </button>
          </div>
        </div>
      )}

      {/* Formulario: Registrar abono */}
      {mostrarFormularioAbono && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          {Object.keys(boletasSeleccionadas).length > 0 ? (
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-900">
                Abonar a {Object.keys(boletasSeleccionadas).length} boleta{Object.keys(boletasSeleccionadas).length > 1 ? 's' : ''}
              </h3>
              {/* Resumen de boletas seleccionadas */}
              <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 space-y-1.5">
                {Object.entries(boletasSeleccionadas).map(([bId, bMonto]) => {
                  const b = venta.boletas?.find(x => x.id === bId)
                  if (!b) return null
                  return (
                    <div key={bId} className="flex items-center justify-between text-sm">
                      <span className="text-blue-800 font-medium">
                        🎫 #{b.numero.toString().padStart(4, '0')}
                        <span className="text-blue-600 ml-1 text-xs">(saldo: ${(b.saldo_pendiente_boleta || 0).toLocaleString('es-CO')})</span>
                      </span>
                      <span className="font-semibold text-blue-900">
                        {bMonto > 0 ? `$${bMonto.toLocaleString('es-CO')}` : 'Sin monto'}
                      </span>
                    </div>
                  )
                })}
                <div className="border-t border-blue-300 pt-1.5 flex justify-between text-sm font-bold text-blue-900">
                  <span>Total a abonar:</span>
                  <span>${Object.values(boletasSeleccionadas).reduce((s, m) => s + (m || 0), 0).toLocaleString('es-CO')}</span>
                </div>
              </div>
            </div>
          ) : (
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Registrar abono general</h3>
          )}
          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-2 rounded mb-4 text-sm">{error}</div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-black mb-1">Medio de pago</label>
              <select
                value={metodoPago}
                onChange={(e) => setMetodoPago(e.target.value)}
                className="w-full px-4 py-2 border border-slate-400 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 bg-white text-black"
              >
                <option value="">Selecciona método de pago</option>
                {MEDIOS_PAGO.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Si NO hay boletas seleccionadas, mostrar input de monto general */}
            {Object.keys(boletasSeleccionadas).length === 0 && (
              <div className="space-y-2">
                <label className="block text-sm font-bold text-black mb-1">
                  Valor a abonar (máx. ${venta.saldo_pendiente.toLocaleString('es-CO')})
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatearInputPesos(monto)}
                    onChange={(e) => {
                      const val = parsearInputPesos(e.target.value)
                      setMonto(Math.min(val, venta.saldo_pendiente))
                    }}
                    placeholder="$ 0"
                    disabled={pagarTodo}
                    className="w-full px-4 py-2 border border-slate-400 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 disabled:bg-slate-100 disabled:text-slate-500 bg-white text-black"
                  />
                </div>
                <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={pagarTodo}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setPagarTodo(checked)
                      if (checked) {
                        setMonto(venta.saldo_pendiente)
                      } else {
                        setMonto(0)
                      }
                    }}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Pagar saldo total de la venta</span>
                </label>
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-black mb-1">Notas (opcional)</label>
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Notas"
                rows={2}
                className="w-full px-4 py-2 border border-slate-400 rounded-lg resize-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 bg-white text-black placeholder:text-slate-500"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setAccion(null); setError(null); setMonto(0); setNotas(''); setBoletasSeleccionadas({}); setPagarTodo(false) }}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => setMostrarConfirmacionAbono(true)}
                disabled={procesando || !metodoPago || (Object.keys(boletasSeleccionadas).length === 0 && monto <= 0) || (Object.keys(boletasSeleccionadas).length > 0 && Object.values(boletasSeleccionadas).reduce((s, m) => s + (m || 0), 0) <= 0)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                {procesando
                  ? 'Registrando...'
                  : !metodoPago
                    ? 'Selecciona método de pago'
                    : Object.keys(boletasSeleccionadas).length > 0
                      ? `Registrar abono a ${Object.keys(boletasSeleccionadas).length} boleta${Object.keys(boletasSeleccionadas).length > 1 ? 's' : ''} ($${Object.values(boletasSeleccionadas).reduce((s, m) => s + (m || 0), 0).toLocaleString('es-CO')})`
                      : 'Registrar abono'}
              </button>
            </div>

            {/* Modal de confirmación de abono */}
            {mostrarConfirmacionAbono && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
                  <div className="text-center mb-4 p-3 rounded-lg bg-blue-50">
                    <h3 className="text-lg font-bold text-blue-800">
                      {(() => {
                        const boletasIds = Object.keys(boletasSeleccionadas)
                        const totalAbono = boletasIds.length > 0 
                          ? Object.values(boletasSeleccionadas).reduce((s, m) => s + (m || 0), 0)
                          : Number(monto)
                        const nuevoSaldo = (venta?.saldo_pendiente || 0) - totalAbono
                        return nuevoSaldo <= 0 ? '✅ Confirmar Pago Total' : '💰 Confirmar Abono'
                      })()}
                    </h3>
                  </div>
                  
                  <div className="space-y-3 text-sm">
                    {venta?.vendedor_nombre ? (
                      <div className="bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 flex items-center gap-2">
                        <span className="text-lg">⚠️</span>
                        <div>
                          <span className="text-xs text-amber-700 font-semibold uppercase tracking-wide block">Venta de:</span>
                          <span className="font-bold text-amber-900">{venta.vendedor_nombre}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-blue-50 border border-blue-300 rounded-lg px-3 py-2 flex items-center gap-2">
                        <span className="text-lg">🌐</span>
                        <div>
                          <span className="text-xs text-blue-700 font-semibold uppercase tracking-wide block">Canal:</span>
                          <span className="font-bold text-blue-900">Venta Online</span>
                        </div>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-600">Cliente:</span>
                      <span className="font-medium text-slate-900">{venta?.nombre}</span>
                    </div>
                    {Object.keys(boletasSeleccionadas).length > 0 && (
                      <div>
                        <span className="text-slate-600">Boletas a abonar:</span>
                        <div className="mt-1 space-y-1">
                          {Object.entries(boletasSeleccionadas).filter(([, m]) => m > 0).map(([bId, m]) => {
                            const b = venta?.boletas?.find(x => x.id === bId)
                            return b ? (
                              <div key={bId} className="flex justify-between text-xs bg-slate-50 p-1.5 rounded">
                                <span>#{b.numero.toString().padStart(4, '0')}</span>
                                <span className="font-medium">${m.toLocaleString('es-CO')}</span>
                              </div>
                            ) : null
                          })}
                        </div>
                      </div>
                    )}
                    <div className="border-t pt-2">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Monto a registrar:</span>
                        <span className="font-bold text-green-700">
                          ${(Object.keys(boletasSeleccionadas).length > 0 
                            ? Object.values(boletasSeleccionadas).reduce((s, m) => s + (m || 0), 0) 
                            : Number(monto)).toLocaleString('es-CO')}
                        </span>
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-slate-600">Saldo total venta:</span>
                        <span className="font-medium text-slate-900">${(venta?.saldo_pendiente || 0).toLocaleString('es-CO')}</span>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Método de pago:</span>
                      <span className="font-medium text-slate-900">{MEDIOS_PAGO.find(m => m.id === metodoPago)?.label || metodoPago}</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => setMostrarConfirmacionAbono(false)}
                      className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => { setMostrarConfirmacionAbono(false); registrarAbono() }}
                      disabled={procesando}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
                    >
                      {procesando ? 'Procesando...' : '✅ Confirmar'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Formulario: Cancelar totalidad */}
      {mostrarFormularioCancelar && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Cancelar venta</h3>
          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-2 rounded mb-4 text-sm">{error}</div>
          )}
          {!confirmarCancelar ? (
            <div className="space-y-4">
              <p className="text-slate-600">
                Si cancelas esta venta, las boletas quedarán nuevamente disponibles para otros clientes.
                Esta acción no debería usarse si el cliente simplemente va a pagar la deuda.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setAccion(null); setError(null) }}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                >
                  No, volver
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmarCancelar(true)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                >
                  Sí, cancelar venta
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-amber-700 font-medium">
                Función de cancelación en desarrollo. Por ahora puedes registrar abonos (incluyendo el pago
                total de la deuda) usando el formulario anterior.
              </p>
              <button
                type="button"
                onClick={() => { setConfirmarCancelar(false); setAccion(null) }}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
              >
                Entendido
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
