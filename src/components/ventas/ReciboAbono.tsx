'use client'

import { useRef } from 'react'
import { generarWhatsAppChatLink } from '@/utils/telefono'
import { WHATSAPP_VENTAS_ACTIVO } from '@/config/features'
import { formatBoletaNumeros } from '@/utils/formatBoletaNumeros'

// ─── Datos que necesita el recibo ───────────────────────────────────
export interface ReciboAbonoData {
  // Tipo de operación
  tipo: 'abono' | 'pago_total' | 'venta_nueva' | 'venta_abono'

  // Monto que se acaba de pagar
  montoRegistrado: number

  // Datos financieros de la venta
  totalVenta: number
  totalPagado: number    // total acumulado DESPUÉS de este pago
  saldoPendiente: number // saldo DESPUÉS de este pago

  // Cliente
  clienteNombre: string
  clienteTelefono?: string
  clienteEmail?: string
  clienteIdentificacion?: string

  // Rifa
  rifaNombre?: string

  // Método de pago usado
  metodoPago: string

  // Notas
  notas?: string

  // Boletas (con su estado actualizado)
  boletas: Array<{
    numero: number
    numeros?: number[]
    estado: string
    precioBoleta?: number
    totalPagado?: number
    saldoPendiente?: number
  }>

  // Fecha/hora del pago
  fechaPago?: Date

  // ID de la venta (para referencia)
  ventaId?: string
}

interface ReciboAbonoProps {
  data: ReciboAbonoData
  onClose: () => void
  onWhatsApp?: () => void // si se quiere manejar externamente
}

// ─── Helpers ────────────────────────────────────────────────────────
const formatoMoneda = (valor: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(valor)

const WHATSAPP_SVG = (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
)

// ─── Generador de link WhatsApp (chat vacío) ─────────────────────────
function generarWhatsAppLink(data: ReciboAbonoData): string | null {
  return generarWhatsAppChatLink(data.clienteTelefono)
}

// ─── Componente principal ───────────────────────────────────────────
export default function ReciboAbono({ data, onClose, onWhatsApp }: ReciboAbonoProps) {
  const reciboRef = useRef<HTMLDivElement>(null)
  const fecha = data.fechaPago || new Date()
  const whatsappLink = generarWhatsAppLink(data)
  const cuentaSaldada = data.saldoPendiente <= 0

  const handleImprimir = () => {
    const contenido = reciboRef.current
    if (!contenido) return

    const ventana = window.open('', '_blank', 'width=420,height=700')
    if (!ventana) return

    ventana.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Recibo de Pago</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            padding: 24px;
            max-width: 400px;
            margin: 0 auto;
            color: #1e293b;
          }
          .recibo-header {
            text-align: center;
            border-bottom: 2px dashed #cbd5e1;
            padding-bottom: 16px;
            margin-bottom: 16px;
          }
          .recibo-header h1 {
            font-size: 18px;
            font-weight: 700;
            margin-bottom: 4px;
          }
          .recibo-header .subtitulo {
            font-size: 12px;
            color: #64748b;
          }
          .recibo-header .fecha {
            font-size: 11px;
            color: #94a3b8;
            margin-top: 6px;
          }
          .seccion {
            margin-bottom: 14px;
          }
          .seccion-titulo {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            color: #64748b;
            letter-spacing: 0.5px;
            margin-bottom: 6px;
          }
          .fila {
            display: flex;
            justify-content: space-between;
            font-size: 13px;
            padding: 3px 0;
          }
          .fila .etiqueta { color: #475569; }
          .fila .valor { font-weight: 600; color: #1e293b; }
          .fila .valor.verde { color: #16a34a; }
          .fila .valor.rojo { color: #dc2626; }
          .fila .valor.naranja { color: #ea580c; }
          .monto-grande {
            text-align: center;
            font-size: 28px;
            font-weight: 800;
            color: #16a34a;
            padding: 12px 0;
            border: 2px solid #bbf7d0;
            border-radius: 12px;
            background: #f0fdf4;
            margin: 12px 0;
          }
          .badge-saldado {
            text-align: center;
            background: #dcfce7;
            color: #15803d;
            font-weight: 700;
            font-size: 14px;
            padding: 8px;
            border-radius: 8px;
            margin: 8px 0;
          }
          .badge-pendiente {
            text-align: center;
            background: #fff7ed;
            color: #c2410c;
            font-weight: 700;
            font-size: 14px;
            padding: 8px;
            border-radius: 8px;
            margin: 8px 0;
          }
          .boleta-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 12px;
            padding: 4px 8px;
            border-radius: 6px;
            margin-bottom: 3px;
          }
          .boleta-item.pagada { background: #f0fdf4; }
          .boleta-item.abonada { background: #fefce8; }
          .boleta-item.pendiente { background: #f1f5f9; }
          .separador {
            border-top: 1px dashed #e2e8f0;
            margin: 12px 0;
          }
          .pie {
            text-align: center;
            font-size: 11px;
            color: #94a3b8;
            margin-top: 20px;
            border-top: 2px dashed #cbd5e1;
            padding-top: 16px;
          }
          @media print {
            body { padding: 12px; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        ${contenido.innerHTML}
        <div class="pie">
          <p>Gracias por su pago</p>
          <p style="margin-top:4px;">Documento generado el ${fecha.toLocaleDateString('es-CO')} ${fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `)
    ventana.document.close()
  }

  const tituloRecibo = (() => {
    switch (data.tipo) {
      case 'pago_total': return '✅ Pago Total Registrado'
      case 'venta_nueva': return '🎫 Venta Completada'
      case 'venta_abono': return '🎫 Venta con Abono Creada'
      default: return '💰 Abono Registrado'
    }
  })()

  const subtituloRecibo = (() => {
    switch (data.tipo) {
      case 'pago_total': return 'La cuenta ha sido saldada completamente'
      case 'venta_nueva': return 'Pago completo — boletas entregadas'
      case 'venta_abono': return `Abono inicial de ${formatoMoneda(data.montoRegistrado)}`
      default: return `Se registró un abono de ${formatoMoneda(data.montoRegistrado)}`
    }
  })()

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[100dvh] sm:max-h-[95vh] my-auto">
        {/* ── Contenido imprimible ── */}
        <div ref={reciboRef} className="p-6 overflow-y-auto flex-1 min-h-0 overscroll-contain">
          {/* Header */}
          <div className="recibo-header text-center border-b-2 border-dashed border-slate-300 pb-4 mb-4">
            <h1 className="text-xl font-bold text-slate-900">RECIBO DE PAGO</h1>
            {data.rifaNombre && (
              <p className="text-sm text-slate-600 font-medium mt-1">{data.rifaNombre}</p>
            )}
            <p className="text-xs text-slate-400 mt-2">
              {fecha.toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              {' — '}
              {fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
            </p>
            {data.ventaId && (
              <p className="text-[10px] text-slate-400 mt-1 font-mono">
                Ref: {data.ventaId.substring(0, 8).toUpperCase()}
              </p>
            )}
          </div>

          {/* Ícono + título */}
          <div className="text-center mb-4">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-green-100 rounded-full mb-3">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-slate-900">{tituloRecibo}</h2>
            <p className="text-sm text-slate-600 mt-1">{subtituloRecibo}</p>
          </div>

          {/* Monto grande */}
          <div className="monto-grande text-center text-3xl font-extrabold text-green-600 py-3 border-2 border-green-200 rounded-xl bg-green-50 my-4">
            {formatoMoneda(data.montoRegistrado)}
          </div>

          {/* Datos del cliente */}
          <div className="seccion mb-4">
            <p className="seccion-titulo text-[11px] font-bold uppercase text-slate-500 tracking-wide mb-2">Cliente</p>
            <div className="bg-slate-50 rounded-lg p-3 space-y-1 text-sm">
              <div className="fila flex justify-between">
                <span className="etiqueta text-slate-600">Nombre:</span>
                <span className="valor font-semibold text-slate-900">{data.clienteNombre}</span>
              </div>
              {data.clienteTelefono && (
                <div className="fila flex justify-between">
                  <span className="etiqueta text-slate-600">Teléfono:</span>
                  <span className="valor font-semibold text-slate-900">{data.clienteTelefono}</span>
                </div>
              )}
              {data.clienteIdentificacion && (
                <div className="fila flex justify-between">
                  <span className="etiqueta text-slate-600">ID:</span>
                  <span className="valor font-semibold text-slate-900">{data.clienteIdentificacion}</span>
                </div>
              )}
              {data.clienteEmail && (
                <div className="fila flex justify-between">
                  <span className="etiqueta text-slate-600">Email:</span>
                  <span className="valor font-semibold text-slate-900 text-xs">{data.clienteEmail}</span>
                </div>
              )}
            </div>
          </div>

          {/* Detalle del pago */}
          <div className="seccion mb-4">
            <p className="seccion-titulo text-[11px] font-bold uppercase text-slate-500 tracking-wide mb-2">Detalle del Pago</p>
            <div className="bg-slate-50 rounded-lg p-3 space-y-1 text-sm">
              <div className="fila flex justify-between">
                <span className="etiqueta text-slate-600">Método de pago:</span>
                <span className="valor font-semibold text-slate-900">{data.metodoPago}</span>
              </div>
              <div className="fila flex justify-between">
                <span className="etiqueta text-slate-600">Monto pagado:</span>
                <span className="valor font-semibold text-green-600">{formatoMoneda(data.montoRegistrado)}</span>
              </div>
              {data.notas && (
                <div className="fila flex justify-between">
                  <span className="etiqueta text-slate-600">Notas:</span>
                  <span className="valor font-semibold text-slate-700 text-xs text-right max-w-[180px]">{data.notas}</span>
                </div>
              )}
            </div>
          </div>

          {/* Estado de cuenta */}
          <div className="seccion mb-4">
            <p className="seccion-titulo text-[11px] font-bold uppercase text-slate-500 tracking-wide mb-2">Estado de Cuenta</p>
            <div className="bg-slate-50 rounded-lg p-3 space-y-1.5 text-sm">
              <div className="fila flex justify-between">
                <span className="etiqueta text-slate-600">Total de la venta:</span>
                <span className="valor font-semibold text-slate-900">{formatoMoneda(data.totalVenta)}</span>
              </div>
              <div className="fila flex justify-between">
                <span className="etiqueta text-slate-600">Total pagado:</span>
                <span className="valor font-semibold text-green-600">{formatoMoneda(data.totalPagado)}</span>
              </div>
              <div className="separador border-t border-dashed border-slate-300 my-2" />
              <div className="fila flex justify-between">
                <span className="etiqueta text-slate-600 font-medium">Saldo pendiente:</span>
                <span className={`valor font-bold text-lg ${cuentaSaldada ? 'text-green-600' : 'text-red-600'}`}>
                  {cuentaSaldada ? '✅ $0 — Saldado' : formatoMoneda(data.saldoPendiente)}
                </span>
              </div>
            </div>
            {cuentaSaldada ? (
              <div className="badge-saldado text-center bg-green-100 text-green-800 font-bold text-sm py-2 rounded-lg mt-2">
                🎉 ¡Cuenta completamente saldada!
              </div>
            ) : (
              <div className="badge-pendiente text-center bg-orange-50 text-orange-800 font-bold text-sm py-2 rounded-lg mt-2">
                ⏳ Saldo pendiente: {formatoMoneda(data.saldoPendiente)}
              </div>
            )}
          </div>

          {/* Boletas */}
          {data.boletas.length > 0 && (
            <div className="seccion mb-2">
              <p className="seccion-titulo text-[11px] font-bold uppercase text-slate-500 tracking-wide mb-2">
                Boletas ({data.boletas.length})
              </p>
              <div className="space-y-1.5">
                {data.boletas.map((b, idx) => {
                  const pagada = b.estado === 'PAGADA' || (b.totalPagado && b.precioBoleta && b.totalPagado >= b.precioBoleta)
                  const abonada = !pagada && b.totalPagado && b.totalPagado > 0
                  return (
                    <div
                      key={idx}
                      className={`boleta-item flex justify-between items-center text-xs px-3 py-2 rounded-lg ${
                        pagada ? 'bg-green-50' : abonada ? 'bg-yellow-50' : 'bg-slate-50'
                      }`}
                    >
                      <span className="font-bold text-slate-800">
                        {formatBoletaNumeros(b.numeros, b.numero)}
                      </span>
                      <span className={`font-semibold ${
                        pagada ? 'text-green-700' : abonada ? 'text-yellow-700' : 'text-slate-500'
                      }`}>
                        {pagada
                          ? '✅ Pagada'
                          : abonada
                            ? `💰 ${formatoMoneda(b.totalPagado!)} / ${formatoMoneda(b.precioBoleta || 0)}`
                            : '🔒 Pendiente'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Botones de acción (NO se imprimen) ── */}
        <div className="no-print border-t border-slate-200 p-4 space-y-3 bg-slate-50 rounded-b-2xl flex-shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {/* Imprimir */}
          <button
            type="button"
            onClick={handleImprimir}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold transition-colors shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Imprimir Recibo
          </button>

          {/* WhatsApp */}
          {WHATSAPP_VENTAS_ACTIVO && whatsappLink && (
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onWhatsApp}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 font-semibold transition-colors shadow-sm"
            >
              {WHATSAPP_SVG}
              Abrir WhatsApp del cliente
            </a>
          )}

          {/* Cerrar / Continuar */}
          <button
            type="button"
            onClick={onClose}
            className="w-full flex items-center justify-center gap-2 px-5 py-2.5 border-2 border-slate-300 text-slate-700 rounded-xl hover:bg-slate-100 font-medium transition-colors"
          >
            Cerrar y continuar
          </button>
        </div>
      </div>
    </div>
  )
}
