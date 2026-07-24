'use client'

import { useState } from 'react'
import { ventasApi } from '@/lib/ventasApi'
import { ReservaResponse } from '@/types/ventas'
import { formatearInputPesos, parsearInputPesos } from '@/utils/formatPesos'

interface DialogoConvertirReservaProps {
  isOpen: boolean
  reserva: ReservaResponse
  onClose: () => void
  onReservaConvertida: () => void
}

export default function DialogoConvertirReserva({
  isOpen,
  reserva,
  onClose,
  onReservaConvertida
}: DialogoConvertirReservaProps) {
  const [tipoVenta, setTipoVenta] = useState<'COMPLETA' | 'ABONO'>('COMPLETA')
  const [montoAbono, setMontoAbono] = useState<number>(0)
  const [medioPagoId, setMedioPagoId] = useState<string>('')
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paso, setPaso] = useState<'confirmacion' | 'procesando' | 'completado' | 'error'>('confirmacion')
  const [ventaResponse, setVentaResponse] = useState<any>(null)

  if (!isOpen) return null

  const PrecioEstimado = 50000 // TODO: obtener del backend
  const totalVenta = reserva.monto_total || PrecioEstimado * reserva.cantidad_boletas
  const saldoPendiente = tipoVenta === 'ABONO' ? totalVenta - montoAbono : 0

  const procesarConversion = async () => {
    // Validaciones
    if (!medioPagoId) {
      setError('Seleccione un método de pago')
      return
    }
    if (tipoVenta === 'ABONO') {
      if (montoAbono <= 0) {
        setError('El monto de abono debe ser mayor a 0')
        return
      }
      if (montoAbono >= totalVenta) {
        setError('Para pago completo, selecciona "Venta Completa"')
        return
      }
    }

    setProcesando(true)
    setError(null)
    setPaso('procesando')

    try {
      const respuesta = await ventasApi.convertirReserva(
        reserva.reserva_id,
        {
          monto_total: totalVenta,
          total_pagado: tipoVenta === 'ABONO' ? montoAbono : totalVenta,
          medio_pago_id: medioPagoId
        }
      )

      setVentaResponse(respuesta.data)
      setPaso('completado')

      // Notificar después de 2 segundos
      setTimeout(() => {
        onReservaConvertida()
      }, 2000)
    } catch (error: any) {
      console.error('Error convirtiendo reserva:', error)
      setError(error.message || 'Error al convertir la reserva')
      setPaso('error')
    } finally {
      setProcesando(false)
    }
  }

  const handleClose = () => {
    if (!procesando) {
      setError(null)
      setPaso('confirmacion')
      setTipoVenta('COMPLETA')
      setMontoAbono(0)
      setMedioPagoId('')
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
            <h3 className="text-lg font-medium text-slate-900 mb-2">Convirtiendo Reserva</h3>
            <p className="text-slate-600">Procesando conversión a venta...</p>
          </div>
        </div>
      </div>
    )
  }

  // Estado completado
  if (paso === 'completado') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">
              ¡Reserva Convertida!
            </h3>
            <p className="text-slate-600 mb-4">
              La reserva se ha convertido a venta exitosamente
            </p>

            {ventaResponse && (
              <div className="bg-slate-50 rounded-lg p-4 mb-4 text-left">
                <h4 className="font-medium text-slate-900 mb-3">Detalles de la Venta</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">ID Venta:</span>
                    <span className="font-mono text-slate-900">{ventaResponse.venta_id?.slice(0, 8)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Boletas:</span>
                    <span className="font-medium text-slate-900">{ventaResponse.cantidad_boletas}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Total:</span>
                    <span className="font-medium text-slate-900">${ventaResponse.monto_total.toLocaleString('es-CO')}</span>
                  </div>
                  {tipoVenta === 'ABONO' && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Pagado:</span>
                        <span className="font-medium text-green-600">${ventaResponse.total_pagado.toLocaleString('es-CO')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Saldo:</span>
                        <span className="font-medium text-orange-600">${ventaResponse.saldo_pendiente.toLocaleString('es-CO')}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-600">Estado:</span>
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                      {ventaResponse.estado_venta}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleClose}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Aceptar
            </button>
          </div>
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
              Error en la Conversión
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
                onClick={procesarConversion}
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
          <h2 className="text-xl font-semibold text-slate-900">Convertir Reserva a Venta</h2>
          <p className="text-sm text-slate-600 mt-1">
            {reserva.rifa_titulo} - {reserva.cantidad_boletas} boleta{reserva.cantidad_boletas !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Resumen de la reserva */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-3">Detalles de la Reserva</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-blue-800">
                <span>ID Reserva:</span>
                <span className="font-mono">{reserva.reserva_id.slice(0, 8)}...</span>
              </div>
              <div className="flex justify-between text-blue-800">
                <span>Boletas:</span>
                <span className="font-medium">{reserva.cantidad_boletas}</span>
              </div>
              <div className="flex justify-between text-blue-800">
                <span>Bloqueo hasta:</span>
                <span className="font-medium">
                  {new Date(reserva.bloqueo_hasta).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Tipo de venta */}
          <div>
            <label className="block text-sm font-bold text-black mb-3">
              Tipo de Venta
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setTipoVenta('COMPLETA')}
                disabled={procesando}
                className={`p-4 border-2 rounded-lg transition-all ${
                  tipoVenta === 'COMPLETA'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="font-medium">Completa</div>
                <div className="text-xs text-slate-600 mt-1">
                  Pago total de ${totalVenta.toLocaleString('es-CO')}
                </div>
              </button>
              <button
                onClick={() => setTipoVenta('ABONO')}
                disabled={procesando}
                className={`p-4 border-2 rounded-lg transition-all ${
                  tipoVenta === 'ABONO'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="font-medium">Parcial</div>
                <div className="text-xs text-slate-600 mt-1">Con pago y saldo</div>
              </button>
            </div>
          </div>

          {/* Monto de abono */}
          {tipoVenta === 'ABONO' && (
            <div>
              <label className="block text-sm font-bold text-black mb-3">
                Monto a Pagar Hoy
              </label>
              <div className="space-y-3">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500">
                    $
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatearInputPesos(montoAbono)}
                    onChange={(e) => {
                      const val = parsearInputPesos(e.target.value)
                      setMontoAbono(Math.min(Math.max(0, val), totalVenta - 1))
                    }}
                    disabled={procesando}
                    className="w-full pl-8 pr-3 py-2 border border-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white text-black"
                    placeholder="0"
                  />
                </div>

                {/* Botones rápidos */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setMontoAbono(Math.floor(totalVenta * 0.3))}
                    disabled={procesando}
                    className="py-2 px-3 bg-slate-100 text-slate-700 rounded text-sm hover:bg-slate-200"
                  >
                    30%
                  </button>
                  <button
                    onClick={() => setMontoAbono(Math.floor(totalVenta * 0.5))}
                    disabled={procesando}
                    className="py-2 px-3 bg-slate-100 text-slate-700 rounded text-sm hover:bg-slate-200"
                  >
                    50%
                  </button>
                  <button
                    onClick={() => setMontoAbono(Math.floor(totalVenta * 0.7))}
                    disabled={procesando}
                    className="py-2 px-3 bg-slate-100 text-slate-700 rounded text-sm hover:bg-slate-200"
                  >
                    70%
                  </button>
                </div>

                {montoAbono > 0 && (
                  <div className="bg-slate-50 p-3 rounded-lg text-sm">
                    <div className="flex justify-between text-slate-600">
                      <span>Total:</span>
                      <span className="font-medium text-slate-900">${totalVenta.toLocaleString('es-CO')}</span>
                    </div>
                    <div className="flex justify-between text-green-600 mt-2">
                      <span>Pago hoy:</span>
                      <span className="font-medium">${montoAbono.toLocaleString('es-CO')}</span>
                    </div>
                    <div className="border-t border-slate-200 mt-2 pt-2 flex justify-between text-orange-600">
                      <span className="font-medium">Saldo pendiente:</span>
                      <span className="font-bold">${saldoPendiente.toLocaleString('es-CO')}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Medio de pago */}
          <div>
            <label className="block text-sm font-bold text-black mb-2">
              Método de Pago
            </label>
            <select
              value={medioPagoId}
              onChange={(e) => setMedioPagoId(e.target.value)}
              disabled={procesando}
              className="w-full px-4 py-2 border border-slate-400 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white text-black"
            >
              <option value="">Seleccionar método de pago</option>
              <option value="d397d917-c0d0-4c61-b2b3-2ebfab7deeb7">Efectivo</option>
              <option value="af6e15fc-c52c-4491-abe1-20243af301c4">Nequi</option>
              <option value="daviplata">Daviplata</option>
              <option value="db94562d-bb01-42a3-9414-6e369a1a70ba">PSE</option>
            </select>
          </div>

          {/* Resumen de totales */}
          <div className="border-t border-slate-200 pt-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Total de la Venta</span>
                <span className="font-medium text-slate-900">${totalVenta.toLocaleString('es-CO')}</span>
              </div>

              {tipoVenta === 'ABONO' && montoAbono > 0 && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Pago inicial</span>
                    <span className="font-medium text-green-600">${montoAbono.toLocaleString('es-CO')}</span>
                  </div>
                  <div className="flex justify-between text-sm border-t pt-2">
                    <span className="text-slate-600 font-medium">Saldo pendiente</span>
                    <span className="font-bold text-orange-600">${saldoPendiente.toLocaleString('es-CO')}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Aclaraciones */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
            <p className="font-medium mb-2">✓ Al convertir:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Las boletas cambiarán a estado PAGADA</li>
              <li>Se creará la venta en el sistema</li>
              {tipoVenta === 'ABONO' && <li>Se registrará un abono inicial</li>}
              <li>La reserva se eliminará</li>
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
            onClick={procesarConversion}
            disabled={procesando || (tipoVenta === 'ABONO' && montoAbono <= 0)}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
          >
            {procesando ? 'Procesando...' : '✓ Convertir a Venta'}
          </button>
        </div>
      </div>
    </div>
  )
}
