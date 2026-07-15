// Configuración de medios de pago — Rifas Doradas (única cuenta para todos los roles)

import { TokenManager } from '@/utils/auth'
import { RIFAS_DORADAS_CONTACT } from '@/config/rifasDoradasContact'

interface PaymentInfo {
  llave: string | null
  cuentaBancolombia: string
  titular: string
  whatsapp: string | null
}

const RIFAS_DORADAS_PAYMENT: PaymentInfo = {
  llave: RIFAS_DORADAS_CONTACT.llaveBreve,
  cuentaBancolombia: RIFAS_DORADAS_CONTACT.cuentaBancolombia,
  titular: RIFAS_DORADAS_CONTACT.titular,
  whatsapp: RIFAS_DORADAS_CONTACT.whatsappDisplay.replace(/\s/g, ''),
}

export function getPaymentInfo(): PaymentInfo {
  // Misma cuenta para admin y vendedor
  void TokenManager.getUser()
  return RIFAS_DORADAS_PAYMENT
}

/**
 * Genera el bloque de texto de medios de pago para mensajes de WhatsApp.
 */
export function getMediosDePagoTexto(): string {
  const info = getPaymentInfo()
  let texto = `*Cómo pagar (Rifas Doradas)*\n`
  if (info.llave) {
    texto += `💰 Llave Bre-B: ${info.llave}\n`
  }
  texto += `💰 Bancolombia ahorros: ${info.cuentaBancolombia}\n`
  texto += `A nombre de: ${info.titular}\n`
  texto += `📲 WhatsApp: ${RIFAS_DORADAS_CONTACT.whatsappDisplay}\n`
  texto += `\nCuando pagues, envíanos el comprobante por este chat ✅`
  return texto
}

export function getMediosDePagoBloque(): string {
  return `\n\n${getMediosDePagoTexto()}`
}
