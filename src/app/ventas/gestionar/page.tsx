'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ClienteSearch from '@/components/ventas/ClienteSearch'
import { Cliente } from '@/types/ventas'
import { ventasApi } from '@/lib/ventasApi'
import ListaVentasPendientes from '@/components/ventas/ListaVentasPendientes'
import { formatBoletaNumeros } from '@/utils/formatBoletaNumeros'

interface ResultadoBusquedaBoleta {
  boleta_buscada: number
  boleta_buscada_numeros?: number[]
  rifa_nombre: string
  doble_oportunidad?: boolean
  venta_id: string
  estado_venta: string
  created_at: string
  cliente: {
    id: string
    nombre: string
    telefono: string
    email?: string
    identificacion?: string
    direccion?: string
  }
  monto_total: number
  total_pagado: number
  saldo_pendiente: number
  boletas: any[]
}

export default function GestionarAbonosPage() {
  const router = useRouter()

  const [modoBusqueda, setModoBusqueda] = useState<'boleta' | 'cliente'>('boleta')
  const [numeroBoleta, setNumeroBoleta] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null)
  const [resultadosBoleta, setResultadosBoleta] = useState<ResultadoBusquedaBoleta[] | null>(null)
  const [clienteDeBoleta, setClienteDeBoleta] = useState<Cliente | null>(null)
  const [boletaBuscadaNum, setBoletaBuscadaNum] = useState<number | null>(null)
  const [boletaBuscadaNumeros, setBoletaBuscadaNumeros] = useState<number[] | null>(null)
  const [ventaConBoletaId, setVentaConBoletaId] = useState<string | null>(null)

  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null)

  const clienteActivo = clienteSeleccionado || clienteDeBoleta

  const volverVentas = () => router.push('/ventas')
  const volverDashboard = () => router.push('/mis-reportes')

  const buscarPorBoleta = async () => {
    const num = parseInt(numeroBoleta.trim())
    if (isNaN(num) || num <= 0) {
      setErrorBusqueda('Ingresa un número de boleta válido')
      return
    }

    setBuscando(true)
    setErrorBusqueda(null)
    setResultadosBoleta(null)
    setClienteDeBoleta(null)
    setBoletaBuscadaNum(null)
    setBoletaBuscadaNumeros(null)
    setVentaConBoletaId(null)

    try {
      const response = await ventasApi.buscarBoletaParaAbono(num)
      const data = response.data

      if (!data.encontrada) {
        setErrorBusqueda(data.mensaje || 'Boleta no encontrada o sin saldo pendiente')
        return
      }

      setResultadosBoleta(data.resultados)
      setBoletaBuscadaNum(num)
      const primero = data.resultados?.[0]
      setBoletaBuscadaNumeros(
        Array.isArray(primero?.boleta_buscada_numeros) && primero.boleta_buscada_numeros.length > 0
          ? primero.boleta_buscada_numeros.map(Number)
          : [num]
      )

      // Mismo flujo que búsqueda por cliente: mostrar todas las ventas del cliente.
      // Si hay un solo cliente en los resultados, ir directo a su lista de ventas.
      const clientesUnicos = new Map<string, ResultadoBusquedaBoleta>()
      for (const r of data.resultados) {
        if (r.cliente?.id) clientesUnicos.set(r.cliente.id, r)
      }

      if (clientesUnicos.size === 1) {
        const resultado = data.resultados[0]
        setClienteDeBoleta({
          id: resultado.cliente.id,
          nombre: resultado.cliente.nombre,
          telefono: resultado.cliente.telefono,
          email: resultado.cliente.email,
          identificacion: resultado.cliente.identificacion,
          direccion: resultado.cliente.direccion,
        })
        setVentaConBoletaId(resultado.venta_id)
      }
      // Si hay varios clientes (misma boleta en distintas rifas), se muestra selector abajo.
    } catch (err: any) {
      setErrorBusqueda(err.message || 'Error buscando boleta')
    } finally {
      setBuscando(false)
    }
  }

  const resetBusqueda = () => {
    setNumeroBoleta('')
    setResultadosBoleta(null)
    setClienteDeBoleta(null)
    setBoletaBuscadaNum(null)
    setBoletaBuscadaNumeros(null)
    setVentaConBoletaId(null)
    setErrorBusqueda(null)
    setClienteSeleccionado(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const seleccionarClienteDeBoleta = (resultado: ResultadoBusquedaBoleta) => {
    setClienteDeBoleta({
      id: resultado.cliente.id,
      nombre: resultado.cliente.nombre,
      telefono: resultado.cliente.telefono,
      email: resultado.cliente.email,
      identificacion: resultado.cliente.identificacion,
      direccion: resultado.cliente.direccion,
    })
    setVentaConBoletaId(resultado.venta_id)
    if (Array.isArray(resultado.boleta_buscada_numeros) && resultado.boleta_buscada_numeros.length > 0) {
      setBoletaBuscadaNumeros(resultado.boleta_buscada_numeros.map(Number))
    }
  }

  return (
    <div className="px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
      <header className="mb-6 border-b-[1.5px] border-black pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={volverVentas}
            className="border-[1.5px] border-black bg-[var(--surface-elevated)] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider hover:bg-[var(--primary)]"
          >
            ← Ventas
          </button>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">Cobranza</p>
            <h1 className="text-2xl font-[800] tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              Gestionar abonos
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-5xl space-y-6">

        {/* Selector de modo de búsqueda */}
        {!clienteActivo && (
          <div className="space-y-4">
            {/* Tabs de búsqueda */}
            <div className="bg-[var(--surface-elevated)] border-[1.5px] border-black shadow-[4px_4px_0_#101010] overflow-hidden">
              <div className="flex border-b-[1.5px] border-black">
                <button
                  onClick={() => { setModoBusqueda('boleta'); resetBusqueda() }}
                  className={`flex-1 px-6 py-4 text-xs font-bold uppercase tracking-wider transition-colors ${
                    modoBusqueda === 'boleta'
                      ? 'bg-[var(--primary)] text-black'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)]'
                  }`}
                >
                  Buscar por # del par
                </button>
                <button
                  onClick={() => { setModoBusqueda('cliente'); resetBusqueda() }}
                  className={`flex-1 px-6 py-4 text-xs font-bold uppercase tracking-wider transition-colors border-l-[1.5px] border-black ${
                    modoBusqueda === 'cliente'
                      ? 'bg-[var(--primary)] text-black'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)]'
                  }`}
                >
                  Buscar por cliente
                </button>
              </div>

              <div className="p-6">
                {modoBusqueda === 'boleta' && (
                  <div className="space-y-4">
                    <p className="text-sm text-slate-600">
                      Ingresa cualquier número de la boleta (en doble oportunidad, cualquiera de los dos del par).
                    </p>
                    <div className="flex gap-3">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">#</span>
                        <input
                          type="number"
                          value={numeroBoleta}
                          onChange={(e) => setNumeroBoleta(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && buscarPorBoleta()}
                          placeholder="Ej: 42"
                          min={1}
                          className="w-full pl-8 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 bg-white text-black text-lg font-semibold"
                        />
                      </div>
                      <button
                        onClick={buscarPorBoleta}
                        disabled={buscando || !numeroBoleta.trim()}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium whitespace-nowrap"
                      >
                        {buscando ? 'Buscando...' : '🔍 Buscar'}
                      </button>
                    </div>

                    {errorBusqueda && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-3">
                        <span className="text-amber-600 text-lg">⚠️</span>
                        <div>
                          <p className="text-amber-800 font-medium text-sm">{errorBusqueda}</p>
                          <p className="text-amber-700 text-xs mt-1">Solo boletas reservadas o con saldo pendiente aparecen aquí.</p>
                        </div>
                      </div>
                    )}

                    {/* Varios clientes con la misma boleta (distintas rifas) */}
                    {resultadosBoleta && resultadosBoleta.length > 0 && !clienteDeBoleta && (
                      <div className="space-y-3">
                        <p className="text-sm text-slate-600 font-medium">
                          La boleta {formatBoletaNumeros(
                            resultadosBoleta[0]?.boleta_buscada_numeros,
                            boletaBuscadaNum
                          )} aparece en más de un cliente. Selecciona cuál gestionar:
                        </p>
                        {resultadosBoleta.map((r) => (
                          <button
                            key={`${r.venta_id}-${r.cliente.id}`}
                            onClick={() => seleccionarClienteDeBoleta(r)}
                            className="w-full text-left border border-slate-200 rounded-lg p-4 hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-semibold text-slate-900">{r.cliente.nombre}</p>
                                <p className="text-sm text-slate-600">{r.cliente.telefono}</p>
                                <p className="text-sm text-slate-500 mt-1">
                                  {r.rifa_nombre} · {r.boletas.length} boleta{r.boletas.length !== 1 ? 's' : ''}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm text-red-600 font-semibold">
                                  Saldo: ${r.saldo_pendiente.toLocaleString('es-CO')}
                                </p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {modoBusqueda === 'cliente' && (
                  <ClienteSearch
                    permitirCrear={false}
                    onClienteSelected={(cliente) => setClienteSeleccionado(cliente)}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Resultado: ventas del cliente (búsqueda por boleta o por cliente) */}
        {clienteActivo && (
          <div className="space-y-6">
            {boletaBuscadaNum != null && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🎫</span>
                  <div>
                    <p className="text-sm text-blue-700">
                      Boleta {formatBoletaNumeros(boletaBuscadaNumeros, boletaBuscadaNum)} encontrada
                      {resultadosBoleta?.[0]?.rifa_nombre && (
                        <> en <strong>{resultadosBoleta.find(r => r.venta_id === ventaConBoletaId)?.rifa_nombre || resultadosBoleta[0].rifa_nombre}</strong></>
                      )}
                    </p>
                    <p className="text-xs text-blue-600 mt-0.5">
                      Se muestran todas las ventas pendientes de este cliente. El par buscado aparece resaltado.
                    </p>
                  </div>
                </div>
                <button
                  onClick={resetBusqueda}
                  className="px-3 py-1.5 text-sm border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-100"
                >
                  Nueva búsqueda
                </button>
              </div>
            )}

            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-xl">{clienteDeBoleta ? '🎫' : '👤'}</span>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{clienteActivo.nombre}</h2>
                    <p className="text-sm text-slate-600">{clienteActivo.telefono}</p>
                    {clienteActivo.identificacion && (
                      <p className="text-xs text-slate-500">CC: {clienteActivo.identificacion}</p>
                    )}
                    {clienteActivo.email && (
                      <p className="text-xs text-slate-500">{clienteActivo.email}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={resetBusqueda}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                >
                  Cambiar
                </button>
              </div>
            </div>

            <ListaVentasPendientes
              clienteId={clienteActivo.id}
              ventaIdDirecta={
                // Tras buscar por boleta, abrir directo esa venta (evita lista vacía / un clic menos)
                clienteDeBoleta && ventaConBoletaId ? ventaConBoletaId : undefined
              }
              boletaDestacada={boletaBuscadaNum ?? undefined}
              ventaDestacadaId={ventaConBoletaId ?? undefined}
              onAbonoFinalizado={resetBusqueda}
            />
          </div>
        )}
      </main>
    </div>
  )
}