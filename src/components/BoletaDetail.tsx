'use client'

import { useState, useCallback } from 'react'
import BoletaTicket from './BoletaTicket'
import ResponsiveBoletaWrapper from './ResponsiveBoletaWrapper'
import { downloadBoletaImage } from '@/utils/downloadBoletaImage'
import type { BoletaDetail } from '@/types/boleta'

interface BoletaDetailProps {
  boleta: BoletaDetail
  onPrint?: () => void
}

export default function BoletaDetail({ boleta, onPrint }: BoletaDetailProps) {
  const [downloading, setDownloading] = useState(false)

  const buildFilename = useCallback(() => {
    const num = boleta.numero.toString().padStart(4, '0')
    const cedula = boleta.cliente_info?.identificacion
    return cedula ? `boleta_${num}_CC_${cedula}` : `boleta_${num}`
  }, [boleta])

  const handleDownloadImage = useCallback(async () => {
    setDownloading(true)
    try {
      await downloadBoletaImage({
        selector: '.boleta-ticket',
        fileName: `${buildFilename()}.png`,
      })
    } catch (err) {
      console.error('Error al descargar imagen:', err)
    } finally {
      setDownloading(false)
    }
  }, [buildFilename])
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CO', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP'
    }).format(amount)
  }

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'DISPONIBLE': return 'bg-green-100 text-green-800'
      case 'RESERVADA': return 'bg-yellow-100 text-yellow-800'
      case 'CON_PAGO': return 'bg-blue-100 text-blue-800'
      case 'TRANSFERIDA': return 'bg-purple-100 text-purple-800'
      case 'ANULADA': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getEstadoLabel = (estado: string) => {
    switch (estado) {
      case 'DISPONIBLE': return 'Disponible'
      case 'RESERVADA': return 'Reservada'
      case 'CON_PAGO': return 'Con Pago'
      case 'TRANSFERIDA': return 'Transferida'
      case 'ANULADA': return 'Anulada'
      default: return estado
    }
  }

  return (
    <div className="space-y-6">
      {/* Ticket Preview */}
      <div className="bg-white rounded-lg shadow-lg border border-slate-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-slate-900">Vista de Boleta</h3>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadImage}
              disabled={downloading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {downloading ? 'Descargando...' : 'Descargar'}
            </button>
            <button
              onClick={onPrint}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Imprimir
            </button>
          </div>
        </div>
        
        <ResponsiveBoletaWrapper>
          <BoletaTicket
            qrUrl={boleta.qr_url}
            barcode={boleta.barcode}
            numero={boleta.numero}
            imagenUrl={(boleta as any).imagen_url ?? (boleta as any).imagenUrl}
            rifaNombre={boleta.rifa_nombre}
            estado={boleta.estado}
            clienteInfo={boleta.cliente_info}
            deuda={boleta.boleta_financiero?.saldo_pendiente ?? boleta.venta_info?.saldo_pendiente}
            reservadaHasta={boleta.bloqueo_hasta}
            precio={boleta.boleta_financiero?.precio_boleta}
            nota={boleta.nota}
          />
        </ResponsiveBoletaWrapper>
      </div>

      {/* Detailed Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Information */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-medium text-slate-900 mb-4">Información de la Boleta</h3>
          
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">Número:</span>
              <span className="text-sm font-medium text-slate-900">#{boleta.numero.toString().padStart(4, '0')}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">Estado:</span>
              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getEstadoColor(boleta.estado)}`}>
                {getEstadoLabel(boleta.estado)}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">Rifa:</span>
              <span className="text-sm font-medium text-slate-900">{boleta.rifa_nombre}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">Código de Barras:</span>
              <span className="text-sm font-mono text-slate-900">{boleta.barcode}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">Fecha Creación:</span>
              <span className="text-sm text-slate-900">{formatDate(boleta.created_at)}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">Última Actualización:</span>
              <span className="text-sm text-slate-900">{formatDate(boleta.updated_at)}</span>
            </div>
          </div>
        </div>

        {/* Customer Information */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-medium text-slate-900 mb-4">Información de Cliente</h3>
          
          {boleta.cliente_info ? (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Nombre:</span>
                <span className="text-sm font-medium text-slate-900">{boleta.cliente_info.nombre}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Identificación:</span>
                <span className="text-sm font-medium text-slate-900">{boleta.cliente_info.identificacion}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Teléfono:</span>
                <span className="text-sm font-medium text-slate-900">{boleta.cliente_info.telefono}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Email:</span>
                <span className="text-sm font-medium text-slate-900">{boleta.cliente_info.email}</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="text-slate-400">
                <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <p className="text-sm text-slate-500">Sin cliente asignado</p>
            </div>
          )}
        </div>

        {/* Estado Financiero de esta Boleta */}
        {boleta.boleta_financiero && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-medium text-slate-900 mb-4">Estado Financiero de esta Boleta</h3>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Precio Boleta:</span>
                <span className="text-sm font-medium text-slate-900">{formatCurrency(boleta.boleta_financiero.precio_boleta)}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Total Pagado:</span>
                <span className="text-sm font-medium text-green-600">{formatCurrency(boleta.boleta_financiero.total_pagado)}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Saldo Pendiente:</span>
                <span className="text-sm font-medium text-orange-600">{formatCurrency(boleta.boleta_financiero.saldo_pendiente)}</span>
              </div>

              {boleta.boleta_financiero.precio_boleta > 0 && (
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">Porcentaje Pagado:</span>
                  <span className="text-sm font-medium text-slate-900">
                    {Math.round((boleta.boleta_financiero.total_pagado / boleta.boleta_financiero.precio_boleta) * 100)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Información de Venta (referencia) */}
        {boleta.venta_info && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-medium text-slate-900 mb-4">Información de Venta</h3>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">ID Venta:</span>
                <span className="text-sm font-medium text-slate-900">{boleta.venta_info.id}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Fecha Venta:</span>
                <span className="text-sm text-slate-900">{formatDate(boleta.venta_info.fecha_venta)}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Método Pago:</span>
                <span className="text-sm font-medium text-slate-900">{boleta.venta_info.metodo_pago}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Estado Venta:</span>
                <span className="text-sm font-medium text-slate-900">{boleta.venta_info.estado}</span>
              </div>
            </div>
          </div>
        )}

        {/* Seller Information */}
        {boleta.vendedor_info && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-medium text-slate-900 mb-4">Información de Vendedor</h3>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Nombre:</span>
                <span className="text-sm font-medium text-slate-900">{boleta.vendedor_info.nombre}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Email:</span>
                <span className="text-sm font-medium text-slate-900">{boleta.vendedor_info.email}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Historial de Abonos */}
      {boleta.abonos && boleta.abonos.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-medium text-slate-900 mb-4">
            💰 Historial de Abonos ({boleta.abonos.length})
          </h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 text-slate-600 font-medium">#</th>
                  <th className="text-left py-2 px-3 text-slate-600 font-medium">Fecha</th>
                  <th className="text-right py-2 px-3 text-slate-600 font-medium">Monto</th>
                  <th className="text-left py-2 px-3 text-slate-600 font-medium">Método</th>
                  <th className="text-left py-2 px-3 text-slate-600 font-medium">Estado</th>
                  <th className="text-left py-2 px-3 text-slate-600 font-medium">Notas</th>
                </tr>
              </thead>
              <tbody>
                {boleta.abonos.map((abono, index) => (
                  <tr key={abono.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2 px-3 text-slate-500">{index + 1}</td>
                    <td className="py-2 px-3 text-slate-900">{formatDate(abono.fecha)}</td>
                    <td className="py-2 px-3 text-right font-medium text-green-700">{formatCurrency(abono.monto)}</td>
                    <td className="py-2 px-3 text-slate-900">{abono.metodo_pago}</td>
                    <td className="py-2 px-3">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                        abono.estado === 'CONFIRMADO' ? 'bg-green-100 text-green-800' :
                        abono.estado === 'REGISTRADO' ? 'bg-orange-100 text-orange-800' :
                        'bg-slate-100 text-slate-800'
                      }`}>
                        {abono.estado}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-500 text-xs max-w-[200px] truncate">{abono.notas || '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300">
                  <td colSpan={2} className="py-2 px-3 font-semibold text-slate-900">Total abonado</td>
                  <td className="py-2 px-3 text-right font-bold text-green-700">
                    {formatCurrency(boleta.abonos.reduce((sum, a) => sum + a.monto, 0))}
                  </td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Reservation Information */}
      {boleta.reserva_token && (
        <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-6">
          <h3 className="text-lg font-medium text-yellow-900 mb-4">Información de Reserva</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-yellow-700">Token de Reserva:</span>
              <p className="font-mono text-sm text-yellow-900 mt-1">{boleta.reserva_token}</p>
            </div>
            
            {boleta.bloqueo_hasta && (
              <div>
                <span className="text-sm text-yellow-700">Bloqueado hasta:</span>
                <p className="text-sm text-yellow-900 mt-1">{formatDate(boleta.bloqueo_hasta)}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
