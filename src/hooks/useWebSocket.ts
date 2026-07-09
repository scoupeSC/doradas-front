'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { WebSocketEvent, BoletaBloqueadaEvent, BoletaVendidaEvent } from '@/types/ventas'

interface UseWebSocketProps {
  rifaId: string
  onBoletaBloqueada?: (event: BoletaBloqueadaEvent) => void
  onBoletaDesbloqueada?: (event: BoletaBloqueadaEvent) => void
  onBoletaVendida?: (event: BoletaVendidaEvent) => void
  onVentaCompletada?: (event: any) => void
}

export function useWebSocket({
  rifaId,
  onBoletaBloqueada,
  onBoletaDesbloqueada,
  onBoletaVendida,
  onVentaCompletada
}: UseWebSocketProps) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 2 // Reducido a 2 para menos intentos
  const reconnectDelay = 1000 // 1 segundo

  const connect = useCallback(() => {
    if (!rifaId) {
      return
    }

    // Verificar si ya estamos conectados o si hemos excedido intentos
    if (reconnectAttempts.current >= maxReconnectAttempts) {
      console.log('WebSocket: Máximo de intentos alcanzado, desactivando reconexión')
      return
    }

    try {
      const token = localStorage.getItem('token')
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000'
      
      // Verificar si el navegador soporta WebSocket
      if (typeof WebSocket === 'undefined') {
        console.log('WebSocket: No soportado por este navegador')
        return
      }
      
      // Verificar si tenemos token
      if (!token) {
        console.log('WebSocket: No hay token de autenticación')
        return
      }
      
      const ws = new WebSocket(`${wsUrl}/rifa/${rifaId}?token=${token}`)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('WebSocket: Conectado exitosamente')
        reconnectAttempts.current = 0
      }

      ws.onmessage = (event) => {
        try {
          const wsEvent: WebSocketEvent = JSON.parse(event.data)
          
          switch (wsEvent.type) {
            case 'BOLETA_BLOQUEADA':
              onBoletaBloqueada?.(wsEvent.data as BoletaBloqueadaEvent)
              break
              
            case 'BOLETA_DESBLOQUEADA':
              onBoletaDesbloqueada?.(wsEvent.data as BoletaBloqueadaEvent)
              break
              
            case 'BOLETA_VENDIDA':
              onBoletaVendida?.(wsEvent.data as BoletaVendidaEvent)
              break
              
            case 'VENTA_COMPLETADA':
              onVentaCompletada?.(wsEvent.data)
              break
              
            default:
              console.log('WebSocket: Evento no manejado:', wsEvent.type)
          }
        } catch (error) {
          // Silenciar completamente errores de parseo
        }
      }

      ws.onclose = (event) => {
        console.log('WebSocket: Conexión cerrada')
        
        // Solo reintentar si no fue un cierre normal y no hemos excedido intentos
        if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++
          const delay = reconnectDelay * Math.pow(2, reconnectAttempts.current - 1)
          
          console.log(`WebSocket: Reintentando en ${delay}ms (intento ${reconnectAttempts.current})`)
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, delay)
        }
      }

      ws.onerror = (event) => {
        // Completamente silencioso - no mostrar errores
        reconnectAttempts.current = maxReconnectAttempts // Prevenir más intentos
      }

    } catch (error: any) {
      // Silenciar completamente cualquier error de conexión
      reconnectAttempts.current = maxReconnectAttempts // Prevenir más intentos
    }
  }, [rifaId, onBoletaBloqueada, onBoletaDesbloqueada, onBoletaVendida, onVentaCompletada])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Desconexión normal')
      wsRef.current = null
    }
  }, [])

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    } else {
      console.warn('WebSocket no está conectado')
    }
  }, [])

  // Conectar al montar y desconectar al desmontar
  useEffect(() => {
    connect()
    
    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  return {
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
    sendMessage,
    disconnect
  }
}

// Hook para manejar eventos de tiempo real en el contexto de ventas
export function useVentasRealTime(rifaId: string) {
  const [eventosRecientes, setEventosRecientes] = useState<WebSocketEvent[]>([])
  const [conectado, setConectado] = useState(false)

  const ws = useWebSocket({
    rifaId,
    onBoletaBloqueada: useCallback((event: BoletaBloqueadaEvent) => {
      const wsEvent: WebSocketEvent = {
        type: 'BOLETA_BLOQUEADA',
        data: event,
        timestamp: new Date().toISOString()
      }
      setEventosRecientes((prev) => [wsEvent, ...prev.slice(0, 9)]) // Mantener últimos 10 eventos
      console.log('Boleta bloqueada en tiempo real:', event)
    }, []),
    onBoletaDesbloqueada: useCallback((event: BoletaBloqueadaEvent) => {
      const wsEvent: WebSocketEvent = {
        type: 'BOLETA_DESBLOQUEADA',
        data: event,
        timestamp: new Date().toISOString()
      }
      setEventosRecientes((prev) => [wsEvent, ...prev.slice(0, 9)])
      console.log('Boleta desbloqueada en tiempo real:', event)
    }, []),
    onBoletaVendida: useCallback((event: BoletaVendidaEvent) => {
      const wsEvent: WebSocketEvent = {
        type: 'BOLETA_VENDIDA',
        data: event,
        timestamp: new Date().toISOString()
      }
      setEventosRecientes((prev) => [wsEvent, ...prev.slice(0, 9)])
      console.log('Boleta vendida en tiempo real:', event)
    }, []),
    onVentaCompletada: useCallback((event: any) => {
      const wsEvent: WebSocketEvent = {
        type: 'VENTA_COMPLETADA',
        data: event,
        timestamp: new Date().toISOString()
      }
      setEventosRecientes((prev) => [wsEvent, ...prev.slice(0, 9)])
      console.log('Venta completada en tiempo real:', event)
    }, [])
  })

  // Monitorear estado de conexión
  useEffect(() => {
    setConectado(ws.isConnected)
  }, [ws.isConnected])

  return {
    eventosRecientes,
    conectado
  }
}
