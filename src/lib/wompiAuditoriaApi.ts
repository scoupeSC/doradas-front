import { API_BASE_URL } from '@/config/api'

const BASE = `${API_BASE_URL}/api/superadmin/wompi`

export type WompiStatus = 'PENDING' | 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR'
export type WompiDiagnostico =
  | 'OK'
  | 'APROBADO_SIN_ENTREGAR'
  | 'PAGADA_POR_OTRO_MEDIO'
  | 'PENDIENTE_REVISAR'
  | 'NO_APROBADO'

export interface WompiBoleta {
  id: string
  numero: number
  numero_principal: number
  estado: string
  numeros: number[]
  bloqueo_hasta?: string | null
  updated_at?: string
}

export interface WompiTransaccion {
  id: string
  reference: string
  transaction_id: string | null
  status: WompiStatus
  amount: number
  currency: string
  created_at: string
  confirmed_at: string | null
  webhook_recibido: boolean
  respuesta_wompi: boolean
  venta_id: string
  estado_venta: string
  monto_total: number
  abono_total: number
  saldo_pendiente: number
  es_venta_online: boolean
  cliente_id: string
  cliente_nombre: string
  cliente_identificacion: string
  cliente_telefono: string | null
  cliente_email: string | null
  rifa_nombre: string
  boletas: WompiBoleta[]
  diagnostico: WompiDiagnostico
}

export interface WompiResumen {
  total_transacciones: number
  aprobadas: number
  pendientes: number
  no_aprobadas: number
  requieren_revision: number
  total_aprobado: number
  total_pendiente: number
  ultima_transaccion: string | null
}

export interface WompiDetalle {
  transaccion: WompiTransaccion & {
    referencia_pago: string | null
    gateway_pago: string | null
    venta_created_at: string
    venta_updated_at: string
  }
  boletas: WompiBoleta[]
  abonos: Array<{
    id: string
    boleta_id: string | null
    monto: number
    estado: string
    referencia: string | null
    gateway_pago: string | null
    medio_pago: string | null
    created_at: string
  }>
  timeline: Array<{
    tipo: string
    fecha: string
    titulo: string
    detalle: string
  }>
  seguridad: Record<string, boolean>
}

export interface WompiFiltros {
  q?: string
  status?: string
  diagnostico?: string
  fechaInicio?: string
  fechaFin?: string
  page?: number
  limit?: number
}

function headers() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 90000)
  try {
    const res = await fetch(url, { ...init, headers: headers(), signal: controller.signal })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || json.success === false) {
      throw new Error(json.message || 'Error consultando transacciones Wompi')
    }
    return json.data as T
  } finally {
    clearTimeout(timer)
  }
}

function queryString(filtros: WompiFiltros) {
  const params = new URLSearchParams()
  Object.entries(filtros).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value))
    }
  })
  return params.toString()
}

export const wompiAuditoriaApi = {
  listar(filtros: WompiFiltros) {
    return request<{
      transacciones: WompiTransaccion[]
      paginacion: { page: number; limit: number; total: number; totalPages: number }
    }>(`${BASE}?${queryString(filtros)}`)
  },

  resumen(filtros: Pick<WompiFiltros, 'fechaInicio' | 'fechaFin'> = {}) {
    return request<WompiResumen>(`${BASE}/resumen?${queryString(filtros)}`)
  },

  detalle(id: string) {
    return request<WompiDetalle>(`${BASE}/${id}`)
  },

  sincronizar(id: string) {
    return request<WompiDetalle>(`${BASE}/${id}/sincronizar`, { method: 'POST', body: '{}' })
  },
}
