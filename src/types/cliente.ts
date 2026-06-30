export interface Cliente {
  id: string
  nombre: string
  telefono: string
  email: string
  identificacion: string
  direccion: string
  created_at: string
  updated_at: string
  // Summary fields from enhanced list query
  total_boletas?: number
  boletas_pagadas?: number
  boletas_reservadas?: number
  boletas_abonadas?: number
  deuda_total?: number
}

export interface ClienteCreateRequest {
  nombre: string
  telefono: string
  email: string
  identificacion: string
  direccion: string
}

export interface ClienteUpdateRequest {
  nombre?: string
  telefono?: string
  email?: string
  direccion?: string
}

export type ClienteFiltroEstado = 'todos' | 'con_boletas' | 'pagadas' | 'reservadas' | 'abonadas'

export interface ClienteResumenFiltros {
  todos: number
  con_boletas: number
  pagadas: number
  reservadas: number
  abonadas: number
}

export interface ClienteListResponse {
  success: boolean
  data: Cliente[]
  rifa_actual?: {
    id: string
    nombre: string
    estado: string
  } | null
  resumen_filtros?: ClienteResumenFiltros
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface ClienteResponse {
  success: boolean
  data: Cliente
}

export interface ClienteCreateResponse {
  success: boolean
  message: string
  data: Cliente
}

export interface ApiError {
  error: string
  message: string
  details?: Array<{
    field: string
    message: string
  }>
}

// ===== Client Detail Types =====

export interface BoletaDetalle {
  boleta_id: string
  numero: number
  estado: 'DISPONIBLE' | 'RESERVADA' | 'ABONADA' | 'PAGADA' | 'TRANSFERIDA' | 'ANULADA'
  precio_unitario: number
  abono: number
  saldo: number
  venta_id: string | null
  estado_venta: string | null
  created_at: string
}

export interface RifaResumen {
  total: number
  pagadas: number
  reservadas: number
  abonadas: number
  anuladas: number
  deuda: number
  abonado: number
}

export interface RifaConBoletas {
  rifa_id: string
  rifa_nombre: string
  rifa_estado: string
  rifa_imagen: string | null
  precio_boleta: number
  boletas: BoletaDetalle[]
  resumen: RifaResumen
}

export interface AbonoHistorial {
  abono_id: string
  monto: number
  estado: string
  referencia: string | null
  notas: string | null
  abono_fecha: string
  gateway_pago: string | null
  medio_pago_nombre: string | null
  rifa_nombre: string | null
  boleta_numero: number | null
  venta_id: string
}

export interface ClienteDetalleResumen {
  total_boletas: number
  pagadas: number
  reservadas: number
  abonadas: number
  anuladas: number
  total_deuda: number
  total_abonado: number
  total_pagado: number
}

export interface ClienteDetalleResponse {
  success: boolean
  data: {
    cliente: Cliente
    rifa_actual?: {
      id: string
      nombre: string
      estado: string
    } | null
    resumen: ClienteDetalleResumen
    rifas: RifaConBoletas[]
    resumen_pasadas?: ClienteDetalleResumen
    rifas_pasadas?: RifaConBoletas[]
    abonos: AbonoHistorial[]
  }
}
