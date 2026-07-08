'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import ClienteSearch from '@/components/ventas/ClienteSearch'
import { rifaApi } from '@/lib/rifaApi'
import type { Rifa } from '@/types/rifa'
import type { Cliente } from '@/types/ventas'
import {
  preasignacionesApi,
  type Preasignacion,
  type AplicarResultado,
} from '@/lib/preasignacionesApi'

type ConfirmState = {
  title: string
  message: string
  type?: 'danger' | 'warning' | 'info'
  onConfirm: () => void
} | null

interface ClienteGrupo {
  clienteId: string
  clienteNombre: string
  clienteIdentificacion: string | null
  clienteTelefono: string | null
  numeros: Preasignacion[]
}

function formatNumero(n: number) {
  return String(n).padStart(4, '0')
}

function formatFecha(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
}

function agruparPorCliente(items: Preasignacion[]): ClienteGrupo[] {
  const mapa = new Map<string, ClienteGrupo>()
  for (const item of items) {
    if (!mapa.has(item.cliente_id)) {
      mapa.set(item.cliente_id, {
        clienteId: item.cliente_id,
        clienteNombre: item.cliente_nombre,
        clienteIdentificacion: item.cliente_identificacion,
        clienteTelefono: item.cliente_telefono,
        numeros: [],
      })
    }
    mapa.get(item.cliente_id)!.numeros.push(item)
  }
  for (const grupo of mapa.values()) {
    grupo.numeros.sort((a, b) => a.numero_boleta - b.numero_boleta)
  }
  return Array.from(mapa.values()).sort((a, b) => a.clienteNombre.localeCompare(b.clienteNombre))
}

export default function PreasignacionesPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ id: string; nombre: string; rol: string } | null>(null)

  const [items, setItems] = useState<Preasignacion[]>([])
  const [gruposNuevos, setGruposNuevos] = useState<ClienteGrupo[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [procesando, setProcesando] = useState<string | null>(null) // id/clienteId en proceso
  const [confirm, setConfirm] = useState<ConfirmState>(null)

  const [showBuscarCliente, setShowBuscarCliente] = useState(false)
  const [expandido, setExpandido] = useState<Record<string, boolean>>({})
  const [nuevoNumeroPorCliente, setNuevoNumeroPorCliente] = useState<Record<string, string>>({})
  const [editandoChip, setEditandoChip] = useState<{ id: string; valor: string } | null>(null)

  // Modal "Asignar a la nueva rifa" (solo SUPER_ADMIN)
  const [showAplicar, setShowAplicar] = useState(false)
  const [rifas, setRifas] = useState<Rifa[]>([])
  const [rifaSeleccionada, setRifaSeleccionada] = useState('')
  const [cargandoRifas, setCargandoRifas] = useState(false)
  const [aplicando, setAplicando] = useState(false)
  const [resultadoAplicar, setResultadoAplicar] = useState<AplicarResultado | null>(null)

  const esSuperAdmin = user?.rol?.toUpperCase() === 'SUPER_ADMIN'

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')
    if (!token || !userData) { router.push('/login'); return }
    try {
      const parsed = JSON.parse(userData)
      if (!['SUPER_ADMIN', 'ADMIN', 'VENDEDOR'].includes(parsed.rol?.toUpperCase())) {
        router.push('/dashboard')
        return
      }
      setUser(parsed)
    } catch { router.push('/login') }
  }, [router])

  const cargar = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const data = await preasignacionesApi.listar()
      setItems(data)
    } catch (e: any) {
      setError(e.message || 'Error al cargar las preasignaciones')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    cargar()
  }, [user, cargar])

  const gruposExistentes = useMemo(() => agruparPorCliente(items), [items])

  const grupos = useMemo(() => {
    const idsExistentes = new Set(gruposExistentes.map((g) => g.clienteId))
    const extras = gruposNuevos.filter((g) => !idsExistentes.has(g.clienteId))
    const todos = [...extras, ...gruposExistentes]
    const termino = q.trim().toLowerCase()
    if (!termino) return todos
    return todos.filter((g) =>
      g.clienteNombre.toLowerCase().includes(termino) ||
      (g.clienteIdentificacion || '').toLowerCase().includes(termino) ||
      (g.clienteTelefono || '').toLowerCase().includes(termino) ||
      g.numeros.some((n) => formatNumero(n.numero_boleta).includes(termino))
    )
  }, [gruposExistentes, gruposNuevos, q])

  const totalNumeros = items.length

  const onClienteSeleccionado = (cliente: Cliente) => {
    setShowBuscarCliente(false)
    if (!cliente.id) return
    const yaExiste = gruposExistentes.some((g) => g.clienteId === cliente.id) ||
      gruposNuevos.some((g) => g.clienteId === cliente.id)
    if (!yaExiste) {
      setGruposNuevos((prev) => [
        ...prev,
        {
          clienteId: cliente.id!,
          clienteNombre: cliente.nombre,
          clienteIdentificacion: cliente.identificacion || null,
          clienteTelefono: cliente.telefono || null,
          numeros: [],
        },
      ])
    }
    setExpandido((prev) => ({ ...prev, [cliente.id!]: true }))
    setQ('')
  }

  const agregarNumero = async (clienteId: string) => {
    const valor = (nuevoNumeroPorCliente[clienteId] || '').trim()
    const numero = Number(valor)
    setError(''); setAviso('')
    if (!valor || !Number.isInteger(numero) || numero < 0 || numero > 9999) {
      setError('Escribe un número de boleta válido (0 a 9999).')
      return
    }

    setProcesando(clienteId)
    try {
      await preasignacionesApi.crear({ cliente_id: clienteId, numero_boleta: numero })
      setNuevoNumeroPorCliente((prev) => ({ ...prev, [clienteId]: '' }))
      setAviso(`Boleta #${formatNumero(numero)} preasignada correctamente.`)
      await cargar()
    } catch (e: any) {
      setError(e.message || 'Error al preasignar el número')
    } finally {
      setProcesando(null)
    }
  }

  const quitarNumero = (item: Preasignacion) => {
    setConfirm({
      title: 'Quitar número preasignado',
      message: `Se quitará la boleta #${formatNumero(item.numero_boleta)} de ${item.cliente_nombre}. Esto NO afecta ninguna venta ya creada anteriormente.`,
      type: 'danger',
      onConfirm: async () => {
        setProcesando(item.id); setError(''); setAviso('')
        try {
          await preasignacionesApi.eliminar(item.id)
          setAviso('Número quitado.')
          await cargar()
        } catch (e: any) {
          setError(e.message || 'Error al quitar el número')
        } finally {
          setProcesando(null)
          setConfirm(null)
        }
      },
    })
  }

  const guardarEdicionChip = async () => {
    if (!editandoChip) return
    const numero = Number(editandoChip.valor)
    if (!Number.isInteger(numero) || numero < 0 || numero > 9999) {
      setError('El número debe estar entre 0 y 9999.')
      return
    }
    setProcesando(editandoChip.id); setError(''); setAviso('')
    try {
      await preasignacionesApi.actualizar(editandoChip.id, { numero_boleta: numero })
      setAviso('Número actualizado.')
      setEditandoChip(null)
      await cargar()
    } catch (e: any) {
      setError(e.message || 'Error al actualizar el número')
    } finally {
      setProcesando(null)
    }
  }

  const quitarClienteVacio = (clienteId: string) => {
    setGruposNuevos((prev) => prev.filter((g) => g.clienteId !== clienteId))
  }

  const abrirAplicar = async () => {
    setShowAplicar(true)
    setResultadoAplicar(null)
    setRifaSeleccionada('')
    setCargandoRifas(true)
    try {
      const res = await rifaApi.getRifasOperativas()
      setRifas(res.data || [])
    } catch (e: any) {
      setError(e.message || 'Error al cargar rifas')
    } finally {
      setCargandoRifas(false)
    }
  }

  const confirmarAplicar = () => {
    if (!rifaSeleccionada) return
    const rifa = rifas.find((r) => r.id === rifaSeleccionada)
    setConfirm({
      title: 'Asignar boletas preasignadas a esta rifa',
      message: `Se intentará reservar cada número preasignado en "${rifa?.nombre}". Las boletas que ya estén vendidas, reservadas o no existan se OMITIRÁN sin tocarlas. Las que estén DISPONIBLE quedarán como una reserva formal (venta pendiente) a nombre del cliente correspondiente. ¿Continuar?`,
      type: 'warning',
      onConfirm: async () => {
        setAplicando(true); setError('')
        try {
          const resultado = await preasignacionesApi.aplicarARifa(rifaSeleccionada)
          setResultadoAplicar(resultado)
          await cargar()
        } catch (e: any) {
          setError(e.message || 'Error al aplicar las preasignaciones')
        } finally {
          setAplicando(false)
          setConfirm(null)
        }
      },
    })
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-slate-500 text-sm">Cargando...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <button onClick={() => router.push('/dashboard')} className="text-sm text-slate-500 hover:text-slate-800 mb-1">
              ← Dashboard
            </button>
            <h1 className="text-xl font-bold text-slate-900">Boletas Preasignadas</h1>
            <p className="text-xs text-slate-500">
              Busca un cliente y asígnale los números que siempre pide. Se aplican todos de un clic cuando salga la próxima rifa.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {esSuperAdmin && (
              <button
                onClick={abrirAplicar}
                className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 text-sm"
              >
                Asignar a la nueva rifa
              </button>
            )}
            <button
              onClick={() => setShowBuscarCliente(true)}
              className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 text-sm"
            >
              + Buscar cliente
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Filtrar por cliente o número ({totalNumeros} número{totalNumeros !== 1 ? 's' : ''} preasignado{totalNumeros !== 1 ? 's' : ''})
          </label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ej: 0047  ó  Juan Pérez"
            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{error}</div>
        )}
        {aviso && (
          <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 text-sm">{aviso}</div>
        )}

        {loading ? (
          <div className="flex items-center gap-3 text-slate-500 text-sm py-10 justify-center">
            <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            Cargando...
          </div>
        ) : grupos.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 text-center py-12 text-slate-500 text-sm">
            No hay boletas preasignadas todavía. Usa &quot;+ Buscar cliente&quot; para empezar.
          </div>
        ) : (
          <div className="space-y-3">
            {grupos.map((grupo) => {
              const abierto = expandido[grupo.clienteId] ?? grupo.numeros.length <= 6
              return (
                <div key={grupo.clienteId} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <button
                    onClick={() => setExpandido((prev) => ({ ...prev, [grupo.clienteId]: !abierto }))}
                    className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{grupo.clienteNombre}</p>
                      <p className="text-xs text-slate-500">
                        {grupo.clienteIdentificacion || '—'} · {grupo.clienteTelefono || '—'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
                        {grupo.numeros.length} boleta{grupo.numeros.length !== 1 ? 's' : ''}
                      </span>
                      <svg className={`w-4 h-4 text-slate-400 transition-transform ${abierto ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {abierto && (
                    <div className="px-5 pb-5 border-t border-slate-100 pt-4">
                      <div className="flex flex-wrap gap-2 mb-4">
                        {grupo.numeros.map((n) => (
                          <div
                            key={n.id}
                            className="group flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 pl-3 pr-1.5 py-1"
                            title={n.ultima_aplicacion_en ? `Aplicada a ${n.ultima_aplicacion_rifa_nombre} · ${formatFecha(n.ultima_aplicacion_en)}` : 'Aún no aplicada'}
                          >
                            {editandoChip?.id === n.id ? (
                              <input
                                autoFocus
                                type="number"
                                min={0}
                                max={9999}
                                value={editandoChip.valor}
                                onChange={(e) => setEditandoChip({ id: n.id, valor: e.target.value })}
                                onKeyDown={(e) => e.key === 'Enter' && guardarEdicionChip()}
                                onBlur={guardarEdicionChip}
                                className="w-16 text-sm border border-indigo-300 rounded px-1 py-0.5"
                              />
                            ) : (
                              <button
                                onClick={() => setEditandoChip({ id: n.id, valor: String(n.numero_boleta) })}
                                className="font-mono font-semibold text-sm text-slate-800 hover:text-indigo-600"
                              >
                                #{formatNumero(n.numero_boleta)}
                              </button>
                            )}
                            {n.ultima_aplicacion_en && (
                              <span className="text-[10px] text-blue-600 font-medium">✓</span>
                            )}
                            <button
                              onClick={() => quitarNumero(n)}
                              disabled={procesando === n.id}
                              className="w-5 h-5 rounded-full flex items-center justify-center text-slate-400 hover:bg-red-100 hover:text-red-600 disabled:opacity-40"
                              title="Quitar número"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                        {grupo.numeros.length === 0 && (
                          <p className="text-sm text-slate-400 italic">Sin números todavía. Agrega el primero abajo.</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={9999}
                          value={nuevoNumeroPorCliente[grupo.clienteId] || ''}
                          onChange={(e) => setNuevoNumeroPorCliente((prev) => ({ ...prev, [grupo.clienteId]: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && agregarNumero(grupo.clienteId)}
                          placeholder="Número de boleta"
                          className="w-40 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                        />
                        <button
                          onClick={() => agregarNumero(grupo.clienteId)}
                          disabled={procesando === grupo.clienteId || !(nuevoNumeroPorCliente[grupo.clienteId] || '').trim()}
                          className="px-3 py-1.5 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 font-medium"
                        >
                          {procesando === grupo.clienteId ? 'Agregando...' : '+ Agregar boleta'}
                        </button>
                        {grupo.numeros.length === 0 && (
                          <button
                            onClick={() => quitarClienteVacio(grupo.clienteId)}
                            className="text-xs text-slate-400 hover:text-slate-600 ml-auto"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Modal: buscar cliente para agregar/gestionar */}
      {showBuscarCliente && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full my-8">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Buscar cliente</h3>
              <button onClick={() => setShowBuscarCliente(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div className="p-6">
              <ClienteSearch permitirCrear={false} onClienteSelected={onClienteSeleccionado} />
            </div>
          </div>
        </div>
      )}

      {/* Modal: aplicar a nueva rifa (SUPER_ADMIN) */}
      {showAplicar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full my-8">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Asignar boletas preasignadas a una rifa</h3>
              <button onClick={() => setShowAplicar(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div className="p-6 space-y-4">
              {!resultadoAplicar ? (
                <>
                  <p className="text-sm text-slate-600">
                    Se revisará cada uno de los {totalNumeros} número(s) preasignado(s). Las boletas que ya estén
                    vendidas o reservadas por otro motivo NO se tocarán; solo se reservan las que estén disponibles.
                  </p>
                  <div>
                    <label className="block text-sm font-bold text-black mb-2">Rifa destino</label>
                    {cargandoRifas ? (
                      <p className="text-sm text-slate-500">Cargando rifas...</p>
                    ) : (
                      <select
                        value={rifaSeleccionada}
                        onChange={(e) => setRifaSeleccionada(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-400 rounded-lg bg-white text-black"
                      >
                        <option value="">Selecciona una rifa...</option>
                        {rifas.map((r) => (
                          <option key={r.id} value={r.id} disabled={['TERMINADA', 'CANCELADA'].includes(r.estado)}>
                            {r.nombre} ({r.estado}){['TERMINADA', 'CANCELADA'].includes(r.estado) ? ' - no disponible' : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
                    Listo. {resultadoAplicar.asignadas.length} de {resultadoAplicar.total_preasignaciones} boleta(s)
                    quedaron reservadas en &quot;{resultadoAplicar.rifa_nombre}&quot;.
                  </div>

                  {resultadoAplicar.asignadas.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Asignadas</p>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {resultadoAplicar.asignadas.map((a) => (
                          <div key={a.venta_id} className="text-sm text-slate-700">
                            #{formatNumero(a.numero_boleta)} → {a.cliente_nombre}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {resultadoAplicar.omitidas.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 mb-2">
                        Omitidas ({resultadoAplicar.omitidas.length})
                      </p>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {resultadoAplicar.omitidas.map((o, i) => (
                          <div key={i} className="text-sm text-slate-600">
                            #{formatNumero(o.numero_boleta)} ({o.cliente_nombre}): {o.motivo}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setShowAplicar(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
              >
                {resultadoAplicar ? 'Cerrar' : 'Cancelar'}
              </button>
              {!resultadoAplicar && (
                <button
                  onClick={confirmarAplicar}
                  disabled={!rifaSeleccionada || aplicando}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-medium"
                >
                  {aplicando ? 'Aplicando...' : 'Aplicar'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <ConfirmDialog
          isOpen={!!confirm}
          title={confirm.title}
          message={confirm.message}
          type={confirm.type}
          confirmText={procesando || aplicando ? 'Procesando...' : 'Confirmar'}
          onConfirm={confirm.onConfirm}
          onCancel={() => !(procesando || aplicando) && setConfirm(null)}
        />
      )}
    </div>
  )
}
