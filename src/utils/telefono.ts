/**
 * Normaliza un número de teléfono para WhatsApp (wa.me).
 * 
 * Reglas:
 * - Si el usuario ingresó un indicativo (empieza con +), se usa tal cual sin el +
 * - Si es un número colombiano típico (10 dígitos, empieza con 3), agrega 57
 * - Si ya empieza con 57 y tiene más de 10 dígitos, se asume que ya tiene indicativo
 * - Para cualquier otro caso, asume Colombia (57)
 * 
 * Ejemplos:
 *   "3217669425"    → "573217669425"     (Colombia, se agrega 57)
 *   "+34612345678"  → "34612345678"      (España, ya tiene indicativo)
 *   "34612345678"   → "34612345678"      (España, ya tiene indicativo)
 *   "+573217669425" → "573217669425"     (Colombia con indicativo explícito)
 *   "573217669425"  → "573217669425"     (Colombia, ya tiene 57)
 *   "+14155551234"  → "14155551234"      (USA)
 */
export function normalizarTelefono(telefono: string | undefined | null): string {
  if (!telefono) return ''
  
  // Limpiar: quitar espacios, guiones, paréntesis
  let tel = telefono.trim()
  
  // Si empieza con +, el usuario ya puso indicativo → quitar el + y usar tal cual
  if (tel.startsWith('+')) {
    return tel.replace(/[^\d]/g, '')
  }
  
  // Quitar todo excepto dígitos
  tel = tel.replace(/[^\d]/g, '')
  
  if (!tel || tel.length < 7) return tel
  
  // Si ya empieza con 57 y tiene longitud de número colombiano completo (12 dígitos: 57 + 10)
  if (tel.startsWith('57') && tel.length >= 12) {
    return tel
  }
  
  // Si es un número colombiano (10 dígitos, empieza con 3)
  if (tel.length === 10 && tel.startsWith('3')) {
    return `57${tel}`
  }
  
  // Si tiene más de 10 dígitos y NO empieza con 57, probablemente ya tiene indicativo
  if (tel.length > 10) {
    return tel
  }
  
  // Por defecto, asumir Colombia
  return `57${tel}`
}

/** Link wa.me sin mensaje prearmado — solo abre el chat del cliente */
export function generarWhatsAppChatLink(telefono: string | undefined | null): string | null {
  const tel = normalizarTelefono(telefono)
  if (!tel || tel.length < 7) return null
  return `https://wa.me/${tel}`
}
