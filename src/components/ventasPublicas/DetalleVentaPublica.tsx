'use client'

import { VentaPublicaDetalle, AbonoPublico } from '@/types/ventasPublicas'
import { useState } from 'react'
import { ventasPublicasApi } from '@/lib/ventasPublicasApi'
import { ventasApi } from '@/lib/ventasApi'
import ReciboAbono, { ReciboAbonoData } from '@/components/ventas/ReciboAbono'
import { formatearInputPesos, parsearInputPesos } from '@/utils/formatPesos'
import { normalizarTelefono } from '@/utils/telefono'
import { getMediosDePagoTexto } from '@/config/paymentInfo'

interface DetalleVentaPublicaProps {
  venta: VentaPublicaDetalle
  onBack: () => void
  onVentaCancelada?: () => void
  onAbonoConfirmado?: (abonoId: string) => void
}

const MEDIOS_PAGO = [
  { id: 'efectivo', label: '💵 Efectivo' },
  { id: 'transferencia', label: '🏦 PSE' },
]

export default function DetalleVentaPublica({
  venta,
  onBack,
  onVentaCancelada,
  onAbonoConfirmado
}: DetalleVentaPublicaProps) {
  const [abonoEnConfirmacion, setAbonoEnConfirmacion] = useState<string | null>(
    null
  )
  const [ventaEnCancelacion, setVentaEnCancelacion] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)

  // Estado para registrar abono/pago
  const [mostrarFormAbono, setMostrarFormAbono] = useState(false)
  const [montoAbono, setMontoAbono] = useState<number>(0)
  const [metodoPago, setMetodoPago] = useState<string>('')
  const [notasAbono, setNotasAbono] = useState('')
  const [pagarTodo, setPagarTodo] = useState(false)
  const [procesandoAbono, setProcesandoAbono] = useState(false)
  const [marcandoRevisada, setMarcandoRevisada] = useState(false)
  const [exitoAbonoMonto, setExitoAbonoMonto] = useState<number | null>(null)
  const [reciboData, setReciboData] = useState<ReciboAbonoData | null>(null)

  // Estado para abono por boleta individual
  const [abonarBoleta, setAbonarBoleta] = useState<{
    boletaId: string
    boletaNumero: number
    saldoPendiente: number
  } | null>(null)

  // Estado para abono múltiple por boleta (modo multi)
  const [modoMultiBoleta, setModoMultiBoleta] = useState(false)
  const [abonosPorBoleta, setAbonosPorBoleta] = useState<Record<string, number>>({})

  const formatoMoneda = (valor: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(valor)
  }

  const getEstadoBadgeColor = (estado: string) => {
    switch (estado) {
      case 'PAGADA':
        return 'bg-green-100 text-green-800'
      case 'ABONADA':
        return 'bg-yellow-100 text-yellow-800'
      case 'PENDIENTE':
        return 'bg-blue-100 text-blue-800'
      case 'SIN_REVISAR':
        return 'bg-purple-100 text-purple-800'
      case 'CANCELADA':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-slate-100 text-slate-800'
    }
  }

  const getEstadoAbonoBadgeColor = (estado: string) => {
    switch (estado) {
      case 'CONFIRMADO':
        return 'bg-green-100 text-green-800'
      case 'REGISTRADO':
        return 'bg-orange-100 text-orange-800'
      case 'ANULADO':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-slate-100 text-slate-800'
    }
  }

  const handleConfirmarPago = async (abonoId: string) => {
    try {
      setError(null)
      setExito(null)
      setAbonoEnConfirmacion(abonoId)

      const response = await ventasPublicasApi.confirmarPagoAbono(abonoId)

      if (!response.success) {
        throw new Error(response.message || 'Error confiriendo pago')
      }

      setExito('✅ Pago confirmado correctamente')
      setAbonoEnConfirmacion(null)

      if (onAbonoConfirmado) {
        onAbonoConfirmado(abonoId)
      }

      // Recargar los datos después de 1.5s
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (err: any) {
      setError(err.message)
      setAbonoEnConfirmacion(null)
    }
  }

  const handleCancelarVenta = async () => {
    if (!window.confirm('¿Deseas cancelar esta venta? Se liberarán todas las boletas')) {
      return
    }

    try {
      setError(null)
      setExito(null)
      setVentaEnCancelacion(true)

      const response = await ventasPublicasApi.cancelarVentaPublica(
        venta.id,
        'Cancelada desde dashboard'
      )

      if (!response.success) {
        throw new Error(response.message || 'Error cancelando venta')
      }

      setExito('✅ Venta cancelada y boletas liberadas')
      setVentaEnCancelacion(false)

      if (onVentaCancelada) {
        onVentaCancelada()
      }

      // Volver a la lista después de 1.5s
      setTimeout(() => {
        onBack()
      }, 1500)
    } catch (err: any) {
      setError(err.message)
      setVentaEnCancelacion(false)
    }
  }

  const handleRegistrarAbono = async () => {
    const montoValidado = Number(montoAbono)
    if (isNaN(montoValidado) || montoValidado <= 0) {
      setError('El monto debe ser un número mayor a 0')
      return
    }

    // Validar contra saldo de boleta individual o saldo general
    const saldoMax = abonarBoleta ? abonarBoleta.saldoPendiente : venta.saldo_pendiente
    if (montoValidado > saldoMax) {
      setError(`El monto no puede superar el saldo pendiente${abonarBoleta ? ` de la boleta #${abonarBoleta.boletaNumero.toString().padStart(4, '0')}` : ''}`)
      return
    }
    if (!metodoPago || metodoPago.trim() === '') {
      setError('Debe seleccionar un método de pago')
      return
    }

    setProcesandoAbono(true)
    setError(null)
    setExito(null)

    try {
      const datosAbono: { monto: number; metodo_pago: string; notas?: string; boleta_id?: string } = {
        monto: montoValidado,
        metodo_pago: metodoPago,
        notas: notasAbono.trim() || undefined
      }

      // Si es abono por boleta individual, enviar boleta_id
      if (abonarBoleta) {
        datosAbono.boleta_id = abonarBoleta.boletaId
      }

      await ventasApi.registrarAbono(venta.id, datosAbono)

      const esPagoTotal = saldoMax - montoValidado <= 0

      setExito(
        esPagoTotal
          ? (abonarBoleta
              ? `✅ ¡Boleta #${abonarBoleta.boletaNumero.toString().padStart(4, '0')} pagada completamente!`
              : '✅ ¡Pago total registrado! La venta queda PAGADA. Las boletas se han entregado al cliente.')
          : `✅ Abono de ${formatoMoneda(montoValidado)}${abonarBoleta ? ` a boleta #${abonarBoleta.boletaNumero.toString().padStart(4, '0')}` : ''} registrado exitosamente.`
      )
      setExitoAbonoMonto(montoValidado)

      // Generar datos para recibo
      const mpLabel = MEDIOS_PAGO.find(m => m.id === metodoPago)?.label || metodoPago
      const nuevoPagadoRecibo = Number(venta.abono_total || 0) + montoValidado
      const nuevoSaldoRecibo = Number(venta.monto_total || 0) - nuevoPagadoRecibo
      // Calcular estado post-abono de cada boleta
      const boletaAbonada = abonarBoleta?.boletaId || null
      let montoRestSingle = montoValidado
      const boletasPostAbonoSingle = venta.boletas.map(b => {
        const precio = b.precio_boleta || 0
        const pagadoPrev = b.total_pagado_boleta || 0
        const saldoB = b.saldo_pendiente_boleta ?? (precio - pagadoPrev)
        let abonoEsta = 0
        if (boletaAbonada) {
          // Abono a boleta específica
          if (b.boleta_id === boletaAbonada) abonoEsta = montoValidado
        } else {
          // Abono general: distribuir
          if (montoRestSingle > 0 && saldoB > 0) {
            abonoEsta = Math.min(montoRestSingle, saldoB)
            montoRestSingle -= abonoEsta
          }
        }
        const nuevoTotalPag = pagadoPrev + abonoEsta
        const nuevoSaldoB = precio - nuevoTotalPag
        const nuevoEst = nuevoTotalPag >= precio ? 'PAGADA' : nuevoTotalPag > 0 ? 'ABONADA' : b.estado
        return {
          numero: b.numero,
          estado: nuevoEst,
          precioBoleta: precio,
          totalPagado: nuevoTotalPag,
          saldoPendiente: nuevoSaldoB > 0 ? nuevoSaldoB : 0
        }
      })
      setReciboData({
        tipo: esPagoTotal ? 'pago_total' : 'abono',
        montoRegistrado: montoValidado,
        totalVenta: Number(venta.monto_total || 0),
        totalPagado: nuevoPagadoRecibo,
        saldoPendiente: nuevoSaldoRecibo > 0 ? nuevoSaldoRecibo : 0,
        clienteNombre: venta.cliente_nombre,
        clienteTelefono: venta.cliente_telefono,
        clienteEmail: venta.cliente_email,
        clienteIdentificacion: venta.cliente_identificacion,
        rifaNombre: venta.rifa_nombre,
        metodoPago: mpLabel,
        notas: notasAbono.trim() || undefined,
        ventaId: venta.id,
        boletas: boletasPostAbonoSingle
      })

      setMostrarFormAbono(false)
      setMontoAbono(0)
      setNotasAbono('')
      setPagarTodo(false)
      setAbonarBoleta(null)

      if (onAbonoConfirmado) {
        onAbonoConfirmado(venta.id)
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Error registrando abono'
      setError(msg)
    } finally {
      setProcesandoAbono(false)
    }
  }

  // ── Helpers para modo multi-boleta ──
  const boletasConSaldo = venta.boletas.filter(
    (b) => typeof b.saldo_pendiente_boleta === 'number' && b.saldo_pendiente_boleta > 0
  )

  const totalAbonoMulti = Object.values(abonosPorBoleta).reduce((s, v) => s + (v || 0), 0)

  const setAbonoBoleta = (boletaId: string, monto: number) => {
    setAbonosPorBoleta((prev) => ({ ...prev, [boletaId]: monto }))
  }

  const aplicarPorcentajeATodas = (porcentaje: number) => {
    const nuevos: Record<string, number> = {}
    boletasConSaldo.forEach((b) => {
      nuevos[b.boleta_id] = Math.round((b.saldo_pendiente_boleta! * porcentaje) / 100)
    })
    setAbonosPorBoleta(nuevos)
  }

  const handleIniciarMultiBoleta = () => {
    setModoMultiBoleta(true)
    setMostrarFormAbono(true)
    setAbonarBoleta(null)
    setPagarTodo(false)
    setMontoAbono(0)
    setError(null)
    setExito(null)
    // Inicializar todos en 0
    const init: Record<string, number> = {}
    boletasConSaldo.forEach((b) => { init[b.boleta_id] = 0 })
    setAbonosPorBoleta(init)
  }

  const handleRegistrarAbonoMultiple = async () => {
    // Filtrar boletas con monto > 0
    const abonosARegistrar = Object.entries(abonosPorBoleta)
      .filter(([, monto]) => monto > 0)
      .map(([boletaId, monto]) => ({ boletaId, monto }))

    if (abonosARegistrar.length === 0) {
      setError('Debes ingresar un monto mayor a 0 en al menos una boleta')
      return
    }

    // Validar que ningún monto exceda el saldo de su boleta
    for (const { boletaId, monto } of abonosARegistrar) {
      const boleta = venta.boletas.find((b) => b.boleta_id === boletaId)
      if (boleta && typeof boleta.saldo_pendiente_boleta === 'number' && monto > boleta.saldo_pendiente_boleta) {
        setError(`El monto para boleta #${boleta.numero.toString().padStart(4, '0')} excede su saldo pendiente`)
        return
      }
    }

    if (!metodoPago || metodoPago.trim() === '') {
      setError('Debe seleccionar un método de pago')
      return
    }

    setProcesandoAbono(true)
    setError(null)
    setExito(null)

    try {
      // Registrar abonos secuencialmente, uno por boleta
      for (const { boletaId, monto } of abonosARegistrar) {
        const payload: { monto: number; metodo_pago: string; notas?: string; boleta_id: string } = {
          monto,
          metodo_pago: metodoPago,
          notas: notasAbono.trim() || undefined,
          boleta_id: boletaId
        }
        await ventasApi.registrarAbono(venta.id, payload)
      }

      setExito(
        `✅ Se registraron ${abonosARegistrar.length} abono(s) por un total de ${formatoMoneda(totalAbonoMulti)} exitosamente.`
      )
      setExitoAbonoMonto(totalAbonoMulti)

      // Generar datos para recibo
      const mpLabelMulti = MEDIOS_PAGO.find(m => m.id === metodoPago)?.label || metodoPago
      const nuevoPagadoMulti = Number(venta.abono_total || 0) + totalAbonoMulti
      const nuevoSaldoMulti = Number(venta.monto_total || 0) - nuevoPagadoMulti
      // Calcular estado post-abono de cada boleta usando el mapa de abonos
      const boletasPostAbonoMulti = venta.boletas.map(b => {
        const precio = b.precio_boleta || 0
        const pagadoPrev = b.total_pagado_boleta || 0
        const abonoEsta = abonosPorBoleta[b.boleta_id] || 0
        const nuevoTotalPag = pagadoPrev + abonoEsta
        const nuevoSaldoB = precio - nuevoTotalPag
        const nuevoEst = nuevoTotalPag >= precio ? 'PAGADA' : nuevoTotalPag > 0 ? 'ABONADA' : b.estado
        return {
          numero: b.numero,
          estado: nuevoEst,
          precioBoleta: precio,
          totalPagado: nuevoTotalPag,
          saldoPendiente: nuevoSaldoB > 0 ? nuevoSaldoB : 0
        }
      })
      setReciboData({
        tipo: nuevoSaldoMulti <= 0 ? 'pago_total' : 'abono',
        montoRegistrado: totalAbonoMulti,
        totalVenta: Number(venta.monto_total || 0),
        totalPagado: nuevoPagadoMulti,
        saldoPendiente: nuevoSaldoMulti > 0 ? nuevoSaldoMulti : 0,
        clienteNombre: venta.cliente_nombre,
        clienteTelefono: venta.cliente_telefono,
        clienteEmail: venta.cliente_email,
        clienteIdentificacion: venta.cliente_identificacion,
        rifaNombre: venta.rifa_nombre,
        metodoPago: mpLabelMulti,
        notas: notasAbono.trim() || undefined,
        ventaId: venta.id,
        boletas: boletasPostAbonoMulti
      })

      setMostrarFormAbono(false)
      setModoMultiBoleta(false)
      setMontoAbono(0)
      setAbonosPorBoleta({})
      setNotasAbono('')
      setPagarTodo(false)
      setAbonarBoleta(null)

      if (onAbonoConfirmado) {
        onAbonoConfirmado(venta.id)
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Error registrando abonos'
      setError(msg)
    } finally {
      setProcesandoAbono(false)
    }
  }

  /**
   * Genera un label legible para el estado
   */
  const getEstadoLabel = (estado: string) => {
    switch (estado) {
      case 'SIN_REVISAR':
        return '🆕 SIN REVISAR'
      default:
        return estado
    }
  }

  /**
   * Genera link de WhatsApp con confirmación de abono y estado de cuenta
   */
  const generarWhatsAppAbonoLink = (montoAbonado: number) => {
    const telefonoCompleto = normalizarTelefono(venta.cliente_telefono)
    if (!telefonoCompleto || telefonoCompleto.length < 7) return null

    const nombre = venta.cliente_nombre || 'Cliente'
    const numeros = venta.boletas.map(b => `#${b.numero.toString().padStart(4, '0')}`).join(', ')

    // Calcular estado post-abono (los datos de la venta aún no se refrescaron, calcular manualmente)
    const nuevoPagado = venta.abono_total + montoAbonado
    const nuevoSaldo = venta.monto_total - nuevoPagado
    const cuentaSaldada = nuevoSaldo <= 0

    // Info por boleta
    const boletasDetalle = venta.boletas.map(b => {
      const pagado = (b.total_pagado_boleta || 0)
      const precio = b.precio_boleta || 0
      const estado = pagado >= precio ? '✅ Pagada'
        : pagado > 0 ? `💰 Abonada ($${pagado.toLocaleString('es-CO')} de $${precio.toLocaleString('es-CO')})`
        : '🔒 Pendiente'
      return `  #${b.numero.toString().padStart(4, '0')}: ${estado}`
    }).join('\n')

    let mensaje = ''
    if (cuentaSaldada) {
      mensaje = `Hola ${nombre}, te confirmamos que tu pago de *${formatoMoneda(montoAbonado)}* fue registrado exitosamente. 🎉\n\n`
      mensaje += `*Estado de tu cuenta - ${venta.rifa_nombre}:*\n`
      mensaje += `💵 Total: ${formatoMoneda(venta.monto_total)}\n`
      mensaje += `✅ Pagado: ${formatoMoneda(nuevoPagado)}\n`
      mensaje += `🎉 *¡Cuenta saldada!*\n`
      if (boletasDetalle) mensaje += `\n*Tus boletas:*\n${boletasDetalle}\n`
      mensaje += `\n¡Mucha suerte! 🍀`
      mensaje += `\n\n📲 *Revisa tus boletas aquí:*\nhttps://elgrancamion.com/boletas`
    } else {
      mensaje = `Hola ${nombre}, te confirmamos que tu abono de *${formatoMoneda(montoAbonado)}* fue registrado exitosamente. ✅\n\n`
      mensaje += `*Estado de tu cuenta - ${venta.rifa_nombre}:*\n`
      mensaje += `💵 Total: ${formatoMoneda(venta.monto_total)}\n`
      mensaje += `✅ Pagado: ${formatoMoneda(nuevoPagado)}\n`
      mensaje += `⏳ Saldo pendiente: *${formatoMoneda(nuevoSaldo)}*\n`
      if (boletasDetalle) mensaje += `\n*Tus boletas:*\n${boletasDetalle}\n`
      mensaje += `\n¡Gracias por tu pago! 🙏`
      mensaje += `\n\n📲 *Revisa tus boletas aquí:*\nhttps://elgrancamion.com/boletas`
    }

    return `https://wa.me/${telefonoCompleto}?text=${encodeURIComponent(mensaje)}`
  }

  /**
   * Genera el link de WhatsApp con mensaje pre-rellenado
   */
  const generarWhatsAppLink = () => {
    const telefonoCompleto = normalizarTelefono(venta.cliente_telefono)
    
    const numeros = venta.boletas.map(b => `#${b.numero.toString().padStart(4, '0')}`).join(', ')
    
    const mediosPago = getMediosDePagoTexto()
    let mensaje = ''

    if (venta.estado_venta === 'SIN_REVISAR') {
      mensaje = `Hola ${venta.cliente_nombre}, recibimos tu reserva en la rifa *${venta.rifa_nombre}* para las boletas *${numeros}*, por un total de *${formatoMoneda(venta.monto_total)}*.\n\n🏆 *PARA PARTICIPAR EN LOS PREMIOS:*\n✅ *Anticipados:* mínimo $90.000 abonados todos los sábados por $2.000.000 acumulables\n🎁 *Premio mayor (20 de junio):* boleta pagada al 100%\n\n${mediosPago}\n\n📲 *Revisa tus boletas aquí:*\nhttps://elgrancamion.com/boletas\n\nRecuerda enviar el comprobante de pago por este medio. ¡Gracias!`
    } else if (venta.estado_venta === 'ABONADA') {
      mensaje = `Hola ${venta.cliente_nombre}, te recordamos que tienes un saldo pendiente de *${formatoMoneda(venta.saldo_pendiente)}* en la rifa *${venta.rifa_nombre}* (boletas: *${numeros}*). Total: ${formatoMoneda(venta.monto_total)}, Abonado: ${formatoMoneda(venta.abono_total)}.\n\n${mediosPago}\n\n📲 *Revisa tus boletas aquí:*\nhttps://elgrancamion.com/boletas\n\n¡Gracias!`
    } else if (venta.estado_venta === 'PENDIENTE') {
      mensaje = `Hola ${venta.cliente_nombre}, te recordamos que tienes pendiente el pago de *${formatoMoneda(venta.saldo_pendiente)}* en la rifa *${venta.rifa_nombre}* (boletas: *${numeros}*).\n\n${mediosPago}\n\n📲 *Revisa tus boletas aquí:*\nhttps://elgrancamion.com/boletas\n\nRecuerda enviar el comprobante de pago por este medio. ¡Gracias!`
    }

    return `https://wa.me/${telefonoCompleto}?text=${encodeURIComponent(mensaje)}`
  }

  /**
   * Maneja clic en WhatsApp: si es SIN_REVISAR, marca como revisada y abre WhatsApp
   */
  const handleWhatsAppClick = async () => {
    const whatsappUrl = generarWhatsAppLink()
    
    if (venta.estado_venta === 'SIN_REVISAR') {
      try {
        setMarcandoRevisada(true)
        await ventasPublicasApi.marcarVentaRevisada(venta.id)
        window.open(whatsappUrl, '_blank')
        setTimeout(() => {
          window.location.reload()
        }, 1500)
      } catch (err: any) {
        window.open(whatsappUrl, '_blank')
      } finally {
        setMarcandoRevisada(false)
      }
    } else {
      window.open(whatsappUrl, '_blank')
    }
  }

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          <span className="text-sm font-medium">Volver</span>
        </button>
        <h2 className="text-lg font-semibold text-slate-900">
          Venta #{venta.id.substring(0, 8)}
        </h2>
      </div>

      {/* Modal de Recibo/Factura */}
      {reciboData && (
        <ReciboAbono
          data={reciboData}
          onClose={() => {
            setReciboData(null)
            window.location.reload()
          }}
        />
      )}

      {/* Mensajes */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 text-sm font-medium">{error}</p>
        </div>
      )}

      {exito && !reciboData && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-700 text-sm font-medium">{exito}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium"
            >
              🔄 Recargar datos
            </button>
          </div>
        </div>
      )}

      {/* Banner SIN REVISAR */}
      {venta.estado_venta === 'SIN_REVISAR' && (
        <div className="bg-purple-50 border-2 border-purple-300 rounded-lg p-5">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 bg-purple-100 rounded-full p-3">
              <span className="text-2xl">🆕</span>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-purple-900">Venta Sin Revisar</h3>
              <p className="text-sm text-purple-700 mt-1">
                Esta venta acaba de llegar desde la web pública. Contacta al cliente por WhatsApp para confirmar 
                el pago y la venta pasará a estado <strong>PENDIENTE</strong>.
              </p>
              <button
                onClick={handleWhatsAppClick}
                disabled={marcandoRevisada}
                className="mt-3 flex items-center gap-2 px-5 py-2.5 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-all shadow-md disabled:opacity-50"
              >
                {marcandoRevisada ? (
                  <span className="inline-block animate-spin">⏳</span>
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                )}
                Contactar por WhatsApp y marcar como revisada
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Información del Cliente */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">
          📋 Información del Cliente
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-500 font-medium mb-1">NOMBRE</p>
            <p className="text-sm font-medium text-slate-900">
              {venta.cliente_nombre}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium mb-1">TELÉFONO</p>
            <p className="text-sm text-slate-900">{venta.cliente_telefono}</p>
          </div>
          {venta.cliente_email && (
            <div>
              <p className="text-xs text-slate-500 font-medium mb-1">EMAIL</p>
              <p className="text-sm text-slate-900">{venta.cliente_email}</p>
            </div>
          )}
          {venta.cliente_identificacion && (
            <div>
              <p className="text-xs text-slate-500 font-medium mb-1">
                IDENTIFICACIÓN
              </p>
              <p className="text-sm text-slate-900">
                {venta.cliente_identificacion}
              </p>
            </div>
          )}
          {venta.cliente_direccion && (
            <div className="md:col-span-2">
              <p className="text-xs text-slate-500 font-medium mb-1">
                DIRECCIÓN
              </p>
              <p className="text-sm text-slate-900">{venta.cliente_direccion}</p>
            </div>
          )}
        </div>
      </div>

      {/* Información de la Rifa y Boletas */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">
          🎫 Boletas Seleccionadas
        </h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-slate-500 font-medium mb-1">RIFA</p>
              <p className="text-sm font-medium text-slate-900">
                {venta.rifa_nombre}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium mb-1">
                PRECIO BOLETA
              </p>
              <p className="text-sm font-medium text-slate-900">
                {formatoMoneda(venta.precio_boleta)}
              </p>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-3">
            <p className="text-xs text-slate-500 font-medium mb-3">BOLETAS</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {venta.boletas.map((boleta) => (
                <div
                  key={boleta.boleta_id}
                  className={`border-2 rounded-xl p-3 text-center flex flex-col gap-2 transition-colors ${
                    abonarBoleta?.boletaId === boleta.boleta_id
                      ? 'border-blue-400 bg-blue-50'
                      : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                  }`}
                >
                  <div className="text-xl font-bold text-slate-800">#{boleta.numero.toString().padStart(4, '0')}</div>
                  <span
                    className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium ${getEstadoBadgeColor(boleta.estado)}`}
                  >
                    {boleta.estado}
                  </span>

                  {/* Datos financieros por boleta */}
                  <div className="text-[11px] text-left space-y-1 mt-1 text-slate-700">
                    {typeof boleta.precio_boleta === 'number' && (
                      <div>Precio: {formatoMoneda(boleta.precio_boleta)}</div>
                    )}
                    {typeof boleta.total_pagado_boleta === 'number' && (
                      <div>Pagado: {formatoMoneda(boleta.total_pagado_boleta)}</div>
                    )}
                    {typeof boleta.saldo_pendiente_boleta === 'number' && (
                      <div className="font-semibold text-orange-700">
                        Saldo: {formatoMoneda(boleta.saldo_pendiente_boleta)}
                      </div>
                    )}
                  </div>

                  {/* Botones de acción por boleta */}
                  {typeof boleta.saldo_pendiente_boleta === 'number' && boleta.saldo_pendiente_boleta > 0 && venta.estado_venta !== 'CANCELADA' && (
                    <div className="mt-1 flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setAbonarBoleta({
                            boletaId: boleta.boleta_id,
                            boletaNumero: boleta.numero,
                            saldoPendiente: boleta.saldo_pendiente_boleta!
                          })
                          setMostrarFormAbono(true)
                          setMontoAbono(0)
                          setPagarTodo(false)
                          setError(null)
                          setExito(null)
                        }}
                        className={`w-full px-2 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                          abonarBoleta?.boletaId === boleta.boleta_id
                            ? 'bg-blue-700 text-white ring-2 ring-blue-400'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700'
                        }`}
                      >
                        💰 Abonar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAbonarBoleta({
                            boletaId: boleta.boleta_id,
                            boletaNumero: boleta.numero,
                            saldoPendiente: boleta.saldo_pendiente_boleta!
                          })
                          setMostrarFormAbono(true)
                          setMontoAbono(boleta.saldo_pendiente_boleta!)
                          setPagarTodo(true)
                          setError(null)
                          setExito(null)
                        }}
                        className="w-full px-2 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                      >
                        ✅ Pagar total
                      </button>
                    </div>
                  )}
                  {boleta.estado === 'PAGADA' && (
                    <div className="mt-1 text-xs text-green-700 font-semibold text-center bg-green-50 rounded-lg py-1">
                      ✅ Pagada
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Resumen de Montos */}
      <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border border-blue-200 p-6">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">
          💰 Resumen de Pago
        </h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-700">Total de la venta:</p>
            <p className="text-sm font-semibold text-slate-900">
              {formatoMoneda(venta.monto_total)}
            </p>
          </div>
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-700">Total pagado:</p>
            <p className="text-sm font-semibold text-green-700">
              {formatoMoneda(venta.abono_total)}
            </p>
          </div>
          <div className="border-t border-blue-200 pt-3 flex justify-between items-center">
            <p className="text-sm font-medium text-slate-900">Saldo pendiente:</p>
            <p
              className={`text-sm font-bold ${
                venta.saldo_pendiente > 0
                  ? 'text-red-700'
                  : 'text-green-700'
              }`}
            >
              {formatoMoneda(venta.saldo_pendiente)}
            </p>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-blue-200 flex items-center justify-between flex-wrap gap-3">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getEstadoBadgeColor(venta.estado_venta)}`}
          >
            Estado: {getEstadoLabel(venta.estado_venta)}
          </span>
          
          {/* Botón WhatsApp */}
          {(venta.estado_venta === 'SIN_REVISAR' || venta.estado_venta === 'PENDIENTE' || venta.estado_venta === 'ABONADA') && venta.cliente_telefono && (
            <button
              onClick={handleWhatsAppClick}
              disabled={marcandoRevisada}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm ${
                venta.estado_venta === 'SIN_REVISAR'
                  ? 'bg-green-500 text-white hover:bg-green-600 animate-pulse'
                  : 'bg-green-50 text-green-700 border border-green-300 hover:bg-green-100'
              } disabled:opacity-50`}
            >
              {marcandoRevisada ? (
                <span className="inline-block animate-spin">⏳</span>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              )}
              {venta.estado_venta === 'SIN_REVISAR'
                ? 'Contactar por WhatsApp'
                : 'Enviar recordatorio WhatsApp'}
            </button>
          )}
        </div>
      </div>

      {/* Abonos Pendientes */}
      {venta.abonos_pendientes && venta.abonos_pendientes.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">
            ✅ Abonos Pendientes de Confirmación ({venta.abonos_pendientes.filter(a => a.estado === 'REGISTRADO').length})
          </h3>

          <div className="space-y-3">
            {venta.abonos_pendientes.map((abono) => (
              <div
                key={abono.id}
                className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors"
              >
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                  <div>
                    <p className="text-xs text-slate-500 font-medium mb-1">
                      BOLETA
                    </p>
                    <p className="text-sm font-medium text-slate-900">
                      #{String(abono.boleta_numero).padStart(4, '0')}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500 font-medium mb-1">
                      MONTO
                    </p>
                    <p className="text-sm font-semibold text-slate-900">
                      {formatoMoneda(abono.monto)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500 font-medium mb-1">
                      MÉTODO
                    </p>
                    <p className="text-sm text-slate-900">
                      {abono.medio_pago_nombre}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500 font-medium mb-1">
                      ESTADO
                    </p>
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getEstadoAbonoBadgeColor(abono.estado)}`}
                    >
                      {abono.estado}
                    </span>
                  </div>

                  <div className="flex justify-end">
                    {abono.estado === 'REGISTRADO' && (
                      <button
                        onClick={() => handleConfirmarPago(abono.id)}
                        disabled={abonoEnConfirmacion === abono.id}
                        className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                      >
                        {abonoEnConfirmacion === abono.id ? (
                          <>
                            <span className="inline-block animate-spin">⏳</span>
                            <span>Confirmando...</span>
                          </>
                        ) : (
                          <>
                            <span>✅</span>
                            <span>Confirmar</span>
                          </>
                        )}
                      </button>
                    )}
                    {abono.estado === 'CONFIRMADO' && (
                      <span className="text-xs font-medium text-green-700">
                        Confirmado
                      </span>
                    )}
                  </div>
                </div>
                {abono.notas && (
                  <p className="text-xs text-slate-600 mt-2">
                    <span className="font-medium">Notas:</span> {abono.notas}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* REGISTRAR ABONO / PAGO — Sección principal de acción  */}
      {/* ═══════════════════════════════════════════════════════ */}
      {venta.estado_venta !== 'CANCELADA' && venta.estado_venta !== 'PAGADA' && venta.estado_venta !== 'SIN_REVISAR' && venta.saldo_pendiente > 0 && (
        <div className="bg-white rounded-lg border-2 border-emerald-200 p-6">
          {!mostrarFormAbono ? (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-900">
                💰 Acciones de Pago
              </h3>
              <p className="text-xs text-slate-600">
                Selecciona una boleta arriba para abonar a esa boleta específica, o usa las opciones generales.
              </p>
              <div className="flex flex-wrap gap-3">
                {boletasConSaldo.length > 1 && (
                  <button
                    onClick={handleIniciarMultiBoleta}
                    className="px-5 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
                    </svg>
                    Abonar a múltiples boletas
                  </button>
                )}
                <a
                  href={`/ventas`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-3 bg-slate-100 text-slate-700 border border-slate-300 rounded-xl font-medium hover:bg-slate-200 transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Ir al módulo de ventas
                </a>
              </div>
            </div>
          ) : modoMultiBoleta ? (
            /* ═══════════════════════════════════════════════════════ */
            /* MODO MULTI-BOLETA: Abonar a varias boletas a la vez    */
            /* ═══════════════════════════════════════════════════════ */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">
                  💰 Abonar a múltiples boletas
                </h3>
                <button
                  onClick={() => {
                    setMostrarFormAbono(false)
                    setModoMultiBoleta(false)
                    setError(null)
                    setAbonosPorBoleta({})
                    setNotasAbono('')
                  }}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Info resumen */}
              <div className="bg-slate-50 rounded-lg p-3 flex items-center justify-between text-sm">
                <span className="text-slate-600">Saldo total pendiente:</span>
                <span className="font-bold text-red-700 text-lg">
                  {formatoMoneda(venta.saldo_pendiente)}
                </span>
              </div>

              {/* Botones rápidos globales */}
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-slate-500 self-center mr-1">Aplicar a todas:</span>
                {[30, 50, 70, 100].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => aplicarPorcentajeATodas(pct)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                  >
                    {pct}%
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const reset: Record<string, number> = {}
                    boletasConSaldo.forEach((b) => { reset[b.boleta_id] = 0 })
                    setAbonosPorBoleta(reset)
                  }}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  Limpiar
                </button>
              </div>

              {/* Lista de boletas con inputs individuales */}
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {boletasConSaldo.map((boleta) => {
                  const saldo = boleta.saldo_pendiente_boleta!
                  const abonoActual = abonosPorBoleta[boleta.boleta_id] || 0
                  return (
                    <div
                      key={boleta.boleta_id}
                      className={`border rounded-xl p-3 transition-colors ${
                        abonoActual > 0
                          ? 'border-emerald-300 bg-emerald-50/50'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-800">
                            #{boleta.numero.toString().padStart(4, '0')}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${getEstadoBadgeColor(boleta.estado)}`}>
                            {boleta.estado}
                          </span>
                        </div>
                        <span className="text-xs text-orange-700 font-semibold">
                          Saldo: {formatoMoneda(saldo)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">$</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formatearInputPesos(abonoActual)}
                            onChange={(e) => {
                              const val = parsearInputPesos(e.target.value)
                              setAbonoBoleta(boleta.boleta_id, Math.min(val, saldo))
                            }}
                            placeholder="$ 0"
                            className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white text-slate-900 text-sm font-medium"
                          />
                        </div>
                        {/* Botones rápidos por boleta */}
                        <button
                          type="button"
                          onClick={() => setAbonoBoleta(boleta.boleta_id, Math.round(saldo * 0.5))}
                          className="px-2 py-2 text-[11px] font-semibold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors whitespace-nowrap"
                        >
                          50%
                        </button>
                        <button
                          type="button"
                          onClick={() => setAbonoBoleta(boleta.boleta_id, saldo)}
                          className="px-2 py-2 text-[11px] font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors whitespace-nowrap"
                        >
                          100%
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Medio de pago */}
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">Medio de pago</label>
                <select
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white text-slate-900"
                >
                  <option value="">Selecciona método de pago</option>
                  {MEDIOS_PAGO.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">Notas (opcional)</label>
                <textarea
                  value={notasAbono}
                  onChange={(e) => setNotasAbono(e.target.value)}
                  placeholder="Ej: Comprobante Nequi #12345, pago verificado..."
                  rows={2}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg resize-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white text-slate-900 placeholder:text-slate-400"
                />
              </div>

              {/* Resumen total */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center justify-between">
                <span className="text-sm font-medium text-emerald-800">Total a abonar:</span>
                <span className="text-lg font-bold text-emerald-700">{formatoMoneda(totalAbonoMulti)}</span>
              </div>

              {/* Botones de acción */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setMostrarFormAbono(false)
                    setModoMultiBoleta(false)
                    setError(null)
                    setAbonosPorBoleta({})
                    setNotasAbono('')
                  }}
                  className="px-5 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleRegistrarAbonoMultiple}
                  disabled={procesandoAbono || !metodoPago || totalAbonoMulti <= 0}
                  className="flex-1 px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {procesandoAbono ? (
                    <>
                      <span className="inline-block animate-spin">⏳</span>
                      <span>Procesando...</span>
                    </>
                  ) : !metodoPago ? (
                    <span>Selecciona método de pago</span>
                  ) : (
                    <>
                      <span>💰</span>
                      <span>Registrar abonos ({formatoMoneda(totalAbonoMulti)})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">
                  {abonarBoleta
                    ? `💰 Abonar a boleta #${abonarBoleta.boletaNumero.toString().padStart(4, '0')}`
                    : (pagarTodo ? '💳 Registrar Pago Total' : '💰 Registrar Abono')}
                </h3>
                <button
                  onClick={() => {
                    setMostrarFormAbono(false)
                    setModoMultiBoleta(false)
                    setError(null)
                    setMontoAbono(0)
                    setNotasAbono('')
                    setPagarTodo(false)
                    setAbonarBoleta(null)
                  }}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Info resumen rápido */}
              <div className="bg-slate-50 rounded-lg p-3 flex items-center justify-between text-sm">
                <span className="text-slate-600">
                  {abonarBoleta
                    ? `Saldo pendiente boleta #${abonarBoleta.boletaNumero.toString().padStart(4, '0')}:`
                    : 'Saldo pendiente:'}
                </span>
                <span className="font-bold text-red-700 text-lg">
                  {formatoMoneda(abonarBoleta ? abonarBoleta.saldoPendiente : venta.saldo_pendiente)}
                </span>
              </div>

              {/* Botón para cambiar boleta */}
              {abonarBoleta && (
                <button
                  type="button"
                  onClick={() => {
                    setAbonarBoleta(null)
                    setMostrarFormAbono(false)
                    setMontoAbono(0)
                    setPagarTodo(false)
                    setError(null)
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                >
                  ← Cambiar boleta
                </button>
              )}

              {/* Medio de pago */}
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">Medio de pago</label>
                <select
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white text-slate-900"
                >
                  <option value="">Selecciona método de pago</option>
                  {MEDIOS_PAGO.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Monto */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-800 mb-1">
                  Monto a abonar (máx. {formatoMoneda(abonarBoleta ? abonarBoleta.saldoPendiente : venta.saldo_pendiente)})
                </label>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatearInputPesos(montoAbono)}
                      onChange={(e) => {
                        const val = parsearInputPesos(e.target.value)
                        const max = abonarBoleta ? abonarBoleta.saldoPendiente : venta.saldo_pendiente
                        setMontoAbono(Math.min(val, max))
                      }}
                      placeholder="$ 0"
                      disabled={pagarTodo}
                      className="w-full pl-8 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-100 disabled:text-slate-500 bg-white text-slate-900 text-lg font-medium"
                    />
                  </div>
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pagarTodo}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setPagarTodo(checked)
                      setMontoAbono(checked ? (abonarBoleta ? abonarBoleta.saldoPendiente : venta.saldo_pendiente) : 0)
                    }}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>{abonarBoleta ? `Pagar saldo total de boleta #${abonarBoleta.boletaNumero.toString().padStart(4, '0')}` : 'Pagar saldo total de la venta'}</span>
                </label>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">Notas (opcional)</label>
                <textarea
                  value={notasAbono}
                  onChange={(e) => setNotasAbono(e.target.value)}
                  placeholder="Ej: Comprobante Nequi #12345, pago verificado..."
                  rows={2}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg resize-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white text-slate-900 placeholder:text-slate-400"
                />
              </div>

              {/* Botones de acción */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setMostrarFormAbono(false)
                    setModoMultiBoleta(false)
                    setError(null)
                    setMontoAbono(0)
                    setNotasAbono('')
                    setPagarTodo(false)
                    setAbonarBoleta(null)
                  }}
                  className="px-5 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleRegistrarAbono}
                  disabled={procesandoAbono || !metodoPago || montoAbono <= 0}
                  className="flex-1 px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {procesandoAbono ? (
                    <>
                      <span className="inline-block animate-spin">⏳</span>
                      <span>Procesando...</span>
                    </>
                  ) : !metodoPago ? (
                    <span>Selecciona método de pago</span>
                  ) : (
                    <>
                      <span>{pagarTodo ? '✅' : '💰'}</span>
                      <span>
                        {abonarBoleta
                          ? (pagarTodo
                              ? `Pagar boleta #${abonarBoleta.boletaNumero.toString().padStart(4, '0')} (${formatoMoneda(montoAbono)})`
                              : `Abonar a boleta #${abonarBoleta.boletaNumero.toString().padStart(4, '0')} (${formatoMoneda(montoAbono)})`)
                          : (pagarTodo
                              ? `Confirmar Pago Total (${formatoMoneda(montoAbono)})`
                              : `Registrar Abono (${formatoMoneda(montoAbono)})`)}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mensaje si venta ya está pagada */}
      {venta.estado_venta === 'PAGADA' && (
        <div className="bg-green-50 rounded-lg border border-green-200 p-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-3">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="font-semibold text-green-800 text-lg">Venta Completamente Pagada</p>
          <p className="text-green-700 text-sm mt-1">Todas las boletas han sido entregadas al cliente.</p>
          <a
            href={`/ventas/${venta.id}/boletas`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Ver / Imprimir Boletas
          </a>
        </div>
      )}

      {/* Acciones secundarias */}
      <div className="flex gap-3">
        <button
          onClick={handleCancelarVenta}
          disabled={ventaEnCancelacion || venta.estado_venta === 'CANCELADA' || venta.estado_venta === 'PAGADA'}
          className="flex-1 px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg font-medium hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {ventaEnCancelacion ? '⏳ Cancelando...' : '❌ Cancelar Venta'}
        </button>
      </div>
    </div>
  )
}
