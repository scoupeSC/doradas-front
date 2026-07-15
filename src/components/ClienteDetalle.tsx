'use client'

import { useState, useEffect } from 'react'
import { clienteApi } from '@/lib/clienteApi'
import { normalizarTelefono } from '@/utils/telefono'
import {
  Cliente,
  ClienteDetalleResumen,
  RifaConBoletas,
  BoletaDetalle,
  AbonoHistorial,
} from '@/types/cliente'
import ClienteHistorialMovimientos from '@/components/ClienteHistorialMovimientos'
import { formatBoletaNumeros } from '@/utils/formatBoletaNumeros'
import {
  lineaPachaPendiente,
  mensajeRecordatorioPendiente,
} from '@/utils/whatsappMensajes'

interface ClienteDetalleProps {
  clienteId: string
  onBack: () => void
}

type FilterEstado = 'TODAS' | 'PAGADA' | 'RESERVADA' | 'ABONADA' | 'ANULADA'

const estadoColors: Record<string, string> = {
  PAGADA: 'bg-green-100 text-green-800 border border-green-300',
  RESERVADA: 'bg-yellow-100 text-yellow-800 border border-yellow-300',
  ABONADA: 'bg-blue-100 text-blue-800 border border-blue-300',
  ANULADA: 'bg-red-100 text-red-800 border border-red-300',
  DISPONIBLE: 'bg-gray-100 text-gray-800 border border-gray-300',
  TRANSFERIDA: 'bg-purple-100 text-purple-800 border border-purple-300',
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ClienteDetalle({ clienteId, onBack }: ClienteDetalleProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [resumen, setResumen] = useState<ClienteDetalleResumen | null>(null)
  const [resumenPasadas, setResumenPasadas] = useState<ClienteDetalleResumen | null>(null)
  const [rifas, setRifas] = useState<RifaConBoletas[]>([])
  const [rifasPasadas, setRifasPasadas] = useState<RifaConBoletas[]>([])
  const [rifaActual, setRifaActual] = useState<{ id: string; nombre: string; estado: string } | null>(null)
  const [abonos, setAbonos] = useState<AbonoHistorial[]>([])
  const [filtroEstado, setFiltroEstado] = useState<FilterEstado>('TODAS')
  const [activeTab, setActiveTab] = useState<'boletas' | 'abonos' | 'movimientos'>('boletas')
  const [expandedRifas, setExpandedRifas] = useState<Set<string>>(new Set())
  const [expandedRifasPasadas, setExpandedRifasPasadas] = useState<Set<string>>(new Set())
  const [historialAbierto, setHistorialAbierto] = useState(false)
  const [canVerHistorial, setCanVerHistorial] = useState(false)

  useEffect(() => {
    try {
      const userData = localStorage.getItem('user')
      if (userData) {
        const rol = (JSON.parse(userData).rol || '').toUpperCase()
        setCanVerHistorial(['SUPER_ADMIN', 'ADMIN'].includes(rol))
      }
    } catch {
      setCanVerHistorial(false)
    }
  }, [])

  useEffect(() => {
    fetchDetalle()
  }, [clienteId])

  const fetchDetalle = async () => {
    try {
      setLoading(true)
      const response = await clienteApi.getClienteDetalle(clienteId)
      setCliente(response.data.cliente)
      setResumen(response.data.resumen)
      setResumenPasadas(response.data.resumen_pasadas || null)
      setRifas(response.data.rifas)
      setRifasPasadas(response.data.rifas_pasadas || [])
      setRifaActual(response.data.rifa_actual || null)
      setAbonos(response.data.abonos)
      setExpandedRifas(new Set(response.data.rifas.map((r) => r.rifa_id)))
      setHistorialAbierto((response.data.rifas_pasadas || []).length > 0)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar detalle del cliente')
    } finally {
      setLoading(false)
    }
  }

  const toggleRifa = (rifaId: string) => {
    setExpandedRifas((prev) => {
      const next = new Set(prev)
      if (next.has(rifaId)) next.delete(rifaId)
      else next.add(rifaId)
      return next
    })
  }

  const getFilteredBoletas = (boletas: BoletaDetalle[]): BoletaDetalle[] => {
    if (filtroEstado === 'TODAS') return boletas
    return boletas.filter((b) => b.estado === filtroEstado)
  }

  const getFilteredRifas = (): RifaConBoletas[] => {
    if (filtroEstado === 'TODAS') return rifas
    return rifas
      .map((r) => ({
        ...r,
        boletas: r.boletas.filter((b) => b.estado === filtroEstado),
      }))
      .filter((r) => r.boletas.length > 0)
  }

  const toggleRifaPasada = (rifaId: string) => {
    setExpandedRifasPasadas((prev) => {
      const next = new Set(prev)
      if (next.has(rifaId)) next.delete(rifaId)
      else next.add(rifaId)
      return next
    })
  }

  const getFilteredRifasPasadas = (): RifaConBoletas[] => {
    if (filtroEstado === 'TODAS') return rifasPasadas
    return rifasPasadas
      .map((r) => ({
        ...r,
        boletas: r.boletas.filter((b) => b.estado === filtroEstado),
      }))
      .filter((r) => r.boletas.length > 0)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Cargando detalle del cliente...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="text-slate-600 hover:text-slate-900 font-medium flex items-center gap-2">
          ← Volver a la lista
        </button>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>
      </div>
    )
  }

  if (!cliente || !resumen) return null

  const filteredRifas = getFilteredRifas()
  const filteredRifasPasadas = getFilteredRifasPasadas()

  // ─── Genera link de WhatsApp con recordatorio personalizado ────────
  const generarWhatsAppRecordatorio = (
    cli: Cliente,
    rifasFiltradas: RifaConBoletas[],
    _estado: FilterEstado
  ): string => {
    const telCompleto = normalizarTelefono(cli.telefono)
    const nombre = cli.nombre || 'Cliente'

    const lineasDetalle: string[] = []
    let deudaTotal = 0

    rifasFiltradas.forEach((rifa) => {
      lineasDetalle.push(`🎟️ *${rifa.rifa_nombre}*`)
      rifa.boletas.forEach((b) => {
        const esPagada = b.estado === 'PAGADA'
        const saldoReal = esPagada ? 0 : b.saldo
        deudaTotal += saldoReal
        lineasDetalle.push(lineaPachaPendiente({
          estado: b.estado,
          numeros: b.numeros,
          numero: b.numero,
          saldo: Number(saldoReal),
          abono: Number(esPagada ? b.precio_unitario : b.abono),
          precio: Number(b.precio_unitario),
        }))
      })
      lineasDetalle.push('')
    })

    const msg = mensajeRecordatorioPendiente({
      nombre,
      lineasDetalle,
      deudaTotal,
    })

    return `https://wa.me/${telCompleto}?text=${encodeURIComponent(msg)}`
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button onClick={onBack} className="text-slate-600 hover:text-slate-900 font-medium flex items-center gap-2 transition-colors">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Volver a la lista
      </button>

      {/* Client Info Card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-slate-800 to-slate-600 rounded-full flex items-center justify-center text-white text-2xl font-bold shrink-0">
              {cliente.nombre?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-black">{cliente.nombre}</h2>
              <p className="text-slate-600">CC: {cliente.identificacion}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-slate-500 block">Teléfono</span>
              <span className="text-black font-semibold">{cliente.telefono || '—'}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Email</span>
              <span className="text-black font-semibold">{cliente.email || '—'}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Dirección</span>
              <span className="text-black font-semibold">{cliente.direccion || '—'}</span>
            </div>
          </div>
        </div>
      </div>

      {rifaActual && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3">
          <p className="text-sm font-bold text-green-900">
            Rifa actual: {rifaActual.nombre}
          </p>
          <p className="text-sm text-green-800 mt-1">
            Los totales y boletas principales corresponden solo a la rifa activa.
          </p>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <KpiCard
          label="Boletas (actual)"
          value={resumen.total_boletas}
          color="bg-slate-900"
          textColor="text-white"
          active={filtroEstado === 'TODAS'}
          onClick={() => setFiltroEstado('TODAS')}
        />
        <KpiCard
          label="Pagadas"
          value={resumen.pagadas}
          color="bg-green-600"
          textColor="text-white"
          active={filtroEstado === 'PAGADA'}
          onClick={() => setFiltroEstado(filtroEstado === 'PAGADA' ? 'TODAS' : 'PAGADA')}
        />
        <KpiCard
          label="Reservadas"
          value={resumen.reservadas}
          color="bg-yellow-500"
          textColor="text-white"
          active={filtroEstado === 'RESERVADA'}
          onClick={() => setFiltroEstado(filtroEstado === 'RESERVADA' ? 'TODAS' : 'RESERVADA')}
        />
        <KpiCard
          label="Abonadas"
          value={resumen.abonadas}
          color="bg-blue-600"
          textColor="text-white"
          active={filtroEstado === 'ABONADA'}
          onClick={() => setFiltroEstado(filtroEstado === 'ABONADA' ? 'TODAS' : 'ABONADA')}
        />
        <KpiCard
          label="Anuladas"
          value={resumen.anuladas}
          color="bg-red-500"
          textColor="text-white"
          active={filtroEstado === 'ANULADA'}
          onClick={() => setFiltroEstado(filtroEstado === 'ANULADA' ? 'TODAS' : 'ANULADA')}
        />
        <KpiCard
          label="💵 Recaudado"
          value={formatCurrency(resumen.total_pagado + resumen.total_abonado)}
          color="bg-emerald-50"
          textColor="text-emerald-800"
          small
        />
        <KpiCard
          label="💰 En Abonos"
          value={formatCurrency(resumen.total_abonado)}
          color="bg-blue-50"
          textColor="text-blue-800"
          small
        />
        <KpiCard
          label="🔴 Debe"
          value={formatCurrency(resumen.total_deuda)}
          color={resumen.total_deuda > 0 ? 'bg-red-100 border-2 border-red-300' : 'bg-green-50'}
          textColor={resumen.total_deuda > 0 ? 'text-red-800' : 'text-green-800'}
          small
        />
      </div>

      {/* Filter indicator */}
      {filtroEstado !== 'TODAS' && (
        <div className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-lg">
          <span className="text-sm text-slate-700 font-medium">
            Filtrando por: <span className={`px-2 py-0.5 rounded text-xs font-bold ${estadoColors[filtroEstado]}`}>{filtroEstado}</span>
          </span>
          <button
            onClick={() => setFiltroEstado('TODAS')}
            className="ml-auto text-sm text-slate-500 hover:text-slate-900 underline"
          >
            Limpiar filtro
          </button>
        </div>
      )}

      {/* WhatsApp Reminder Button — visible when RESERVADA or ABONADA filter is active */}
      {(filtroEstado === 'RESERVADA' || filtroEstado === 'ABONADA') && cliente.telefono && filteredRifas.length > 0 && (
        <div className="flex justify-end">
          <a
            href={generarWhatsAppRecordatorio(cliente, filteredRifas, filtroEstado)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all text-sm"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            📩 Enviar recordatorio por WhatsApp ({filtroEstado === 'RESERVADA' ? 'Reservadas' : 'Abonadas'})
          </a>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('boletas')}
          className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${
            activeTab === 'boletas'
              ? 'border-slate-900 text-black'
              : 'border-transparent text-slate-500 hover:text-black'
          }`}
        >
          📋 Boletas rifa actual ({resumen.total_boletas})
        </button>
        <button
          onClick={() => setActiveTab('abonos')}
          className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${
            activeTab === 'abonos'
              ? 'border-slate-900 text-black'
              : 'border-transparent text-slate-500 hover:text-black'
          }`}
        >
          💰 Historial de Abonos ({abonos.length})
        </button>
        {canVerHistorial && (
          <button
            onClick={() => setActiveTab('movimientos')}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${
              activeTab === 'movimientos'
                ? 'border-slate-900 text-black'
                : 'border-transparent text-slate-500 hover:text-black'
            }`}
          >
            📜 Movimientos
          </button>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'boletas' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <h3 className="text-sm font-bold text-slate-900">
              Boletas de la rifa actual
            </h3>
          </div>

          {filteredRifas.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <div className="text-4xl mb-3">🎫</div>
              <p className="text-slate-500 font-medium">
                {filtroEstado === 'TODAS'
                  ? 'Este cliente no tiene boletas en la rifa actual'
                  : `No hay boletas con estado "${filtroEstado}" en la rifa actual`}
              </p>
            </div>
          ) : (
            filteredRifas.map((rifa) => (
              <RifaAccordion
                key={rifa.rifa_id}
                rifa={rifa}
                filteredBoletas={getFilteredBoletas(rifa.boletas)}
                expanded={expandedRifas.has(rifa.rifa_id)}
                onToggle={() => toggleRifa(rifa.rifa_id)}
                filtroEstado={filtroEstado}
              />
            ))
          )}

          {rifasPasadas.length > 0 && (
            <div className="pt-4 border-t border-slate-200 space-y-4">
              <button
                type="button"
                onClick={() => setHistorialAbierto((prev) => !prev)}
                className="w-full flex items-center justify-between rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-left"
              >
                <div>
                  <h3 className="text-sm font-bold text-violet-950">
                    Historial de rifas pasadas
                  </h3>
                  <p className="text-sm text-violet-800 mt-1">
                    {rifasPasadas.length} rifa{rifasPasadas.length !== 1 ? 's' : ''} · {resumenPasadas?.total_boletas || 0} boleta{(resumenPasadas?.total_boletas || 0) !== 1 ? 's' : ''}
                  </p>
                </div>
                <svg
                  className={`w-5 h-5 text-violet-500 transition-transform ${historialAbierto ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {historialAbierto && (
                <div className="space-y-4">
                  {resumenPasadas && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <KpiCard label="Boletas pasadas" value={resumenPasadas.total_boletas} color="bg-violet-100" textColor="text-violet-900" small />
                      <KpiCard label="Pagadas" value={resumenPasadas.pagadas} color="bg-green-100" textColor="text-green-800" small />
                      <KpiCard label="Reservadas" value={resumenPasadas.reservadas} color="bg-yellow-100" textColor="text-yellow-800" small />
                      <KpiCard label="Abonadas" value={resumenPasadas.abonadas} color="bg-blue-100" textColor="text-blue-800" small />
                    </div>
                  )}

                  {filteredRifasPasadas.length === 0 ? (
                    <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
                      No hay boletas pasadas con el filtro seleccionado.
                    </div>
                  ) : (
                    filteredRifasPasadas.map((rifa) => (
                      <RifaAccordion
                        key={`pasada-${rifa.rifa_id}`}
                        rifa={rifa}
                        filteredBoletas={getFilteredBoletas(rifa.boletas)}
                        expanded={expandedRifasPasadas.has(rifa.rifa_id)}
                        onToggle={() => toggleRifaPasada(rifa.rifa_id)}
                        filtroEstado={filtroEstado}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'abonos' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {abonos.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-4xl mb-3">💳</div>
              <p className="text-slate-500 font-medium">No hay abonos registrados para este cliente</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Fecha</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Rifa</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Boleta</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase">Monto</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Medio Pago</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Referencia</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 uppercase">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {abonos.map((abono) => (
                    <tr key={abono.abono_id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-black">{formatDate(abono.abono_fecha)}</td>
                      <td className="px-4 py-3 text-sm text-black font-medium">{abono.rifa_nombre || '—'}</td>
                      <td className="px-4 py-3 text-sm">
                        {abono.boleta_numero != null || (abono.boleta_numeros && abono.boleta_numeros.length > 0) ? (
                          <span className="bg-slate-100 px-2 py-1 rounded font-mono font-bold text-black">
                            {formatBoletaNumeros(abono.boleta_numeros, abono.boleta_numero)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-green-700">
                        {formatCurrency(abono.monto)}
                      </td>
                      <td className="px-4 py-3 text-sm text-black">
                        {abono.medio_pago_nombre || abono.gateway_pago || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{abono.referencia || '—'}</td>
                      <td className="px-4 py-3 text-sm text-center">
                        <span
                          className={`px-2 py-1 rounded text-xs font-bold ${
                            abono.estado === 'CONFIRMADO'
                              ? 'bg-green-100 text-green-800'
                              : abono.estado === 'ANULADO'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {abono.estado}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'movimientos' && canVerHistorial && (
        <ClienteHistorialMovimientos clienteId={clienteId} />
      )}
    </div>
  )
}

// ===== Sub-components =====

function KpiCard({
  label,
  value,
  color,
  textColor,
  active,
  onClick,
  highlight,
  small,
}: {
  label: string
  value: number | string
  color: string
  textColor: string
  active?: boolean
  onClick?: () => void
  highlight?: boolean
  small?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`rounded-xl p-3 text-center transition-all ${color} ${
        active ? 'ring-2 ring-offset-2 ring-slate-900 scale-105' : ''
      } ${onClick ? 'cursor-pointer hover:scale-105 hover:shadow-md' : 'cursor-default'} ${
        highlight ? 'animate-pulse' : ''
      }`}
    >
      <div className={`${small ? 'text-lg' : 'text-2xl'} font-black ${textColor}`}>{value}</div>
      <div className={`text-xs font-semibold mt-1 ${textColor} opacity-80`}>{label}</div>
    </button>
  )
}

function RifaAccordion({
  rifa,
  filteredBoletas,
  expanded,
  onToggle,
  filtroEstado,
}: {
  rifa: RifaConBoletas
  filteredBoletas: BoletaDetalle[]
  expanded: boolean
  onToggle: () => void
  filtroEstado: FilterEstado
}) {
  const boletas = filtroEstado === 'TODAS' ? rifa.boletas : filteredBoletas

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Rifa Header */}
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="text-2xl">🎟️</div>
          <div className="text-left">
            <h3 className="text-lg font-bold text-black">{rifa.rifa_nombre}</h3>
            <div className="flex items-center gap-3 mt-1 text-xs">
              <span className={`px-2 py-0.5 rounded font-bold ${
                rifa.rifa_estado === 'ACTIVA' ? 'bg-green-100 text-green-800' :
                rifa.rifa_estado === 'TERMINADA' ? 'bg-gray-100 text-gray-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {rifa.rifa_estado}
              </span>
              <span className="text-slate-500">Precio: {formatCurrency(rifa.precio_boleta)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          {/* Mini summary badges */}
          <div className="hidden sm:flex items-center gap-2">
            {rifa.resumen.pagadas > 0 && (
              <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded font-bold">
                {rifa.resumen.pagadas} Pagadas
              </span>
            )}
            {rifa.resumen.reservadas > 0 && (
              <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded font-bold">
                {rifa.resumen.reservadas} Reserv.
              </span>
            )}
            {rifa.resumen.abonadas > 0 && (
              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-bold">
                {rifa.resumen.abonadas} Abonadas
              </span>
            )}
            {rifa.resumen.deuda > 0 && (
              <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded font-bold">
                Deuda: {formatCurrency(rifa.resumen.deuda)}
              </span>
            )}
          </div>
          <svg
            className={`w-5 h-5 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Rifa Body */}
      {expanded && (
        <div className="border-t border-slate-200">
          {/* Rifa financial summary */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 bg-slate-50">
            <div className="text-center">
              <div className="text-xs text-slate-500 font-semibold">Total Boletas</div>
              <div className="text-lg font-black text-black">{rifa.resumen.total}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-slate-500 font-semibold">✅ Pagadas</div>
              <div className="text-lg font-black text-green-700">{rifa.resumen.pagadas}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-slate-500 font-semibold">💰 Total Recaudado</div>
              <div className="text-lg font-black text-emerald-700">{formatCurrency(rifa.resumen.abonado)}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-slate-500 font-semibold">⏳ Pendiente por Cobrar</div>
              <div className={`text-lg font-black ${rifa.resumen.deuda > 0 ? 'text-red-700' : 'text-green-700'}`}>
                {rifa.resumen.deuda > 0 ? formatCurrency(rifa.resumen.deuda) : '$ 0'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-slate-500 font-semibold">📊 Progreso</div>
              <div className="text-lg font-black text-blue-700">
                {rifa.resumen.abonado + (rifa.resumen.pagadas * rifa.precio_boleta) > 0
                  ? Math.round(((rifa.resumen.abonado) / ((rifa.resumen.total) * rifa.precio_boleta)) * 100)
                  : 0}%
              </div>
            </div>
          </div>

          {/* Boletas Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-y border-slate-200">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-bold text-slate-600 uppercase">Nº Boleta</th>
                  <th className="px-4 py-2 text-center text-xs font-bold text-slate-600 uppercase">Estado</th>
                  <th className="px-4 py-2 text-right text-xs font-bold text-slate-600 uppercase">Precio</th>
                  <th className="px-4 py-2 text-right text-xs font-bold text-slate-600 uppercase">Pagado</th>
                  <th className="px-4 py-2 text-right text-xs font-bold text-slate-600 uppercase">Debe</th>
                  <th className="px-4 py-2 text-center text-xs font-bold text-slate-600 uppercase">Progreso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {boletas.map((boleta) => {
                  // For PAGADA boletas: 100% paid, abono = precio, saldo = 0
                  const esPagada = boleta.estado === 'PAGADA'
                  const abonoReal = esPagada ? boleta.precio_unitario : boleta.abono
                  const saldoReal = esPagada ? 0 : boleta.saldo
                  const porcentaje = boleta.precio_unitario > 0
                    ? Math.min(Math.round((abonoReal / boleta.precio_unitario) * 100), 100)
                    : 0

                  return (
                    <tr key={boleta.boleta_id} className={`hover:bg-slate-50 transition-colors ${esPagada ? 'bg-green-50/50' : ''}`}>
                      <td className="px-4 py-3">
                        <span className="bg-slate-100 px-3 py-1 rounded font-mono font-black text-black text-sm">
                          {formatBoletaNumeros(boleta.numeros, boleta.numero)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${estadoColors[boleta.estado] || 'bg-gray-100 text-gray-800'}`}>
                          {boleta.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-black font-medium">
                        {formatCurrency(boleta.precio_unitario)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-emerald-700">
                        {formatCurrency(abonoReal)}
                      </td>
                      <td className={`px-4 py-3 text-right text-sm font-bold ${saldoReal > 0 ? 'text-red-700' : 'text-green-700'}`}>
                        {saldoReal > 0 ? formatCurrency(saldoReal) : '✅ $ 0'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-20 h-3 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                porcentaje >= 100 ? 'bg-green-500' :
                                porcentaje >= 50 ? 'bg-blue-500' :
                                porcentaje > 0 ? 'bg-yellow-500' : 'bg-red-300'
                              }`}
                              style={{ width: `${Math.min(porcentaje, 100)}%` }}
                            />
                          </div>
                          <span className={`text-xs font-black w-10 text-right ${
                            porcentaje >= 100 ? 'text-green-700' :
                            porcentaje >= 50 ? 'text-blue-700' :
                            porcentaje > 0 ? 'text-yellow-700' : 'text-red-700'
                          }`}>{porcentaje}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
