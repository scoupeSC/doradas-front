const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api'

/** Origen del backend sin sufijo /api (las rutas ya incluyen /api/...) */
export const API_BASE_URL = rawApiUrl.replace(/\/api\/?$/, '')
