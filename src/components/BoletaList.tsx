'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Boleta } from '@/types/boleta'
import type { Rifa } from '@/types/rifa'
import { getStorageImageUrl } from '@/lib/storageImageUrl'
import { boletaApi } from '@/lib/boletaApi'
import { downloadBoletaFromElement } from '@/utils/downloadBoletaImage'

interface BoletaListProps {
  boletas: Boleta[]
  loading: boolean
  rifaInfo?: Rifa | null
}

export default function BoletaList({ boletas, loading, rifaInfo }: BoletaListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const [filtroEstado, setFiltroEstado] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [downloading, setDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 })
  const [editingNotaId, setEditingNotaId] = useState<string | null>(null)
  const [notaTemp, setNotaTemp] = useState('')
  const [savingNota, setSavingNota] = useState(false)
  const [notasLocales, setNotasLocales] = useState<Record<string, string | null>>({})
  const router = useRouter()

  // Determina label y clases del estado según la boleta
  const getEstadoInfo = (boleta: Boleta) => {
    const estadoRaw = boleta.estado?.toString().trim().toUpperCase() || ''

    if (estadoRaw === 'RESERVADA') {
      if (boleta.cliente_info) return { label: 'RESERVADA', classes: 'bg-blue-600 text-white' }
      return { label: 'BLOQUEADA', classes: 'bg-amber-200 text-black' }
    }
    if (estadoRaw === 'ABONADA') return { label: 'ABONADA', classes: 'bg-orange-400 text-black' }
    if (estadoRaw === 'PAGADA' || estadoRaw === 'CON_PAGO') return { label: 'PAGADA', classes: 'bg-green-700 text-white' }
    if (estadoRaw === 'ANULADA' || estadoRaw === 'CANCELADA') return { label: 'CANCELADA', classes: 'bg-red-600 text-white' }
    if (estadoRaw === 'DISPONIBLE') return { label: 'DISPONIBLE', classes: 'bg-emerald-300 text-black' }
    if (estadoRaw === 'TRANSFERIDA') return { label: 'TRANSFERIDA', classes: 'bg-purple-100 text-purple-800' }

    return { label: estadoRaw || 'DESCONOCIDO', classes: 'bg-slate-100 text-slate-800' }
  }

  // Cálculos para las Cards (Heurística: Visibilidad del estado del sistema)
  const stats = useMemo(() => {
    return boletas.reduce(
      (acc, boleta) => {
        const estadoRaw = boleta.estado?.toString().trim().toUpperCase() || ''
        if (estadoRaw === 'DISPONIBLE') acc.disponibles++
        else if (estadoRaw === 'PAGADA' || estadoRaw === 'CON_PAGO') acc.vendidas++
        else if (estadoRaw === 'RESERVADA' && boleta.cliente_info) acc.reservadas++
        else if (estadoRaw === 'ABONADA') acc.abonadas++
        return acc
      },
      { disponibles: 0, vendidas: 0, reservadas: 0, abonadas: 0 }
    )
  }, [boletas])

  // Filtros y Paginación
  const filteredBoletas = useMemo(() => {
    let result = boletas

    // Filtro por estado (click en tarjeta)
    if (filtroEstado) {
      result = result.filter(boleta => {
        const estadoRaw = boleta.estado?.toString().trim().toUpperCase() || ''
        if (filtroEstado === 'DISPONIBLE') return estadoRaw === 'DISPONIBLE'
        if (filtroEstado === 'VENDIDAS') return estadoRaw === 'PAGADA' || estadoRaw === 'CON_PAGO'
        if (filtroEstado === 'RESERVADAS') return estadoRaw === 'RESERVADA' && boleta.cliente_info
        if (filtroEstado === 'ABONADAS') return estadoRaw === 'ABONADA'
        return true
      })
    }

    // Filtro por búsqueda de texto
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      result = result.filter(boleta => {
        const numeroStr = boleta.numero?.toString().padStart(4, '0') || ''
        const nombre = boleta.cliente_info?.nombre?.toLowerCase() || ''
        const identificacion = boleta.cliente_info?.identificacion?.toString() || ''
        return numeroStr.includes(searchLower) || nombre.includes(searchLower) || identificacion.includes(searchTerm)
      })
    }

    return result
  }, [boletas, searchTerm, filtroEstado])

  const paginatedBoletas = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredBoletas.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredBoletas, currentPage, itemsPerPage])

  const totalPages = Math.ceil(filteredBoletas.length / itemsPerPage)
  const startIndex = filteredBoletas.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1
  const endIndex = Math.min(currentPage * itemsPerPage, filteredBoletas.length)

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }

  const formatBoletaNumber = (numero: number) => numero.toString().padStart(4, '0')

  // --- Selección ---
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredBoletas.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredBoletas.map(b => b.id)))
    }
  }, [filteredBoletas, selectedIds.size])

  const allFilteredSelected = filteredBoletas.length > 0 && selectedIds.size === filteredBoletas.length

  // --- Helpers para descarga ---
  const imageToDataUrl = async (src: string): Promise<string | null> => {
    // Método 1: fetch + blob (más confiable que Image + crossOrigin)
    try {
      console.log('[Descarga] Cargando imagen via fetch:', src)
      const resp = await fetch(src, { mode: 'cors' })
      if (resp.ok) {
        const blob = await resp.blob()
        return await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.readAsDataURL(blob)
        })
      }
    } catch (e) {
      console.warn('[Descarga] fetch falló, intentando con Image:', e)
    }

    // Método 2: Image + canvas (fallback)
    return new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        try {
          const c = document.createElement('canvas')
          c.width = img.naturalWidth
          c.height = img.naturalHeight
          const ctx = c.getContext('2d')
          if (ctx) {
            ctx.drawImage(img, 0, 0)
            resolve(c.toDataURL('image/jpeg', 0.92))
          } else resolve(null)
        } catch { resolve(null) }
      }
      img.onerror = () => { console.warn('[Descarga] Image.onerror'); resolve(null) }
      img.src = src
      setTimeout(() => { console.warn('[Descarga] Image timeout'); resolve(null) }, 15000)
    })
  }

  // --- Descarga masiva ---
  const handleBulkDownload = useCallback(async () => {
    if (selectedIds.size === 0) return
    setDownloading(true)
    const boletasToDownload = boletas.filter(b => selectedIds.has(b.id))
    setDownloadProgress({ current: 0, total: boletasToDownload.length })

    try {
      // 1) Resolver la URL de imagen (desde boleta o rifa)
      const imagenRifaFallback = getStorageImageUrl(rifaInfo?.imagen_url ?? null) ?? rifaInfo?.imagen_url ?? null
      const primeraBoletaImg = boletasToDownload[0]?.imagen_url
      const imagenSrc = getStorageImageUrl(primeraBoletaImg ?? null) ?? primeraBoletaImg ?? imagenRifaFallback

      console.log('[Descarga] rifaInfo.imagen_url:', rifaInfo?.imagen_url)
      console.log('[Descarga] primera boleta imagen_url:', primeraBoletaImg)
      console.log('[Descarga] imagenSrc resuelta:', imagenSrc)

      // 2) Convertir imagen a data URL (base64) UNA SOLA VEZ — elimina CORS y red
      let imagenDataUrl: string | null = null
      if (imagenSrc) {
        imagenDataUrl = await imageToDataUrl(imagenSrc)
        console.log('[Descarga] imagenDataUrl:', imagenDataUrl ? `OK (${imagenDataUrl.substring(0, 50)}...)` : 'FALLÓ - null')
      } else {
        console.warn('[Descarga] No hay URL de imagen para las boletas')
      }

      // 3) Crear contenedor reutilizable fuera del viewport
      const container = document.createElement('div')
      container.style.cssText = 'position:fixed;top:-2000px;left:0;width:900px;pointer-events:none;'
      document.body.appendChild(container)

      // 4) Pre-cargar datos financieros de boletas ABONADAS seleccionadas
      const financieroMap: Record<string, { precio_boleta: number; total_pagado: number; saldo_pendiente: number }> = {}
      const boletasAbonadas = boletasToDownload.filter(b => (b.estado ?? '').toString().trim().toUpperCase() === 'ABONADA')
      if (boletasAbonadas.length > 0) {
        const detalles = await Promise.all(
          boletasAbonadas.map(b =>
            boletaApi.getBoletaById(b.id).then(r => ({ id: b.id, financiero: r.data.boleta_financiero })).catch(() => null)
          )
        )
        detalles.forEach(d => {
          if (d?.financiero) financieroMap[d.id] = d.financiero
        })
      }

      for (let i = 0; i < boletasToDownload.length; i++) {
        const boleta = boletasToDownload[i]
        setDownloadProgress({ current: i + 1, total: boletasToDownload.length })

        const estadoNorm = (boleta.estado ?? '').toString().trim().toUpperCase()
        const tieneCliente = Boolean(boleta.cliente_info && (boleta.cliente_info.nombre || boleta.cliente_info.identificacion))
        const precioNum = rifaInfo?.precio_boleta ? Number(rifaInfo.precio_boleta) : null

        let diasCaducidad: number | null = null
        if (boleta.bloqueo_hasta) {
          try {
            const hasta = new Date(boleta.bloqueo_hasta)
            const diffMs = hasta.getTime() - Date.now()
            diasCaducidad = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
          } catch { /* ignore */ }
        }

        const reservadaHastaFmt = boleta.bloqueo_hasta ? (() => {
          try {
            const dt = new Date(boleta.bloqueo_hasta)
            if (isNaN(dt.getTime())) return boleta.bloqueo_hasta
            return dt.toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
          } catch { return boleta.bloqueo_hasta }
        })() : null

        const esReservada = estadoNorm === 'RESERVADA'
        const esCancelada = estadoNorm === 'ANULADA' || estadoNorm === 'CANCELADA'
        const esPagada = ['CON_PAGO', 'PAGADA', 'PAGADO', 'VENDIDA'].includes(estadoNorm) && tieneCliente
        const esAbonada = estadoNorm === 'ABONADA'

        let estadoHTML = ''
        if (esCancelada) {
          estadoHTML = `<div style="width:100%;padding:4px 0;text-align:center;font-weight:800;font-size:11px;letter-spacing:0.05em;background:#dc2626;color:white;">BOLETA CANCELADA</div><p style="font-weight:700;text-align:center;font-size:10px;">Esta boleta no tiene validez</p>`
        } else if (esReservada && tieneCliente) {
          estadoHTML = `<div style="width:100%;padding:4px 0;text-align:center;font-weight:800;font-size:11px;letter-spacing:0.05em;background:#2563eb;color:white;">RESERVADA</div><p style="font-weight:600;text-align:center;font-size:10px;">A nombre de:</p><p style="text-align:center;font-size:10px;">${boleta.cliente_info?.nombre ?? '—'}</p><p style="text-align:center;font-size:10px;">CC. ${boleta.cliente_info?.identificacion ?? '—'}</p><p style="font-weight:700;text-align:center;font-size:10px;">Reservada hasta: ${reservadaHastaFmt ?? '—'}</p>`
        } else if (esReservada && !tieneCliente) {
          estadoHTML = `<div style="width:100%;padding:4px 0;text-align:center;font-weight:800;font-size:11px;letter-spacing:0.05em;background:#fde68a;color:black;">BLOQUEADA</div><p style="font-weight:600;text-align:center;font-size:10px;">Boleta bloqueada momentáneamente</p>`
        } else if (esPagada) {
          estadoHTML = `<div style="width:100%;padding:4px 0;text-align:center;font-weight:800;font-size:11px;letter-spacing:0.05em;background:#15803d;color:white;">PAGADA</div><p style="font-weight:600;text-align:center;font-size:10px;">A nombre de:</p><p style="text-align:center;font-size:10px;">${boleta.cliente_info?.nombre ?? '—'}</p><p style="text-align:center;font-size:10px;">CC. ${boleta.cliente_info?.identificacion ?? '—'}</p>`
        } else if (esAbonada) {
          const fin = financieroMap[boleta.id]
          const abonado = fin ? fin.total_pagado : 0
          const saldo = fin ? fin.saldo_pendiente : (precioNum ? precioNum : 0)
          estadoHTML = `<div style="width:100%;padding:4px 0;text-align:center;font-weight:800;font-size:11px;letter-spacing:0.05em;background:#fb923c;color:black;">ABONADA</div><p style="font-weight:600;text-align:center;font-size:10px;">A nombre de:</p><p style="text-align:center;font-size:10px;">${boleta.cliente_info?.nombre ?? '—'}</p><p style="text-align:center;font-size:10px;">CC. ${boleta.cliente_info?.identificacion ?? '—'}</p>${fin ? `<p style="font-weight:700;text-align:center;font-size:10px;color:#15803d;">Abonado: $${abonado.toLocaleString('es-CO')}</p><p style="font-weight:700;text-align:center;font-size:10px;color:#dc2626;">Deuda: $${saldo.toLocaleString('es-CO')}</p>` : ''}`
        } else {
          estadoHTML = `<div style="width:100%;padding:4px 0;text-align:center;font-weight:800;font-size:11px;letter-spacing:0.05em;background:#6ee7b7;color:black;">DISPONIBLE</div>`
        }

        const caducidadText = diasCaducidad !== null
          ? `- ${diasCaducidad} días de caducidad`
          : '- Válida hasta el día del sorteo'

        const qrSrc = boleta.qr_url || ''
        const numPad = boleta.numero.toString().padStart(4, '0')

        // Usar la imagen data URL pre-cargada (sin CORS, instantáneo)
        const rightContent = imagenDataUrl
          ? `<img src="${imagenDataUrl}" style="width:100%;height:100%;object-fit:contain;object-position:left center;" />`
          : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:white;"><div style="text-align:center;color:black;"><p style="font-size:20px;font-weight:700;">${rifaInfo?.nombre || 'Rifa'}</p><p>Boleta #${numPad}</p></div></div>`

        container.innerHTML = `
          <div class="boleta-ticket" style="display:flex;border:2px solid black;overflow:hidden;background:white;width:800px;height:352px;">
            <div style="flex-shrink:0;padding:8px;display:flex;flex-direction:column;justify-content:space-between;border-right:2px solid black;width:210px;">
              <div style="font-size:10px;text-align:center;color:black;font-weight:500;">
                <p>- Boleta sin pagar no juega</p>
                <p>${caducidadText}</p>
                <p>- Juega hasta quedar en poder del público</p>
              </div>
              <div style="font-size:10px;text-align:center;color:black;">
                ${estadoHTML}
              </div>
              <div style="display:flex;justify-content:center;">
                <img src="${qrSrc}" style="width:80px;height:80px;border:1px solid black;" alt="QR" />
              </div>
              ${(() => { const n = getNotaBoleta(boleta); return n ? `<div style="text-align:center;font-size:8px;font-style:italic;color:#475569;padding:0 4px;max-height:24px;overflow:hidden;line-height:1.2;">${n}</div>` : ''; })()}
              <div>
                <div style="text-align:center;font-size:18px;font-weight:800;color:black;">#${numPad}</div>
                ${precioNum ? `<div style="text-align:center;font-size:11px;font-weight:700;color:black;">$${precioNum.toLocaleString('es-CO')}</div>` : ''}
              </div>
            </div>
            <div style="flex-shrink:0;height:100%;width:590px;">
              ${rightContent}
            </div>
          </div>
        `

        // Esperar mínimo a que QR cargue (imagen de rifa ya es data URL, instantánea)
        const qrImg = container.querySelector('img[alt="QR"]') as HTMLImageElement | null
        if (qrImg && !qrImg.complete) {
          await new Promise<void>(resolve => {
            qrImg.onload = () => resolve()
            qrImg.onerror = () => resolve()
            setTimeout(resolve, 3000)
          })
        }

        const ticketEl = container.querySelector('.boleta-ticket') as HTMLElement
        if (ticketEl) {
          const num = boleta.numero.toString().padStart(4, '0')
          const cc = boleta.cliente_info?.identificacion
            ? boleta.cliente_info.identificacion.replace(/\s+/g, '_')
            : 'SIN_CC'

          await downloadBoletaFromElement(
            ticketEl,
            `boleta_${num}_CC_${cc}.png`
          )
        }

        // Espera corta entre descargas (solo para no saturar el navegador)
        if (i < boletasToDownload.length - 1) {
          await new Promise(r => setTimeout(r, 300))
        }
      }

      container.remove()
    } catch (err) {
      console.error('Error en descarga masiva:', err)
    } finally {
      setDownloading(false)
      setDownloadProgress({ current: 0, total: 0 })
    }
  }, [selectedIds, boletas, rifaInfo])

  // --- Nota ---
  const getNotaBoleta = (boleta: Boleta): string | null => {
    if (boleta.id in notasLocales) return notasLocales[boleta.id]
    return boleta.nota ?? null
  }

  const handleEditNota = (boleta: Boleta) => {
    setEditingNotaId(boleta.id)
    setNotaTemp(getNotaBoleta(boleta) || '')
  }

  const handleSaveNota = async (boletaId: string) => {
    setSavingNota(true)
    try {
      const notaValue = notaTemp.trim() || null
      await boletaApi.updateBoletaNota(boletaId, notaValue)
      setNotasLocales(prev => ({ ...prev, [boletaId]: notaValue }))
      setEditingNotaId(null)
    } catch (err) {
      console.error('Error guardando nota:', err)
      alert('Error al guardar la nota')
    } finally {
      setSavingNota(false)
    }
  }

  const handleCancelNota = () => {
    setEditingNotaId(null)
    setNotaTemp('')
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-900 mb-4"></div>
        <div className="ml-4 text-slate-600 font-medium text-lg">Cargando la información de la rifa...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Header y Botón Principal CTA
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestión de Boletas</h1>
          <p className="text-slate-500 text-sm mt-1">Administra los estados y clientes de la rifa actual.</p>
        </div>
        <button 
          onClick={() => router.push('/boletas/crear')} // Ajusta tu ruta aquí
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl shadow-md hover:shadow-lg transform transition-all active:scale-95 font-semibold flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Crear Boletas
        </button>
      </div> */}

      {/* Cards de Resumen - Clickeables como Filtros */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => { setFiltroEstado(filtroEstado === 'DISPONIBLE' ? null : 'DISPONIBLE'); setCurrentPage(1) }}
          className={`bg-white rounded-xl shadow-sm border p-5 flex items-center gap-4 border-l-4 border-l-emerald-400 transition-all cursor-pointer text-left w-full ${
            filtroEstado === 'DISPONIBLE' ? 'ring-2 ring-emerald-400 bg-emerald-50 border-emerald-300' : 'border-slate-200 hover:shadow-md hover:border-emerald-300'
          }`}
        >
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <p className="text-sm text-black font-semibold">Disponibles</p>
            <p className="text-2xl font-bold text-black">{stats.disponibles}</p>
          </div>
        </button>

        <button
          onClick={() => { setFiltroEstado(filtroEstado === 'VENDIDAS' ? null : 'VENDIDAS'); setCurrentPage(1) }}
          className={`bg-white rounded-xl shadow-sm border p-5 flex items-center gap-4 border-l-4 border-l-green-600 transition-all cursor-pointer text-left w-full ${
            filtroEstado === 'VENDIDAS' ? 'ring-2 ring-green-500 bg-green-50 border-green-300' : 'border-slate-200 hover:shadow-md hover:border-green-300'
          }`}
        >
          <div className="p-3 bg-green-50 text-green-700 rounded-lg">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <p className="text-sm text-black font-semibold">Vendidas</p>
            <p className="text-2xl font-bold text-black">{stats.vendidas}</p>
          </div>
        </button>

        <button
          onClick={() => { setFiltroEstado(filtroEstado === 'RESERVADAS' ? null : 'RESERVADAS'); setCurrentPage(1) }}
          className={`bg-white rounded-xl shadow-sm border p-5 flex items-center gap-4 border-l-4 border-l-blue-500 transition-all cursor-pointer text-left w-full ${
            filtroEstado === 'RESERVADAS' ? 'ring-2 ring-blue-500 bg-blue-50 border-blue-300' : 'border-slate-200 hover:shadow-md hover:border-blue-300'
          }`}
        >
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </div>
          <div>
            <p className="text-sm text-black font-semibold">Reservadas</p>
            <p className="text-2xl font-bold text-black">{stats.reservadas}</p>
          </div>
        </button>

        <button
          onClick={() => { setFiltroEstado(filtroEstado === 'ABONADAS' ? null : 'ABONADAS'); setCurrentPage(1) }}
          className={`bg-white rounded-xl shadow-sm border p-5 flex items-center gap-4 border-l-4 border-l-orange-400 transition-all cursor-pointer text-left w-full ${
            filtroEstado === 'ABONADAS' ? 'ring-2 ring-orange-400 bg-orange-50 border-orange-300' : 'border-slate-200 hover:shadow-md hover:border-orange-300'
          }`}
        >
          <div className="p-3 bg-orange-50 text-orange-500 rounded-lg">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <p className="text-sm text-black font-semibold">Abonadas</p>
            <p className="text-2xl font-bold text-black">{stats.abonadas}</p>
          </div>
        </button>
      </div>

      {/* Filtro activo indicator */}
      {filtroEstado && (
        <div className="flex items-center gap-2 px-1">
          <span className="text-sm text-black font-semibold">Filtrando por:</span>
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-bold">
            {filtroEstado}
            <button onClick={() => { setFiltroEstado(null); setCurrentPage(1) }} className="ml-1 hover:text-red-600 transition-colors">
              ✕
            </button>
          </span>
        </div>
      )}

      {/* Buscador y Controles */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div className="flex flex-col lg:flex-row gap-4 justify-between items-center">
          <div className="w-full lg:w-2/3 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-slate-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>
            </div>
            <input
              type="text"
              placeholder="Buscar por boleta (0000), nombre o identificación..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-400 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-shadow text-black bg-white focus:bg-white placeholder:text-slate-500"
            />
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto">
            <label htmlFor="itemsPerPage" className="text-sm font-medium text-slate-600">Mostrar:</label>
            <select
              id="itemsPerPage"
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value))
                setCurrentPage(1)
              }}
              className="px-3 py-2 border border-slate-400 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none text-black bg-white"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

      {/* Resumen de Resultados */}
      <div className="flex justify-between items-center px-1">
        <div className="text-sm text-slate-600">
          Mostrando <span className="font-semibold text-slate-900">{startIndex}</span> a <span className="font-semibold text-slate-900">{endIndex}</span> de <span className="font-semibold text-slate-900">{filteredBoletas.length}</span>
          {filteredBoletas.length !== boletas.length && (
            <span className="ml-1 text-slate-500">(filtradas de {boletas.length} totales)</span>
          )}
        </div>
        {(searchTerm || filtroEstado) && (
          <button
            onClick={() => { setSearchTerm(''); setFiltroEstado(null); setCurrentPage(1) }}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium underline-offset-2 hover:underline"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Barra de acciones de selección */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-blue-800">
              {selectedIds.size} boleta{selectedIds.size !== 1 ? 's' : ''} seleccionada{selectedIds.size !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-blue-600 hover:text-blue-800 underline"
            >
              Deseleccionar todo
            </button>
          </div>
          <button
            onClick={handleBulkDownload}
            disabled={downloading}
            className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {downloading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Descargando {downloadProgress.current}/{downloadProgress.total}...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Descargar ({selectedIds.size})
              </>
            )}
          </button>
        </div>
      )}

      {/* Tabla de Boletas */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/80 border-b border-slate-200">
              <tr>
                <th className="px-4 py-4 text-center">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    title="Seleccionar todas"
                  />
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Número</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Contacto</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">ID / Cédula</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Vendedor</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nota</th>
                {/* <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">QR</th> */}
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedBoletas.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <svg className="w-12 h-12 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <p className="text-base">{searchTerm ? 'No hay resultados para tu búsqueda.' : 'Aún no hay boletas en esta rifa.'}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedBoletas.map((boleta) => {
                  const estado = getEstadoInfo(boleta)
                  return (
                    <tr key={boleta.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-4 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(boleta.id)}
                          onChange={() => toggleSelect(boleta.id)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-lg font-mono font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded inline-block">
                          {formatBoletaNumber(boleta.numero)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-3 py-1 text-xs font-bold rounded-full ${estado.classes}`}>
                          {estado.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-slate-900">{boleta.cliente_info?.nombre || <span className="text-slate-400 italic">Sin asignar</span>}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-600">{boleta.cliente_info?.telefono || '-'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-600">{boleta.cliente_info?.identificacion || '-'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-600">{boleta.vendedor_info?.nombre || '-'}</div>
                      </td>
                      <td className="px-6 py-4">
                        {editingNotaId === boleta.id ? (
                          <div className="flex flex-col gap-1">
                            <textarea
                              value={notaTemp}
                              onChange={(e) => setNotaTemp(e.target.value)}
                              maxLength={500}
                              rows={2}
                              className="w-full text-xs border border-blue-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                              placeholder="Escribe una nota..."
                              autoFocus
                            />
                            <div className="flex gap-1 justify-end">
                              <button
                                onClick={() => handleSaveNota(boleta.id)}
                                disabled={savingNota}
                                className="text-xs bg-green-500 text-white px-2 py-0.5 rounded hover:bg-green-600 disabled:opacity-50 transition-colors"
                              >
                                {savingNota ? '...' : '✓'}
                              </button>
                              <button
                                onClick={handleCancelNota}
                                disabled={savingNota}
                                className="text-xs bg-slate-300 text-slate-700 px-2 py-0.5 rounded hover:bg-slate-400 disabled:opacity-50 transition-colors"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-1 group/nota">
                            {getNotaBoleta(boleta) ? (
                              <span className="text-xs text-slate-600 italic max-w-[150px] truncate" title={getNotaBoleta(boleta) || ''}>
                                {getNotaBoleta(boleta)}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-300 italic">—</span>
                            )}
                            <button
                              onClick={() => handleEditNota(boleta)}
                              className="text-slate-400 hover:text-blue-500 transition-colors p-0.5 opacity-0 group-hover/nota:opacity-100"
                              title="Editar nota"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </td>
                      {/* <td className="px-6 py-4 whitespace-nowrap text-center">
                        {boleta.qr_url ? (
                          <button onClick={() => window.open(boleta.qr_url || '', '_blank')} className="text-blue-600 hover:text-blue-800 text-xs font-semibold inline-flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-md hover:bg-blue-100 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                            Ver QR
                          </button>
                        ) : (
                          <span className="text-slate-400 text-xs italic">N/A</span>
                        )}
                      </td> */}
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end space-x-3 opacity-100 sm:opacity-100 sm:group-hover:opacity-100 transition-opacity">
                          <button onClick={() => router.push(`/boletas/${boleta.id}`)} className="text-slate-600 hover:text-blue-600 transition-colors p-1" title="Ver Detalle">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          </button>
                          <button onClick={() => router.push(`/boletas/${boleta.id}/print`)} className="text-slate-600 hover:text-green-600 transition-colors p-1" title="Imprimir">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginación Mejorada */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 py-4">
          <div className="text-sm text-slate-500">
            Página <span className="font-semibold text-slate-900">{currentPage}</span> de <span className="font-semibold text-slate-900">{totalPages}</span>
          </div>
          <div className="flex items-center space-x-1 bg-white border border-slate-200 p-1 rounded-lg shadow-sm">
            <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="px-3 py-1.5 text-sm font-medium rounded-md hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent text-slate-700 transition-colors">Anterior</button>
            <div className="hidden sm:flex items-center px-2">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum = currentPage <= 3 ? i + 1 : currentPage >= totalPages - 2 ? totalPages - 4 + i : currentPage - 2 + i
                if (totalPages <= 5) pageNum = i + 1
                return (
                  <button key={pageNum} onClick={() => handlePageChange(pageNum)} className={`w-8 h-8 mx-0.5 text-sm font-medium rounded-md flex items-center justify-center transition-colors ${currentPage === pageNum ? 'bg-blue-600 text-white shadow' : 'text-slate-600 hover:bg-slate-100'}`}>
                    {pageNum}
                  </button>
                )
              })}
            </div>
            <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="px-3 py-1.5 text-sm font-medium rounded-md hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent text-slate-700 transition-colors">Siguiente</button>
          </div>
        </div>
      )}

    </div>
  )
}