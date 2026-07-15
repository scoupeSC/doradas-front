'use client'

import { useEffect, useState } from 'react'
import { VentaPublicaListado } from '@/types/ventasPublicas'
import { ventasPublicasApi } from '@/lib/ventasPublicasApi'
import { normalizarTelefono } from '@/utils/telefono'
import {
  formatPacha,
  formatPachasDesdeNumerosPlanos,
  mensajePagoPendienteVenta,
  mensajeReservaRecibida,
  mensajeSaldoPendienteVenta,
} from '@/utils/whatsappMensajes'

interface ListaVentasPublicasProps {
  onSelectVenta: (ventaId: string) => void
  filtroEstado?: string
}

export default function ListaVentasPublicas({
  onSelectVenta,
  filtroEstado
}: ListaVentasPublicasProps) {
  const [ventas, setVentas] = useState<VentaPublicaListado[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filtroRifa, setFiltroRifa] = useState('')
  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroCedula, setFiltroCedula] = useState('')
  const [filtroEstadoLocal, setFiltroEstadoLocal] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [marcandoRevisada, setMarcandoRevisada] = useState<string | null>(null)

  const cargarVentas = async () => {
    try {
      setLoading(true)
      setError(null)

      let response

      if (filtroEstado === 'pendientes') {
        response = await ventasPublicasApi.getVentasPublicasPendientes(
          filtroCliente || undefined,
          filtroCedula || undefined
        )
      } else {
        response = await ventasPublicasApi.getVentasPublicas(
          filtroEstadoLocal || filtroEstado || undefined,
          filtroRifa || undefined,
          filtroCliente || undefined,
          filtroCedula || undefined
        )
      }

      if (!response.success) {
        throw new Error(response.message || 'Error cargando ventas')
      }

      setVentas(response.data || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(cargarVentas, 300)
    return () => clearTimeout(timer)
  }, [filtroEstado, filtroEstadoLocal, filtroRifa, filtroCliente, filtroCedula])

  // Auto-refresh cada 30 segundos cuando está en modo pendientes
  useEffect(() => {
    if (!autoRefresh || filtroEstado !== 'pendientes') return
    const interval = setInterval(cargarVentas, 30000)
    return () => clearInterval(interval)
  }, [autoRefresh, filtroEstado])

  const getEstadoBadgeColor = (estado: string) => {
    switch (estado) {
      case 'PAGADA':
        return 'bg-green-100 text-green-800 border-green-300'
      case 'ABONADA':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'PENDIENTE':
        return 'bg-blue-100 text-blue-800 border-blue-300'
      case 'SIN_REVISAR':
        return 'bg-purple-100 text-purple-800 border-purple-300'
      case 'CANCELADA':
        return 'bg-red-100 text-red-800 border-red-300'
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300'
    }
  }

  const getEstadoLabel = (estado: string) => {
    switch (estado) {
      case 'SIN_REVISAR':
        return '🆕 SIN REVISAR'
      case 'PENDIENTE':
        return 'PENDIENTE'
      case 'ABONADA':
        return 'ABONADA'
      case 'PAGADA':
        return 'PAGADA'
      case 'CANCELADA':
        return 'CANCELADA'
      default:
        return estado
    }
  }

  const formatoMoneda = (valor: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(valor)
  }

  /**
   * Genera el link de WhatsApp según el estado de la venta
   */
  const generarWhatsAppLink = (venta: VentaPublicaListado) => {
    const telefonoCompleto = normalizarTelefono(venta.cliente_telefono)

    // Siempre pacha (ambos números) por boleta
    const boletasList = (venta as any).boletas
    const pachas =
      Array.isArray(boletasList) && boletasList.length > 0
        ? boletasList.map((b: any) => formatPacha(b.numeros, b.numero)).join(', ')
        : venta.numeros_boletas && venta.numeros_boletas.length > 0
          ? formatPachasDesdeNumerosPlanos(venta.numeros_boletas.map(Number), venta.cantidad_boletas)
          : `${venta.cantidad_boletas} pacha(s)`

    let mensaje = ''

    if (venta.estado_venta === 'SIN_REVISAR') {
      mensaje = mensajeReservaRecibida({
        nombre: venta.cliente_nombre,
        rifaNombre: venta.rifa_nombre,
        pachas,
        montoTotal: venta.monto_total,
      })
    } else if (venta.estado_venta === 'ABONADA') {
      const saldo = venta.monto_total - venta.abono_total
      mensaje = mensajeSaldoPendienteVenta({
        nombre: venta.cliente_nombre,
        rifaNombre: venta.rifa_nombre,
        pachas,
        saldo,
        montoTotal: venta.monto_total,
        abonado: venta.abono_total,
      })
    } else if (venta.estado_venta === 'PENDIENTE') {
      mensaje = mensajePagoPendienteVenta({
        nombre: venta.cliente_nombre,
        rifaNombre: venta.rifa_nombre,
        pachas,
        saldo: venta.monto_total,
      })
    }

    return `https://wa.me/${telefonoCompleto}?text=${encodeURIComponent(mensaje)}`
  }

  /**
   * Maneja el clic en WhatsApp para SIN_REVISAR → marca como revisada y abre WhatsApp
   */
  const handleWhatsAppClick = async (e: React.MouseEvent, venta: VentaPublicaListado) => {
    e.stopPropagation() // Evitar que se abra el detalle de la venta
    
    const whatsappUrl = generarWhatsAppLink(venta)
    
    // Si es SIN_REVISAR, marcar como revisada
    if (venta.estado_venta === 'SIN_REVISAR') {
      try {
        setMarcandoRevisada(venta.id)
        await ventasPublicasApi.marcarVentaRevisada(venta.id)
        // Abrir WhatsApp
        window.open(whatsappUrl, '_blank')
        // Recargar lista
        setTimeout(cargarVentas, 1000)
      } catch (err: any) {
        // Abrir WhatsApp de todos modos
        window.open(whatsappUrl, '_blank')
      } finally {
        setMarcandoRevisada(null)
      }
    } else {
      // Para PENDIENTE y ABONADA, solo abrir WhatsApp
      window.open(whatsappUrl, '_blank')
    }
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">🔍 Filtros</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="text"
            placeholder="Buscar por nombre del cliente..."
            value={filtroCliente}
            onChange={(e) => setFiltroCliente(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            placeholder="Buscar por cédula / identificación..."
            value={filtroCedula}
            onChange={(e) => setFiltroCedula(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            placeholder="Filtrar por nombre de rifa..."
            value={filtroRifa}
            onChange={(e) => setFiltroRifa(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {filtroEstado !== 'pendientes' && (
            <select
              value={filtroEstadoLocal}
              onChange={(e) => setFiltroEstadoLocal(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Todos los estados</option>
              <option value="SIN_REVISAR">🆕 Sin Revisar</option>
              <option value="PENDIENTE">🔵 Pendiente</option>
              <option value="ABONADA">🟡 Abonada</option>
              <option value="PAGADA">🟢 Pagada</option>
              <option value="CANCELADA">🔴 Cancelada</option>
            </select>
          )}
        </div>
        {(filtroCliente || filtroCedula || filtroRifa || filtroEstadoLocal) && (
          <button
            onClick={() => { setFiltroCliente(''); setFiltroCedula(''); setFiltroRifa(''); setFiltroEstadoLocal('') }}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            ✕ Limpiar filtros
          </button>
        )}
      </div>

      {/* Estado de carga */}
      {loading && (
        <div className="bg-white rounded-lg border border-slate-200 p-6 text-center">
          <div className="inline-block">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
          <p className="text-slate-600 mt-3">Cargando ventas...</p>
        </div>
      )}

      {/* Mensajes de error */}
      {error && !loading && (
        <div className="bg-red-50 rounded-lg border border-red-200 p-4">
          <p className="text-red-700 font-medium">Error</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Lista vacía */}
      {!loading && !error && ventas.length === 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
          <svg
            className="w-12 h-12 text-slate-400 mx-auto mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
          <p className="text-slate-600">No hay ventas que mostrar</p>
        </div>
      )}

      {/* Lista de ventas */}
      {!loading && !error && ventas.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-slate-900">
              Ventas encontradas: {ventas.length}
            </h3>
            <div className="flex items-center gap-2">
              {filtroEstado === 'pendientes' && (
                <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={autoRefresh} 
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Auto-refresh 30s
                </label>
              )}
              <button 
                onClick={cargarVentas} 
                disabled={loading}
                className="px-3 py-1 text-xs bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                🔄 Refrescar
              </button>
            </div>
          </div>

          {ventas.map((venta) => (
            <div
              key={venta.id}
              className={`bg-white rounded-lg border hover:shadow-md transition-all cursor-pointer p-4 ${
                venta.estado_venta === 'SIN_REVISAR'
                  ? 'border-purple-300 bg-purple-50/30 ring-1 ring-purple-200'
                  : 'border-slate-200 hover:border-blue-400'
              }`}
            >
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
                {/* ID y Fecha */}
                <div onClick={() => onSelectVenta(venta.id)}>
                  <p className="text-xs text-slate-500 font-medium mb-1">
                    ID VENTA
                  </p>
                  <p className="text-sm font-mono text-slate-900">
                    {venta.id.substring(0, 8)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {new Date(venta.created_at).toLocaleDateString('es-CO')}
                  </p>
                </div>

                {/* Cliente */}
                <div onClick={() => onSelectVenta(venta.id)}>
                  <p className="text-xs text-slate-500 font-medium mb-1">
                    CLIENTE
                  </p>
                  <p className="text-sm font-medium text-slate-900">
                    {venta.cliente_nombre}
                  </p>
                  <p className="text-xs text-slate-600">{venta.cliente_telefono}</p>
                </div>

                {/* Rifa */}
                <div onClick={() => onSelectVenta(venta.id)}>
                  <p className="text-xs text-slate-500 font-medium mb-1">RIFA</p>
                  <p className="text-sm text-slate-900">{venta.rifa_nombre}</p>
                  <p className="text-xs text-slate-600">
                    {venta.cantidad_boletas} boleta
                    {venta.cantidad_boletas !== 1 ? 's' : ''}
                  </p>
                </div>

                {/* Montos */}
                <div onClick={() => onSelectVenta(venta.id)}>
                  <p className="text-xs text-slate-500 font-medium mb-1">
                    TOTAL / PAGADO
                  </p>
                  <p className="text-sm font-semibold text-slate-900">
                    {formatoMoneda(venta.monto_total)}
                  </p>
                  <p
                    className={`text-xs mt-1 ${
                      venta.abono_total > 0
                        ? 'text-green-600'
                        : 'text-slate-500'
                    }`}
                  >
                    {formatoMoneda(venta.abono_total)}
                  </p>
                </div>

                {/* Estado */}
                <div className="flex items-center" onClick={() => onSelectVenta(venta.id)}>
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getEstadoBadgeColor(venta.estado_venta)}`}
                  >
                    {getEstadoLabel(venta.estado_venta)}
                  </span>
                </div>

                {/* Botón WhatsApp */}
                <div className="flex items-center justify-end gap-2">
                  {(venta.estado_venta === 'SIN_REVISAR' || venta.estado_venta === 'PENDIENTE' || venta.estado_venta === 'ABONADA') && venta.cliente_telefono && (
                    <button
                      onClick={(e) => handleWhatsAppClick(e, venta)}
                      disabled={marcandoRevisada === venta.id}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all shadow-sm ${
                        venta.estado_venta === 'SIN_REVISAR'
                          ? 'bg-green-500 text-white hover:bg-green-600 animate-pulse'
                          : 'bg-green-50 text-green-700 border border-green-300 hover:bg-green-100'
                      } disabled:opacity-50`}
                      title={
                        venta.estado_venta === 'SIN_REVISAR'
                          ? 'Enviar mensaje y marcar como revisada'
                          : 'Enviar recordatorio por WhatsApp'
                      }
                    >
                      {marcandoRevisada === venta.id ? (
                        <span className="inline-block animate-spin">⏳</span>
                      ) : (
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                      )}
                      <span className="hidden sm:inline">
                        {venta.estado_venta === 'SIN_REVISAR' ? 'Contactar' : 'Recordar'}
                      </span>
                    </button>
                  )}
                  <svg
                    className="w-5 h-5 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    onClick={() => onSelectVenta(venta.id)}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
