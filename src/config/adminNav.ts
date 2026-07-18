export type AdminUser = {
  id: string
  email: string
  nombre: string
  rol: string
}

export type AdminNavItem = {
  href: string
  label: string
  description: string
  roles: Array<'SUPER_ADMIN' | 'ADMIN' | 'VENDEDOR'>
}

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Administrador',
  ADMIN: 'Administrador',
  VENDEDOR: 'Vendedor',
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  {
    href: '/analytics',
    label: 'Reportes',
    description: 'Dashboard global del proyecto',
    roles: ['SUPER_ADMIN'],
  },
  {
    href: '/mis-reportes',
    label: 'Mis reportes',
    description: 'Rendimiento de tus ventas',
    roles: ['SUPER_ADMIN', 'ADMIN', 'VENDEDOR'],
  },
  {
    href: '/ventas',
    label: 'Ventas',
    description: 'Nueva venta y abonos',
    roles: ['SUPER_ADMIN', 'ADMIN', 'VENDEDOR'],
  },
  {
    href: '/ventas-publicas',
    label: 'Ventas públicas',
    description: 'Confirmar pagos online',
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    href: '/boletas-reservadas',
    label: 'Boletas reservadas',
    description: 'Administrar reservas',
    roles: ['SUPER_ADMIN', 'ADMIN', 'VENDEDOR'],
  },
  {
    href: '/boletas/ver',
    label: 'Ver boletas',
    description: 'Estado de números',
    roles: ['SUPER_ADMIN', 'ADMIN', 'VENDEDOR'],
  },
  {
    href: '/clientes',
    label: 'Clientes',
    description: 'Directorio de clientes',
    roles: ['SUPER_ADMIN', 'ADMIN', 'VENDEDOR'],
  },
  {
    href: '/recordatorios',
    label: 'Recordatorios',
    description: 'Pagos pendientes por WhatsApp',
    roles: ['SUPER_ADMIN', 'ADMIN', 'VENDEDOR'],
  },
  {
    href: '/seguimiento-clientes',
    label: 'Seguimiento',
    description: 'Seguimiento de clientes',
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    href: '/preasignaciones',
    label: 'Preasignaciones',
    description: 'Boletas preasignadas',
    roles: ['SUPER_ADMIN', 'ADMIN', 'VENDEDOR'],
  },
  {
    href: '/gastos',
    label: 'Gastos',
    description: 'Reportar y ver gastos del equipo',
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    href: '/rifas',
    label: 'Proyectos',
    description: 'Crear y configurar proyectos',
    roles: ['SUPER_ADMIN'],
  },
  {
    href: '/ganadores',
    label: 'Ganadores',
    description: 'Asignar ganadores',
    roles: ['SUPER_ADMIN'],
  },
  {
    href: '/vendedores',
    label: 'Vendedores',
    description: 'Estadísticas de equipo',
    roles: ['SUPER_ADMIN'],
  },
  {
    href: '/historial',
    label: 'Historial',
    description: 'Movimientos del sistema',
    roles: ['SUPER_ADMIN'],
  },
  {
    href: '/superadmin-ventas',
    label: 'Ventas (superadmin)',
    description: 'Vista avanzada de ventas',
    roles: ['SUPER_ADMIN'],
  },
  {
    href: '/transacciones-wompi',
    label: 'Transacciones Wompi',
    description: 'Auditoría de pagos y entrega',
    roles: ['SUPER_ADMIN'],
  },
]

export function homeRouteForRole(rol?: string | null): string {
  const role = (rol || '').toUpperCase()
  if (role === 'SUPER_ADMIN') return '/analytics'
  if (['ADMIN', 'VENDEDOR'].includes(role)) return '/mis-reportes'
  return '/login'
}

export function navItemsForRole(rol?: string | null): AdminNavItem[] {
  const role = (rol || '')
    .toUpperCase()
    .trim()
    .replace(/\s+/g, '_') as AdminNavItem['roles'][number]
  return ADMIN_NAV_ITEMS.filter((item) => item.roles.includes(role))
}

export function isPublicAdminPath(pathname: string): boolean {
  if (!pathname) return true
  if (pathname === '/') return true
  if (pathname.startsWith('/login')) return true
  if (pathname.startsWith('/verificar')) return true
  if (pathname.startsWith('/mis-boletas')) return true
  return false
}
