import { API_BASE_URL } from '@/config/api'

class UploadApiService {
  private baseUrl = `${API_BASE_URL}/api`

  async uploadImagen(file: File): Promise<{ ok: boolean; url: string }> {
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('token')
        : null

    if (!token) {
      throw new Error('No hay token de autenticación')
    }

    const formData = new FormData()
    formData.append('imagen', file)

    const response = await fetch(`${this.baseUrl}/uploads/imagen`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        errorData.message || `Error al subir imagen: ${response.statusText}`
      )
    }

    const data = await response.json()
    
    if (!data.ok) {
      throw new Error(data.message || 'Error al subir imagen')
    }

    return data
  }
}

export const uploadApi = new UploadApiService()
