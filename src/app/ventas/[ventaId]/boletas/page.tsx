'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ventasApi } from '@/lib/ventasApi'
import { getStorageImageUrl } from '@/lib/storageImageUrl'
import BoletaTicket from '@/components/BoletaTicket'
import ResponsiveBoletaWrapper from '@/components/ResponsiveBoletaWrapper'
import { downloadBoletaImage } from '@/utils/downloadBoletaImage'
import { formatBoletaNumeros, normalizeNumeros } from '@/utils/formatBoletaNumeros'

interface BoletaInfo {
  id: string
  numero: number
  numeros?: number[]
  estado: string
  precio_boleta?: number
  total_pagado_boleta?: number
  saldo_pendiente_boleta?: number
  qr_url?: string
  imagen_url?: string
  nota?: string | null
}

export default function VentasBoletasPage() {
  const params = useParams()
  const router = useRouter()
  const ventaId = params.ventaId as string
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [clienteNombre, setClienteNombre] = useState('')
  const [clienteIdentificacion, setClienteIdentificacion] = useState('')
  const [rifaNombre, setRifaNombre] = useState('')
  const [boletas, setBoletas] = useState<BoletaInfo[]>([])
  const [estadoVenta, setEstadoVenta] = useState('')

  useEffect(() => {
    if (!ventaId) return
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      return
    }
    fetchDetalle()
  }, [ventaId, router])

  const fetchDetalle = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await ventasApi.getVentaDetalleFinanciero(ventaId)
      const data = response.data as any
      setClienteNombre(data.cliente_nombre ?? data.nombre ?? 'Cliente')
      setClienteIdentificacion(data.cliente_identificacion ?? data.identificacion ?? '')
      setRifaNombre(data.rifa_nombre ?? '')
      setBoletas(data.boletas ?? [])
      setEstadoVenta(data.estado_venta ?? '')
    } catch (err: any) {
      setError(err?.message ?? 'Error al cargar la venta')
    } finally {
      setLoading(false)
    }
  }

  const descargarBoleta = useCallback(async (boletaNumero: number, elementId: string) => {
    try {
      const cc = (clienteIdentificacion || 'SIN_CC').replace(/\s+/g, '_')
      await downloadBoletaImage({
        elementId,
        fileName: `boleta_${boletaNumero.toString().padStart(4, '0')}_CC_${cc}.png`,
      })
    } catch (err) {
      console.error('Error descargando boleta:', err)
    }
  }, [clienteIdentificacion])

  const descargarTodas = useCallback(async () => {
    for (const b of boletas) {
      await descargarBoleta(b.numero, `venta-boleta-${b.id}`)
      await new Promise(r => setTimeout(r, 500))
    }
  }, [boletas, descargarBoleta])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-600">Cargando boletas...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow border border-red-200 p-6 max-w-md">
          <p className="text-red-600 font-medium mb-4">{error}</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300"
          >
            Volver
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h1 className="text-xl font-semibold text-slate-900 mb-1">
            Entregar boletas
          </h1>
          <p className="text-slate-600 text-sm">
            Cliente: <span className="font-medium text-slate-800">{clienteNombre}</span>
            {estadoVenta && (
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                {estadoVenta}
              </span>
            )}
          </p>
        </div>

        {/* Botones de acción globales */}
        {boletas.length > 0 && (
          <div className="flex justify-end mb-4">
            <button
              onClick={descargarTodas}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Descargar Todas
            </button>
          </div>
        )}

        {boletas.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center text-slate-600">
            No hay boletas asociadas a esta venta.
          </div>
        ) : (
          <div className="space-y-6">
            {boletas.map((boleta) => (
              <div
                key={boleta.id}
                className="bg-white rounded-xl shadow-sm border border-slate-200 p-4"
              >
                <div className="flex items-center justify-between mb-3 gap-2">
                  <span className="text-lg font-bold text-slate-800">
                    Boleta {formatBoletaNumeros(boleta.numeros, boleta.numero)}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => descargarBoleta(boleta.numero, `venta-boleta-${boleta.id}`)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Descargar
                    </button>
                    <Link
                      href={`/boletas/${boleta.id}/print`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                      Imprimir
                    </Link>
                  </div>
                </div>
                <ResponsiveBoletaWrapper id={`venta-boleta-${boleta.id}`}>
                    <BoletaTicket
                      qrUrl={boleta.qr_url || `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=boleta-${boleta.id}`}
                      barcode=""
                      numero={boleta.numero}
                      numeros={normalizeNumeros(boleta.numeros, boleta.numero)}
                      imagenUrl={boleta.imagen_url}
                      rifaNombre={rifaNombre}
                      estado={boleta.estado}
                      clienteInfo={{
                        nombre: clienteNombre,
                        identificacion: clienteIdentificacion
                      }}
                      deuda={boleta.saldo_pendiente_boleta}
                      precio={boleta.precio_boleta}
                      nota={boleta.nota}
                    />
                </ResponsiveBoletaWrapper>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
          >
            Volver
          </button>
        </div>
      </div>
    </div>
  )
}
