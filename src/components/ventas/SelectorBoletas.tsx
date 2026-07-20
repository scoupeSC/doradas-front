'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ventasApi } from '@/lib/ventasApi'
import { BoletaDisponible, BoletaEnCarrito, BoletaBloqueada } from '@/types/ventas'
import { formatBoletaNumeros, searchMatchesNumeros, normalizeNumeros, getPrincipalGift, sanitizeBoletaSearchDigits, scoreBoletaSearchMatch, isExactBoletaNumberMatch } from '@/utils/formatBoletaNumeros'
import PrincipalGiftLabel from '@/components/ventas/PrincipalGiftLabel'


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
  /** Número tocado mientras se bloquea (feedback visual de principal). */
  const [numeroEnSeleccion, setNumeroEnSeleccion] = useState<{
    boletaId: string
    numero: number
  } | null>(null)
  const [feedbackPrincipal, setFeedbackPrincipal] = useState<string | null>(null)
  const [boletaBuscada, setBoletaBuscada] = useState<{
    id: string
    numero: number
    numeros: number[]
    estado: string
    disponible: boolean
    bloqueada?: boolean
    cliente_nombre?: string | null
    cliente_identificacion?: string | null
  } | null>(null)
  const [buscandoExacta, setBuscandoExacta] = useState(false)
  const intervalosRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map())
  const seleccionadasIdsRef = useRef<Set<string>>(new Set())
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const busquedaExactaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    seleccionadasIdsRef.current = new Set(boletasSeleccionadas.map((b) => b.id))
  }, [boletasSeleccionadas])

  // ── Ruleta ──────────────────────────────────────────────────────────────
  const [mostrarRuleta, setMostrarRuleta] = useState(false)
  const [faseRuleta, setFaseRuleta] = useState<'idle' | 'girando' | 'resultado'>('idle')
  const [boletaRuleta, setBoletaRuleta] = useState<BoletaDisponible | null>(null)
  const [numeroMostrado, setNumeroMostrado] = useState<number>(0)
  const [bloqueandoRuleta, setBloqueandoRuleta] = useState(false)
  const ruletaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ruletaIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)


  // Cargar boletas disponibles
  const cargarBoletasDisponibles = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = Boolean(opts?.silent)
    if (!silent) {
      setLoading(true)
      setError(null)
    }
    
    try {
      const response = await ventasApi.getBoletasDisponibles(rifaId)
      const boletas = response.data || []

      const enCarrito = seleccionadasIdsRef.current

      // El endpoint /disponibles ya excluye bloqueos vigentes (admin o web pública)
      const boletasDisponibles = boletas
        .filter((boleta: any) => !enCarrito.has(boleta.id))
        .map((boleta: any) => ({
          id: boleta.id,
          numero: boleta.numero,
          numeros: Array.isArray(boleta.numeros) ? boleta.numeros.map(Number) : [Number(boleta.numero)],
          estado: 'DISPONIBLE' as const,
          qr_url: boleta.qr_url || '',
          barcode: boleta.barcode || '',
          imagen_url: boleta.imagen_url,
          rifa_nombre: '',
          rifa_id: rifaId,
          precio: 0
        }))
      
      setBoletasDisponibles(boletasDisponibles)
      
      if (!silent && boletasDisponibles.length === 0) {
        setError('No hay boletas disponibles en este momento.')
      }
    } catch (error: any) {
      if (!silent) {
        console.warn('Error cargando boletas:', error)
        if (error.message && error.message.includes('Endpoint no encontrado')) {
          setError('El endpoint de boletas no está disponible. Contacte al administrador.')
        } else {
          setError('Error cargando boletas disponibles')
        }
        setBoletasDisponibles([])
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [rifaId])

  // Bloquear boleta al seleccionarla (el número pulsado queda como principal)
  const seleccionarBoleta = async (
    boleta: BoletaDisponible,
    numeroPrincipal?: number | null
  ) => {
    if (bloqueando.has(boleta.id)) return
    
    const nums = normalizeNumeros((boleta as any).numeros, boleta.numero)
    const principal =
      numeroPrincipal != null && nums.includes(Number(numeroPrincipal))
        ? Number(numeroPrincipal)
        : Number(boleta.numero)

    setBloqueando(prev => new Set(prev).add(boleta.id))
    setNumeroEnSeleccion({ boletaId: boleta.id, numero: principal })
    
    try {
      const response = await ventasApi.bloquearBoleta(boleta.id, 15, principal)
      const bloqueo = response.data
      const { gift } = getPrincipalGift(nums, boleta.numero, principal)
      
      const boletaEnCarrito: BoletaEnCarrito = {
        id: boleta.id,
        numero: boleta.numero,
        numeros: nums,
        numero_principal: principal,
        precio: precioBoleta,
        reserva_token: bloqueo.reserva_token,
        bloqueo_hasta: bloqueo.bloqueo_hasta,
        qr_url: boleta.qr_url,
        barcode: boleta.barcode,
        imagen_url: boleta.imagen_url,
      }
      
      onBoletaSeleccionada(boletaEnCarrito)
      setBoletasDisponibles(prev => prev.filter(b => b.id !== boleta.id))
      setError(null)

      const msg =
        gift != null
          ? `Principal #${String(principal).padStart(4, '0')} · Regalo #${String(gift).padStart(4, '0')}`
          : `Principal #${String(principal).padStart(4, '0')}`
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
      setFeedbackPrincipal(msg)
      feedbackTimerRef.current = setTimeout(() => setFeedbackPrincipal(null), 4500)
      
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
    } catch (error: any) {
      const code = error?.code || error?.response?.data?.error
      const apiMsg =
        error?.response?.data?.message ||
        error?.message ||
        'No se pudo bloquear la boleta.'

      // Si ya la tomó la web pública u otro vendedor: quitarla ya de la lista
      if (
        code === 'BOLETA_ALREADY_BLOCKED' ||
        /ya está bloqueada|already blocked/i.test(String(apiMsg))
      ) {
        setBoletasDisponibles((prev) => prev.filter((b) => b.id !== boleta.id))
        setError('Ese número acaba de reservarse en otra sesión (web o admin). Ya no está disponible.')
        void cargarBoletasDisponibles({ silent: true })
      } else if (
        code === 'BOLETA_ALREADY_SOLD' ||
        /ya está vendida|already sold/i.test(String(apiMsg))
      ) {
        setBoletasDisponibles((prev) => prev.filter((b) => b.id !== boleta.id))
        setError('Esa boleta ya no está disponible.')
        void cargarBoletasDisponibles({ silent: true })
      } else {
        setError(apiMsg)
      }
    } finally {
      setBloqueando(prev => {
        const newSet = new Set(prev)
        newSet.delete(boleta.id)
        return newSet
      })
      setNumeroEnSeleccion((prev) =>
        prev?.boletaId === boleta.id ? null : prev
      )
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
        numeros: normalizeNumeros(boleta.numeros, boleta.numero),
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
      const principal =
        Number.isFinite(numeroMostrado) && numeroMostrado > 0
          ? Number(numeroMostrado)
          : Number(boletaRuleta.numero)
      await seleccionarBoleta(boletaRuleta, principal)
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

  // Filtrar y ordenar boletas por búsqueda (exacto primero)
  const boletasFiltradas = (() => {
    const term = sanitizeBoletaSearchDigits(busqueda)
    if (!term) return boletasDisponibles || []

    const matched = (boletasDisponibles || []).filter((boleta) =>
      searchMatchesNumeros((boleta as any).numeros, term, boleta.numero)
    )

    const exactInList = matched.some((boleta) =>
      isExactBoletaNumberMatch((boleta as any).numeros, term, boleta.numero)
    )

    // Si hay match exacto disponible: mostrar solo esa(s). Si no: similares.
    const list = exactInList
      ? matched.filter((boleta) =>
          isExactBoletaNumberMatch((boleta as any).numeros, term, boleta.numero)
        )
      : matched

    return [...list].sort((a, b) => {
      const scoreA = scoreBoletaSearchMatch((a as any).numeros, term, a.numero)
      const scoreB = scoreBoletaSearchMatch((b as any).numeros, term, b.numero)
      if (scoreA !== scoreB) return scoreA - scoreB
      return a.numero - b.numero
    })
  })()

  const exactaDisponible = Boolean(
    busqueda &&
      boletasFiltradas.some((boleta) =>
        isExactBoletaNumberMatch(
          (boleta as any).numeros,
          busqueda,
          boleta.numero
        )
      )
  )

  // Consultar estado de la boleta exacta si no está en disponibles
  useEffect(() => {
    const term = sanitizeBoletaSearchDigits(busqueda)
    if (busquedaExactaTimerRef.current) {
      clearTimeout(busquedaExactaTimerRef.current)
      busquedaExactaTimerRef.current = null
    }

    if (!term) {
      setBoletaBuscada(null)
      setBuscandoExacta(false)
      return
    }

    // Esperar número completo (o al menos 3 dígitos) para no spamear API
    if (term.length < 3) {
      setBoletaBuscada(null)
      setBuscandoExacta(false)
      return
    }

    const enDisponibles = (boletasDisponibles || []).some((boleta) =>
      isExactBoletaNumberMatch((boleta as any).numeros, term, boleta.numero)
    )
    if (enDisponibles) {
      setBoletaBuscada(null)
      setBuscandoExacta(false)
      return
    }

    setBuscandoExacta(true)
    busquedaExactaTimerRef.current = setTimeout(async () => {
      try {
        const numero = Number(term.replace(/^0+/, '') || term)
        const response = await ventasApi.buscarBoletaPorNumero(rifaId, numero)
        const data = response.data
        if (!data) {
          setBoletaBuscada(null)
          return
        }
        setBoletaBuscada({
          id: data.id,
          numero: data.numero,
          numeros: normalizeNumeros(data.numeros, data.numero),
          estado: data.estado,
          disponible: Boolean(data.disponible),
          bloqueada: Boolean(data.bloqueada),
          cliente_nombre: data.cliente_nombre,
          cliente_identificacion: data.cliente_identificacion,
        })
      } catch {
        setBoletaBuscada(null)
      } finally {
        setBuscandoExacta(false)
      }
    }, 280)

    return () => {
      if (busquedaExactaTimerRef.current) {
        clearTimeout(busquedaExactaTimerRef.current)
        busquedaExactaTimerRef.current = null
      }
    }
  }, [busqueda, boletasDisponibles, rifaId])

  // Reset página al cambiar búsqueda
  useEffect(() => {
    setPagina(1)
  }, [busqueda])

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
        `${process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '') || 'http://localhost:3000'}/api/boletas/unblock-multiple`,
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



  // Actualización periódica de disponibles (web pública + otros vendedores)
  useEffect(() => {
    const interval = setInterval(() => {
      void cargarBoletasDisponibles({ silent: true })
    }, 5000)
    return () => clearInterval(interval)
  }, [cargarBoletasDisponibles])

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
            onClick={() => cargarBoletasDisponibles()}
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
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          maxLength={4}
          placeholder="Buscar número de boleta (solo cifras)..."
          value={busqueda}
          onChange={(e) => setBusqueda(sanitizeBoletaSearchDigits(e.target.value))}
          className="text-black placeholder:text-slate-500 w-full px-4 py-2 border border-slate-400 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white"
        />
        {busqueda && (
          <p className="mt-1.5 text-xs text-slate-500">
            {exactaDisponible
              ? 'Mostrando la boleta exacta.'
              : boletaBuscada && !boletaBuscada.disponible
                ? 'Esa boleta ya no está disponible. Abajo verás números parecidos disponibles.'
                : 'Buscando coincidencia exacta o números parecidos...'}
          </p>
        )}
      </div>

      {/* Resultado exacto no disponible */}
      {busqueda && boletaBuscada && !boletaBuscada.disponible && !exactaDisponible && (
        <div className="mb-4 rounded-lg border-2 border-amber-400 bg-amber-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                Boleta encontrada · no disponible
              </p>
              <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">
                {formatBoletaNumeros(boletaBuscada.numeros, boletaBuscada.numero)}
              </p>
              <p className="mt-1 text-sm text-amber-900">
                Estado: <span className="font-semibold">{boletaBuscada.estado}</span>
                {boletaBuscada.bloqueada ? ' (bloqueada temporalmente)' : ''}
              </p>
              {boletaBuscada.cliente_nombre && (
                <p className="mt-1 text-sm text-slate-700">
                  Cliente: {boletaBuscada.cliente_nombre}
                  {boletaBuscada.cliente_identificacion
                    ? ` · CC ${boletaBuscada.cliente_identificacion}`
                    : ''}
                </p>
              )}
            </div>
            <span className="rounded-full bg-amber-200 px-3 py-1 text-xs font-bold uppercase text-amber-900">
              Primero en resultados
            </span>
          </div>
        </div>
      )}

      {busqueda && buscandoExacta && !exactaDisponible && !boletaBuscada && (
        <div className="mb-4 text-sm text-slate-500">Consultando estado del número...</div>
      )}

      {/* Boletas Seleccionadas */}
      {boletasSeleccionadas.length > 0 && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-sm font-medium text-blue-900 mb-3">
            Boletas Seleccionadas ({boletasSeleccionadas.length})
          </h3>
          {feedbackPrincipal && (
            <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 animate-pulse">
              ✓ Seleccionaste: {feedbackPrincipal}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {boletasSeleccionadas.map((boleta) => (
              <div
                key={boleta.id}
                className="bg-white border border-blue-300 rounded-lg p-3 flex items-start justify-between gap-2"
              >
                <div className="min-w-0">
                  <PrincipalGiftLabel
                    numeros={(boleta as any).numeros}
                    numero={boleta.numero}
                    numeroPrincipal={boleta.numero_principal}
                  />
                  <div className="mt-2 text-xs text-blue-700">
                    Bloqueada hasta: {new Date(boleta.bloqueo_hasta).toLocaleTimeString()}
                  </div>
                </div>
                <button
                  onClick={() => removerBoleta(boleta)}
                  className="shrink-0 text-red-500 hover:text-red-700 text-xl leading-none"
                  aria-label="Quitar boleta"
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
            {busqueda && boletaBuscada && !boletaBuscada.disponible
              ? 'Sin números parecidos disponibles'
              : busqueda
                ? 'No se encontraron boletas'
                : 'No hay boletas disponibles'}
          </h3>
          <p className="text-slate-600 mb-4 max-w-md mx-auto">
            {busqueda && boletaBuscada && !boletaBuscada.disponible
              ? `El número ${formatBoletaNumeros(boletaBuscada.numeros, boletaBuscada.numero)} ya no está disponible y no hay similares libres ahora.`
              : busqueda
                ? `No hay boletas que coincidan con "${busqueda}". Intenta con otro número.`
                : 'Todas las boletas de este proyecto pueden estar vendidas o reservadas. Intenta más tarde o contacta al administrador.'}
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
        <>
          {busqueda && !exactaDisponible && boletasPagina.length > 0 && (
            <p className="mb-3 text-sm font-medium text-slate-700">
              {boletaBuscada && !boletaBuscada.disponible
                ? 'Números parecidos disponibles'
                : 'Resultados parecidos (la exacta no está libre)'}
            </p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {boletasPagina.map((boleta) => {
            const nums = normalizeNumeros((boleta as any).numeros, boleta.numero)
            const dual = nums.length > 1
            const isExact = Boolean(
              busqueda &&
                isExactBoletaNumberMatch(nums, busqueda, boleta.numero)
            )
            return (
              <div
                key={boleta.id}
                className={`bg-white border-2 rounded-lg p-3 hover:border-blue-500 hover:bg-blue-50 transition-all ${
                  isExact
                    ? 'border-emerald-500 ring-2 ring-emerald-300 bg-emerald-50'
                    : 'border-slate-200'
                }`}
              >
                <div className="text-center space-y-2">
                  {dual ? (
                    <div className="grid gap-1.5">
                      {nums.map((n) => {
                        const isPicking =
                          numeroEnSeleccion?.boletaId === boleta.id &&
                          numeroEnSeleccion.numero === n
                        return (
                          <button
                            key={`${boleta.id}-${n}`}
                            type="button"
                            onClick={() => seleccionarBoleta(boleta, n)}
                            disabled={bloqueando.has(boleta.id)}
                            className={`w-full rounded-md border px-2 py-2 text-sm font-bold tabular-nums transition-all disabled:opacity-50 ${
                              isPicking
                                ? 'border-amber-500 bg-amber-400 text-slate-900 ring-2 ring-amber-400 scale-[1.03] shadow-md'
                                : 'border-amber-300/70 bg-amber-50 text-slate-900 hover:border-amber-500 hover:bg-amber-100 hover:ring-1 hover:ring-amber-400'
                            }`}
                            title={`Seleccionar #${String(n).padStart(4, '0')} como principal`}
                          >
                            <span className="block">#{String(n).padStart(4, '0')}</span>
                            {isPicking && (
                              <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-wide text-amber-950">
                                Principal ✓
                              </span>
                            )}
                          </button>
                        )
                      })}
                      <p className="text-[10px] leading-tight text-slate-500">
                        Toca el número que será el principal
                      </p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => seleccionarBoleta(boleta, nums[0])}
                      disabled={bloqueando.has(boleta.id)}
                      className="w-full text-sm font-bold text-slate-900 disabled:opacity-50"
                    >
                      {formatBoletaNumeros(nums, boleta.numero)}
                    </button>
                  )}
                  <div className="text-xs text-slate-600">
                    ${precioBoleta.toLocaleString('es-CO')}
                  </div>
                  {bloqueando.has(boleta.id) && (
                    <div className="text-xs text-blue-600">
                      Bloqueando...
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        </>
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
                      className="text-white font-black leading-none text-center px-2"
                      style={{
                        fontSize: faseRuleta === 'resultado' && boletaRuleta?.numeros && boletaRuleta.numeros.length > 1
                          ? '1.1rem'
                          : '2.6rem',
                        letterSpacing: '-0.02em',
                        fontVariantNumeric: 'tabular-nums',
                        filter: faseRuleta === 'girando' ? 'blur(0.5px)' : 'none',
                        transition: 'filter 0.2s',
                      }}
                    >
                      {faseRuleta === 'resultado' && boletaRuleta
                        ? formatBoletaNumeros(boletaRuleta.numeros, boletaRuleta.numero)
                        : String(numeroMostrado).padStart(4, '0')}
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
