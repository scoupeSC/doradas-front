'use client'

import { useState, useCallback } from 'react'
import html2canvas from 'html2canvas-pro'
import { ventasApi } from '@/lib/ventasApi'
import { BoletaEnCarrito, Cliente } from '@/types/ventas'
import { normalizarTelefono } from '@/utils/telefono'
import { getMediosDePagoBloque } from '@/config/paymentInfo'
import BoletaTicket from '@/components/BoletaTicket'
import ResponsiveBoletaWrapper from '@/components/ResponsiveBoletaWrapper'

interface DialogoReservaProps {
  isOpen: boolean
  boletas: BoletaEnCarrito[]
  cliente: Cliente
  precioBoleta: number
  rifaId: string
  rifaNombre?: string
  fechaSorteo?: string | null
  onClose: () => void
  onReservaCompletada: () => void
}

function formatDateForInput(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function DialogoReserva({
  isOpen,
  boletas,
  cliente,
  precioBoleta,
  rifaId,
  rifaNombre,
  fechaSorteo,
  onClose,
  onReservaCompletada
}: DialogoReservaProps) {
  // Calcular fecha máxima (fecha del sorteo o 30 días por defecto)
  const fechaMaxima = fechaSorteo
    ? new Date(fechaSorteo)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  // Fecha mínima: mañana
  const manana = new Date()
  manana.setDate(manana.getDate() + 1)
  manana.setHours(0, 0, 0, 0)

  // Valor inicial: fecha del sorteo si existe, sino 5 días
  const fechaInicialDefault = fechaSorteo
    ? formatDateForInput(fechaMaxima)
    : formatDateForInput(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000))

  const [fechaBloqueo, setFechaBloqueo] = useState<string>(fechaInicialDefault)
  const [notas, setNotas] = useState<string>('')
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paso, setPaso] = useState<'confirmacion' | 'procesando' | 'completado' | 'error'>('confirmacion')
  const [reservaResponse, setReservaResponse] = useState<any>(null)

  const subtotal = boletas.length * precioBoleta

  // Hooks de descarga (deben estar antes de cualquier return condicional)
  const descargarBoletaReserva = useCallback(async (boletaNumero: number, identificacion: string, elementId: string) => {
    const wrapper = document.getElementById(elementId)
    const el = wrapper?.querySelector('.boleta-ticket') as HTMLElement ?? wrapper
    if (!el) return
    try {
      const canvas = await html2canvas(el, {
        scale: 4.03,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
      })
      const link = document.createElement('a')
      const cc = (identificacion || 'SIN_CC').replace(/\s+/g, '_')
      link.download = `boleta_${boletaNumero.toString().padStart(4, '0')}_CC_${cc}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (err) {
      console.error('Error descargando boleta:', err)
    }
  }, [])

  const descargarTodasReserva = useCallback(async () => {
    const boletasRes = reservaResponse?.boletas_reservadas ?? []
    for (const b of boletasRes) {
      await descargarBoletaReserva(b.numero, cliente.identificacion || '', `reserva-boleta-${b.id}`)
      await new Promise(r => setTimeout(r, 500))
    }
  }, [reservaResponse, cliente.identificacion, descargarBoletaReserva])

  // Generar link de WhatsApp para notificar al cliente de la reserva
  const generarLinkWhatsAppReserva = useCallback(() => {
    if (!cliente.telefono || !reservaResponse) return null

    const boletasRes = reservaResponse?.boletas_reservadas ?? []
    const numerosStr = boletasRes.map((b: any) => `#${b.numero.toString().padStart(4, '0')}`).join(', ')
    const fechaLimite = new Date(reservaResponse.bloqueo_hasta).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
    const linkBoletas = 'https://elgrancamion.com/boletas'

    const mediosDePago = getMediosDePagoBloque()

    let mensaje = `Hola ${cliente.nombre} 👋\n\n`
    mensaje += `Se registró una *RESERVA* en *${rifaNombre || 'la rifa'}*.\n\n`
    mensaje += `🎫 *Boleta${boletasRes.length > 1 ? 's' : ''}:* ${numerosStr}\n`
    mensaje += `📋 *Estado:* RESERVADA\n`
    mensaje += `💰 *Valor total:* $${subtotal.toLocaleString('es-CO')}\n`
    mensaje += `📅 *Reserva válida hasta:* ${fechaLimite}\n\n`
    mensaje += `⚠️ Recuerda realizar el pago antes de la fecha límite. Boleta sin pagar no juega.`
    mensaje += `\n\n🏆 *PARA PARTICIPAR EN LOS PREMIOS:*\n✅ *Anticipados:* mínimo $90.000 abonados todos los sábados por $2.000.000 acumulables\n🎁 *Premio mayor (20 de junio):* boleta pagada al 100%`
    mensaje += mediosDePago

    if (linkBoletas) {
      mensaje += `\n\n📲 *Revisa tus boletas aquí:*\n${linkBoletas}\n`
    }

    mensaje += `\n¡Buena suerte! 🍀`

    const tel = normalizarTelefono(cliente.telefono)

    return `https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`
  }, [cliente, reservaResponse, rifaNombre, subtotal])

  if (!isOpen) return null

  const fechaExpiracion = new Date(fechaBloqueo + 'T23:59:59')
  const ahora = new Date()
  const diffMs = fechaExpiracion.getTime() - ahora.getTime()
  const diasBloqueo = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))

  const procesarReserva = async () => {
    if (!cliente.nombre || !cliente.telefono) {
      setError('Complete la información del cliente')
      return
    }

    if (boletas.length === 0) {
      setError('Seleccione al menos una boleta')
      return
    }

    if (diasBloqueo < 1) {
      setError('La fecha de bloqueo debe ser al menos mañana')
      return
    }

    if (fechaSorteo && new Date(fechaBloqueo) > new Date(fechaSorteo)) {
      setError('La fecha no puede ser posterior al día del sorteo')
      return
    }

    setProcesando(true)
    setError(null)
    setPaso('procesando')

    try {
      const reservaPayload = {
        rifa_id: rifaId,
        cliente: {
          nombre: cliente.nombre,
          telefono: cliente.telefono,
          email: cliente.email || undefined,
          identificacion: cliente.identificacion || undefined,
          direccion: cliente.direccion || undefined
        },
        boletas: boletas.map(b => b.id),
        dias_bloqueo: diasBloqueo,
        notas: notas || undefined
      }
      console.log('[DialogoReserva] Payload enviado:', JSON.stringify(reservaPayload, null, 2))
      const respuesta = await ventasApi.crearReserva(reservaPayload)

      setReservaResponse(respuesta.data)
      setPaso('completado')

      // Notificar después de 2 segundos
      // setTimeout(() => {
      //   onReservaCompletada()
      // }, 2000)
    } catch (error: any) {
      console.error('Error procesando reserva:', error)
      setError(error.message || 'Error procesando la reserva')
      setPaso('error')
    } finally {
      setProcesando(false)
    }
  }

  const handleClose = () => {
  if (!procesando) {
    if (paso === 'completado') {
      onReservaCompletada()
    }

    setError(null)
    setPaso('confirmacion')
    setFechaBloqueo(fechaInicialDefault)
    setNotas('')
    onClose()
  }
}

  // Estado procesando
  if (paso === 'procesando') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-4">
              <svg className="w-6 h-6 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">Creando Reserva</h3>
            <p className="text-slate-600">Procesando tu reserva...</p>
          </div>
        </div>
      </div>
    )
  }

  // Estado completado
  if (paso === 'completado') {
    const boletasRes = reservaResponse?.boletas_reservadas ?? []

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
          <div className="text-center py-4">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">
              ¡Reserva Creada!
            </h3>
            <p className="text-slate-600 mb-4">
              La reserva se ha creado exitosamente
            </p>

            {reservaResponse && (
              <div className="bg-slate-50 rounded-lg p-4 mb-4 text-left">
                <h4 className="font-medium text-slate-900 mb-3">Detalles de la Reserva</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Boletas:</span>
                    <span className="font-medium text-slate-900">{reservaResponse.cantidad_boletas}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Bloqueo Hasta:</span>
                    <span className="font-medium text-slate-900">
                      {new Date(reservaResponse.bloqueo_hasta).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Cliente:</span>
                    <span className="font-medium text-slate-900">{cliente.nombre}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Boletas para descargar/imprimir */}
          {boletasRes.length > 0 && (
            <div className="border-t border-slate-200 pt-4 mt-2">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-slate-900">🎫 Boletas Reservadas</h4>
                <button
                  onClick={descargarTodasReserva}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs font-medium"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Descargar Todas
                </button>
              </div>
              <div className="space-y-4">
                {boletasRes.map((b: any) => (
                  <div key={b.id} className="border border-slate-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-slate-900 text-sm">Boleta #{b.numero.toString().padStart(4, '0')}</span>
                      <button
                        onClick={() => descargarBoletaReserva(b.numero, cliente.identificacion || '', `reserva-boleta-${b.id}`)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-medium"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Descargar
                      </button>
                    </div>
                    <ResponsiveBoletaWrapper id={`reserva-boleta-${b.id}`}>
                        <BoletaTicket
                          qrUrl={b.qr_url || `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=boleta-${b.id}`}
                          barcode=""
                          numero={b.numero}
                          imagenUrl={b.imagen_url}
                          rifaNombre={rifaNombre || ''}
                          estado="RESERVADA"
                          clienteInfo={{
                            nombre: cliente.nombre,
                            identificacion: cliente.identificacion
                          }}
                          reservadaHasta={reservaResponse.bloqueo_hasta}
                          precio={precioBoleta}
                        />
                    </ResponsiveBoletaWrapper>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Botón de WhatsApp */}
          {generarLinkWhatsAppReserva() && (
            <div className="flex justify-center mt-4">
              <a
                href={generarLinkWhatsAppReserva()!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Enviar por WhatsApp
              </a>
            </div>
          )}

          <button
            onClick={handleClose}
            className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Aceptar
          </button>
        </div>
      </div>
    )
  }

  // Estado error
  if (paso === 'error') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">
              Error al Crear Reserva
            </h3>
            <p className="text-red-600 mb-4">{error}</p>

            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={procesarReserva}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Reintentar
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Estado confirmación
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 p-6">
          <h2 className="text-xl font-semibold text-slate-900">Confirmar Reserva</h2>
          <p className="text-sm text-slate-600 mt-1">
            Bloquea boletas por un período de tiempo
          </p>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Resumen de boletas */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-3">Boletas a Reservar</h3>
            <div className="space-y-2">
              {boletas.slice(0, 3).map((boleta) => (
                <div key={boleta.id} className="flex justify-between text-sm">
                  <span className="text-blue-800">#{boleta.numero.toString().padStart(4, '0')}</span>
                  <span className="text-blue-600 font-medium">${precioBoleta.toLocaleString('es-CO')}</span>
                </div>
              ))}
              {boletas.length > 3 && (
                <div className="text-sm text-blue-600 italic">
                  +{boletas.length - 3} boletas más...
                </div>
              )}
            </div>
            <div className="border-t border-blue-200 mt-3 pt-3">
              <div className="flex justify-between font-medium">
                <span className="text-blue-900">Total ({boletas.length} boletas)</span>
                <span className="text-blue-900">${subtotal.toLocaleString('es-CO')}</span>
              </div>
            </div>
          </div>

          {/* Configuración de bloqueo con calendario */}
          <div>
            <label className="block text-sm font-bold text-black mb-3">
              📅 Fecha Límite de Reserva
            </label>
            <div className="space-y-3">
              <input
                type="date"
                value={fechaBloqueo}
                min={formatDateForInput(manana)}
                max={formatDateForInput(fechaMaxima)}
                onChange={(e) => setFechaBloqueo(e.target.value)}
                disabled={procesando}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white text-black text-base cursor-pointer"
              />

              {/* Info de fecha seleccionada */}
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-xs text-blue-600 font-medium">Reserva válida hasta:</p>
                    <p className="text-sm font-semibold text-blue-900">
                      {fechaExpiracion.toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-blue-600">{diasBloqueo}</p>
                    <p className="text-xs text-blue-600">días</p>
                  </div>
                </div>
              </div>

              {/* Indicador de fecha del sorteo */}
              {fechaSorteo && (
                <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <span>🎰</span>
                  <span>
                    Fecha del sorteo: {new Date(fechaSorteo).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Cliente */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <h3 className="font-medium text-slate-900 mb-2">Cliente</h3>
            <div className="text-sm text-slate-700 space-y-1">
              <div className="font-medium">{cliente.nombre}</div>
              {cliente.telefono && <div>Tel: {cliente.telefono}</div>}
              {cliente.email && <div>Email: {cliente.email}</div>}
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-sm font-bold text-black mb-2">
              Notas (opcional)
            </label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              disabled={procesando}
              rows={3}
              className="w-full px-3 py-2 border border-slate-400 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent resize-none bg-white text-black placeholder:text-slate-500"
              placeholder="Detalles sobre la reserva..."
            />
          </div>

          {/* Aclaraciones */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
            <p className="font-medium mb-2">⏱️ Aclaraciones Importantes:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Las boletas estarán reservadas hasta el {fechaExpiracion.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}</li>
              <li>Pasada esa fecha, se liberarán automáticamente</li>
              <li>Puedes convertirla a venta en cualquier momento</li>
              <li>O cancelarla si cambias de opinión</li>
            </ul>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 p-6 flex gap-3">
          <button
            onClick={handleClose}
            disabled={procesando}
            className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={procesarReserva}
            disabled={procesando || boletas.length === 0 || !cliente.nombre || !cliente.telefono}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors"
          >
            {procesando ? 'Procesando...' : '📌 Crear Reserva'}
          </button>
        </div>
      </div>
    </div>
  )
}
