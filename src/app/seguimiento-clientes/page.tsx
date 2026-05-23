'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import SeguimientoClientes from '@/components/SeguimientoClientes'

export default function SeguimientoClientesPage() {
  const [authorized, setAuthorized] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const token    = localStorage.getItem('token')
    const userData = localStorage.getItem('user')

    if (!token || !userData) {
      router.push('/login')
      return
    }

    try {
      const user = JSON.parse(userData)
      const rol  = (user.rol || '').toUpperCase()
      if (['SUPER_ADMIN', 'ADMIN'].includes(rol)) {
        setAuthorized(true)
      } else {
        router.push('/dashboard')
      }
    } catch {
      router.push('/login')
    }
  }, [router])

  if (!authorized) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-slate-500 text-sm">Verificando acceso…</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-indigo-50/30">
      {/* ── Header ── */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            <div className="flex items-center gap-3">
              <a
                href="/dashboard"
                className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
                Dashboard
              </a>
              <span className="text-slate-300">/</span>
              <div className="flex items-center gap-2">
                <span className="text-lg">👥</span>
                <span className="font-semibold text-slate-800 text-sm">Seguimiento de Clientes</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href="/recordatorios"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition-colors font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                Recordatorios
              </a>
              <a
                href="/clientes"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition-colors font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                Clientes
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* ── Contenido ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Título + descripción */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Seguimiento de Clientes</h1>
          <p className="text-slate-500 text-sm mt-1">
            Lista completa de clientes con sus boletas, estado de pago y recordatorios enviados.
            Ordenado del cliente más antiguo al más reciente.
          </p>
        </div>

        <SeguimientoClientes />
      </main>
    </div>
  )
}
