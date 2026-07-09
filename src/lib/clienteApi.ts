import { API_BASE_URL } from '@/config/api'
import { 
  Cliente, 
  ClienteCreateRequest, 
  ClienteUpdateRequest, 
  ClienteListResponse, 
  ClienteResponse, 
  ClienteCreateResponse,
  ClienteDetalleResponse,
  ClienteFiltroEstado,
  ApiError 
} from '@/types/cliente'

class ClienteApiService {
  private getAuthHeaders() {
    const token = localStorage.getItem('token')
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    }
  }

  private async fetchWithTimeout(
    input: string,
    init: RequestInit = {},
    timeoutMs = 60000
  ): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await fetch(input, { ...init, signal: controller.signal })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error('El servidor tardó demasiado en responder. Intenta de nuevo.')
      }
      throw err
    } finally {
      clearTimeout(timer)
    }
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    const data = await response.json()
    
    if (!response.ok) {
      if (data.error === 'Validation Error' && data.details) {
        const validationErrors = data.details.map((detail: any) => 
          `${detail.field}: ${detail.message}`
        ).join(', ')
        throw new Error(validationErrors)
      }
      throw new Error(data.message || `HTTP error! status: ${response.status}`)
    }
    
    return data
  }

  async createCliente(clienteData: ClienteCreateRequest): Promise<ClienteCreateResponse> {
    const response = await fetch(`${API_BASE_URL}/api/clientes`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(clienteData)
    })
    return this.handleResponse<ClienteCreateResponse>(response)
  }

  async getClientes(
    page: number = 1,
    limit: number = 10,
    search: string = '',
    filtro: ClienteFiltroEstado = 'todos'
  ): Promise<ClienteListResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      filtro,
      ...(search && { search })
    })
    
    const response = await this.fetchWithTimeout(`${API_BASE_URL}/api/clientes?${params}`, {
      headers: this.getAuthHeaders()
    })
    return this.handleResponse<ClienteListResponse>(response)
  }

  async getClienteById(id: string): Promise<ClienteResponse> {
    const response = await fetch(`${API_BASE_URL}/api/clientes/${id}`, {
      headers: this.getAuthHeaders()
    })
    return this.handleResponse<ClienteResponse>(response)
  }

  async getClienteByIdentificacion(identificacion: string): Promise<ClienteResponse> {
    const response = await fetch(`${API_BASE_URL}/api/clientes/identificacion/${identificacion}`, {
      headers: this.getAuthHeaders()
    })
    return this.handleResponse<ClienteResponse>(response)
  }

  async updateCliente(id: string, clienteData: ClienteUpdateRequest): Promise<ClienteResponse> {
    const response = await fetch(`${API_BASE_URL}/api/clientes/${id}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(clienteData)
    })
    return this.handleResponse<ClienteResponse>(response)
  }

  async deleteCliente(id: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE_URL}/api/clientes/${id}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    })
    return this.handleResponse<{ success: boolean; message: string }>(response)
  }

  async getClienteDetalle(id: string): Promise<ClienteDetalleResponse> {
    const response = await this.fetchWithTimeout(`${API_BASE_URL}/api/clientes/${id}/detalle`, {
      headers: this.getAuthHeaders()
    })
    return this.handleResponse<ClienteDetalleResponse>(response)
  }

  async getNextIdentificacion(): Promise<{ success: boolean; data: { identificacion: string } }> {
    const response = await fetch(`${API_BASE_URL}/api/clientes/next-identificacion`, {
      headers: this.getAuthHeaders()
    })
    return this.handleResponse<{ success: boolean; data: { identificacion: string } }>(response)
  }
}

export const clienteApi = new ClienteApiService()
