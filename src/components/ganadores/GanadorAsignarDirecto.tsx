'use client'

import { useEffect, useState } from 'react'
import { API_BASE_URL } from '@/config/api'

interface ClienteForm {
  nombre: string
  telefono: string
  email: string
  direccion: string
  identificacion: string
}

interface RifaOption {
  id: string
  nombre: string
  precio_boleta: string | number
}

interface UsuarioOption {
  id: string
  nombre: string
  rol: string
}

const MEDIOS_PAGO = [
  { id: 'd397d917-c0d0-4c61-b2b3-2ebfab7deeb7', nombre: 'Efectivo' },
  { id: 'af6e15fc-c52c-4491-abe1-20243af301c4', nombre: 'Nequi' },
  { id: 'daviplata', nombre: 'Daviplata' },
  { id: 'db94562d-bb01-42a3-9414-6e369a1a70ba', nombre: 'PSE' },
]

const ROL_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  VENDEDOR: 'Vendedor',
}

function toDatetimeLocalValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function GanadorAsignarDirecto() {
  const [rifas, setRifas] = useState<RifaOption[]>([])
  const [usuarios, setUsuarios] = useState<UsuarioOption[]>([])
  const [rifaId, setRifaId] = useState('')
  const [numeroBoleta, setNumeroBoleta] = useState('')
  const [cliente, setCliente] = useState<ClienteForm>({
    nombre: '', telefono: '', email: '', direccion: '', identificacion: '',
  })
  const [fechaVenta, setFechaVenta] = useState(toDatetimeLocalValue(new Date()))
  const [realizadoPor, setRealizadoPor] = useState('')
  const [medioPagoId, setMedioPagoId] = useState(MEDIOS_PAGO[0].id)
  const [alertaBoleta, setAlertaBoleta] = useState<string | null>(null)
  const [boletaDisponible, setBoletaDisponible] = useState<boolean | null>(null)
  const [validando, setValidando] = useState(false)
  const [asignando, setAsignando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState<string | null>(null)

  const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('token')
    const res = await fetch(`${API_BASE_URL}/api${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || `Error ${res.status}`)
    return data
  }

  useEffect(() => {
    const load = async () => {
      try {
        const [rifasRes, usuariosRes] = await Promise.all([
          apiRequest('/rifas/operativas?estado=ACTIVA'),
          apiRequest('/ventas/ganadores/usuarios'),
        ])
        const rifasList = rifasRes.data || []
        setRifas(rifasList)
        if (rifasList.length > 0) setRifaId(rifasList[0].id)
        const users = usuariosRes.data || []
        setUsuarios(users)
        const userData = localStorage.getItem('user')
        if (userData) {
          const parsed = JSON.parse(userData)
          if (parsed.id && users.some((u: UsuarioOption) => u.id === parsed.id)) {
            setRealizadoPor(parsed.id)
          } else if (users.length > 0) {
            setRealizadoPor(users[0].id)
          }
        }
      } catch {
        setError('Error cargando proyectos o usuarios')
      }
    }
    load()
  }, [])

  const rifaSeleccionada = rifas.find((r) => r.id === rifaId)
  const precioBoleta = rifaSeleccionada ? Number(rifaSeleccionada.precio_boleta) : 0

  const validarBoleta = async () => {
    const num = parseInt(numeroBoleta, 10)
    if (!rifaId || Number.isNaN(num) || num < 0) {
      setAlertaBoleta(null)
      setBoletaDisponible(null)
      return
    }
    setValidando(true)
    setAlertaBoleta(null)
    setBoletaDisponible(null)
    try {
      const data = await apiRequest(
        `/ventas/ganadores/buscar-boleta?numero=${num}&rifa_id=${rifaId}`
      )
      const result = data.data
      if (!result.encontrada) {
        setAlertaBoleta('Boleta no encontrada en este proyecto')
        setBoletaDisponible(false)
        return
      }
      if (result.disponible) {
        setBoletaDisponible(true)
        setAlertaBoleta(null)
        return
      }
      const estado = (result.boleta?.estado || '').toUpperCase()
      setBoletaDisponible(false)
      if (estado === 'PAGADA') {
        setAlertaBoleta('⚠️ Esta boleta está PAGADA. No se puede asignar como ganador.')
      } else if (estado === 'ABONADA') {
        setAlertaBoleta('⚠️ Esta boleta está ABONADA. No se puede asignar como ganador.')
      } else if (estado === 'RESERVADA') {
        setAlertaBoleta('⚠️ Esta boleta está RESERVADA. Debe estar DISPONIBLE para asignar.')
      } else {
        setAlertaBoleta(`⚠️ Boleta no disponible (estado: ${estado})`)
      }
    } catch (err: unknown) {
      setAlertaBoleta(err instanceof Error ? err.message : 'Error validando boleta')
      setBoletaDisponible(false)
    } finally {
      setValidando(false)
    }
  }

  const limpiarFormulario = () => {
    setNumeroBoleta('')
    setCliente({ nombre: '', telefono: '', email: '', direccion: '', identificacion: '' })
    setFechaVenta(toDatetimeLocalValue(new Date()))
    setAlertaBoleta(null)
    setBoletaDisponible(null)
    setMedioPagoId(MEDIOS_PAGO[0].id)
  }

  const asignarDirecto = async () => {
    const num = parseInt(numeroBoleta, 10)
    if (!rifaId) { setError('Selecciona un proyecto'); return }
    if (Number.isNaN(num) || num < 0) { setError('Número de boleta inválido'); return }
    if (!cliente.nombre.trim()) { setError('El nombre es requerido'); return }
    if (!cliente.telefono.trim()) { setError('El teléfono es requerido'); return }
    if (!realizadoPor) { setError('Selecciona quién realizó la venta'); return }
    if (!fechaVenta) { setError('La fecha de venta es requerida'); return }

    if (boletaDisponible === false) {
      setError(alertaBoleta?.replace(/^⚠️\s*/, '') || 'La boleta no está disponible')
      return
    }

    setError('')
    setExito(null)
    setAsignando(true)
    try {
      const data = await apiRequest('/ventas/ganadores/asignar-directo', {
        method: 'POST',
        body: JSON.stringify({
          rifa_id: rifaId,
          numero_boleta: num,
          cliente: {
            nombre: cliente.nombre.trim().toUpperCase(),
            telefono: cliente.telefono.trim(),
            email: cliente.email.trim() || null,
            direccion: cliente.direccion.trim() || null,
            identificacion: cliente.identificacion.trim() || null,
          },
          medio_pago_id: medioPagoId,
          realizado_por: realizadoPor,
          fecha_venta: new Date(fechaVenta).toISOString(),
        }),
      })
      setExito(
        `🏆 ${data.data.cliente_nombre} — Boleta #${String(data.data.boleta_numero).padStart(4, '0')} PAGADA`
      )
      limpiarFormulario()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al asignar ganador'
      setError(msg)
      if (msg.includes('PAGADA') || msg.includes('ABONADA') || msg.includes('RESERVADA')) {
        setAlertaBoleta(`⚠️ ${msg}`)
        setBoletaDisponible(false)
      }
    } finally {
      setAsignando(false)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          {error}
        </div>
      )}

      {exito && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
          {exito}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-1">Asignar Directo</h2>
        <p className="text-sm text-slate-500 mb-5">
          Asigna una boleta <strong>DISPONIBLE</strong> como ganador con pago completo (PAGADA).
          Solo se permite si la boleta no está abonada ni pagada.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Proyecto *</label>
            <select
              value={rifaId}
              onChange={(e) => { setRifaId(e.target.value); setBoletaDisponible(null); setAlertaBoleta(null) }}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
            >
              {rifas.map((r) => (
                <option key={r.id} value={r.id}>{r.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Número de boleta *</label>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                max={9999}
                value={numeroBoleta}
                onChange={(e) => { setNumeroBoleta(e.target.value); setBoletaDisponible(null); setAlertaBoleta(null) }}
                onBlur={validarBoleta}
                placeholder="Ej: 3128"
                className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
              />
              <button
                type="button"
                onClick={validarBoleta}
                disabled={validando || !numeroBoleta}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-medium text-slate-700 disabled:opacity-50"
              >
                {validando ? '…' : 'Verificar'}
              </button>
            </div>
          </div>
        </div>

        {alertaBoleta && (
          <div className="mb-4 bg-amber-50 border-2 border-amber-300 text-amber-900 px-4 py-3 rounded-xl text-sm font-semibold">
            {alertaBoleta}
          </div>
        )}

        {boletaDisponible === true && (
          <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2 rounded-xl text-sm font-medium">
            ✅ Boleta DISPONIBLE — precio: ${precioBoleta.toLocaleString('es-CO')} (quedará PAGADA)
          </div>
        )}

        <h4 className="text-sm font-semibold text-slate-700 mb-3 mt-6">Datos del cliente</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Nombre *</label>
            <input type="text" value={cliente.nombre} onChange={(e) => setCliente((p) => ({ ...p, nombre: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Teléfono *</label>
            <input type="text" value={cliente.telefono} onChange={(e) => setCliente((p) => ({ ...p, telefono: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Cédula</label>
            <input type="text" value={cliente.identificacion} onChange={(e) => setCliente((p) => ({ ...p, identificacion: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
            <input type="email" value={cliente.email} onChange={(e) => setCliente((p) => ({ ...p, email: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-500 mb-1">Dirección</label>
            <input type="text" value={cliente.direccion} onChange={(e) => setCliente((p) => ({ ...p, direccion: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400" />
          </div>
        </div>

        <h4 className="text-sm font-semibold text-slate-700 mb-3">Datos de la venta</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Fecha de registro de venta *</label>
            <input
              type="datetime-local"
              value={fechaVenta}
              onChange={(e) => setFechaVenta(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Realizado por (admin/vendedor) *</label>
            <select
              value={realizadoPor}
              onChange={(e) => setRealizadoPor(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
            >
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre} ({ROL_LABELS[u.rol] || u.rol})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Medio de pago *</label>
            <select
              value={medioPagoId}
              onChange={(e) => setMedioPagoId(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
            >
              {MEDIOS_PAGO.map((mp) => (
                <option key={mp.id} value={mp.id}>{mp.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Monto (pago completo)</label>
            <input
              type="text"
              readOnly
              value={precioBoleta > 0 ? `$ ${precioBoleta.toLocaleString('es-CO')}` : '—'}
              className="w-full px-3 py-2.5 border border-slate-100 rounded-xl text-sm bg-slate-50 text-slate-700 font-semibold"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={asignarDirecto}
          disabled={asignando || boletaDisponible === false}
          className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl text-sm font-semibold hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center gap-2"
        >
          {asignando ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Asignando…
            </>
          ) : (
            <>🏆 Asignar ganador (PAGADA completa)</>
          )}
        </button>
      </div>
    </div>
  )
}
