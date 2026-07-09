'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function BoletasPage() {
  const [userRole, setUserRole] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')
    
    if (!token || !userData) {
      router.push('/login')
      return
    }

    try {
      const user = JSON.parse(userData)
      setUserRole(user.rol)
      
      // Check if user has allowed role
      if (user.rol !== 'SUPER_ADMIN' && user.rol !== 'ADMIN' && user.rol !== 'VENDEDOR') {
        router.push('/dashboard')
        return
      }
    } catch (error) {
      router.push('/login')
    }
  }, [router])

  if (userRole && userRole !== 'SUPER_ADMIN' && userRole !== 'ADMIN' && userRole !== 'VENDEDOR') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-6 py-4 rounded-lg max-w-md">
          <h2 className="text-lg font-medium mb-2">Acceso Restringido</h2>
          <p>Este módulo solo está disponible para usuarios con rol SUPER_ADMIN, ADMIN o VENDEDOR</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800"
          >
            Volver al Dashboard
          </button>
        </div>
      </div>
    )
  }

  if (!userRole) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500">Cargando...</div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="app-header sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="text-slate-600 hover:text-slate-900 transition-colors"
              >
                ← Dashboard
              </button>
              <h1 className="text-2xl font-light text-neutral-100">Módulo de Boletas</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Opción: Crear Boletas */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 hover:shadow-md transition-shadow cursor-pointer"
               onClick={() => router.push('/boletas/crear')}>
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-900 mb-2">Crear Boletas</h2>
                <p className="text-slate-600">Genera nuevas boletas para las rifas disponibles</p>
              </div>
              <div className="text-blue-600 font-medium hover:text-blue-700">
                Ir a crear boletas →
              </div>
            </div>
          </div>

          {/* Opción: Ver Boletas */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 hover:shadow-md transition-shadow cursor-pointer"
               onClick={() => router.push('/boletas/ver')}>
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-900 mb-2">Ver Boletas</h2>
                <p className="text-slate-600">Consulta todas las boletas por rifa</p>
              </div>
              <div className="text-green-600 font-medium hover:text-green-700">
                Ir a ver boletas →
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 bg-slate-50 rounded-lg border border-slate-200 p-6">
          <h3 className="text-lg font-medium text-slate-900 mb-3">Guía rápida</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-blue-600 rounded-full mt-1.5"></div>
              <div>
                <strong>Crear Boletas:</strong> Genera nuevas boletas para las rifas activas
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-green-600 rounded-full mt-1.5"></div>
              <div>
                <strong>Ver Boletas:</strong> Consulta el estado y detalles de todas las boletas
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
