'use client'

import { useState, useEffect, useCallback } from 'react'
import { recordatoriosApi, ClienteRecordatorio, ResumenRecordatorios, Vendedor } from '@/lib/recordatoriosApi'
import { clienteApi } from '@/lib/clienteApi'
import { RifaConBoletas } from '@/types/cliente'
import { normalizarTelefono } from '@/utils/telefono'
import { getMediosDePagoTexto } from '@/config/paymentInfo'

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function getEstadoEmoji(estado: string): string {
  switch (estado) {
    case 'RESERVADA': return '📌'
    case 'ABONADA': return '💳'
    case 'PAGADA': return '✅'
    default: return '🔹'
  }
}

function formatDateTime(dateString: string | null) {
  if (!dateString) return '—'
  return new Date(dateString).toLocaleString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDateShort(dateString: string) {
  return new Date(dateString).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Genera = URL de WhatsApp con un mensaje bonito personalizado
 */
async function generarMensajeWhatsApp(
  cliente: ClienteRecordatorio,
  tipo: 'todos' | 'reservadas' | 'abonadas' = 'todos'
): Promise<string | null> {
  const telCompleto = normalizarTelefono(cliente.telefono)
  if (!telCompleto || telCompleto.length < 7) return null

  const nombre = cliente.nombre || 'Cliente'

  try {
    const response = await clienteApi.getClienteDetalle(cliente.id)
    const { rifas, resumen } = response.data

    let msg = `🔔 *¡Hola ${nombre}!* 🎉\n\n`
    msg += `Le escribimos de *Inversiones Castaño* para recordarle sobre sus boletas pendientes.\n\n`
    msg += `🎯 *¡No se quede por fuera del  anticipado este sabado 13 de Junio por 4 millones de pesos !*\n`
    msg += `Para participar en este anticipado cada boleta debe de estar cancelada por lo menos con $60.000 pesos y para el premio mayor este 20 de junio debe estar cancelada completamente.\n\n`
    

    // Detalle por rifa
    rifas.forEach((rifa: RifaConBoletas) => {
      const boletasPendientes = rifa.boletas.filter(b => b.estado === 'RESERVADA' || b.estado === 'ABONADA')
      if (boletasPendientes.length === 0) return

      msg += `🎟️ *${rifa.rifa_nombre}*\n`
      boletasPendientes.forEach(b => {
        const num = `#${String(b.numero).padStart(4, '0')}`
        if (b.estado === 'RESERVADA') {
          msg += `  ${getEstadoEmoji(b.estado)} Boleta *${num}* — Reservada (pendiente: ${formatCurrency(Number(b.saldo))})\n`
        } else {
          msg += `  ${getEstadoEmoji(b.estado)} Boleta *${num}* — Abonado: ${formatCurrency(Number(b.abono))} de ${formatCurrency(Number(b.precio_unitario))} (falta: ${formatCurrency(Number(b.saldo))})\n`
        }
      })
      msg += `\n`
    })

    const deuda = Number(resumen.total_deuda) || 0
    if (deuda > 0) {
      msg += `💰 *Total pendiente: ${formatCurrency(deuda)}*\n\n`
    }

    msg += `🏦 ${getMediosDePagoTexto()}\n\n`
    msg += `📲 *Revisa tus boletas aquí:*\nhttps://elgrancamion.com/boletas\n\n`
    msg += `¡Gracias por su confianza! 🙏✨`

    return `https://wa.me/${telCompleto}?text=${encodeURIComponent(msg)}`
  } catch {
    // Fallback si falla la API
    const deuda = cliente.deuda_total || 0
    let msg = `🔔 *¡Hola ${nombre}!* 🎉\n\n`
    msg += `Le recordamos que tiene boletas pendientes por pagar.\n\n`
    if (deuda > 0) msg += `💰 *Total pendiente: ${formatCurrency(deuda)}*\n\n`
    msg += `🏦 ${getMediosDePagoTexto()}\n\n`
    msg += `📲 *Revisa tus boletas aquí:*\nhttps://elgrancamion.com/boletas\n\n`
    msg += `¡Complete su pago para participar en los sorteos anticipados! 🙏✨`
    return `https://wa.me/${telCompleto}?text=${encodeURIComponent(msg)}`
  }
}

// Detectar vendedor logueado de forma sincrónica para evitar race conditions
function getLoggedUserVendedorInfo(): { isVendedor: boolean; vendedorId: string } {
  try {
    const userData = typeof window !== 'undefined' ? localStorage.getItem('user') : null
    if (userData) {
      const user = JSON.parse(userData)
      if (user.rol?.toUpperCase() === 'VENDEDOR' && user.id) {
        return { isVendedor: true, vendedorId: user.id }
      }
    }
  } catch { /* ignore */ }
  return { isVendedor: false, vendedorId: '' }
}

export default function RecordatoriosList() {
  const loggedUser = getLoggedUserVendedorInfo()
  const [clientes, setClientes] = useState<ClienteRecordatorio[]>([])
  const [resumen, setResumen] = useState<ResumenRecordatorios | null>(null)
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [searchTerm, setSearchTerm] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [filtroActivo, setFiltroActivo] = useState<'todos' | 'reservadas' | 'abonadas'>('todos')
  const [filtroNotificado, setFiltroNotificado] = useState<'todos' | 'si' | 'no'>('todos')
  const [filtroVendedor, setFiltroVendedor] = useState<string>(loggedUser.vendedorId)
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [loading, setLoading] = useState(true)
  const [cargandoRecordatorio, setCargandoRecordatorio] = useState<string | null>(null)
  const isVendedor = loggedUser.isVendedor

  // Cargar vendedores al montar
  useEffect(() => {
    recordatoriosApi.getVendedores()
      .then(res => setVendedores(res.data || []))
      .catch(() => setVendedores([]))
  }, [])

  const fetchClientes = useCallback(async (page: number = 1) => {
    setLoading(true)
    try {
      const [listResponse, resumenResponse] = await Promise.all([
        recordatoriosApi.getClientesParaRecordatorio(page, pagination.limit, searchQuery, filtroActivo, filtroNotificado, filtroVendedor),
        recordatoriosApi.getResumen(filtroVendedor)
      ])
      setClientes(listResponse.data)
      setPagination(listResponse.pagination)
      setResumen(resumenResponse.data)
    } catch (error) {
      console.error('Error fetching recordatorios:', error)
    } finally {
      setLoading(false)
    }
  }, [searchQuery, filtroActivo, filtroNotificado, filtroVendedor, pagination.limit])

  useEffect(() => {
    fetchClientes(1)
  }, [fetchClientes])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSearchQuery(searchTerm)
  }

  const handleEnviarRecordatorio = async (cliente: ClienteRecordatorio) => {
    setCargandoRecordatorio(cliente.id)
    try {
      const url = await generarMensajeWhatsApp(cliente, filtroActivo)
      if (url) {
        window.open(url, '_blank')
        // Registrar la notificación
        await recordatoriosApi.registrarNotificacion(cliente.id)
        // Actualizar el cliente en la lista local
        setClientes(prev => prev.map(c =>
          c.id === cliente.id
            ? {
                ...c,
                total_notificaciones: c.total_notificaciones + 1,
                ultima_notificacion: new Date().toISOString()
              }
            : c
        ))
        // Actualizar resumen
        if (resumen && cliente.total_notificaciones === 0) {
          setResumen({
            ...resumen,
            notificados: resumen.notificados + 1,
            no_notificados: Math.max(resumen.no_notificados - 1, 0)
          })
        }
      }
    } catch (error) {
      console.error('Error enviando recordatorio:', error)
    } finally {
      setCargandoRecordatorio(null)
    }
  }

  const handlePageChange = (page: number) => {
    fetchClientes(page)
  }

  const filters = [
    { key: 'todos' as const, label: 'Todos Pendientes', count: resumen?.total_pendientes ?? 0, color: 'bg-slate-900', textColor: 'text-white' },
    { key: 'reservadas' as const, label: 'Con Reservadas', count: resumen?.con_reservadas ?? 0, color: 'bg-yellow-500', textColor: 'text-white' },
    { key: 'abonadas' as const, label: 'Con Abonadas', count: resumen?.con_abonadas ?? 0, color: 'bg-blue-600', textColor: 'text-white' },
  ]

  const notifFilters = [
    { key: 'todos' as const, label: 'Todos', count: resumen?.total_pendientes ?? 0, emoji: '📋' },
    { key: 'no' as const, label: 'Sin Notificar', count: resumen?.no_notificados ?? 0, emoji: '🔴' },
    { key: 'si' as const, label: 'Notificados', count: resumen?.notificados ?? 0, emoji: '✅' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">🔔 Recordatorios de Pago</h2>
          <p className="text-sm text-slate-500 mt-1">Clientes con boletas pendientes — envíales un recordatorio por WhatsApp</p>
        </div>
      </div>

      {/* Filtro principal: Vendedor/Admin — oculto para VENDEDOR (auto-filtrado) */}
      {!isVendedor && (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <label className="block text-xs font-bold text-slate-600 uppercase mb-2">👤 Filtrar por Vendedor / Admin</label>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFiltroVendedor('')}
            className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              filtroVendedor === ''
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            👥 Todos
          </button>
          {vendedores.map((v) => (
            <button
              key={v.id}
              onClick={() => setFiltroVendedor(v.id)}
              className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                filtroVendedor === v.id
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {v.rol === 'SUPER_ADMIN' ? '👑' : v.rol === 'ADMIN' ? '🔑' : '🏷️'} {v.nombre}
            </button>
          ))}
        </div>
      </div>
      )}

      {/* Filter Cards - Tipo de boleta */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFiltroActivo(f.key)}
            className={`rounded-xl p-3 text-center transition-all cursor-pointer hover:scale-105 hover:shadow-md ${f.color} ${
              filtroActivo === f.key ? 'ring-2 ring-offset-2 ring-slate-900 scale-105' : ''
            }`}
          >
            <div className={`text-xl font-black ${f.textColor}`}>{f.count}</div>
            <div className={`text-xs font-semibold mt-1 ${f.textColor} opacity-80`}>{f.label}</div>
          </button>
        ))}
      </div>

      {/* Filter - Notificado/No notificado */}
      <div className="flex gap-2 flex-wrap">
        {notifFilters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFiltroNotificado(f.key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              filtroNotificado === f.key
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {f.emoji} {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <form onSubmit={handleSearchSubmit} className="flex gap-3">
          <input
            type="text"
            placeholder="Buscar por nombre, email, teléfono o identificación..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border border-slate-400 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none text-black placeholder-slate-500 bg-white"
          />
          <button
            type="submit"
            className="bg-slate-900 text-white px-6 py-2 rounded-lg hover:bg-slate-800 transition-colors font-semibold"
          >
            🔍 Buscar
          </button>
        </form>
      </div>

      {/* Client List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-900 mx-auto mb-3"></div>
            <p className="text-slate-500 font-medium">Cargando clientes...</p>
          </div>
        ) : clientes.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">🎉</div>
            <p className="text-slate-500 font-medium">No hay clientes pendientes con estos filtros</p>
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
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Vendedor</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 uppercase">Boletas Pend.</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase">Deuda</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Registrado</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 uppercase">Notificación</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {clientes.map((cliente) => {
                    const fueNotificado = cliente.total_notificaciones > 0
                    return (
                      <tr
                        key={cliente.id}
                        className={`transition-colors ${
                          fueNotificado
                            ? 'bg-green-50/60 hover:bg-green-50'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${
                              fueNotificado
                                ? 'bg-gradient-to-br from-green-500 to-green-600'
                                : 'bg-gradient-to-br from-slate-700 to-slate-500'
                            }`}>
                              {cliente.nombre?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <div>
                              <div className="text-sm font-bold text-black flex items-center gap-1.5">
                                {cliente.nombre}
                                {fueNotificado && (
                                  <span className="text-green-600 text-xs" title={`Notificado ${cliente.total_notificaciones} vez(es)`}>✓</span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500">{cliente.email || cliente.identificacion}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-black">{cliente.telefono}</td>
                        <td className="px-4 py-3">
                          {cliente.vendedor_nombre ? (
                            <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs px-2 py-1 rounded-full font-semibold">
                              👤 {cliente.vendedor_nombre}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1 flex-wrap">
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
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-red-700">
                          {formatCurrency(cliente.deuda_total || 0)}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500">
                          {formatDateShort(cliente.created_at)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {fueNotificado ? (
                            <div>
                              <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-semibold">
                                ✅ {cliente.total_notificaciones}x
                              </span>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {formatDateTime(cliente.ultima_notificacion)}
                              </div>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-red-50 text-red-600 text-xs px-2 py-1 rounded-full font-semibold">
                              🔴 Sin notificar
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleEnviarRecordatorio(cliente)}
                            disabled={cargandoRecordatorio === cliente.id}
                            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-50 ${
                              fueNotificado
                                ? 'bg-green-600 text-white hover:bg-green-500 shadow-sm'
                                : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-md shadow-emerald-600/20 animate-pulse hover:animate-none'
                            }`}
                            title={fueNotificado ? 'Enviar otro recordatorio' : 'Enviar primer recordatorio'}
                          >
                            {cargandoRecordatorio === cliente.id ? (
                              <span className="animate-spin">⏳</span>
                            ) : (
                              <>
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                </svg>
                                {fueNotificado ? 'Reenviar' : 'Recordar'}
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="lg:hidden divide-y divide-slate-100">
              {clientes.map((cliente) => {
                const fueNotificado = cliente.total_notificaciones > 0
                return (
                  <div
                    key={cliente.id}
                    className={`p-4 transition-colors ${
                      fueNotificado ? 'bg-green-50/60' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0 ${
                          fueNotificado
                            ? 'bg-gradient-to-br from-green-500 to-green-600'
                            : 'bg-gradient-to-br from-slate-700 to-slate-500'
                        }`}>
                          {cliente.nombre?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-black truncate flex items-center gap-1">
                            {cliente.nombre}
                            {fueNotificado && <span className="text-green-600 text-xs">✓</span>}
                          </div>
                          <div className="text-xs text-slate-500">{cliente.telefono} · {formatDateShort(cliente.created_at)}</div>
                          {cliente.vendedor_nombre && (
                            <div className="text-xs text-indigo-600 font-medium mt-0.5">👤 {cliente.vendedor_nombre}</div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
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
                      <span className="text-xs font-bold text-red-700">
                        Deuda: {formatCurrency(cliente.deuda_total || 0)}
                      </span>
                      {fueNotificado ? (
                        <span className="bg-green-100 text-green-800 text-xs px-1.5 py-0.5 rounded font-semibold">
                          ✅ Notificado {cliente.total_notificaciones}x · {formatDateTime(cliente.ultima_notificacion)}
                        </span>
                      ) : (
                        <span className="bg-red-50 text-red-600 text-xs px-1.5 py-0.5 rounded font-semibold">
                          🔴 Sin notificar
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex justify-end">
                      <button
                        onClick={() => handleEnviarRecordatorio(cliente)}
                        disabled={cargandoRecordatorio === cliente.id}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-50 ${
                          fueNotificado
                            ? 'bg-green-600 text-white hover:bg-green-500'
                            : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-md shadow-emerald-600/20'
                        }`}
                      >
                        {cargandoRecordatorio === cliente.id ? (
                          '⏳ Cargando...'
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                            </svg>
                            {fueNotificado ? '📩 Reenviar' : '📩 Recordar'}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )
              })}
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
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                ← Anterior
              </button>
              <span className="px-4 py-2 text-sm font-bold text-black">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
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
