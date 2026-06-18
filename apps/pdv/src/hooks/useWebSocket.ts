import { useEffect, useRef, useCallback } from 'react'

type Canal = 'kds' | 'pdv' | 'painel'

interface WSMensagem {
  evento: string
  dados: unknown
}

export function useWebSocket(canal: Canal, onMensagem: (msg: WSMensagem) => void) {
  const ws     = useRef<WebSocket | null>(null)
  const onMsg  = useRef(onMensagem)
  onMsg.current = onMensagem

  const conectar = useCallback(() => {
    const url = `${import.meta.env.VITE_WS_URL ?? 'ws://localhost:3000'}/ws/${canal}`
    ws.current = new WebSocket(url)

    ws.current.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as WSMensagem
        onMsg.current(msg)
      } catch { /* ignora mensagens malformadas */ }
    }

    ws.current.onclose = () => {
      // Reconecta após 3s se a conexão cair
      setTimeout(conectar, 3000)
    }
  }, [canal])

  useEffect(() => {
    conectar()
    return () => {
      ws.current?.close()
    }
  }, [conectar])
}
