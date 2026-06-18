import { useEffect, useRef } from 'react'

export function useAlertaNovosPedidos(totalAtual: number) {
  const anteriorRef = useRef<number | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)

  function tocarSom() {
    try {
      const ctx = audioCtxRef.current ?? new AudioContext()
      audioCtxRef.current = ctx

      // Três tons descendentes — "ding dong ding"
      const freqs = [660, 550, 440]
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = freq
        osc.type = 'triangle'
        const t = ctx.currentTime + i * 0.2
        gain.gain.setValueAtTime(0.5, t)
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
        osc.start(t)
        osc.stop(t + 0.3)
      })
    } catch (_) {}
  }

  useEffect(() => {
    if (anteriorRef.current === null) {
      anteriorRef.current = totalAtual
      return
    }
    if (totalAtual > anteriorRef.current) {
      tocarSom()
    }
    anteriorRef.current = totalAtual
  }, [totalAtual])
}
