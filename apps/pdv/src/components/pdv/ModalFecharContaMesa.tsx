import { useState, useEffect } from 'react'
import type { ContaPendente } from '../../hooks/usePedidoPronto'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3010'

function headers(): Record<string, string> {
  const token = localStorage.getItem('token')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

type Forma = 'pix' | 'dinheiro' | 'debito' | 'credito'
const FORMAS: { key: Forma; label: string; icone: string }[] = [
  { key: 'pix',      label: 'PIX',     icone: '🟩' },
  { key: 'dinheiro', label: 'Dinheiro', icone: '💵' },
  { key: 'debito',   label: 'Débito',  icone: '💳' },
  { key: 'credito',  label: 'Crédito', icone: '💳' },
]

interface Props {
  conta: ContaPendente
  onPago: (mesaId: string) => void
  onFechar: () => void
}

interface PedidoMesa {
  id: string
  total: number
  itens_pedido: { id: string; quantidade: number; subtotal: number; produtos: { nome: string } }[]
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function ModalFecharContaMesa({ conta, onPago, onFechar }: Props) {
  const [pedido, setPedido]     = useState<PedidoMesa | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [forma, setForma]       = useState<Forma>('pix')
  const [valorRecebido, setValorRecebido] = useState('')
  const [processando, setProcessando] = useState(false)
  const [pago, setPago]         = useState(false)
  const [erro, setErro]         = useState('')

  const total = pedido ? Number(pedido.total) : (conta.total ?? 0)
  const troco = forma === 'dinheiro' ? Math.max(0, Number(valorRecebido) - total) : 0

  useEffect(() => {
    async function carregarPedido() {
      try {
        const res = await fetch(`${API}/mesas/${conta.mesaId}/pedido`, { headers: headers() })
        if (res.ok) {
          const data = await res.json()
          setPedido(data)
          setValorRecebido(Number(data?.total ?? conta.total ?? 0).toFixed(2))
        }
      } catch (_) {}
      setCarregando(false)
    }
    carregarPedido()
  }, [conta.mesaId])

  async function confirmarPagamento() {
    if (!pedido?.id) return
    setProcessando(true)
    setErro('')
    try {
      const res = await fetch(`${API}/pedidos/${pedido.id}/pagamento`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ forma, valor: total, troco }),
      })
      if (!res.ok) throw new Error(await res.text())
      setPago(true)
      setTimeout(() => {
        onPago(conta.mesaId)
        onFechar()
      }, 1800)
    } catch (e: any) {
      setErro(e.message ?? 'Erro ao processar pagamento')
    }
    setProcessando(false)
  }

  if (pago) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 rounded-2xl p-8 w-full max-w-sm border border-green-700 text-center">
          <div className="text-6xl mb-3">✅</div>
          <h2 className="text-xl font-bold text-green-400">Conta fechada!</h2>
          <p className="text-gray-400 text-sm mt-2">Mesa {conta.mesaNumero} liberada</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-orange-700 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">🧾 Fechar Conta</h2>
            <p className="text-sm text-orange-400 font-semibold">Mesa {conta.mesaNumero}</p>
          </div>
          <button onClick={onFechar} className="text-gray-500 hover:text-white text-2xl leading-none">×</button>
        </div>

        {/* Itens do pedido */}
        {carregando ? (
          <p className="text-gray-500 text-sm text-center py-4">Carregando pedido...</p>
        ) : pedido && (
          <div className="bg-gray-800 rounded-xl p-3 space-y-1 max-h-40 overflow-y-auto">
            {pedido.itens_pedido.map(i => (
              <div key={i.id} className="flex justify-between text-xs text-gray-300">
                <span>{i.quantidade}× {i.produtos?.nome}</span>
                <span className="text-gray-400">{fmt(Number(i.subtotal))}</span>
              </div>
            ))}
          </div>
        )}

        {/* Total */}
        <div className="bg-gray-800 rounded-xl p-4 text-center">
          <p className="text-xs text-gray-400 mb-1">Total a pagar</p>
          <p className="text-3xl font-bold text-orange-400">{fmt(total)}</p>
        </div>

        {/* Forma de pagamento */}
        <div className="grid grid-cols-2 gap-2">
          {FORMAS.map(f => (
            <button key={f.key} onClick={() => setForma(f.key)}
              className={`py-3 rounded-xl text-sm font-semibold transition border ${
                forma === f.key
                  ? 'bg-orange-500 border-orange-500 text-white'
                  : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'
              }`}>
              {f.icone} {f.label}
            </button>
          ))}
        </div>

        {/* Valor recebido (dinheiro) */}
        {forma === 'dinheiro' && (
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Valor recebido</label>
            <input type="number" step="0.01" value={valorRecebido}
              onChange={e => setValorRecebido(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-center text-lg font-bold focus:outline-none focus:border-orange-500" />
            {troco > 0 && (
              <p className="text-green-400 text-sm text-center mt-2 font-semibold">
                Troco: {fmt(troco)}
              </p>
            )}
          </div>
        )}

        {erro && <p className="text-red-400 text-xs text-center">{erro}</p>}

        {/* Botões */}
        <div className="flex gap-3">
          <button onClick={onFechar} disabled={processando}
            className="flex-1 py-3 rounded-xl border border-gray-700 text-gray-400 hover:text-white text-sm font-semibold transition">
            Cancelar
          </button>
          <button
            onClick={confirmarPagamento}
            disabled={processando || carregando || !pedido}
            className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-bold transition disabled:opacity-50">
            {processando ? 'Processando…' : '✅ Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}
