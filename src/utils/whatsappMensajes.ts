/**
 * Mensajes de WhatsApp para clientes — tono humano, marca Rifas Doradas, boletas en pacha.
 */
import { formatBoletaNumeros } from '@/utils/formatBoletaNumeros'
import { getMediosDePagoTexto } from '@/config/paymentInfo'

export const LINK_CONSULTA_BOLETAS = 'https://elgrancamion.com/boletas'

const fmt = (value: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)

/** Etiqueta de una boleta siempre como pacha (ambos números). */
export function formatPacha(
  numeros: number[] | null | undefined,
  fallback?: number | null
): string {
  return `Pacha ${formatBoletaNumeros(numeros, fallback)}`
}

/** Lista de pachas unidas, p.ej. "Pacha #0001 · #0002, Pacha #0003 · #0004" */
export function formatPachasList(
  items: Array<{ numeros?: number[] | null; numero?: number | null }>
): string {
  if (!items.length) return ''
  return items.map((b) => formatPacha(b.numeros, b.numero)).join(', ')
}

/**
 * Si solo hay un array plano de números (2 por pacha), agrupa de a 2.
 * Si no cuadra en pares, formatea todo junto como una pacha.
 */
export function formatPachasDesdeNumerosPlanos(
  numeros: number[],
  cantidadBoletas?: number
): string {
  const flat = numeros.map(Number)
  const n = Number(cantidadBoletas) || 0
  if (n > 0 && flat.length === n * 2) {
    const labels: string[] = []
    for (let i = 0; i < flat.length; i += 2) {
      labels.push(formatPacha([flat[i], flat[i + 1]]))
    }
    return labels.join(', ')
  }
  if (flat.length >= 2 && flat.length % 2 === 0) {
    const labels: string[] = []
    for (let i = 0; i < flat.length; i += 2) {
      labels.push(formatPacha([flat[i], flat[i + 1]]))
    }
    return labels.join(', ')
  }
  return formatPacha(flat)
}

function cierreConsulta(): string {
  return `Si quieres ver tus números cuando quieras:\n${LINK_CONSULTA_BOLETAS}`
}

function bloquePago(): string {
  return getMediosDePagoTexto()
}

/** Recordatorio genérico de saldo / pachas pendientes */
export function mensajeRecordatorioPendiente(opts: {
  nombre: string
  lineasDetalle: string[]
  deudaTotal?: number
}): string {
  const nombre = opts.nombre || 'amigo/a'
  let msg = `Hola ${nombre} 👋\n\n`
  msg += `Te escribimos de *Rifas Doradas*. Queríamos recordarte que aún tienes pachas pendientes:\n\n`

  if (opts.lineasDetalle.length) {
    msg += opts.lineasDetalle.join('\n')
    msg += `\n\n`
  }

  if (opts.deudaTotal && opts.deudaTotal > 0) {
    msg += `En total te quedan pendientes *${fmt(opts.deudaTotal)}*.\n\n`
  }

  msg += `${bloquePago()}\n\n`
  msg += `Cuando puedas, envíanos el comprobante por aquí y te la dejamos al día 🙌\n\n`
  msg += cierreConsulta()
  return msg
}

/** Línea de detalle por boleta/pacha para recordatorios */
export function lineaPachaPendiente(opts: {
  estado: string
  numeros?: number[] | null
  numero?: number | null
  saldo: number
  abono?: number
  precio?: number
}): string {
  const pacha = formatPacha(opts.numeros, opts.numero)
  if (opts.estado === 'RESERVADA') {
    return `  • ${pacha} — reservada, te falta ${fmt(opts.saldo)}`
  }
  if (opts.estado === 'ABONADA') {
    const abono = opts.abono ?? 0
    const precio = opts.precio ?? 0
    return `  • ${pacha} — llevas ${fmt(abono)} de ${fmt(precio)}, te faltan ${fmt(opts.saldo)}`
  }
  return `  • ${pacha} — ${opts.estado}`
}

/** Confirmación de reserva nueva (venta pública SIN_REVISAR) */
export function mensajeReservaRecibida(opts: {
  nombre: string
  rifaNombre: string
  pachas: string
  montoTotal: number
}): string {
  const nombre = opts.nombre || 'amigo/a'
  let msg = `Hola ${nombre} 👋\n\n`
  msg += `Somos de *Rifas Doradas*. Ya quedó tu reserva en *${opts.rifaNombre}*:\n\n`
  msg += `🎟️ Tus pachas: *${opts.pachas}*\n`
  msg += `💵 Total: *${fmt(opts.montoTotal)}*\n\n`
  msg += `Para ir participando en los premios, ve abonando cuando puedas. Si tienes duda de cuánto te falta, escríbenos.\n\n`
  msg += `${bloquePago()}\n\n`
  msg += `Envíanos el comprobante por este chat y te lo confirmamos de una 🙌\n\n`
  msg += cierreConsulta()
  return msg
}

/** Recordatorio saldo en venta abonada */
export function mensajeSaldoPendienteVenta(opts: {
  nombre: string
  rifaNombre: string
  pachas: string
  saldo: number
  montoTotal: number
  abonado: number
}): string {
  const nombre = opts.nombre || 'amigo/a'
  let msg = `Hola ${nombre} 👋\n\n`
  msg += `Te escribimos de *Rifas Doradas*. Te quedó un saldo de *${fmt(opts.saldo)}* en *${opts.rifaNombre}*.\n\n`
  msg += `🎟️ Tus pachas: *${opts.pachas}*\n`
  msg += `Total: ${fmt(opts.montoTotal)} · Ya llevas: ${fmt(opts.abonado)}\n\n`
  msg += `${bloquePago()}\n\n`
  msg += `Cuando abones, manda el comprobante por aquí y lo dejamos registrado 🙌\n\n`
  msg += cierreConsulta()
  return msg
}

/** Recordatorio pago pendiente (venta PENDIENTE) */
export function mensajePagoPendienteVenta(opts: {
  nombre: string
  rifaNombre: string
  pachas: string
  saldo: number
}): string {
  const nombre = opts.nombre || 'amigo/a'
  let msg = `Hola ${nombre} 👋\n\n`
  msg += `Te escribimos de *Rifas Doradas*. Te recordamos el pago pendiente de *${fmt(opts.saldo)}* en *${opts.rifaNombre}*.\n\n`
  msg += `🎟️ Tus pachas: *${opts.pachas}*\n\n`
  msg += `${bloquePago()}\n\n`
  msg += `Cuando pagues, envíanos el comprobante por este chat 🙌\n\n`
  msg += cierreConsulta()
  return msg
}

/** Confirmación de abono / pago registrado */
export function mensajeConfirmacionAbono(opts: {
  nombre: string
  rifaNombre: string
  montoAbonado: number
  montoTotal: number
  nuevoPagado: number
  nuevoSaldo: number
  lineasPachas: string[]
  cuentaSaldada: boolean
}): string {
  const nombre = opts.nombre || 'amigo/a'
  let msg = ''

  if (opts.cuentaSaldada) {
    msg += `Hola ${nombre} 👋\n\n`
    msg += `¡Listo! En *Rifas Doradas* ya quedó registrado tu pago de *${fmt(opts.montoAbonado)}* 🎉\n\n`
    msg += `*Tu cuenta en ${opts.rifaNombre}:*\n`
    msg += `💵 Total: ${fmt(opts.montoTotal)}\n`
    msg += `✅ Pagado: ${fmt(opts.nuevoPagado)}\n`
    msg += `🎉 *¡Quedaste al día!*\n`
    if (opts.lineasPachas.length) {
      msg += `\n*Tus pachas:*\n${opts.lineasPachas.join('\n')}\n`
    }
    msg += `\nMucha suerte 🍀\n\n`
    msg += cierreConsulta()
  } else {
    msg += `Hola ${nombre} 👋\n\n`
    msg += `En *Rifas Doradas* ya quedó tu abono de *${fmt(opts.montoAbonado)}* ✅\n\n`
    msg += `*Tu cuenta en ${opts.rifaNombre}:*\n`
    msg += `💵 Total: ${fmt(opts.montoTotal)}\n`
    msg += `✅ Pagado: ${fmt(opts.nuevoPagado)}\n`
    msg += `⏳ Te falta: *${fmt(opts.nuevoSaldo)}*\n`
    if (opts.lineasPachas.length) {
      msg += `\n*Tus pachas:*\n${opts.lineasPachas.join('\n')}\n`
    }
    msg += `\nGracias por confiar en nosotros 🙌\n\n`
    msg += cierreConsulta()
  }

  return msg
}

/** Comprobante de venta (analytics) */
export function mensajeComprobanteVenta(opts: {
  nombre: string
  tipoLabel: string
  pachas: string
  montoTotal: number
  totalPagado: number
  saldoPendiente: number
}): string {
  const nombre = opts.nombre || 'amigo/a'
  let msg = `Hola ${nombre} 👋\n\n`
  msg += `Te enviamos el detalle de tu compra en *Rifas Doradas*:\n\n`
  msg += `📋 Tipo: ${opts.tipoLabel}\n`
  msg += `🎟️ Pachas: ${opts.pachas}\n`
  msg += `💵 Total: ${fmt(opts.montoTotal)}\n`
  msg += `✅ Pagado: ${fmt(opts.totalPagado)}\n`
  if (opts.saldoPendiente > 0) {
    msg += `⏳ Pendiente: ${fmt(opts.saldoPendiente)}\n`
  }
  msg += `\n¡Gracias por participar! 🙌\n\n`
  msg += cierreConsulta()
  return msg
}

/** Comprobante de abono (analytics) */
export function mensajeComprobanteAbono(opts: {
  nombre: string
  monto: number
  pachas: string
  montoTotal: number
  abonoTotal: number
  saldoPendiente: number
}): string {
  const nombre = opts.nombre || 'amigo/a'
  let msg = `Hola ${nombre} 👋\n\n`
  msg += `Confirmamos tu abono en *Rifas Doradas*:\n\n`
  msg += `💵 Abonaste: ${fmt(opts.monto)}\n`
  msg += `🎟️ Pachas: ${opts.pachas}\n`
  msg += `Total de la venta: ${fmt(opts.montoTotal)}\n`
  msg += `✅ Llevas pagado: ${fmt(opts.abonoTotal)}\n`
  if (opts.saldoPendiente > 0) {
    msg += `⏳ Te falta: ${fmt(opts.saldoPendiente)}\n`
  }
  msg += `\n¡Gracias! 🙌\n\n`
  msg += cierreConsulta()
  return msg
}

/** Cliente confirma su propia reserva (página pública) */
export function mensajeClienteConfirmaReserva(opts: {
  nombre: string
  telefono: string
  pachas: string
  montoTotal: number
}): string {
  return (
    `Hola, soy ${opts.nombre}. Confirmé mi reserva en *Rifas Doradas*.\n` +
    `Tel: ${opts.telefono}\n` +
    `Pachas: ${opts.pachas}\n` +
    `Total: ${fmt(opts.montoTotal)}`
  )
}
