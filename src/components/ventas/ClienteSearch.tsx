'use client'

import { useState, useEffect } from 'react'
import { Cliente, ClienteSimilar } from '@/types/ventas'
import { ventasApi } from '@/lib/ventasApi'

interface ClienteSearchProps {
  onClienteSelected: (cliente: Cliente) => void
  onClienteCreated?: (cliente: Cliente) => void
  permitirCrear?: boolean
  rifaId?: string
}

const ESTADO_BOLETA_STYLES: Record<string, string> = {
  PAGADA: 'bg-green-100 text-green-800',
  RESERVADA: 'bg-amber-100 text-amber-800',
  ABONADA: 'bg-blue-100 text-blue-800',
  ANULADA: 'bg-red-100 text-red-800',
  DISPONIBLE: 'bg-slate-100 text-slate-700'
}

function formatNumeroBoleta(numero: number) {
  return String(numero).padStart(4, '0')
}

function getEstadoBoletaStyle(estado: string) {
  return ESTADO_BOLETA_STYLES[estado] || 'bg-slate-100 text-slate-700'
}

export default function ClienteSearch({
  onClienteSelected,
  onClienteCreated,
  permitirCrear = true,
  rifaId
}: ClienteSearchProps) {
  const [modo, setModo] = useState<'BUSCAR' | 'NUEVO'>('BUSCAR')
  const [tipoBusqueda, setTipoBusqueda] = useState<'CEDULA' | 'GENERAL'>('CEDULA')
  const [busqueda, setBusqueda] = useState('')
  const [cedulaBusqueda, setCedulaBusqueda] = useState('')
  const [resultados, setResultados] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(false)
  const [clienteNuevo, setClienteNuevo] = useState<Cliente>({
    nombre: '',
    telefono: '',
    email: '',
    direccion: '',
    identificacion: ''
  })
  const [creando, setCreando] = useState(false)
  const [clienteCreadoExitosamente, setClienteCreadoExitosamente] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generandoId, setGenerandoId] = useState(false)
  const [similares, setSimilares] = useState<ClienteSimilar[]>([])
  const [loadingSimilares, setLoadingSimilares] = useState(false)
  const [similaresOcultos, setSimilaresOcultos] = useState(false)
  const [terminoSimilar, setTerminoSimilar] = useState('')


  useEffect(() => {
  if (!permitirCrear) {
    setModo('BUSCAR')
  }
}, [permitirCrear])

  useEffect(() => {
    if (modo !== 'NUEVO') {
      setSimilares([])
      setSimilaresOcultos(false)
      setTerminoSimilar('')
      return
    }

    const nombre = clienteNuevo.nombre.trim()
    const identificacion = (clienteNuevo.identificacion ?? '').trim()
    const termino = identificacion.length >= 5 ? identificacion : nombre

    if (similaresOcultos || termino.length < 3) {
      setSimilares([])
      setLoadingSimilares(false)
      setTerminoSimilar(termino)
      return
    }

    setTerminoSimilar(termino)
    setLoadingSimilares(true)

    const timeoutId = setTimeout(async () => {
      try {
        const response = await ventasApi.buscarClientesSimilares(termino, rifaId)
        setSimilares(response.data || [])
      } catch {
        setSimilares([])
      } finally {
        setLoadingSimilares(false)
      }
    }, 350)

    return () => clearTimeout(timeoutId)
  }, [
    modo,
    clienteNuevo.nombre,
    clienteNuevo.identificacion,
    similaresOcultos,
    rifaId
  ])

  // Buscar clientes cuando cambia la búsqueda
  useEffect(() => {
    const buscarClientes = async () => {
      setLoading(true)
      setError(null)
      
      try {
        let response
        
        if (tipoBusqueda === 'CEDULA' && cedulaBusqueda.length >= 7)  {
          // Búsqueda específica por cédula
          response = await ventasApi.buscarClientePorCedula(cedulaBusqueda.trim())
          setResultados([response.data])
        } else if (tipoBusqueda === 'GENERAL' && busqueda.length >= 3) {
          // Búsqueda general
         const response = await ventasApi.buscarClientes(busqueda)
          setResultados(response.data || [])
        } else {
          setResultados([])
          setLoading(false)
          return
        }
      } catch (error) {
        // console.error('Error buscando clientes:', error)
        // setError('Error buscando clientes')
        setResultados([])
      } finally {
        setLoading(false)
      }
    }

    const timeoutId = setTimeout(buscarClientes, 300)
    return () => clearTimeout(timeoutId)
  }, [busqueda, cedulaBusqueda, tipoBusqueda])

  // Generar identificación secuencial
  const generarIdentificacion = async () => {
    setGenerandoId(true)
    setError(null)
    try {
      const response = await ventasApi.getNextIdentificacion()
      setClienteNuevo(prev => ({ ...prev, identificacion: response.data.identificacion }))
    } catch (err) {
      setError('Error al generar identificación')
    } finally {
      setGenerandoId(false)
    }
  }

  // Crear nuevo cliente
  const crearCliente = async () => {
    if (!clienteNuevo.nombre || !clienteNuevo.telefono) {
      setError('Nombre y teléfono son requeridos')
      return
    }

    setCreando(true)
    setError(null)

    try {
      const response = await ventasApi.crearCliente(clienteNuevo)
      const nuevoCliente = response.data?.cliente ?? response.data
      
      console.log('Cliente creado exitosamente:', nuevoCliente)
      
      if (!nuevoCliente || !nuevoCliente.nombre) {
        setError('Error: El servidor no devolvió los datos del cliente correctamente')
        return
      }

      // Llamar al callback con el cliente creado
      // Seleccionar automáticamente el cliente recién creado
      onClienteSelected(nuevoCliente)

    //   // Notificar creación si existe callback
    //   if (onClienteCreated) {
    //   onClienteCreated(nuevoCliente)
    //  }
      
      // Marcar como creado exitosamente
      setClienteCreadoExitosamente(true)
      
      // Limpiar formulario
      setClienteNuevo({
        nombre: '',
        telefono: '',
        email: '',
        direccion: '',
        identificacion: ''
      })
      
      // Limpiar error si había
      setError(null)
      
    } catch (error: any) {
      console.error('Error creando cliente:', error)
      setError(error.message || 'Error creando cliente')
    } finally {
      setCreando(false)
    }
  }

  // Seleccionar cliente existente
  const seleccionarCliente = (cliente: Cliente) => {
    onClienteSelected(cliente)
    setBusqueda('')
    setCedulaBusqueda('')
    setResultados([])
    setSimilares([])
    setSimilaresOcultos(false)
    setClienteCreadoExitosamente(false)
    setError(null)
  }

  const usarClienteSimilar = (cliente: ClienteSimilar) => {
    seleccionarCliente({
      id: cliente.id,
      nombre: cliente.nombre,
      telefono: cliente.telefono,
      email: cliente.email,
      direccion: cliente.direccion,
      identificacion: cliente.identificacion
    })
  }

  const renderPanelSimilares = () => {
    if (modo !== 'NUEVO' || similaresOcultos || terminoSimilar.length < 3) {
      return null
    }

    if (loadingSimilares) {
      return (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Buscando clientes similares...
        </div>
      )
    }

    if (similares.length === 0) {
      return null
    }

    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-amber-950">
              ¿Ya existe este cliente?
            </p>
            <p className="text-sm text-amber-900 mt-1">
              Encontramos {similares.length} cliente{similares.length !== 1 ? 's' : ''} parecido{similares.length !== 1 ? 's' : ''}. Revisa cédula, boleta y estado antes de crear uno nuevo.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSimilaresOcultos(true)}
            className="text-xs font-medium text-amber-800 hover:text-amber-950 whitespace-nowrap"
          >
            Crear nuevo igual
          </button>
        </div>

        <div className="space-y-2 max-h-80 overflow-y-auto">
          {similares.map((cliente) => (
            <div
              key={cliente.id}
              className="rounded-lg border border-amber-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-900">{cliente.nombre}</div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                    {cliente.identificacion && (
                      <span>C.C: {cliente.identificacion}</span>
                    )}
                    <span>{cliente.telefono}</span>
                    {cliente.email && <span>{cliente.email}</span>}
                  </div>

                  {cliente.boletas?.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Historial de boletas
                      </p>
                      {cliente.boletas.map((boleta, index) => (
                        <div
                          key={`${cliente.id}-${boleta.rifa_id || boleta.rifa_nombre}-${boleta.numero}-${index}`}
                          className="flex flex-wrap items-center gap-2 text-sm"
                        >
                          <span className="font-medium text-slate-800">
                            #{formatNumeroBoleta(boleta.numero)}
                          </span>
                          <span className="text-slate-500">·</span>
                          <span className="text-slate-700">{boleta.rifa_nombre}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${getEstadoBoletaStyle(boleta.estado)}`}
                          >
                            {boleta.estado}
                          </span>
                          {boleta.rifa_estado === 'TERMINADA' && (
                            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800">
                              Rifa terminada
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">
                      Sin boletas registradas en rifas anteriores.
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => usarClienteSimilar(cliente)}
                  className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Usar este cliente
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
      <h2 className="text-lg font-bold text-black mb-6">Datos del Cliente</h2>
      
      {/* Tabs para cambiar modo */}
      {permitirCrear && (
      <div className="flex space-x-1 mb-6 bg-slate-100 p-1 rounded-lg">
        <button
          onClick={() => {
            setModo('BUSCAR')
            setClienteCreadoExitosamente(false) // Resetear estado
            setError(null)
          }}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
            modo === 'BUSCAR'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Cliente Existente
        </button>
        <button
          onClick={() => {
            setModo('NUEVO')
            setClienteCreadoExitosamente(false)
            setSimilares([])
            setSimilaresOcultos(false)
            setError(null)
          }}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
            modo === 'NUEVO'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Nuevo Cliente
        </button>
      </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {clienteCreadoExitosamente && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            ¡Cliente creado exitosamente! Redirigiendo al resumen...
          </div>
        </div>
      )}

      {!permitirCrear || modo === 'BUSCAR' ? (
        <div className="space-y-4">
          {/* Tabs para tipo de búsqueda */}
          <div className="flex space-x-1 mb-4 bg-slate-50 p-1 rounded-lg">
            <button
              onClick={() => setTipoBusqueda('CEDULA')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                tipoBusqueda === 'CEDULA'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Por Cédula
            </button>
            <button
              onClick={() => setTipoBusqueda('GENERAL')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                tipoBusqueda === 'GENERAL'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              General
            </button>
          </div>

          {/* Campo de búsqueda por cédula */}
          {tipoBusqueda === 'CEDULA' ? (
            <div>
              <label className="block text-sm font-bold text-black mb-2">
                Número de Cédula
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={cedulaBusqueda}
                  onChange={(e) => setCedulaBusqueda(e.target.value.replace(/\D/g, ''))} // Solo números
                  className="block w-full pl-10 pr-3 py-2 border border-slate-400 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white text-black placeholder:text-slate-500"
                  placeholder="Ej: 123456789"
                />
              </div>
            </div>
          ) : (
            /* Campo de búsqueda general */
            <div>
              <label className="block text-sm font-bold text-black mb-2">
                Buscar por nombre, teléfono o email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-slate-400 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white text-black placeholder:text-slate-500"
                  placeholder="Escribe al menos 3 caracteres..."
                />
              </div>
            </div>
          )}

          {/* Resultados de búsqueda */}
          {loading ? (
            <div className="text-center py-4 text-slate-500">
              <div className="inline-flex items-center">
                <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {tipoBusqueda === 'CEDULA' ? 'Buscando por cédula...' : 'Buscando clientes...'}
              </div>
            </div>
          ) : resultados.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-black">
                {resultados.length} cliente{resultados.length !== 1 ? 's' : ''} encontrado{resultados.length !== 1 ? 's' : ''}
                {tipoBusqueda === 'CEDULA' && ' por cédula'}
              </h3>
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-200">
                {resultados.map((cliente) => (
                  <button
                    key={cliente.id}
                    onClick={() => seleccionarCliente(cliente)}
                    className="w-full text-left p-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-slate-900">{cliente.nombre}</div>
                        <div className="text-sm text-slate-600">{cliente.telefono}</div>
                        {cliente.email && (
                          <div className="text-sm text-slate-500">{cliente.email}</div>
                        )}
                        {cliente.identificacion && (
                          <div className="text-sm text-slate-500">C.C: {cliente.identificacion}</div>
                        )}
                      </div>
                      <div className="text-blue-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <svg className="w-12 h-12 mx-auto mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="text-slate-600">
                {tipoBusqueda === 'CEDULA' 
                  ? 'No se encontró cliente con esa cédula'
                  : 'No se encontraron clientes'
                }
              </p>
              <p className="text-sm text-slate-500 mt-1">
                {tipoBusqueda === 'CEDULA' 
                  ? 'Intenta con otro número de cédula o crea un nuevo cliente'
                  : busqueda.length >= 3 
                    ? 'Intenta con otra búsqueda o crea un nuevo cliente'
                    : 'Escribe al menos 3 caracteres para comenzar'
                }
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            Al escribir el nombre o la cédula, mostraremos clientes similares con su historial de boletas para evitar duplicados.
          </div>

          {/* Formulario de nuevo cliente */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-black mb-2">
                Nombre completo *
              </label>
              <input
                type="text"
                value={clienteNuevo.nombre}
                onChange={(e) => {
                  setSimilaresOcultos(false)
                  setClienteNuevo({ ...clienteNuevo, nombre: e.target.value })
                }}
                className="w-full px-3 py-2 border border-slate-400 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white text-black placeholder:text-slate-500"
                placeholder="Juan Pérez"
              />
              <div className="mt-3">
                {renderPanelSimilares()}
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-black mb-2">
                Teléfono *
              </label>
              <input
                type="tel"
                value={clienteNuevo.telefono}
                onChange={(e) => setClienteNuevo({ ...clienteNuevo, telefono: e.target.value })}
                className="w-full px-3 py-2 border border-slate-400 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white text-black placeholder:text-slate-500"
                placeholder="+57 300 123 4567"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-black mb-2">
                Email
              </label>
              <input
                type="email"
                value={clienteNuevo.email}
                onChange={(e) => setClienteNuevo({ ...clienteNuevo, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-400 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white text-black placeholder:text-slate-500"
                placeholder="juan@ejemplo.com"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-black mb-2">
                Identificación
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={clienteNuevo.identificacion}
                  onChange={(e) => {
                    setSimilaresOcultos(false)
                    setClienteNuevo({ ...clienteNuevo, identificacion: e.target.value })
                  }}
                  className="flex-1 px-3 py-2 border border-slate-400 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white text-black placeholder:text-slate-500"
                  placeholder="123456789"
                />
                <button
                  type="button"
                  onClick={generarIdentificacion}
                  disabled={generandoId}
                  className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                >
                  {generandoId ? '...' : 'Generar'}
                </button>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-black mb-2">
              Dirección
            </label>
            <textarea
              value={clienteNuevo.direccion}
              onChange={(e) => setClienteNuevo({ ...clienteNuevo, direccion: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-slate-400 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent resize-none bg-white text-black placeholder:text-slate-500"
              placeholder="Calle 123 #45-67, Bogotá"
            />
          </div>

          <button
            onClick={crearCliente}
            disabled={creando || !clienteNuevo.nombre || !clienteNuevo.telefono}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creando ? 'Creando cliente...' : 'Crear Nuevo Cliente'}
          </button>
        </div>
      )}

      
    </div>
  )
}
