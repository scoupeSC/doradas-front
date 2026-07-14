// Módulo de Ventas Públicas desde Web Externa

export interface ClientePublico {
  nombre: string
  telefono: string
  email?: string
  identificacion?: string
  direccion?: string
}

export interface BoletaPublica {
  boleta_id: string
  numero: number
  numeros?: number[]
  estado: string
  precio_boleta?: number
  total_pagado_boleta?: number
  saldo_pendiente_boleta?: number
  qr_url?: string
  imagen_url?: string
}

export interface AbonoPublico {
  id: string
  venta_id: string
  boleta_id: string
  monto: number
  moneda: string
  estado: 'REGISTRADO' | 'CONFIRMADO' | 'ANULADO'
  notas?: string
  created_at: string
  boleta_numero: number
  medio_pago_nombre: string
}

export interface VentaPublicaDetalle {
  id: string
  rifa_id: string
  cliente_id: string
  monto_total: number
  abono_total: number
  saldo_pendiente: number
  estado_venta: 'SIN_REVISAR' | 'PENDIENTE' | 'ABONADA' | 'PAGADA' | 'CANCELADA'
  medio_pago_id: string
  created_at: string
  updated_at: string
  cliente_nombre: string
  cliente_telefono: string
  cliente_email?: string
  cliente_identificacion?: string
  cliente_direccion?: string
  rifa_nombre: string
  precio_boleta: number
  medio_pago_nombre: string
  boletas: BoletaPublica[]
  abonos_pendientes: AbonoPublico[]
}

export interface VentaPublicaListado {
  id: string
  rifa_id: string
  cliente_id: string
  monto_total: number
  abono_total: number
  saldo_pendiente: number
  estado_venta: string
  medio_pago_id: string
  created_at: string
  cliente_nombre: string
  cliente_telefono: string
  cliente_email?: string
  cliente_identificacion?: string
  rifa_nombre: string
  cantidad_boletas: number
  numeros_boletas?: number[]
}

export interface EstadisticasPublicas {
  total_ventas: number
  ventas_pagadas: number
  ventas_abonadas: number
  ventas_pendientes: number
  ventas_sin_revisar: number
  total_abonado: number
  total_venta: number
  saldo_pendiente_total: number
}

export interface EstadisticasPorRifa {
  id: string
  rifa_nombre: string
  total_ventas_publicas: number
  total_abonado: number
  total_venta: number
  clientes_unicos: number
}

export interface ApiResponse<T> {
  success: boolean
  message?: string
  data?: T
  count?: number
}
