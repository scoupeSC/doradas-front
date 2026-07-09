import { API_BASE_URL } from '@/config/api'
import {
  VentaPublicaListado,
  VentaPublicaDetalle,
  EstadisticasPublicas,
  EstadisticasPorRifa,
  ApiResponse
} from '@/types/ventasPublicas'

class VentasPublicasApiService {
  private baseUrl = `${API_BASE_URL}/api`

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('token')
        : null

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }

    if (token) {
      ;(headers as Record<string, string>)['Authorization'] =
        `Bearer ${token}`
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers
    })

    let data

    try {
      data = await response.json()
    } catch {
      throw new Error(
        `No se pudo parsear JSON. Status: ${response.status}`
      )
    }

    if (!response.ok) {
      throw new Error(data?.message || `Error: ${response.status}`)
    }

    return data
  }

  /**
   * Obtener todas las ventas públicas con filtros opcionales
   */
  async getVentasPublicas(
    estado?: string,
    rifaId?: string,
    clienteNombre?: string,
    clienteIdentificacion?: string
  ): Promise<ApiResponse<VentaPublicaListado[]>> {
    const params = new URLSearchParams()
    if (estado) params.append('estado', estado)
    if (rifaId) params.append('rifa_id', rifaId)
    if (clienteNombre) params.append('cliente_nombre', clienteNombre)
    if (clienteIdentificacion) params.append('cliente_identificacion', clienteIdentificacion)

    const query = params.toString()
    const endpoint = `/admin/dashboard/ventas-publicas${query ? `?${query}` : ''}`

    return this.request<VentaPublicaListado[]>(endpoint)
  }

  /**
   * Obtener solo ventas públicas pendientes y abonadas
   */
  async getVentasPublicasPendientes(
    clienteNombre?: string,
    clienteIdentificacion?: string
  ): Promise<
    ApiResponse<VentaPublicaListado[]>
  > {
    const params = new URLSearchParams()
    if (clienteNombre) params.append('cliente_nombre', clienteNombre)
    if (clienteIdentificacion) params.append('cliente_identificacion', clienteIdentificacion)
    const qs = params.toString()
    return this.request<VentaPublicaListado[]>(
      `/admin/dashboard/ventas-publicas/pendientes${qs ? `?${qs}` : ''}`
    )
  }

  /**
   * Obtener detalles completos de una venta pública
   */
  async getDetalleVentaPublica(
    ventaId: string
  ): Promise<ApiResponse<VentaPublicaDetalle>> {
    return this.request<VentaPublicaDetalle>(
      `/admin/dashboard/ventas-publicas/${ventaId}`
    )
  }

  /**
   * Confirmar pago manual de un abono
   */
  async confirmarPagoAbono(
    abonoId: string
  ): Promise<ApiResponse<{ abono_id: string; venta_id: string }>> {
    return this.request(
      `/admin/dashboard/abonos/${abonoId}/confirmar`,
      {
        method: 'POST'
      }
    )
  }

  /**
   * Cancelar una venta pública
   */
  async cancelarVentaPublica(
    ventaId: string,
    motivo?: string
  ): Promise<ApiResponse<{ venta_id: string }>> {
    return this.request(
      `/admin/dashboard/ventas-publicas/${ventaId}/cancelar`,
      {
        method: 'POST',
        body: JSON.stringify({ motivo })
      }
    )
  }

  /**
   * Marcar venta como revisada (SIN_REVISAR → PENDIENTE)
   */
  async marcarVentaRevisada(
    ventaId: string
  ): Promise<ApiResponse<{ venta_id: string }>> {
    return this.request(
      `/admin/dashboard/ventas-publicas/${ventaId}/marcar-revisada`,
      {
        method: 'POST'
      }
    )
  }

  /**
   * 🔔 Obtener SOLO ventas SIN_REVISAR (para banner de notificación)
   */
  async getVentasSinRevisar(): Promise<
    ApiResponse<VentaPublicaListado[]>
  > {
    return this.request<VentaPublicaListado[]>(
      `/admin/dashboard/ventas-publicas/sin-revisar`
    )
  }

  /**
   * 🎫 Obtener todas las boletas reservadas (online + punto físico)
   */
  async getBoletasReservadas(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>('/admin/dashboard/boletas-reservadas')
  }

  /**
   * 🔓 Liberar manualmente una boleta reservada
   */
  async liberarBoleta(boletaId: string): Promise<ApiResponse<any>> {
    return this.request(`/admin/dashboard/boletas-reservadas/${boletaId}/liberar`, {
      method: 'POST'
    })
  }

  /**
   * 🔓 Liberar TODAS las boletas de una venta
   */
  async liberarBoletasDeVenta(ventaId: string): Promise<ApiResponse<any>> {
    return this.request(`/admin/dashboard/boletas-reservadas/venta/${ventaId}/liberar`, {
      method: 'POST'
    })
  }

  /**
   * Obtener estadísticas generales de ventas públicas
   */
  async getEstadisticasPublicas(): Promise<
    ApiResponse<EstadisticasPublicas>
  > {
    return this.request<EstadisticasPublicas>(
      '/admin/dashboard/estadisticas'
    )
  }

  /**
   * Obtener estadísticas por rifa
   */
  async getEstadisticasPorRifa(): Promise<
    ApiResponse<EstadisticasPorRifa[]>
  > {
    return this.request<EstadisticasPorRifa[]>(
      '/admin/dashboard/estadisticas/por-rifa'
    )
  }
}

export const ventasPublicasApi = new VentasPublicasApiService()
