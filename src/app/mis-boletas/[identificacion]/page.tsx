'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import BoletaTicket from '@/components/BoletaTicket'
import ResponsiveBoletaWrapper from '@/components/ResponsiveBoletaWrapper'
import { downloadBoletaImage } from '@/utils/downloadBoletaImage'

interface BoletaData {
  id: string
  numero: number
  estado: string
  qr_url: string
  barcode: string
  imagen_url?: string | null
  bloqueo_hasta?: string | null
  venta_id?: string | null
  estado_venta?: string | null
  precio_boleta: number
  total_pagado: number
  saldo_pendiente: number
  nota?: string | null
}

interface RifaGroup {
  rifa_id: string
  rifa_nombre: string
  precio_boleta: number
  fecha_sorteo: string
  premio_principal: string
  boletas: BoletaData[]
}

interface ClienteData {
  nombre: string
  telefono: string
  identificacion: string
  email?: string | null
}

interface ApiResponse {
  success: boolean
  data: {
    cliente: ClienteData | null
    rifas: RifaGroup[]
    total_boletas: number
  }
  message?: string
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://rifas-backend-production.up.railway.app/api'
const PUBLIC_API_KEY = process.env.NEXT_PUBLIC_PUBLIC_API_KEY || 'pk_4f9a8c7e2d1b6a9f3c0d5e7f8a2b4c6d'

export default function MisBoletasPage() {
  const params = useParams()
  const identificacion = params.identificacion as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cliente, setCliente] = useState<ClienteData | null>(null)
  const [rifas, setRifas] = useState<RifaGroup[]>([])
  const [totalBoletas, setTotalBoletas] = useState(0)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  useEffect(() => {
    const fetchBoletas = async () => {
      try {
        setLoading(true)
        setError(null)

        const res = await fetch(`${API_BASE}/public/cliente/${encodeURIComponent(identificacion)}/boletas`, {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': PUBLIC_API_KEY
          }
        })

        const data: ApiResponse = await res.json()

        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Error al consultar boletas')
        }

        setCliente(data.data.cliente)
        setRifas(data.data.rifas)
        setTotalBoletas(data.data.total_boletas)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      } finally {
        setLoading(false)
      }
    }

    if (identificacion) {
      fetchBoletas()
    }
  }, [identificacion])

  const descargarBoleta = useCallback(async (boleta: BoletaData, cc: string) => {
    setDownloadingId(boleta.id)
    try {
      const num = boleta.numero.toString().padStart(4, '0')
      await downloadBoletaImage({
        elementId: `boleta-${boleta.id}`,
        fileName: `boleta_${num}_CC_${cc.replace(/\s+/g, '_')}.png`,
      })
    } catch (err) {
      console.error('Error descargando boleta:', err)
    } finally {
      setDownloadingId(null)
    }
  }, [])

  const descargarTodas = useCallback(async () => {
    if (!cliente) return
    const cc = cliente.identificacion || 'SIN_CC'
    for (const rifa of rifas) {
      for (const boleta of rifa.boletas) {
        await descargarBoleta(boleta, cc)
        await new Promise(r => setTimeout(r, 600))
      }
    }
  }, [rifas, cliente, descargarBoleta])

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <p className="text-slate-600 text-lg">Cargando tus boletas...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.232 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Error</h2>
          <p className="text-slate-600">{error}</p>
        </div>
      </div>
    )
  }

  // No boletas found
  if (totalBoletas === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Sin boletas</h2>
          <p className="text-slate-600">No se encontraron boletas asociadas a la identificación <strong>{identificacion}</strong></p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-6 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">🎫 Mis Boletas</h1>
              {cliente && (
                <p className="text-slate-600 mt-1">
                  {cliente.nombre} — CC. {cliente.identificacion}
                </p>
              )}
              <p className="text-sm text-slate-500 mt-1">
                {totalBoletas} boleta{totalBoletas > 1 ? 's' : ''} en {rifas.length} rifa{rifas.length > 1 ? 's' : ''}
              </p>
            </div>

            {totalBoletas > 0 && (
              <button
                onClick={descargarTodas}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Descargar Todas
              </button>
            )}
          </div>
        </div>

        {/* Rifas y Boletas */}
        {rifas.map((rifa) => (
          <div key={rifa.rifa_id} className="mb-8">
            {/* Rifa Header */}
            <div className="bg-white rounded-t-xl border border-slate-200 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900">{rifa.rifa_nombre}</h2>
              <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-600">
                <span>🏆 Premio: <strong>{rifa.premio_principal}</strong></span>
                <span>📅 Sorteo: <strong>{new Date(rifa.fecha_sorteo).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}</strong></span>
                <span>💰 Precio: <strong>${rifa.precio_boleta.toLocaleString('es-CO')}</strong></span>
              </div>
            </div>

            {/* Boletas Grid */}
            <div className="bg-slate-50 rounded-b-xl border border-t-0 border-slate-200 p-4">
              <div className="space-y-6">
                {rifa.boletas.map((boleta) => (
                  <div key={boleta.id} className="relative">
                    {/* BoletaTicket */}
                    <ResponsiveBoletaWrapper id={`boleta-${boleta.id}`}>
                        <BoletaTicket
                          qrUrl={boleta.qr_url}
                          barcode={boleta.barcode}
                          numero={boleta.numero}
                          imagenUrl={boleta.imagen_url}
                          rifaNombre={rifa.rifa_nombre}
                          estado={boleta.estado}
                          clienteInfo={cliente ? {
                            nombre: cliente.nombre,
                            identificacion: cliente.identificacion
                          } : null}
                          deuda={boleta.saldo_pendiente > 0 ? boleta.saldo_pendiente : null}
                          reservadaHasta={boleta.bloqueo_hasta}
                          precio={boleta.precio_boleta}
                          nota={boleta.nota}
                        />
                    </ResponsiveBoletaWrapper>

                    {/* Info + Download Button */}
                    <div className="flex items-center justify-between mt-3 px-2">
                      <div className="text-sm text-slate-600">
                        {boleta.saldo_pendiente > 0 ? (
                          <span className="text-amber-600 font-medium">
                            ⚠️ Saldo pendiente: ${boleta.saldo_pendiente.toLocaleString('es-CO')}
                          </span>
                        ) : (
                          <span className="text-green-600 font-medium">✅ Pago completo</span>
                        )}
                      </div>
                      <button
                        onClick={() => descargarBoleta(boleta, cliente?.identificacion || 'SIN_CC')}
                        disabled={downloadingId === boleta.id}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors text-sm disabled:opacity-50"
                      >
                        {downloadingId === boleta.id ? (
                          <>
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Descargando...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Descargar
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}

        {/* Footer */}
        <div className="text-center text-sm text-slate-400 py-6">
          <p>🍀 ¡Buena suerte en el sorteo!</p>
        </div>
      </div>
    </div>
  )
}
