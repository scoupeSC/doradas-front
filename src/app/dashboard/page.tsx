'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import VentasOnlineBanner from '@/components/ventasPublicas/VentasOnlineBanner'

interface User {
  id: string
  email: string
  nombre: string
  rol: string
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const router = useRouter()

  const normalizedRole = user?.rol?.toUpperCase()
  const canUseOperationalModules = ['SUPER_ADMIN', 'VENDEDOR', 'ADMIN'].includes(normalizedRole || '')
  const canUseRifas = normalizedRole === 'SUPER_ADMIN'
  const canUseReportes = normalizedRole === 'SUPER_ADMIN'
  const canUseMisReportes = ['SUPER_ADMIN', 'ADMIN', 'VENDEDOR'].includes(normalizedRole || '')
  const canUseRecordatorios = ['SUPER_ADMIN', 'ADMIN', 'VENDEDOR'].includes(normalizedRole || '')
  const canUseSeguimiento = ['SUPER_ADMIN', 'ADMIN'].includes(normalizedRole || '')
  const canUseVentasPublicas = ['SUPER_ADMIN', 'ADMIN'].includes(normalizedRole || '')
  const canUseVendedoresStats = normalizedRole === 'SUPER_ADMIN'
  const canUseHistorial = normalizedRole === 'SUPER_ADMIN'
  const canUseSuperadminVentas = normalizedRole === 'SUPER_ADMIN'
  const canUsePreasignaciones = ['SUPER_ADMIN', 'ADMIN', 'VENDEDOR'].includes(normalizedRole || '')

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')

    if (!token || !userData) {
      router.push('/login')
      return
    }

    try {
      const parsedUser = JSON.parse(userData)
      setUser(parsedUser)
    } catch (error) {
      router.push('/login')
    }
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/login')
  }

  if (!user) {
    return (
      <div className="min-h-screen app-shell flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-neutral-400 text-sm">Cargando...</span>
        </div>
      </div>
    )
  }

  const roleLabel: Record<string, string> = {
    SUPER_ADMIN: 'Super Administrador',
    ADMIN: 'Administrador',
    VENDEDOR: 'Vendedor',
  }

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="app-header sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-black/50">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-semibold text-neutral-100 leading-tight">Sistema de Rifas</h1>
                <p className="text-[11px] text-neutral-500 leading-none">Panel de Administración</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-3 px-3 py-1.5 bg-neutral-950 rounded-xl border border-neutral-800">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-lg flex items-center justify-center text-white text-xs font-semibold">
                  {user.nombre?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-neutral-100 leading-tight">{user.nombre}</p>
                  <p className="text-[11px] text-neutral-500 leading-tight">{roleLabel[normalizedRole || ''] || user.rol}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-neutral-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all duration-200"
                title="Cerrar sesión"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="hidden sm:inline">Salir</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Banner de Ventas Online Pendientes */}
        {canUseVentasPublicas && (
          <VentasOnlineBanner onVerPendientes={() => router.push('/ventas-publicas')} />
        )}

        {/* Welcome Section */}
        <div className="mb-8 animate-fade-in">
          <h2 className="text-2xl font-semibold text-neutral-100 mb-1">
            Bienvenido, {user.nombre.split(' ')[0]}
          </h2>
          <p className="text-neutral-500 text-sm">
            Gestiona tus rifas, ventas y clientes desde un solo lugar
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="module-stat-card">
            <div className="flex items-center gap-3">
              <div className="module-card-icon module-card--indigo !w-10 !h-10">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-neutral-500 font-medium uppercase tracking-wider">Rol</p>
                <p className="text-lg font-semibold text-neutral-100">{roleLabel[normalizedRole || ''] || user.rol}</p>
              </div>
            </div>
          </div>
          <div className="module-stat-card">
            <div className="flex items-center gap-3">
              <div className="module-card-icon module-card--emerald !w-10 !h-10">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-neutral-500 font-medium uppercase tracking-wider">Correo</p>
                <p className="text-sm font-medium text-neutral-100 truncate max-w-[180px]">{user.email}</p>
              </div>
            </div>
          </div>
          <div className="module-stat-card">
            <div className="flex items-center gap-3">
              <div className="module-card-icon module-card--emerald !w-10 !h-10">
                <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse" />
              </div>
              <div>
                <p className="text-xs text-neutral-500 font-medium uppercase tracking-wider">Estado</p>
                <p className="text-lg font-semibold text-emerald-400">Activo</p>
              </div>
            </div>
          </div>
        </div>

        {/* Modules */}
        <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center gap-2 mb-5">
            <svg className="w-5 h-5 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            <h3 className="text-lg font-semibold text-neutral-100">Módulos</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Ventas */}
            {canUseOperationalModules && (
              <a
                href="/ventas"
                className="group module-card module-card--indigo card-hover"
              >
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="module-card-icon">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <span className="module-card-badge">
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                      En vivo
                    </span>
                  </div>
                  <h4 className="text-lg font-semibold mb-1 text-neutral-100">Ventas</h4>
                  <p className="module-card-desc">Sistema de ventas con bloqueo en tiempo real</p>
                  <div className="module-card-link">
                    Ir al módulo
                    <svg className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                  </div>
                </div>
              </a>
            )}

            {/* Ventas Públicas */}
            {canUseVentasPublicas && (
              <a
                href="/ventas-publicas"
                className="group relative bg-gradient-to-br from-emerald-500 to-emerald-700 p-6 rounded-2xl text-white overflow-hidden card-hover shadow-lg shadow-emerald-600/15"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-8 translate-x-8" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-6 -translate-x-6" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/10">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-[11px] font-semibold border border-white/10">
                      Online
                    </span>
                  </div>
                  <h4 className="text-lg font-semibold mb-1">Ventas Públicas</h4>
                  <p className="text-emerald-100 text-sm leading-relaxed">Confirmar pagos desde la web pública</p>
                  <div className="mt-4 flex items-center text-emerald-200 text-xs font-medium group-hover:text-white transition-colors">
                    Ir al módulo
                    <svg className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                  </div>
                </div>
              </a>
            )}

            {/* Boletas Reservadas */}
            {canUseOperationalModules && (
              <a
                href="/boletas-reservadas"
                className="group relative bg-gradient-to-br from-amber-500 to-amber-700 p-6 rounded-2xl text-white overflow-hidden card-hover shadow-lg shadow-amber-600/15"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-8 translate-x-8" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-6 -translate-x-6" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/10">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                      </svg>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-[11px] font-semibold border border-white/10">
                      Reservas
                    </span>
                  </div>
                  <h4 className="text-lg font-semibold mb-1">Boletas Reservadas</h4>
                  <p className="text-amber-100 text-sm leading-relaxed">Administrar y liberar boletas reservadas</p>
                  <div className="mt-4 flex items-center text-amber-200 text-xs font-medium group-hover:text-white transition-colors">
                    Ir al módulo
                    <svg className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                  </div>
                </div>
              </a>
            )}

            {/* Recordatorios */}
            {canUseRecordatorios && (
              <a
                href="/recordatorios"
                className="group relative bg-gradient-to-br from-rose-500 to-rose-700 p-6 rounded-2xl text-white overflow-hidden card-hover shadow-lg shadow-rose-600/15"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-8 translate-x-8" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-6 -translate-x-6" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/10">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-[11px] font-semibold border border-white/10">
                      WhatsApp
                    </span>
                  </div>
                  <h4 className="text-lg font-semibold mb-1">Recordatorios</h4>
                  <p className="text-rose-100 text-sm leading-relaxed">Recordar pagos pendientes por WhatsApp</p>
                  <div className="mt-4 flex items-center text-rose-200 text-xs font-medium group-hover:text-white transition-colors">
                    Ir al módulo
                    <svg className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                  </div>
                </div>
              </a>
            )}

            {/* Seguimiento de Clientes (ADMIN + SUPER_ADMIN) */}
            {canUseSeguimiento && (
              <a
                href="/seguimiento-clientes"
                className="group relative bg-gradient-to-br from-teal-500 to-teal-700 p-6 rounded-2xl text-white overflow-hidden card-hover shadow-lg shadow-teal-600/15"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-8 translate-x-8" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-6 -translate-x-6" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/10">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-[11px] font-semibold border border-white/10">
                      Admin
                    </span>
                  </div>
                  <h4 className="text-lg font-semibold mb-1">Seguimiento Clientes</h4>
                  <p className="text-teal-100 text-sm leading-relaxed">Boletas, abonos, saldos y recordatorios por cliente</p>
                  <div className="mt-4 flex items-center text-teal-200 text-xs font-medium group-hover:text-white transition-colors">
                    Ir al módulo
                    <svg className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                  </div>
                </div>
              </a>
            )}

            {/* Edición de Ventas (solo SUPER_ADMIN) */}
            {canUseSuperadminVentas && (
              <a
                href="/superadmin-ventas"
                className="group relative bg-gradient-to-br from-rose-600 to-red-800 p-6 rounded-2xl text-white overflow-hidden card-hover shadow-lg shadow-red-900/20"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-8 translate-x-8" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-6 -translate-x-6" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/10">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-[11px] font-semibold border border-white/10">
                      Super Admin
                    </span>
                  </div>
                  <h4 className="text-lg font-semibold mb-1">Edición de Ventas</h4>
                  <p className="text-rose-100 text-sm leading-relaxed">Editar abonos, métodos de pago, liberar boletas, estados y clientes</p>
                  <div className="mt-4 flex items-center text-rose-200 text-xs font-medium group-hover:text-white transition-colors">
                    Ir al módulo
                    <svg className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                  </div>
                </div>
              </a>
            )}

            {/* Boletas Preasignadas (SUPER_ADMIN, ADMIN, VENDEDOR) */}
            {canUsePreasignaciones && (
              <a
                href="/preasignaciones"
                className="group relative bg-gradient-to-br from-amber-500 to-orange-700 p-6 rounded-2xl text-white overflow-hidden card-hover shadow-lg shadow-orange-700/15"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-8 translate-x-8" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-6 -translate-x-6" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/10">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-[11px] font-semibold border border-white/10">
                      Nuevo
                    </span>
                  </div>
                  <h4 className="text-lg font-semibold mb-1">Boletas Preasignadas</h4>
                  <p className="text-orange-100 text-sm leading-relaxed">Reserva números fijos para clientes de siempre, listos para la próxima rifa</p>
                  <div className="mt-4 flex items-center text-orange-200 text-xs font-medium group-hover:text-white transition-colors">
                    Ir al módulo
                    <svg className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                  </div>
                </div>
              </a>
            )}

            {/* Historial (solo SUPER_ADMIN) */}
            {canUseHistorial && (
              <a
                href="/historial"
                className="group relative bg-gradient-to-br from-slate-700 to-slate-900 p-6 rounded-2xl text-white overflow-hidden card-hover shadow-lg shadow-slate-900/20"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-8 translate-x-8" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-6 -translate-x-6" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/10">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-[11px] font-semibold border border-white/10">
                      Auditoría
                    </span>
                  </div>
                  <h4 className="text-lg font-semibold mb-1">Historial</h4>
                  <p className="text-slate-300 text-sm leading-relaxed">Ver cambios de boletas, clientes, abonos y liberaciones</p>
                  <div className="mt-4 flex items-center text-slate-400 text-xs font-medium group-hover:text-white transition-colors">
                    Ir al módulo
                    <svg className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                  </div>
                </div>
              </a>
            )}

            {/* Vendedores (solo SUPER_ADMIN) */}
            {canUseVendedoresStats && (              <a
                href="/vendedores"
                className="group relative bg-gradient-to-br from-indigo-500 to-indigo-700 p-6 rounded-2xl text-white overflow-hidden card-hover shadow-lg shadow-indigo-600/15"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-8 translate-x-8" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-6 -translate-x-6" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/10">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-[11px] font-semibold border border-white/10">
                      Equipo
                    </span>
                  </div>
                  <h4 className="text-lg font-semibold mb-1">Vendedores</h4>
                  <p className="text-indigo-100 text-sm leading-relaxed">Métricas de ventas, abonos y clientes por vendedor/admin</p>
                  <div className="mt-4 flex items-center text-indigo-200 text-xs font-medium group-hover:text-white transition-colors">
                    Ir al módulo
                    <svg className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                  </div>
                </div>
              </a>
            )}

            {/* Clientes */}
            <a
              href="/clientes"
              className="group bg-white p-6 rounded-2xl border border-slate-200/80 hover:border-slate-300 card-hover shadow-sm"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center group-hover:bg-violet-100 transition-colors">
                  <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h4 className="text-base font-semibold text-slate-900">Clientes</h4>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed">Gestionar clientes del sistema</p>
              <div className="mt-3 flex items-center text-slate-400 text-xs font-medium group-hover:text-indigo-600 transition-colors">
                Ir al módulo
                <svg className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
              </div>
            </a>

            {/* Rifas */}
            {canUseRifas && (
              <a
                href="/rifas"
                className="group bg-white p-6 rounded-2xl border border-slate-200/80 hover:border-slate-300 card-hover shadow-sm"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center group-hover:bg-rose-100 transition-colors">
                    <svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                    </svg>
                  </div>
                  <h4 className="text-base font-semibold text-slate-900">Rifas</h4>
                </div>
                <p className="text-sm text-slate-500 leading-relaxed">Gestionar rifas y sorteos</p>
                <div className="mt-3 flex items-center text-slate-400 text-xs font-medium group-hover:text-indigo-600 transition-colors">
                  Ir al módulo
                  <svg className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                </div>
              </a>
            )}

            {/* Ganadores - Solo SUPER_ADMIN */}
            {canUseRifas && (
              <a
                href="/ganadores"
                className="group relative bg-gradient-to-br from-yellow-500 to-amber-600 p-6 rounded-2xl text-white overflow-hidden card-hover shadow-lg shadow-amber-600/15"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-8 translate-x-8" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-6 -translate-x-6" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/10">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                      </svg>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-[11px] font-semibold border border-white/10">
                      Super Admin
                    </span>
                  </div>
                  <h4 className="text-lg font-semibold mb-1">Ganadores</h4>
                  <p className="text-amber-100 text-sm leading-relaxed">Gestionar ganadores</p>
                  <div className="mt-4 flex items-center text-amber-200 text-xs font-medium group-hover:text-white transition-colors">
                    Ir al módulo
                    <svg className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                  </div>
                </div>
              </a>
            )}

            {/* Boletas */}
            {canUseOperationalModules && (
              <a
                href="/boletas/ver"
                className="group bg-white p-6 rounded-2xl border border-slate-200/80 hover:border-slate-300 card-hover shadow-sm"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-sky-50 rounded-xl flex items-center justify-center group-hover:bg-sky-100 transition-colors">
                    <svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h4 className="text-base font-semibold text-slate-900">Boletas</h4>
                </div>
                <p className="text-sm text-slate-500 leading-relaxed">Ver todas las boletas del sistema</p>
                <div className="mt-3 flex items-center text-slate-400 text-xs font-medium group-hover:text-indigo-600 transition-colors">
                  Ir al módulo
                  <svg className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                </div>
              </a>
            )}

            {/* Reportes */}
            {canUseReportes ? (
              <a
                href="/analytics"
                className="group bg-white p-6 rounded-2xl border border-slate-200/80 hover:border-slate-300 card-hover shadow-sm"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center group-hover:bg-teal-100 transition-colors">
                    <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h4 className="text-base font-semibold text-slate-900">Reportes</h4>
                </div>
                <p className="text-sm text-slate-500 leading-relaxed">Ver reportes y métricas de rifas</p>
                <div className="mt-3 flex items-center text-slate-400 text-xs font-medium group-hover:text-indigo-600 transition-colors">
                  Ir al módulo
                  <svg className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                </div>
              </a>
            ) : normalizedRole === 'ADMIN' ? null : (
              <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-200/50 opacity-60">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h4 className="text-base font-medium text-slate-400">Reportes</h4>
                </div>
                <p className="text-sm text-slate-400">Próximamente</p>
              </div>
            )}

            {/* Mis Reportes (ADMIN / VENDEDOR / SUPER_ADMIN) - solo ventas del usuario */}
            {canUseMisReportes && (
              <a
                href="/mis-reportes"
                className="group relative bg-gradient-to-br from-teal-500 to-teal-700 p-6 rounded-2xl text-white overflow-hidden card-hover shadow-lg shadow-teal-600/15"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-8 translate-x-8" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-6 -translate-x-6" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/10">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-[11px] font-semibold border border-white/10">
                      Personal
                    </span>
                  </div>
                  <h4 className="text-lg font-semibold mb-1">Mis Reportes</h4>
                  <p className="text-teal-100 text-sm leading-relaxed">Ventas, abonos y métricas de tu propia gestión</p>
                  <div className="mt-4 flex items-center text-teal-200 text-xs font-medium group-hover:text-white transition-colors">
                    Ir al módulo
                    <svg className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                  </div>
                </div>
              </a>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto py-6 text-center">
        <p className="text-xs text-neutral-600">Sistema de Rifas © {new Date().getFullYear()} · v2.0</p>
      </footer>
    </div>
  )
}
