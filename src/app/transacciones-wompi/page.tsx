'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  wompiAuditoriaApi,
  type WompiDetalle,
  type WompiDiagnostico,
  type WompiResumen,
  type WompiTransaccion,
} from '@/lib/wompiAuditoriaApi'

const money = (value: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0)

const fecha = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString('es-CO', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : '—'

const numberLabel = (n: number) => `#${String(n).padStart(4, '0')}`

function statusClass(status: string) {
  if (status === 'APPROVED') return 'bg-emerald-100 text-emerald-700'
  if (status === 'PENDING') return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

const diagnosticos: Record<WompiDiagnostico, { label: string; className: string }> = {
  OK: { label: 'Correcto', className: 'bg-emerald-100 text-emerald-700' },
  APROBADO_SIN_ENTREGAR: {
    label: 'Aprobado sin entregar',
    className: 'bg-red-100 text-red-700',
  },
  PAGADA_POR_OTRO_MEDIO: {
    label: 'Pagada por otro medio',
    className: 'bg-blue-100 text-blue-700',
  },
  PENDIENTE_REVISAR: {
    label: 'Pendiente de revisar',
    className: 'bg-orange-100 text-orange-700',
  },
  NO_APROBADO: { label: 'No aprobado', className: 'bg-slate-100 text-slate-700' },
}

function Kpi({
  label,
  value,
  detail,
  tone = 'slate',
}: {
  label: string
  value: string | number
  detail: string
  tone?: 'slate' | 'green' | 'amber' | 'red'
}) {
  const tones = {
    slate: 'border-slate-200',
    green: 'border-emerald-200',
    amber: 'border-amber-200',
    red: 'border-red-200',
  }
  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-sm ${tones[tone]}`}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  )
}

export default function TransaccionesWompiPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [resumen, setResumen] = useState<WompiResumen | null>(null)
  const [rows, setRows] = useState<WompiTransaccion[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [diagnostico, setDiagnostico] = useState('')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detalle, setDetalle] = useState<WompiDetalle | null>(null)
  const [loadingDetalle, setLoadingDetalle] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('token')
    const raw = localStorage.getItem('user')
    if (!token || !raw) {
      router.push('/login')
      return
    }
    try {
      const user = JSON.parse(raw)
      if (String(user?.rol || '').toUpperCase() !== 'SUPER_ADMIN') {
        router.push('/mis-reportes')
        return
      }
      setAuthorized(true)
    } catch {
      router.push('/login')
    }
  }, [router])

  const cargar = useCallback(async () => {
    if (!authorized) return
    setLoading(true)
    setError('')
    try {
      const filtros = {
        q: search,
        status,
        diagnostico,
        fechaInicio,
        fechaFin,
        page,
        limit: 25,
      }
      const [list, summary] = await Promise.all([
        wompiAuditoriaApi.listar(filtros),
        wompiAuditoriaApi.resumen({ fechaInicio, fechaFin }),
      ])
      setRows(list.transacciones)
      setTotal(list.paginacion.total)
      setTotalPages(list.paginacion.totalPages)
      setResumen(summary)
    } catch (e: any) {
      setError(e.message || 'No se pudieron cargar las transacciones')
    } finally {
      setLoading(false)
    }
  }, [authorized, search, status, diagnostico, fechaInicio, fechaFin, page])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const buscar = (event: FormEvent) => {
    event.preventDefault()
    setPage(1)
    setSearch(q.trim())
  }

  const abrirDetalle = async (id: string) => {
    setLoadingDetalle(true)
    setError('')
    try {
      setDetalle(await wompiAuditoriaApi.detalle(id))
    } catch (e: any) {
      setError(e.message || 'No se pudo cargar el detalle')
    } finally {
      setLoadingDetalle(false)
    }
  }

  const sincronizar = async () => {
    if (!detalle || syncing) return
    const tx = detalle.transaccion
    const ok = window.confirm(
      `Se consultará directamente Wompi para ${tx.reference}.\n\n` +
        'Solo se marcará PAGADA si Wompi responde APPROVED y coinciden referencia, moneda y monto. ¿Continuar?'
    )
    if (!ok) return
    setSyncing(true)
    setError('')
    setNotice('')
    try {
      const fresh = await wompiAuditoriaApi.sincronizar(tx.id)
      setDetalle(fresh)
      setNotice(`Wompi consultado: estado ${fresh.transaccion.status}`)
      await cargar()
    } catch (e: any) {
      setError(e.message || 'No fue posible consultar Wompi')
    } finally {
      setSyncing(false)
    }
  }

  if (!authorized) {
    return <div className="py-24 text-center text-slate-500">Verificando acceso…</div>
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Transacciones Wompi</h1>
        <p className="text-sm text-slate-500">
          Auditoría de pagos, clientes, boletas y entrega. Exclusivo para SUPER_ADMIN.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi
          label="Recaudo aprobado"
          value={money(resumen?.total_aprobado || 0)}
          detail={`${resumen?.aprobadas || 0} pagos`}
          tone="green"
        />
        <Kpi
          label="Pendientes"
          value={resumen?.pendientes || 0}
          detail={money(resumen?.total_pendiente || 0)}
          tone="amber"
        />
        <Kpi
          label="Requieren revisión"
          value={resumen?.requieren_revision || 0}
          detail="Demorados o inconsistentes"
          tone={resumen?.requieren_revision ? 'red' : 'slate'}
        />
        <Kpi
          label="No aprobadas"
          value={resumen?.no_aprobadas || 0}
          detail="Declinadas, anuladas o error"
        />
        <Kpi
          label="Total"
          value={resumen?.total_transacciones || 0}
          detail={`Última: ${fecha(resumen?.ultima_transaccion)}`}
        />
      </div>

      <form
        onSubmit={buscar}
        className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-6"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Referencia, transacción, cliente, cédula o boleta"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 md:col-span-2"
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
        >
          <option value="">Todos los estados</option>
          <option value="APPROVED">Aprobados</option>
          <option value="PENDING">Pendientes</option>
          <option value="DECLINED">Declinados</option>
          <option value="VOIDED">Anulados</option>
          <option value="ERROR">Error</option>
        </select>
        <select
          value={diagnostico}
          onChange={(e) => {
            setDiagnostico(e.target.value)
            setPage(1)
          }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
        >
          <option value="">Todos los diagnósticos</option>
          <option value="PENDIENTE_REVISAR">Pendientes a revisar</option>
          <option value="APROBADO_SIN_ENTREGAR">Aprobados sin entregar</option>
          <option value="PAGADA_POR_OTRO_MEDIO">Pagados por otro medio</option>
          <option value="NO_APROBADO">No aprobados</option>
          <option value="OK">Correctos</option>
        </select>
        <input
          type="date"
          value={fechaInicio}
          onChange={(e) => {
            setFechaInicio(e.target.value)
            setPage(1)
          }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
        />
        <div className="flex gap-2">
          <input
            type="date"
            value={fechaFin}
            onChange={(e) => {
              setFechaFin(e.target.value)
              setPage(1)
            }}
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
          />
          <button className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700">
            Buscar
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="font-bold text-slate-900">Historial ({total})</h2>
          <button
            onClick={() => void cargar()}
            disabled={loading}
            className="text-sm font-semibold text-sky-600 disabled:opacity-50"
          >
            Actualizar
          </button>
        </div>
        {loading ? (
          <div className="p-12 text-center text-slate-500">Cargando transacciones…</div>
        ) : !rows.length ? (
          <div className="p-12 text-center text-slate-500">No hay resultados.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Fecha / referencia</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Boletas</th>
                  <th className="px-4 py-3">Monto</th>
                  <th className="px-4 py-3">Wompi</th>
                  <th className="px-4 py-3">Venta / entrega</th>
                  <th className="px-4 py-3">Diagnóstico</th>
                  <th className="px-4 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((tx) => {
                  const diag = diagnosticos[tx.diagnostico] || diagnosticos.OK
                  return (
                    <tr key={tx.id} className="border-t border-slate-100 align-top hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{fecha(tx.created_at)}</p>
                        <p className="mt-1 font-mono text-[11px] text-slate-500">{tx.reference}</p>
                        <p className="font-mono text-[10px] text-slate-400">
                          Tx: {tx.transaction_id || 'Sin ID'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{tx.cliente_nombre}</p>
                        <p className="text-xs text-slate-500">CC {tx.cliente_identificacion}</p>
                        <p className="text-xs text-slate-500">{tx.cliente_telefono || 'Sin teléfono'}</p>
                      </td>
                      <td className="px-4 py-3">
                        {tx.boletas.map((b) => (
                          <p key={b.id} className="whitespace-nowrap font-semibold text-slate-800">
                            {b.numeros.map(numberLabel).join(' · ')}
                          </p>
                        ))}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">{money(tx.amount)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-bold ${statusClass(tx.status)}`}>
                          {tx.status}
                        </span>
                        <p className="mt-2 text-[10px] text-slate-500">
                          Webhook: {tx.webhook_recibido ? 'Sí' : 'No'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-bold ${statusClass(tx.estado_venta === 'PAGADA' ? 'APPROVED' : 'PENDING')}`}>
                          {tx.estado_venta}
                        </span>
                        <p className="mt-2 text-[10px] text-slate-500">
                          Boletas: {tx.boletas.map((b) => b.estado).join(', ')}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-bold ${diag.className}`}>
                          {diag.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => void abrirDetalle(tx.id)}
                          className="font-semibold text-sky-600 hover:text-sky-800"
                        >
                          Ver completo
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-slate-500">
            Página {page} de {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      </div>

      {(detalle || loadingDetalle) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm">
          <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            {loadingDetalle ? (
              <div className="p-16 text-center text-slate-500">Cargando detalle…</div>
            ) : detalle ? (
              <>
                <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white px-5 py-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Detalle de transacción</h2>
                    <p className="font-mono text-xs text-slate-500">{detalle.transaccion.reference}</p>
                  </div>
                  <button
                    onClick={() => setDetalle(null)}
                    className="text-2xl leading-none text-slate-400 hover:text-slate-700"
                    aria-label="Cerrar"
                  >
                    ×
                  </button>
                </div>

                <div className="space-y-5 p-5">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                    <Kpi label="Estado Wompi" value={detalle.transaccion.status} detail={fecha(detalle.transaccion.confirmed_at)} />
                    <Kpi label="Venta" value={detalle.transaccion.estado_venta} detail={`Saldo ${money(detalle.transaccion.saldo_pendiente)}`} />
                    <Kpi label="Monto" value={money(detalle.transaccion.amount)} detail={detalle.transaccion.currency} />
                    <Kpi label="Webhook" value={detalle.transaccion.webhook_recibido ? 'Recibido' : 'No recibido'} detail={`Tx: ${detalle.transaccion.transaction_id || 'Sin ID'}`} />
                  </div>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <section className="rounded-xl border border-slate-200 p-4">
                      <h3 className="mb-3 font-bold text-slate-900">Cliente</h3>
                      <dl className="grid grid-cols-[110px_1fr] gap-2 text-sm">
                        <dt className="text-slate-500">Nombre</dt><dd className="font-medium">{detalle.transaccion.cliente_nombre}</dd>
                        <dt className="text-slate-500">Cédula</dt><dd>{detalle.transaccion.cliente_identificacion}</dd>
                        <dt className="text-slate-500">Teléfono</dt><dd>{detalle.transaccion.cliente_telefono || '—'}</dd>
                        <dt className="text-slate-500">Correo</dt><dd className="break-all">{detalle.transaccion.cliente_email || '—'}</dd>
                      </dl>
                    </section>
                    <section className="rounded-xl border border-slate-200 p-4">
                      <h3 className="mb-3 font-bold text-slate-900">Referencias</h3>
                      <dl className="space-y-2 text-sm">
                        <div><dt className="text-slate-500">Referencia comercio</dt><dd className="break-all font-mono">{detalle.transaccion.reference}</dd></div>
                        <div><dt className="text-slate-500">ID Wompi</dt><dd className="break-all font-mono">{detalle.transaccion.transaction_id || 'No registrado'}</dd></div>
                        <div><dt className="text-slate-500">ID venta</dt><dd className="break-all font-mono text-xs">{detalle.transaccion.venta_id}</dd></div>
                      </dl>
                    </section>
                  </div>

                  <section className="rounded-xl border border-slate-200 p-4">
                    <h3 className="mb-3 font-bold text-slate-900">Boletas entregadas</h3>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {detalle.boletas.map((b) => (
                        <div key={b.id} className="rounded-lg bg-slate-50 p-3">
                          <p className="font-bold text-slate-900">{b.numeros.map(numberLabel).join(' · ')}</p>
                          <p className="text-xs text-slate-500">
                            Principal {numberLabel(b.numero_principal)} · Estado {b.estado}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-xl border border-slate-200 p-4">
                    <h3 className="mb-3 font-bold text-slate-900">Línea de tiempo</h3>
                    <div className="space-y-3 border-l-2 border-slate-200 pl-4">
                      {detalle.timeline.map((item, index) => (
                        <div key={`${item.tipo}-${index}`} className="relative">
                          <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-sky-500" />
                          <p className="text-sm font-semibold text-slate-900">{item.titulo}</p>
                          <p className="text-xs text-slate-500">{fecha(item.fecha)} · {item.detalle}</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    <strong>Acción protegida:</strong> “Consultar Wompi” no permite elegir el estado.
                    Solo confirma la entrega si Wompi responde APPROVED y coinciden referencia,
                    moneda y monto.
                  </div>

                  <div className="flex flex-wrap justify-end gap-3">
                    <button
                      onClick={() => setDetalle(null)}
                      className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700"
                    >
                      Cerrar
                    </button>
                    <button
                      onClick={() => void sincronizar()}
                      disabled={syncing}
                      className="rounded-lg bg-sky-600 px-4 py-2 font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                    >
                      {syncing ? 'Consultando Wompi…' : 'Consultar Wompi ahora'}
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
