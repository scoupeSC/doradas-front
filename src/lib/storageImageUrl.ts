/**
 * Convierte una URL de imagen del storage del backend a una URL absoluta
 * apuntando al backend en producción o al proxy local de Next.js.
 * Acepta: URL completa con /storage/, URL con otro path, o solo nombre de archivo.
 */
const IMAGE_EXT = /\.(jpe?g|png|gif|webp)(\?|#|$)/i

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '') ||
  'http://localhost:3000'

export function getStorageImageUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string' || !url.trim()) return null
  const trimmed = url.trim()

  // Ya es URL absoluta completa al backend
  if (trimmed.startsWith(BACKEND_URL)) return trimmed

  // Extraer solo el nombre del archivo de cualquier formato
  let filename: string | null = null

  // URL completa que contiene /storage/ -> extraer filename
  if (trimmed.includes('/storage/')) {
    const match = trimmed.match(/\/storage\/([^?#]+)/)
    if (match) filename = match[1]
  }

  // URL completa (http(s)://...) -> extraer último segmento del path
  if (!filename && /^https?:\/\//i.test(trimmed)) {
    try {
      const pathname = new URL(trimmed).pathname
      const lastSegment = pathname.replace(/^\/+/, '').split('/').pop()
      if (lastSegment && IMAGE_EXT.test(lastSegment)) filename = lastSegment
    } catch {
      // URL mal formada
    }
  }

  // Ruta same-origin tipo /storage/xxx
  if (!filename && trimmed.startsWith('/storage/')) {
    filename = trimmed.replace('/storage/', '')
  }

  // Solo nombre de archivo (ej. "rifa-1771619173811.jpeg")
  if (!filename && !trimmed.includes('/') && IMAGE_EXT.test(trimmed)) {
    filename = trimmed
  }

  // Path relativo tipo "storage/xxx" o "/uploads/xxx.jpeg"
  if (!filename) {
    const pathSegment = trimmed.replace(/^\/+/, '').split('/').pop()
    if (pathSegment && IMAGE_EXT.test(pathSegment)) filename = pathSegment
  }

  // Construir URL absoluta al backend
  if (filename) return `${BACKEND_URL}/storage/${filename}`

  return trimmed
}
