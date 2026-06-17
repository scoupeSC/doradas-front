'use client'

import { useRef, useEffect, useState, ReactNode } from 'react'

/**
 * Wrapper que escala visualmente un BoletaTicket (800×352px fijo)
 * para que quepa en cualquier contenedor sin scroll horizontal.
 *
 * - NO altera las dimensiones del ticket → html2canvas captura los 800×352px completos.
 * - Usa CSS transform: scale() para reducir visualmente si el contenedor es < 800px.
 * - En pantallas ≥ 800px, no aplica escala (se ve 1:1).
 */
export default function ResponsiveBoletaWrapper({ children, id }: { children: ReactNode; id?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return
      const parentWidth = containerRef.current.parentElement?.clientWidth ?? containerRef.current.clientWidth
      const ticketWidth = 800
      const newScale = parentWidth < ticketWidth ? parentWidth / ticketWidth : 1
      setScale(newScale)
    }

    updateScale()
    window.addEventListener('resize', updateScale)
    return () => window.removeEventListener('resize', updateScale)
  }, [])

  const scaledHeight = 352 * scale

  return (
    <div
      ref={containerRef}
      className="w-full relative overflow-hidden"
      style={{ height: `${scaledHeight}px` }}
    >
      <div
        id={id}
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: `translateX(-50%) scale(${scale})`,
          transformOrigin: 'top center',
          width: '800px',
          height: '352px',
          boxSizing: 'border-box',
        }}
      >
        {children}
      </div>
    </div>
  )
}
