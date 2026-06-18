import { useEffect, useRef, useState } from 'react'

const WS_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3010')
  .replace('http', 'ws') + '/ws/pdv'

export interface PedidoPronto {
  id: string
  tipo: string
  mesaNumero?: number
  isConta?: boolean
  mesaId?: string
  pedidoId?: string
  total?: number
}

export interface ContaPendente {
  id: string          // mesaId
  mesaId: string
  mesaNumero: number
  pedidoId?: string
  total?: number
  hora: string
}

export function usePedidoPronto() {
  const [pedidos, setPedidos]               = useState<PedidoPronto[]>([])
  const [contasPendentes, setContasPendentes] = useState<ContaPendente[]>([])
  const wsRef     = useRef<WebSocket | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)

  function tocarSom() {
    try {
      const ctx = audioCtxRef.current ?? new AudioContext()
      audioCtxRef.current = ctx
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

        if (msg.evento === 'pedido_conta') {
          const dado = msg.dados
          tocarSom()

          // Notificação temporária (some em 8s)
          const notifId = `conta-${dado.mesaId ?? dado.mesaNumero}`
          setPedidos(prev => {
            const jaExiste = prev.find(p => p.id === notifId)
            if (jaExiste) return prev
            return [...prev, {
              id: notifId,
              tipo: 'mesa',
              mesaNumero: dado.mesaNumero,
              isConta: true,
              mesaId: dado.mesaId,
              pedidoId: dado.pedidoId,
              total: dado.total,
            }]
          })

          // Fila persistente (só some ao pagar)
          setContasPendentes(prev => {
            const jaExiste = prev.find(c => c.mesaId === dado.mesaId)
            if (jaExiste) return prev
            return [...prev, {
              id: dado.mesaId,
              mesaId: dado.mesaId,
              mesaNumero: dado.mesaNumero,
              pedidoId: dado.pedidoId,
              total: dado.total,
              hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            }]
          })
        }
      } catch (_) {}
    }

    ws.onclose = () => setTimeout(conectar, 3000)
  }

  useEffect(() => {
    conectar()
    return () => wsRef.current?.close()
  }, [])

  function dispensar(id: string) {
    setPedidos(prev => prev.filter(p => p.id !== id))
  }

  function removerConta(mesaId: string) {
    setContasPendentes(prev => prev.filter(c => c.mesaId !== mesaId))
  }

  return { pedidos, dispensar, contasPendentes, removerConta }
}
