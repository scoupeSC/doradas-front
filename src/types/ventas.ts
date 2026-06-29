// Módulo de Ventas y Bloqueo de Boletas

export interface BoletaDisponible {
  id: string
  numero: number
  estado: 'DISPONIBLE'
  qr_url: string
  barcode: string
  imagen_url?: string
  rifa_nombre: string
  rifa_id: string
  precio?: number
}

export interface BoletaBloqueada {
  boleta_id: string
  reserva_token: string
  bloqueo_hasta: string
  tiempo_bloqueo_minutos: number
}

export interface BloqueoVerificacion {
  found: boolean
  valid: boolean
  expired: boolean
  reserva_token?: string
  bloqueo_hasta?: string
}

export interface Cliente {
  id?: string
  nombre: string
  telefono: string
  email?: string
  direccion?: string
  identificacion?: string
}

export interface ClienteBoletaHistorial {
  numero: number
  estado: string
  rifa_nombre: string
  rifa_estado: string
  rifa_id?: string
  es_actual?: boolean
  fue_liberada?: boolean
  total_abonado?: number
  estado_venta?: string | null
  resumen_pago?: string
}

export interface ClienteSimilar extends Cliente {
  id: string
  score?: number
  boletas: ClienteBoletaHistorial[]
}

export interface BoletaEnCarrito {
  id: string
  numero: number
  precio: number
  reserva_token: string
  bloqueo_hasta: string
  qr_url: string
  barcode: string
  imagen_url?: string
}

export interface VentaRequest {
  rifa_id: string
  cliente: Cliente
  boletas: Array<{
    id: string
    reserva_token: string
  }>
  
  medio_pago_id: string
  total_venta: number
  total_pagado?: number
  notas?: string
  abonos_por_boleta?: Array<{
    boleta_id: string
    monto: number
  }>
}

export interface VentaResponse {
  id: string
  rifa_id: string
  cliente_id: string
  cliente_nombre: string
  cliente_telefono: string
  cliente_email?: string
  monto_total: string
  saldo_pendiente?: number
  estado_venta: 'COMPLETADA' | 'PENDIENTE' | 'CANCELADA'
  total_venta: number
  total_pagado?: number
  metodo_pago: string
  notas?: string
  boletas_vendidas: number
  boletas?: Array<{
    id: string
    numero: number
    qr_url: string
    imagen_url?: string
  }>
  created_at: string
  updated_at: string
}

export interface BoletasDisponiblesResponse {
  boletas: BoletaDisponible[]
  rifa: {
    id: string
    nombre: string
    premio: string
    precio_boleta: number
    total_boletas: number
  }
}

export interface RifaStats {
  total_boletas: number
  boletas_vendidas: number
  boletas_disponibles: number
  boletas_bloqueadas: number
  total_ventas: number
  total_recaudado: number
}

export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
}

// Tipos para WebSocket
export interface WebSocketEvent {
  type: string
  data: any
  timestamp: string
}

export interface BoletaBloqueadaEventData {
  boleta_id: string
  numero: number
  bloqueado_por: string
  bloqueo_hasta: string
}

export interface BoletaDesbloqueadaEventData extends BoletaBloqueadaEventData {}

export interface BoletaVendidaEventData {
  boleta_id: string
  numero: number
  vendida_a: string
  venta_id: string
}

// Alias para compatibilidad con código existente
export type BoletaBloqueadaEvent = BoletaBloqueadaEventData
export type BoletaVendidaEvent = BoletaVendidaEventData

// Tipos para abonos y pagos parciales
export interface Abono {
  id: string
  venta_id: string
  monto: number
  metodo_pago: string
  fecha_abono: string
  notas?: string
  creado_por: string
}

export interface VentaConAbonos extends VentaResponse {
  abonos: Abono[]
  proximo_vencimiento?: string
  dias_restantes?: number
}
// Tipos para Reservas
export interface ReservaRequest {
  rifa_id: string
  cliente: Cliente
  boletas: string[] // Array de IDs de boletas
  dias_bloqueo?: number // Opcional, default 5
  notas?: string
}

export interface BolataReservada {
  id: string
  numero: number
}

export interface ReservaResponse {
  reserva_id: string
  tipo: 'RESERVA_FORMAL'
  rifa_titulo: string
  cantidad_boletas: number
  dias_bloqueo: number
  bloqueo_hasta: string
  estado_venta: 'PENDIENTE'
  monto_total: number
  boletas_reservadas: BolataReservada[]
  cliente_id?: string
  cliente_nombre?: string
  created_at?: string
}

export interface ConvertirReservaRequest {
  monto_total: number
  total_pagado: number
  medio_pago_id: string
}

export interface ConvertirReservaResponse {
  venta_id: string
  tipo: 'VENTA_CONVERTIDA'
  cantidad_boletas: number
  monto_total: number
  total_pagado: number
  saldo_pendiente: number
  estado_venta: 'ABONADA' | 'COMPLETADA'
}

export interface CancelarReservaRequest {
  motivo: string
}

export interface CancelarReservaResponse {
  reserva_id: string
  boletas_liberadas: number
  estado_venta: 'CANCELADA'
  motivo: string
}