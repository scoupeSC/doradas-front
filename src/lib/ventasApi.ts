import { API_BASE_URL } from '@/config/api'
import {
  ApiResponse,
  BoletaDisponible,
  BoletaBloqueada,
  BloqueoVerificacion,
  Cliente,
  ClienteSimilar,
  VentaRequest,
  VentaResponse,
  RifaStats,
  ReservaRequest,
  ReservaResponse,
  ConvertirReservaRequest,
  ConvertirReservaResponse,
  CancelarReservaRequest,
  CancelarReservaResponse
} from '@/types/ventas'

class VentasApiService {
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
      headers,
      signal: AbortSignal.timeout(60000),
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
      let serverMessage =
        data?.message || data?.error || data?.errors || response.statusText

      if (response.status === 423 || data?.error === 'SISTEMA_EN_PAUSA') {
        serverMessage =
          'El sistema está en pausa. Ve a Proyectos y reactiva el proyecto (estado ACTIVA) para poder vender boletas.'
      }

      if (data?.details && Array.isArray(data.details)) {
        const fieldErrors = data.details.map((d: any) => `${d.field}: ${d.message}`).join('; ')
        serverMessage = `${serverMessage} (${fieldErrors})`
      }

      // Errores de negocio esperados (ej. boleta ya bloqueada): no usar console.error
      // porque en Next.js/dev dispara el overlay de error.
      const expectedCodes = new Set([
        'BOLETA_ALREADY_BLOCKED',
        'BOLETA_ALREADY_SOLD',
        'SISTEMA_EN_PAUSA',
      ])
      const isExpected =
        expectedCodes.has(data?.error) ||
        response.status === 409 ||
        (response.status === 400 && typeof data?.error === 'string')

      if (!isExpected) {
        console.warn('[VentasAPI] Request failed:', {
          endpoint,
          status: response.status,
          message: serverMessage,
        })
      }

      const error = new Error(
        typeof serverMessage === 'string'
          ? serverMessage
          : `API Error ${response.status}`
      ) as any
      error.response = { data, status: response.status }
      error.code = data?.error
      throw error
    }

    return data
  }

  // ---------------- BOLETAS ----------------

  async getBoletasDisponibles(rifaId: string) {
    return this.request<any[]>(`/boletas/rifa/${rifaId}/disponibles`)
  }

  async buscarBoletaPorNumero(rifaId: string, numero: number) {
    return this.request<{
      id: string
      numero: number
      numeros?: number[]
      numero_principal?: number | null
      estado: string
      disponible: boolean
      bloqueada?: boolean
      bloqueo_hasta?: string | null
      cliente_nombre?: string | null
      cliente_identificacion?: string | null
      qr_url?: string
      barcode?: string
      imagen_url?: string
    } | null>(`/boletas/rifa/${rifaId}/buscar?numero=${numero}`)
  }

  async bloquearBoleta(
    boletaId: string,
    tiempoBloqueo = 15,
    numeroPrincipal?: number | null
  ) {
    return this.request<BoletaBloqueada>(
      `/boletas/${boletaId}/block`,
      {
        method: 'POST',
        body: JSON.stringify({
          tiempo_bloqueo: tiempoBloqueo,
          ...(numeroPrincipal != null ? { numero_principal: numeroPrincipal } : {}),
        })
      }
    )
  }

  async verificarBloqueo(
    boletaId: string,
    reservaToken: string
  ) {
    return this.request<BloqueoVerificacion>(
      `/boletas/${boletaId}/check-block?reserva_token=${reservaToken}`
    )
  }

  async desbloquearBoleta(
    boletaId: string,
    reservaToken: string
  ) {
    return this.request<{ boleta_id: string }>(
      `/boletas/${boletaId}/unblock`,
      {
        method: 'POST',
        body: JSON.stringify({
          reserva_token: reservaToken
        })
      }
    )
  }

  async actualizarEstadoBoleta(
    boletaId: string,
    estado: string,
    clienteId?: string,
    ventaId?: string
  ) {
    return this.request<any>(`/boletas/${boletaId}`, {
      method: 'PUT',
      body: JSON.stringify({
        estado,
        cliente_id: clienteId,
        venta_id: ventaId
      })
    })
  }

  async getBoletaDetalle(boletaId: string) {
    return this.request<any>(`/boletas/${boletaId}`)
  }

  // ---------------- VENTAS ----------------

  async crearVenta(ventaData: VentaRequest) {
    return this.request<VentaResponse>(`/ventas`, {
      method: 'POST',
      body: JSON.stringify(ventaData)
    })
  }

  async getVentasPorRifa(rifaId: string) {
    return this.request<VentaResponse[]>(
      `/ventas/rifa/${rifaId}`
    )
  }

  async getRifaStats(rifaId: string) {
    return this.request<RifaStats>(
      `/boletas/rifa/${rifaId}/stats`
    )
  }

  async getVentasPorCliente(clienteId: string) {
    // Backend: GET /ventas/cliente/:clienteId → { success, data: [{ id, monto_total, estado_venta, created_at, total_pagado, saldo_pendiente }] }
    return this.request<
      {
        id: number
        monto_total: number
        estado_venta: string
        created_at: string
        total_pagado: number
        saldo_pendiente: number
      }[]
    >(`/ventas/cliente/${clienteId}`)
  }

  // ---------------- CLIENTES ----------------

  async buscarClientes(query: string) {
  return this.request<Cliente[]>(
    `/clientes?search=${encodeURIComponent(query)}`
  )
}

  async buscarClientesSimilares(query: string, rifaId?: string) {
    const params = new URLSearchParams({
      q: query,
      limit: '8'
    })
    if (rifaId) {
      params.set('rifa_id', rifaId)
    }
    return this.request<ClienteSimilar[]>(`/clientes/similares?${params.toString()}`)
  }

  async buscarClientePorCedula(cedula: string) {
    return this.request<Cliente>(
      `/clientes/cedula/${cedula}`
    )
  }

  async crearCliente(cliente: Cliente) {
    return this.request<{ cliente: Cliente }>(
      `/clientes`,
      {
        method: 'POST',
        body: JSON.stringify(cliente)
      }
    )
  }

  async getNextIdentificacion() {
    return this.request<{ identificacion: string }>(
      `/clientes/next-identificacion`
    )
  }

  async getClienteById(clienteId: string) {
    return this.request<Cliente>(
      `/clientes/${clienteId}`
    )
  }

  async actualizarCliente(
    clienteId: string,
    cliente: Partial<Cliente>
  ) {
    return this.request<Cliente>(
      `/clientes/${clienteId}`,
      {
        method: 'PUT',
        body: JSON.stringify(cliente)
      }
    )
  }

  // ---------------- BLOQUEO PERIÓDICO ----------------

async verificarBloqueoPeriodico(
  boletaId: string,
  reservaToken: string,
  callback: (valid: boolean) => void,
  intervalo: number = 30000
): Promise<NodeJS.Timeout> {

  const intervalId = setInterval(async () => {
    try {
      const response = await this.verificarBloqueo(
        boletaId,
        reservaToken
      )

      const isValid =
        response.data.valid && !response.data.expired

      callback(isValid)

      if (!isValid) {
        clearInterval(intervalId)
      }

    } catch (error: any) {
      console.error('Error verificando bloqueo:', error)

      // 🚨 SI ES 404 → DETENER LOOP
      if (error.message.includes('404')) {
        clearInterval(intervalId)
      }

      callback(false)
    }
  }, intervalo)

  return intervalId
}


async liberarBloqueosMultiples(
  boletas: { id: string; reserva_token: string }[]
) {
  return this.request(`/boletas/unblock-multiple`, {
    method: 'POST',
    body: JSON.stringify({ boletas })
  })
}
  // ---------------- BUSCAR VENTA Pagina Gestionar ----------------

  async buscarBoletaParaAbono(numero: number, rifaId?: string) {
    let url = `/ventas/buscar-boleta-abono?numero=${numero}`
    if (rifaId) url += `&rifa_id=${rifaId}`
    return this.request<any>(url)
  }

  async buscarVenta(query: string) {
    return this.request<VentaResponse[]>(
      `/ventas/search?q=${encodeURIComponent(query)}`
    )
  }

  async getVentaById(ventaId: string) {
    // Backend: GET /ventas/:id → { success, data: venta }
    return this.request<any>(`/ventas/${ventaId}`)
  }

  /** Detalle financiero de la venta (cliente + abonos + saldo) para módulo Gestionar */
  async getVentaDetalleFinanciero(ventaId: string) {
    // Backend: GET /ventas/:id/detalle-financiero → { success, data: { ...venta, nombre, telefono, total_pagado, saldo_pendiente, abonos[] } }
    return this.request<any>(`/ventas/${ventaId}/detalle-financiero`)
  }

  // ---------------- ABONOS ----------------

  async registrarAbono(
    ventaId: string,
    data: { monto: number; metodo_pago: string; notas?: string; boleta_id?: string; boletas_abono?: Array<{ boleta_id: string; monto: number }> }
  ) {
    // Validar y limpiar datos antes de enviar
    const montoNum = Number(data.monto)
    if (isNaN(montoNum) || montoNum <= 0) {
      throw new Error('El monto debe ser un número mayor a 0')
    }

    const metodoPago = (data.metodo_pago || 'efectivo').trim()
    if (!metodoPago) {
      throw new Error('El método de pago es requerido')
    }

    // Construir payload sin valores undefined/null
    const payload: Record<string, any> = {
      monto: montoNum,
      metodo_pago: metodoPago
    }

    // Solo agregar notas si tiene contenido
    if (data.notas && typeof data.notas === 'string' && data.notas.trim()) {
      payload.notas = data.notas.trim()
    }

    // Multi-boleta: enviar array de boletas con montos individuales
    if (data.boletas_abono && data.boletas_abono.length > 0) {
      payload.boletas_abono = data.boletas_abono
    }
    // Abono a boleta individual (modo legacy)
    else if (data.boleta_id) {
      payload.boleta_id = data.boleta_id
    }
    
    return this.request<{
      message: string
      venta: VentaResponse
    }>(`/ventas/${ventaId}/abonos`, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  }

  // ============ RESERVAS ============

  async crearReserva(reservaData: ReservaRequest) {
    return this.request<ReservaResponse>(`/ventas/reservar`, {
      method: 'POST',
      body: JSON.stringify({
        rifa_id: reservaData.rifa_id,
        cliente: {
          nombre: reservaData.cliente.nombre,
          telefono: reservaData.cliente.telefono,
          email: reservaData.cliente.email,
          identificacion: reservaData.cliente.identificacion,
          direccion: reservaData.cliente.direccion
        },
        boletas: reservaData.boletas,
        dias_bloqueo: reservaData.dias_bloqueo || 5,
        notas: reservaData.notas
      })
    })
  }

  async convertirReserva(
    reservaId: string,
    convertirData: ConvertirReservaRequest
  ) {
    return this.request<ConvertirReservaResponse>(
      `/ventas/${reservaId}/convertir-reserva`,
      {
        method: 'POST',
        body: JSON.stringify(convertirData)
      }
    )
  }

  async cancelarReserva(
    reservaId: string,
    cancelarData: CancelarReservaRequest
  ) {
    return this.request<CancelarReservaResponse>(
      `/ventas/${reservaId}/cancelar-reserva`,
      {
        method: 'POST',
        body: JSON.stringify(cancelarData)
      }
    )
  }

  async obtenerReserva(reservaId: string) {
    return this.request<ReservaResponse>(`/ventas/${reservaId}`)
  }

  async listarReservasActivas(rifaId?: string) {
    const endpoint = rifaId
      ? `/ventas/reservas/activas?rifa_id=${rifaId}`
      : `/ventas/reservas/activas`
    return this.request<ReservaResponse[]>(endpoint)
  }

}

export const ventasApi = new VentasApiService()
