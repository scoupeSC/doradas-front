'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { boletaApi } from '@/lib/boletaApi'
import type { BoletaDetail } from '@/types/boleta'
import BoletaDetailComponent from '@/components/BoletaDetail'

export default function BoletaDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [boleta, setBoleta] = useState<BoletaDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)

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
      
      fetchBoletaDetail()
    } catch (error) {
      router.push('/login')
    }
  }, [router])

  const fetchBoletaDetail = async () => {
    try {
      setLoading(true)
      const boletaId = params.id as string
      
      if (!boletaId) {
        setError('ID de boleta no proporcionado')
        return
      }

      const response = await boletaApi.getBoletaById(boletaId)
      setBoleta(response.data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar los detalles de la boleta')
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    if (boleta) {
      router.push(`/boletas/${boleta.id}/print`)
    }
  }

  if (userRole && userRole !== 'SUPER_ADMIN' && userRole !== 'VENDEDOR' && userRole !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-6 py-4 rounded-lg max-w-md">
          <h2 className="text-lg font-medium mb-2">Acceso Restringido</h2>
          <p>Este módulo solo está disponible para usuarios con rol SUPER_ADMIN, VENDEDOR o ADMIN</p>
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500">Cargando detalles de la boleta...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg max-w-md">
          <h2 className="text-lg font-medium mb-2">Error</h2>
          <p>{error}</p>
          <div className="mt-4 space-x-4">
            <button
              onClick={fetchBoletaDetail}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Reintentar
            </button>
            <button
              onClick={() => router.push('/boletas')}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
            >
              Volver a Boletas
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!boleta) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-6 py-4 rounded-lg max-w-md">
          <h2 className="text-lg font-medium mb-2">Boleta No Encontrada</h2>
          <p>No se encontró la boleta solicitada</p>
          <button
            onClick={() => router.push('/boletas')}
            className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800"
          >
            Volver a Boletas
          </button>
        </div>
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
                onClick={() => router.push('/boletas/ver')}
                className="text-slate-600 hover:text-slate-900 transition-colors"
              >
                ← Boletas
              </button>
              <h1 className="text-2xl font-light text-neutral-100">Detalles de Boleta</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-slate-600">
                Boleta #{boleta.numero.toString().padStart(4, '0')}
              </span>
              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                boleta.estado === 'DISPONIBLE' ? 'bg-green-100 text-green-800' :
                boleta.estado === 'RESERVADA' ? 'bg-yellow-100 text-yellow-800' :
                boleta.estado === 'CON_PAGO' ? 'bg-blue-100 text-blue-800' :
                boleta.estado === 'TRANSFERIDA' ? 'bg-purple-100 text-purple-800' :
                'bg-red-100 text-red-800'
              }`}>
                {boleta.estado === 'DISPONIBLE' ? 'Disponible' :
                 boleta.estado === 'RESERVADA' ? 'Reservada' :
                 boleta.estado === 'CON_PAGO' ? 'Con Pago' :
                 boleta.estado === 'TRANSFERIDA' ? 'Transferida' :
                 boleta.estado}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <BoletaDetailComponent boleta={boleta} onPrint={handlePrint} />
      </main>
    </div>
  )
}
