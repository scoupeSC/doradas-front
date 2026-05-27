import { API_BASE_URL } from '@/config/api'

export interface BoletaSeguimiento {
  boleta_id: string
  numero: number
  estado: 'RESERVADA' | 'ABONADA' | 'PAGADA' | 'DISPONIBLE'
  rifa_id: string
  rifa_nombre: string
  precio_boleta: number
  abono_total: number
  saldo_pendiente: number
  boleta_created_at: string
  fecha_venta: string | null
  es_venta_online: boolean
  vendedor_nombre: string | null
}

export interface ClienteSeguimiento {
  cliente_id: string
  nombre: string
  telefono: string
  email: string
  identificacion: string
  cliente_created_at: string
  total_notificaciones: number
  ultima_notificacion: string | null
  total_contactos: number
  ultimo_contacto: string | null
  boletas: BoletaSeguimiento[]
}

export interface SeguimientoListResponse {
  success: boolean
  clientes: ClienteSeguimiento[]
  paginacion: {
    page: number
    limit: number
    total: number
    total_pages: number
  }
}

export type EstadoBoleta = 'todas' | 'RESERVADA' | 'ABONADA' | 'PAGADA'
export type FiltroNotificado = 'todos' | 'si' | 'no'

class SeguimientoClientesApiService {
  private getAuthHeaders() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    }
  }

  private async handleResponse<T>(res: Response): Promise<T> {
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.message || `HTTP ${res.status}`)
    }
    return data
  }

  async getSeguimiento(params: {
    page?: number
    limit?: number
    search?: string
    estadoBoleta?: EstadoBoleta
    notificado?: FiltroNotificado
    rifaId?: string
    abonoMin?: number
    abonoMax?: number
  }): Promise<SeguimientoListResponse> {
    const q = new URLSearchParams()
    if (params.page)                    q.set('page',         String(params.page))
    if (params.limit)                   q.set('limit',        String(params.limit))
    if (params.search)                  q.set('search',       params.search)
    if (params.estadoBoleta)            q.set('estadoBoleta', params.estadoBoleta)
    if (params.notificado)              q.set('notificado',   params.notificado)
    if (params.rifaId)                  q.set('rifaId',       params.rifaId)
    if (params.abonoMin !== undefined)  q.set('abonoMin',     String(params.abonoMin))
    if (params.abonoMax !== undefined)  q.set('abonoMax',     String(params.abonoMax))

    const res = await fetch(`${API_BASE_URL}/api/reportes/seguimiento-clientes?${q}`, {
      headers: this.getAuthHeaders(),
    })
    return this.handleResponse<SeguimientoListResponse>(res)
  }

  async registrarContacto(clienteId: string, nota?: string): Promise<{
    total_contactos: number
    ultimo_contacto: string
  }> {
    const res = await fetch(
      `${API_BASE_URL}/api/reportes/seguimiento-clientes/${encodeURIComponent(clienteId)}/contacto`,
      {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ nota: nota ?? null }),
      }
    )
    return this.handleResponse(res)
  }
}

export const seguimientoClientesApi = new SeguimientoClientesApiService()
