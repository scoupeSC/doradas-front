'use client'

import { useState } from 'react'
import { Cliente, ClienteFiltroEstado, ClienteResumenFiltros } from '@/types/cliente'
import { clienteApi } from '@/lib/clienteApi'
import { RifaConBoletas } from '@/types/cliente'
import { normalizarTelefono } from '@/utils/telefono'
import { getMediosDePagoTexto } from '@/config/paymentInfo'

interface ClienteListProps {
  clientes: Cliente[]
  rifaActual?: { id: string; nombre: string; estado: string } | null
  resumenFiltros: ClienteResumenFiltros
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  onEdit: (cliente: Cliente) => void
  onDelete: (id: string) => void
  onView: (cliente: Cliente) => void
  onSearch: (search: string) => void
  onPageChange: (page: number) => void
  onFilterEstado: (estado: ClienteFiltroEstado) => void
  filtroActivo: ClienteFiltroEstado
  loading: boolean
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

// ─── WhatsApp recordatorio desde la lista ─────────────────────────
function tieneBoletasPendientes(cliente: Cliente): boolean {
  return ((cliente.boletas_reservadas || 0) > 0 || (cliente.boletas_abonadas || 0) > 0)
}

function getEstadoEmoji(estado: string): string {
  switch (estado) {
    case 'RESERVADA': return '📌'
    case 'ABONADA': return '💳'
    case 'PAGADA': return '✅'
    default: return '🔹'
  }
}

async function generarWhatsAppRecordatorioConDetalle(cliente: Cliente): Promise<string | null> {
  const telCompleto = normalizarTelefono(cliente.telefono)
  if (!telCompleto || telCompleto.length < 7) return null

  const nombre = cliente.nombre || 'Cliente'

  try {
    const response = await clienteApi.getClienteDetalle(cliente.id)
    const { rifas, resumen } = response.data
    const rifasActuales = rifas.filter((rifa: RifaConBoletas) => rifa.rifa_estado === 'ACTIVA')

    let msg = `🔔 *Recordatorio de pago pendiente*\n\nHola *${nombre}*, le recordamos que tiene boletas pendientes por pagar:\n\n`

    // Detalle por rifa actual
    rifasActuales.forEach((rifa: RifaConBoletas) => {
      const boletasPendientes = rifa.boletas.filter(b => b.estado === 'RESERVADA' || b.estado === 'ABONADA')
      if (boletasPendientes.length === 0) return

      msg += `🎟️ *${rifa.rifa_nombre}*\n`
      boletasPendientes.forEach(b => {
        const num = `#${String(b.numero).padStart(4, '0')}`
        if (b.estado === 'RESERVADA') {
          msg += `  ${getEstadoEmoji(b.estado)} Boleta *${num}* — Reservada (pendiente: ${formatCurrency(Number(b.saldo))})
`
        } else {
          msg += `  ${getEstadoEmoji(b.estado)} Boleta *${num}* — Abonada: ${formatCurrency(Number(b.abono))} de ${formatCurrency(Number(b.precio_unitario))} (falta: ${formatCurrency(Number(b.saldo))})
`
        }
      })
      msg += `\n`
    })

    const deuda = Number(resumen.total_deuda) || 0
    if (deuda > 0) {
      msg += `💰 *Total pendiente: ${formatCurrency(deuda)}*\n`
    }

    msg += `\n${getMediosDePagoTexto()}`

    msg += `\n\n📲 *Revisa tus boletas aquí:*\nhttps://elgrancamion.com/boletas`

    msg += `\n\nPor favor, acérquese a completar su pago para asegurar su participación. ¡Gracias! 🙏`

    return `https://wa.me/${telCompleto}?text=${encodeURIComponent(msg)}`
  } catch {
    // Fallback al mensaje simple si falla la API
    const deuda = cliente.deuda_total || 0
    let msg = `🔔 *Recordatorio de pago pendiente*\n\nHola *${nombre}*, le recordamos que tiene boletas pendientes por pagar.\n\n`
    if (deuda > 0) msg += `💰 *Total pendiente: ${formatCurrency(deuda)}*\n`
    msg += `\n${getMediosDePagoTexto()}`
    msg += `\n\n📲 *Revisa tus boletas aquí:*\nhttps://elgrancamion.com/boletas`
    msg += `\n\nPor favor, acérquese a completar su pago. ¡Gracias! 🙏`
    return `https://wa.me/${telCompleto}?text=${encodeURIComponent(msg)}`
  }
}

export default function ClienteList({
  clientes,
  rifaActual,
  resumenFiltros,
  pagination,
  onEdit,
  onDelete,
  onView,
  onSearch,
  onPageChange,
  onFilterEstado,
  filtroActivo,
  loading,
}: ClienteListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [cargandoRecordatorio, setCargandoRecordatorio] = useState<string | null>(null)

  const handleEnviarRecordatorio = async (cliente: Cliente) => {
    setCargandoRecordatorio(cliente.id)
    try {
      const url = await generarWhatsAppRecordatorioConDetalle(cliente)
      if (url) window.open(url, '_blank')
    } finally {
      setCargandoRecordatorio(null)
    }
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSearch(searchTerm)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const filters: Array<{
    key: ClienteFiltroEstado
    label: string
    count: number
    color: string
    textColor: string
  }> = [
    { key: 'todos', label: 'Todos', count: resumenFiltros.todos, color: 'bg-slate-900', textColor: 'text-white' },
    { key: 'con_boletas', label: 'Con Boletas (actual)', count: resumenFiltros.con_boletas, color: 'bg-indigo-600', textColor: 'text-white' },
    { key: 'pagadas', label: 'Pagadas (actual)', count: resumenFiltros.pagadas, color: 'bg-green-600', textColor: 'text-white' },
    { key: 'reservadas', label: 'Reservadas (actual)', count: resumenFiltros.reservadas, color: 'bg-yellow-500', textColor: 'text-white' },
    { key: 'abonadas', label: 'Abonadas (actual)', count: resumenFiltros.abonadas, color: 'bg-blue-600', textColor: 'text-white' },
  ]

  return (
    <div className="space-y-6">
      {rifaActual && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3">
          <p className="text-sm font-bold text-green-900">
            Rifa actual: {rifaActual.nombre}
          </p>
          <p className="text-sm text-green-800 mt-1">
            La lista muestra solo boletas, deudas y estados de la rifa activa. Las rifas anteriores están en el detalle de cada cliente.
          </p>
        </div>
      )}

      {/* Filter Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => onFilterEstado(f.key)}
            className={`rounded-xl p-3 text-center transition-all cursor-pointer hover:scale-105 hover:shadow-md ${f.color} ${
              filtroActivo === f.key ? 'ring-2 ring-offset-2 ring-slate-900 scale-105' : ''
            }`}
          >
            <div className={`text-xl font-black ${f.textColor}`}>{f.count}</div>
            <div className={`text-xs font-semibold mt-1 ${f.textColor} opacity-80`}>{f.label}</div>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <form onSubmit={handleSearchSubmit} className="flex gap-4">
          <input
            type="text"
            placeholder="Buscar por nombre, email, teléfono o identificación..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border border-slate-400 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none text-black placeholder-slate-500 bg-white"
          />
          <button
            type="submit"
            className="bg-slate-900 text-white px-6 py-2 rounded-lg hover:bg-slate-800 transition-colors font-semibold"
          >
            🔍 Buscar
          </button>
        </form>
      </div>

      {/* Client Cards / Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-900 mx-auto mb-3"></div>
            <p className="text-slate-500 font-medium">Cargando clientes...</p>
          </div>
        ) : clientes.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">👥</div>
            <p className="text-slate-500 font-medium">No se encontraron clientes</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Cliente</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Teléfono</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Identificación</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 uppercase">Boletas (actual)</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 uppercase">Estado (actual)</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase">Deuda (actual)</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {clientes.map((cliente) => (
                    <tr key={cliente.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-gradient-to-br from-slate-700 to-slate-500 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0">
                            {cliente.nombre?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-black">{cliente.nombre}</div>
                            <div className="text-xs text-slate-500">{cliente.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-black">{cliente.telefono}</td>
                      <td className="px-4 py-3 text-sm text-black font-mono">{cliente.identificacion}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-sm font-black ${(cliente.total_boletas || 0) > 0 ? 'text-black' : 'text-slate-400'}`}>
                          {cliente.total_boletas || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          {(cliente.boletas_pagadas || 0) > 0 && (
                            <span className="bg-green-100 text-green-800 text-xs px-1.5 py-0.5 rounded font-bold">
                              {cliente.boletas_pagadas} Pag
                            </span>
                          )}
                          {(cliente.boletas_reservadas || 0) > 0 && (
                            <span className="bg-yellow-100 text-yellow-800 text-xs px-1.5 py-0.5 rounded font-bold">
                              {cliente.boletas_reservadas} Res
                            </span>
                          )}
                          {(cliente.boletas_abonadas || 0) > 0 && (
                            <span className="bg-blue-100 text-blue-800 text-xs px-1.5 py-0.5 rounded font-bold">
                              {cliente.boletas_abonadas} Abo
                            </span>
                          )}
                          {(cliente.total_boletas || 0) === 0 && (
                            <span className="text-xs text-slate-400">Sin boletas</span>
                          )}
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-right text-sm font-bold ${
                        (cliente.deuda_total || 0) > 0 ? 'text-red-700' : 'text-green-700'
                      }`}>
                        {(cliente.deuda_total || 0) > 0 ? formatCurrency(cliente.deuda_total || 0) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => onView(cliente)}
                            className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-700 transition-colors"
                            title="Ver detalle"
                          >
                            👁️ Ver
                          </button>
                          <button
                            onClick={() => onEdit(cliente)}
                            className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-500 transition-colors"
                            title="Editar"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => onDelete(cliente.id)}
                            className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-500 transition-colors"
                            title="Eliminar"
                          >
                            🗑️
                          </button>
                          {tieneBoletasPendientes(cliente) && (
                            <button
                              onClick={() => handleEnviarRecordatorio(cliente)}
                              disabled={cargandoRecordatorio === cliente.id}
                              className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-500 transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                              title="Enviar recordatorio por WhatsApp"
                            >
                              {cargandoRecordatorio === cliente.id ? (
                                <span className="animate-spin">⏳</span>
                              ) : (
                                <>
                                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                  </svg>
                                  📩
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="lg:hidden divide-y divide-slate-100">
              {clientes.map((cliente) => (
                <div key={cliente.id} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 bg-gradient-to-br from-slate-700 to-slate-500 rounded-full flex items-center justify-center text-white font-bold shrink-0">
                        {cliente.nombre?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-black truncate">{cliente.nombre}</div>
                        <div className="text-xs text-slate-500">{cliente.identificacion} · {cliente.telefono}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => onView(cliente)}
                      className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-700 transition-colors shrink-0"
                    >
                      👁️ Ver
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {(cliente.total_boletas || 0) > 0 ? (
                      <>
                        <span className="text-xs font-bold text-black bg-slate-100 px-2 py-1 rounded">
                          {cliente.total_boletas} boletas
                        </span>
                        {(cliente.boletas_pagadas || 0) > 0 && (
                          <span className="bg-green-100 text-green-800 text-xs px-1.5 py-0.5 rounded font-bold">
                            {cliente.boletas_pagadas} Pag
                          </span>
                        )}
                        {(cliente.boletas_reservadas || 0) > 0 && (
                          <span className="bg-yellow-100 text-yellow-800 text-xs px-1.5 py-0.5 rounded font-bold">
                            {cliente.boletas_reservadas} Res
                          </span>
                        )}
                        {(cliente.boletas_abonadas || 0) > 0 && (
                          <span className="bg-blue-100 text-blue-800 text-xs px-1.5 py-0.5 rounded font-bold">
                            {cliente.boletas_abonadas} Abo
                          </span>
                        )}
                        {(cliente.deuda_total || 0) > 0 && (
                          <span className="text-xs font-bold text-red-700">
                            Deuda: {formatCurrency(cliente.deuda_total || 0)}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-slate-400">Sin boletas</span>
                    )}
                  </div>
                  <div className="mt-2 flex gap-2 justify-end">
                    <button
                      onClick={() => onEdit(cliente)}
                      className="text-blue-600 text-xs font-bold hover:underline"
                    >
                      ✏️ Editar
                    </button>
                    <button
                      onClick={() => onDelete(cliente.id)}
                      className="text-red-600 text-xs font-bold hover:underline"
                    >
                      🗑️ Eliminar
                    </button>
                    {tieneBoletasPendientes(cliente) && (
                      <button
                        onClick={() => handleEnviarRecordatorio(cliente)}
                        disabled={cargandoRecordatorio === cliente.id}
                        className="text-green-600 text-xs font-bold hover:underline inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        {cargandoRecordatorio === cliente.id ? '⏳ Cargando...' : '📩 Recordar'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-sm text-slate-700 font-medium">
              Mostrando {((pagination.page - 1) * pagination.limit) + 1} a{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} de{' '}
              {pagination.total} clientes
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onPageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                ← Anterior
              </button>
              <span className="px-4 py-2 text-sm font-bold text-black">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => onPageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                Siguiente →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
