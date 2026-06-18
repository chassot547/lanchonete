import { useEffect, useRef, useState } from 'react'

const WS_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3010')
  .replace('http', 'ws') + '/ws/pdv'

interface PedidoPronto {
  id: string
  tipo: string
  mesaNumero?: number
}

export function usePedidoPronto() {
  const [pedidos, setPedidos] = useState<PedidoPronto[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)

  function tocarSom() {
    try {
      const ctx = audioCtxRef.current ?? new AudioContext()
      audioCtxRef.current = ctx

      // Dois bips agudos
      ;[0, 0.25].forEach(offset => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = 880
        osc.type = 'sine'
        gain.gain.setValueAtTime(0.4, ctx.currentTime + offset)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.2)
        osc.start(ctx.currentTime + offset)
        osc.stop(ctx.currentTime + offset + 0.2)
      })
    } catch (_) {}
  }

  function conectar() {
    const token = localStorage.getItem('token')
    if (!token) return

    const ws = new WebSocket(`${WS_URL}?token=${token}`)
    wsRef.current = ws

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        if (msg.evento === 'pedido_pronto') {
          const dado = msg.dados
          tocarSom()
          setPedidos(prev => [...prev, {
            id: dado.pedidoId,
            tipo: dado.tipo ?? 'balcao',
            mesaNumero: dado.mesaNumero,
          }])
        }
      } catch (_) {}
    }

    ws.onclose = () => {
      // Reconecta após 3s
      setTimeout(conectar, 3000)
    }
  }

  useEffect(() => {
    conectar()
    return () => {
      wsRef.current?.close()
    }
  }, [])

  function dispensar(id: string) {
    setPedidos(prev => prev.filter(p => p.id !== id))
  }

  return { pedidos, dispensar }
}
