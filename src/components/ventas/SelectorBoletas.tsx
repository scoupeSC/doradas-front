'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ventasApi } from '@/lib/ventasApi'
import { BoletaDisponible, BoletaEnCarrito, BoletaBloqueada } from '@/types/ventas'


interface SelectorBoletasProps {
  rifaId: string
  precioBoleta: number
  onBoletaSeleccionada: (boleta: BoletaEnCarrito) => void
  onBoletaRemovida: (boletaId: string) => void
  boletasSeleccionadas: BoletaEnCarrito[]


  
}




export default function SelectorBoletas({ 
  rifaId, 
  precioBoleta, 
  onBoletaSeleccionada, 
  onBoletaRemovida,
  boletasSeleccionadas 
}: SelectorBoletasProps) {
  const [boletasDisponibles, setBoletasDisponibles] = useState<BoletaDisponible[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)
  const [boletasPorPagina] = useState(20)
  const [bloqueando, setBloqueando] = useState<Set<string>>(new Set())
  const intervalosRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map())

  // ── Ruleta ──────────────────────────────────────────────────────────────
  const [mostrarRuleta, setMostrarRuleta] = useState(false)
  const [faseRuleta, setFaseRuleta] = useState<'idle' | 'girando' | 'resultado'>('idle')
  const [boletaRuleta, setBoletaRuleta] = useState<BoletaDisponible | null>(null)
  const [numeroMostrado, setNumeroMostrado] = useState<number>(0)
  const [bloqueandoRuleta, setBloqueandoRuleta] = useState(false)
  const ruletaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ruletaIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)


  // Cargar boletas disponibles
  const cargarBoletasDisponibles = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await ventasApi.getBoletasDisponibles(rifaId)
      const boletas = response.data || []
      
      // Filtrar solo las boletas disponibles y transformar al formato esperado
      const boletasDisponibles = boletas
        .filter((boleta: any) => boleta.estado === 'DISPONIBLE')
        .map((boleta: any) => ({
          id: boleta.id,
          numero: boleta.numero,
          estado: 'DISPONIBLE' as const,
          qr_url: boleta.qr_url || '',
          barcode: boleta.barcode || '',
          imagen_url: boleta.imagen_url,
          rifa_nombre: '',
          rifa_id: rifaId,
          precio: 0
        }))
      
      setBoletasDisponibles(boletasDisponibles)
      
      // Si no hay boletas disponibles, mostrar mensaje informativo
      if (boletasDisponibles.length === 0) {
        const totalBoletas = boletas.length
        const reservadas = boletas.filter((b: any) => b.estado === 'RESERVADA').length
        const vendidas = boletas.filter((b: any) => b.estado === 'VENDIDA').length
        
        setError(`No hay boletas disponibles. Total: ${totalBoletas}, Reservadas: ${reservadas}, Vendidas: ${vendidas}`)
      }
    } catch (error: any) {
      console.error('Error cargando boletas:', error)
      
      // Verificar si es un error de endpoint no encontrado
      if (error.message && error.message.includes('Endpoint no encontrado')) {
        setError('El endpoint de boletas no está disponible. Contacte al administrador.')
      } else {
        setError('Error cargando boletas disponibles')
      }
      
      setBoletasDisponibles([]) // Establecer array vacío en caso de error
    } finally {
      setLoading(false)
    }
  }, [rifaId])

  // Bloquear boleta al seleccionarla
  const seleccionarBoleta = async (boleta: BoletaDisponible) => {
    if (bloqueando.has(boleta.id)) return
    
    setBloqueando(prev => new Set(prev).add(boleta.id))
    
    try {
      // Bloquear la boleta
      const response = await ventasApi.bloquearBoleta(boleta.id, 15) // 15 minutos
      const bloqueo = response.data
      
      // Agregar al carrito
      const boletaEnCarrito: BoletaEnCarrito = {
        id: boleta.id,
        numero: boleta.numero,
        precio: precioBoleta,
        reserva_token: bloqueo.reserva_token,
        bloqueo_hasta: bloqueo.bloqueo_hasta,
        qr_url: boleta.qr_url,
        barcode: boleta.barcode,
        imagen_url: boleta.imagen_url,
      }
      
      onBoletaSeleccionada(boletaEnCarrito)
      
      // Remover de disponibles
      setBoletasDisponibles(prev => prev.filter(b => b.id !== boleta.id))
      
      // Iniciar verificación periódica del bloqueo
      const intervalId = await ventasApi.verificarBloqueoPeriodico(
  boleta.id,
  bloqueo.reserva_token,
  (valid) => {
    if (!valid) {
      onBoletaRemovida(boleta.id)
      setBoletasDisponibles(prev => [...prev, boleta])

      const interval = intervalosRef.current.get(boleta.id)
      if (interval) {
        clearInterval(interval)
        intervalosRef.current.delete(boleta.id)
      }
    }
  }
)

intervalosRef.current.set(boleta.id, intervalId)

      
    } catch (error) {
      setError(`La boleta #${String(boleta.numero).padStart(4, '0')} ya fue seleccionada por otro usuario. Por favor elige otra boleta.`)
      console.error('Error bloqueando boleta:', error)
      // refrescar lista inmediatamente
      // cargarBoletasDisponibles()
    } finally {
      setBloqueando(prev => {
        const newSet = new Set(prev)
        newSet.delete(boleta.id)
        return newSet
      })
    }
  }

  // Remover boleta del carrito y desbloquear
  const removerBoleta = async (boleta: BoletaEnCarrito) => {
    try {
      await ventasApi.desbloquearBoleta(boleta.id, boleta.reserva_token)
      
    const interval = intervalosRef.current.get(boleta.id)
if (interval) {
  clearInterval(interval)
  intervalosRef.current.delete(boleta.id)
}


      // Devolver a disponibles
      const boletaDisponible: BoletaDisponible = {
        id: boleta.id,
        numero: boleta.numero,
        estado: 'DISPONIBLE',
        qr_url: boleta.qr_url,
        barcode: boleta.barcode,
        imagen_url: boleta.imagen_url,
        rifa_nombre: '', // No disponible en este contexto
        rifa_id: rifaId,
        precio: precioBoleta,
      }
      
      setBoletasDisponibles(prev => [...prev, boletaDisponible])
      onBoletaRemovida(boleta.id)
      
    } catch (error) {
      console.error('Error desbloqueando boleta:', error)
    }
  }

  // ── Lógica de la ruleta ──────────────────────────────────────────────────
  const boletasParaRuleta = boletasDisponibles.filter(
    b => !boletasSeleccionadas.some(s => s.id === b.id)
  )

  const girarRuleta = () => {
    if (boletasParaRuleta.length === 0) return

    // Limpiar timers previos
    if (ruletaIntervalRef.current) clearInterval(ruletaIntervalRef.current)
    if (ruletaTimerRef.current) clearTimeout(ruletaTimerRef.current)

    // Elegir boleta ganadora aleatoriamente
    const ganadora = boletasParaRuleta[Math.floor(Math.random() * boletasParaRuleta.length)]
    setBoletaRuleta(ganadora)
    setFaseRuleta('girando')

    // Animación: ciclar números rápido y luego frenar
    let velocidad = 40
    let elapsed = 0
    const duracionTotal = 2800

    const ciclar = () => {
      const pool = boletasParaRuleta.length > 1
        ? boletasParaRuleta.filter(b => b.id !== ganadora.id)
        : boletasParaRuleta
      const random = pool[Math.floor(Math.random() * pool.length)]
      setNumeroMostrado(random.numero)

      elapsed += velocidad
      // frenar progresivamente
      if (elapsed > 1200) velocidad = 160
      else if (elapsed > 800) velocidad = 100
      else if (elapsed > 500) velocidad = 65

      if (elapsed >= duracionTotal) {
        // Resultado final
        if (ruletaIntervalRef.current) clearInterval(ruletaIntervalRef.current)
        setNumeroMostrado(ganadora.numero)
        setFaseRuleta('resultado')
        return
      }

      if (ruletaIntervalRef.current) clearInterval(ruletaIntervalRef.current)
      ruletaIntervalRef.current = setInterval(ciclar, velocidad)
    }

    ruletaIntervalRef.current = setInterval(ciclar, velocidad)
  }

  const abrirRuleta = () => {
    setMostrarRuleta(true)
    setFaseRuleta('idle')
    setBoletaRuleta(null)
    setNumeroMostrado(0)
  }

  const cerrarRuleta = () => {
    if (ruletaIntervalRef.current) clearInterval(ruletaIntervalRef.current)
    if (ruletaTimerRef.current) clearTimeout(ruletaTimerRef.current)
    setMostrarRuleta(false)
    setFaseRuleta('idle')
  }

  const seleccionarBoletaRuleta = async () => {
    if (!boletaRuleta || bloqueandoRuleta) return
    setBloqueandoRuleta(true)
    try {
      await seleccionarBoleta(boletaRuleta)
      cerrarRuleta()
    } catch {
      // silencioso, seleccionarBoleta ya maneja el error
    } finally {
      setBloqueandoRuleta(false)
    }
  }

  // Limpiar timers de ruleta al desmontar
  useEffect(() => {
    return () => {
      if (ruletaIntervalRef.current) clearInterval(ruletaIntervalRef.current)
      if (ruletaTimerRef.current) clearTimeout(ruletaTimerRef.current)
    }
  }, [])

  // Filtrar boletas por búsqueda
  const boletasFiltradas = (boletasDisponibles || []).filter(boleta => {
    if (!busqueda) return true
    const termino = busqueda.replace(/^#/, '').trim()
    if (!termino) return true
    // Comparar contra el número sin ceros y con ceros (padded a 4 dígitos)
    const numStr = boleta.numero.toString()
    const numPadded = numStr.padStart(4, '0')
    const terminoLimpio = termino.replace(/^0+/, '') || '0' // quitar ceros iniciales del término
    return numStr.includes(terminoLimpio) || numPadded.includes(termino)
  })

  // Paginación
  const totalPaginas = Math.ceil(boletasFiltradas.length / boletasPorPagina)
  const boletasPagina = boletasFiltradas.slice(
    (pagina - 1) * boletasPorPagina,
    pagina * boletasPorPagina
  )

  // Cargar boletas al montar
  useEffect(() => {
    cargarBoletasDisponibles()
  }, [cargarBoletasDisponibles])


  useEffect(() => {
  return () => {
    if (boletasSeleccionadas.length > 0) {
      ventasApi.liberarBloqueosMultiples(
        boletasSeleccionadas.map(b => ({
          id: b.id,
          reserva_token: b.reserva_token
        }))
      )
    }

    // limpiar todos los intervalos
    intervalosRef.current.forEach(interval => {
      clearInterval(interval)
    })

    intervalosRef.current.clear()
  }
}, [])


useEffect(() => {
  const handleBeforeUnload = () => {
    if (boletasSeleccionadas.length > 0) {
      navigator.sendBeacon(
        `${process.env.NEXT_PUBLIC_API_URL}/boletas/unblock-multiple`,
        JSON.stringify({
          boletas: boletasSeleccionadas.map(b => ({
            id: b.id,
            reserva_token: b.reserva_token
          }))
        })
      )
    }
  }

  window.addEventListener('beforeunload', handleBeforeUnload)

  return () => {
    window.removeEventListener('beforeunload', handleBeforeUnload)
  }
}, [boletasSeleccionadas])



  // Actualización periódica de disponibles
  useEffect(() => {
    const interval = setInterval(() => {
      if (boletasDisponibles.length >= 0) { // Solo actualizar si hay datos
        cargarBoletasDisponibles()
      }
    }, 30000) // 30 segundos
    return () => clearInterval(interval)
  }, [cargarBoletasDisponibles, boletasDisponibles.length])

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-medium text-slate-900">Seleccionar Boletas Disponibles</h2>
        <div className="flex items-center space-x-3">
          <div className="text-sm text-slate-600">
            <span className="font-medium">{boletasDisponibles?.length || 0}</span> disponibles
          </div>
          {/* Botón ruleta */}
          <button
            onClick={abrirRuleta}
            disabled={boletasParaRuleta.length === 0 || loading}
            title="Elegir boleta al azar"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
              bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700
              text-white shadow-md shadow-violet-500/30 transition-all hover:scale-105
              disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            <span className="text-base">🎰</span>
            Boleta al Azar
          </button>
          <button
            onClick={cargarBoletasDisponibles}
            disabled={loading}
            className="px-3 py-1 text-sm bg-slate-100 text-slate-700 rounded hover:bg-slate-200 disabled:opacity-50"
          >
            {loading ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* Búsqueda */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar por número de boleta..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="text-black placeholder:text-slate-500 w-full px-4 py-2 border border-slate-400 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white"
        />
      </div>

      {/* Boletas Seleccionadas */}
      {boletasSeleccionadas.length > 0 && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-sm font-medium text-blue-900 mb-3">
            Boletas Seleccionadas ({boletasSeleccionadas.length})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {boletasSeleccionadas.map((boleta) => (
              <div
                key={boleta.id}
                className="bg-white border border-blue-300 rounded-lg p-3 flex items-center justify-between"
              >
                <div>
<div className="font-medium text-blue-900">
  #{String(boleta.numero).padStart(4, '0')}
</div>                  <div className="text-xs text-blue-700">
                    Bloqueada hasta: {new Date(boleta.bloqueo_hasta).toLocaleTimeString()}
                  </div>
                </div>
                <button
                  onClick={() => removerBoleta(boleta)}
                  className="text-red-500 hover:text-red-700"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista de Boletas Disponibles */}
      {loading ? (
        <div className="text-center py-8 text-slate-500">
          <div className="inline-flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full mb-4">
            <svg className="w-4 h-4 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <p className="text-slate-600">Cargando boletas disponibles...</p>
        </div>
      ) : boletasPagina.length === 0 ? (
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-amber-100 rounded-full mb-4">
            <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-slate-900 mb-2">
            {busqueda ? 'No se encontraron boletas' : 'No hay boletas disponibles'}
          </h3>
          <p className="text-slate-600 mb-4 max-w-md mx-auto">
            {busqueda 
              ? `No hay boletas que coincidan con "${busqueda}". Intenta con otro número de boleta.`
              : 'Todas las boletas de esta rifa pueden estar vendidas o reservadas. Intenta más tarde o contacta al administrador.'
            }
          </p>
          {busqueda && (
            <button
              onClick={() => setBusqueda('')}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
            >
              Limpiar búsqueda
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {boletasPagina.map((boleta) => (
            <button
              key={boleta.id}
              onClick={() => seleccionarBoleta(boleta)}
              disabled={bloqueando.has(boleta.id)}
              className="bg-white border-2 border-slate-200 rounded-lg p-4 hover:border-blue-500 hover:bg-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="text-center">
                <div className="text-lg font-bold text-slate-900">
                  #{boleta.numero.toString().padStart(4, '0')}
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  ${precioBoleta.toLocaleString('es-CO')}
                </div>
                {bloqueando.has(boleta.id) && (
                  <div className="text-xs text-blue-600 mt-2">
                    Bloqueando...
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Paginación */}
      {totalPaginas > 1 && (
        <div className="flex justify-center items-center space-x-2 mt-6">
          <button
            onClick={() => setPagina(prev => Math.max(1, prev - 1))}
            disabled={pagina === 1}
            className="px-3 py-1 border border-slate-300 rounded disabled:opacity-50"
          >
            Anterior
          </button>
          <span className="text-sm text-slate-600">
            Página {pagina} de {totalPaginas}
          </span>
          <button
            onClick={() => setPagina(prev => Math.min(totalPaginas, prev + 1))}
            disabled={pagina === totalPaginas}
            className="px-3 py-1 border border-slate-300 rounded disabled:opacity-50"
          >
            Siguiente
          </button>
        </div>
      )}

      {/* ── Modal Ruleta ── */}
      {mostrarRuleta && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(10,10,30,0.85)', backdropFilter: 'blur(6px)' }}
          onClick={e => { if (e.target === e.currentTarget) cerrarRuleta() }}
        >
          <div className="relative bg-gradient-to-br from-slate-900 to-indigo-950 rounded-3xl shadow-2xl border border-indigo-500/30 p-8 w-full max-w-sm text-center overflow-hidden">

            {/* Decoración fondo */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-violet-600/10 blur-2xl" />
              <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full bg-indigo-600/10 blur-2xl" />
            </div>

            {/* Botón cerrar */}
            <button
              onClick={cerrarRuleta}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors text-sm"
            >
              ✕
            </button>

            {/* Título */}
            <p className="text-violet-300 text-xs font-bold uppercase tracking-widest mb-1">
              🎰 Boleta al Azar
            </p>
            <h3 className="text-white text-xl font-black mb-6">
              {faseRuleta === 'idle' && '¿Listo para girar?'}
              {faseRuleta === 'girando' && '¡Girando...!'}
              {faseRuleta === 'resultado' && '¡Tu número es!'}
            </h3>

            {/* Display del número */}
            <div className="relative flex items-center justify-center mb-8">
              {/* Anillo exterior giratorio */}
              <div
                className="absolute w-52 h-52 rounded-full border-4 border-dashed"
                style={{
                  borderColor: faseRuleta === 'resultado' ? '#34d399' : '#7c3aed',
                  animation: faseRuleta === 'girando'
                    ? 'spin 0.8s linear infinite'
                    : faseRuleta === 'resultado'
                    ? 'spin 3s linear infinite'
                    : 'none',
                }}
              />
              {/* Anillo medio */}
              <div
                className="absolute w-44 h-44 rounded-full border-2"
                style={{
                  borderColor: faseRuleta === 'resultado' ? '#6ee7b7' : '#a78bfa',
                  opacity: 0.5,
                  animation: faseRuleta === 'girando'
                    ? 'spin 0.5s linear infinite reverse'
                    : 'none',
                }}
              />

              {/* Círculo central */}
              <div
                className="relative w-36 h-36 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all duration-300"
                style={{
                  background: faseRuleta === 'resultado'
                    ? 'linear-gradient(135deg, #059669, #065f46)'
                    : 'linear-gradient(135deg, #4c1d95, #1e1b4b)',
                  boxShadow: faseRuleta === 'resultado'
                    ? '0 0 40px rgba(52, 211, 153, 0.6), 0 0 80px rgba(52, 211, 153, 0.2)'
                    : '0 0 40px rgba(124, 58, 237, 0.5)',
                  transform: faseRuleta === 'resultado' ? 'scale(1.08)' : 'scale(1)',
                }}
              >
                {faseRuleta === 'idle' ? (
                  <span className="text-5xl">🎟️</span>
                ) : (
                  <>
                    <span className="text-white/60 text-xs font-bold uppercase tracking-widest mb-1">
                      #{' '}
                    </span>
                    <span
                      className="text-white font-black leading-none"
                      style={{
                        fontSize: '2.6rem',
                        letterSpacing: '-0.02em',
                        fontVariantNumeric: 'tabular-nums',
                        filter: faseRuleta === 'girando' ? 'blur(0.5px)' : 'none',
                        transition: 'filter 0.2s',
                      }}
                    >
                      {String(numeroMostrado).padStart(4, '0')}
                    </span>
                    {faseRuleta === 'resultado' && (
                      <span className="text-emerald-300 text-xs font-bold mt-1">✓ Disponible</span>
                    )}
                  </>
                )}
              </div>

              {/* Estrellas de celebración */}
              {faseRuleta === 'resultado' && (
                <>
                  {['top-2 left-6', 'top-2 right-6', 'bottom-2 left-6', 'bottom-2 right-6',
                    'top-1/2 left-0', 'top-1/2 right-0'].map((pos, i) => (
                    <span
                      key={i}
                      className={`absolute ${pos} text-yellow-300`}
                      style={{
                        fontSize: i % 2 === 0 ? '1rem' : '0.75rem',
                        animation: `pulse 0.8s ease-in-out ${i * 0.1}s infinite alternate`,
                      }}
                    >
                      ✦
                    </span>
                  ))}
                </>
              )}
            </div>

            {/* Contador de disponibles */}
            <p className="text-slate-400 text-xs mb-6">
              {boletasParaRuleta.length} boleta{boletasParaRuleta.length !== 1 ? 's' : ''} disponible{boletasParaRuleta.length !== 1 ? 's' : ''} para sortear
            </p>

            {/* Botones */}
            <div className="flex flex-col gap-3">
              {faseRuleta === 'idle' && (
                <button
                  onClick={girarRuleta}
                  className="w-full py-3.5 rounded-2xl font-black text-white text-lg
                    bg-gradient-to-r from-violet-600 to-indigo-600
                    hover:from-violet-500 hover:to-indigo-500
                    shadow-lg shadow-violet-600/40 transition-all hover:scale-105 active:scale-95"
                >
                  🎰 ¡Girar!
                </button>
              )}

              {faseRuleta === 'girando' && (
                <div className="w-full py-3.5 rounded-2xl font-bold text-violet-300 text-base
                  bg-violet-950/50 border border-violet-500/30 flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Girando...
                </div>
              )}

              {faseRuleta === 'resultado' && (
                <>
                  <button
                    onClick={seleccionarBoletaRuleta}
                    disabled={bloqueandoRuleta}
                    className="w-full py-3.5 rounded-2xl font-black text-white text-base
                      bg-gradient-to-r from-emerald-500 to-teal-600
                      hover:from-emerald-400 hover:to-teal-500
                      shadow-lg shadow-emerald-500/40 transition-all hover:scale-105 active:scale-95
                      disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    {bloqueandoRuleta ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                        </svg>
                        Seleccionando...
                      </span>
                    ) : (
                      `🎟️ ¡Quiero el #${String(boletaRuleta?.numero ?? 0).padStart(4, '0')}!`
                    )}
                  </button>
                  <button
                    onClick={girarRuleta}
                    disabled={bloqueandoRuleta}
                    className="w-full py-3 rounded-2xl font-semibold text-violet-300 text-sm
                      bg-violet-950/50 border border-violet-500/30
                      hover:bg-violet-900/50 hover:text-violet-200
                      transition-all disabled:opacity-50"
                  >
                    🔄 Girar de nuevo
                  </button>
                </>
              )}
            </div>

            {/* Info: pueden seguir girando para más boletas */}
            {boletasSeleccionadas.length > 0 && (
              <p className="text-slate-500 text-xs mt-4">
                Ya tienes {boletasSeleccionadas.length} boleta{boletasSeleccionadas.length !== 1 ? 's' : ''} seleccionada{boletasSeleccionadas.length !== 1 ? 's' : ''} · puedes seguir girando
              </p>
            )}
          </div>

          {/* Keyframes globales inline */}
          <style>{`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
            @keyframes pulse {
              from { opacity: 0.4; transform: scale(0.8); }
              to   { opacity: 1;   transform: scale(1.2); }
            }
          `}</style>
        </div>
      )}
    </div>
  )
}
