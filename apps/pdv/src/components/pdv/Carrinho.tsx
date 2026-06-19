import { useState, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { usePedidoStore } from '../../store/pedido.store'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3010'

function headers(): Record<string, string> {
  const token = localStorage.getItem('token')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

type Forma = 'dinheiro' | 'pix' | 'debito' | 'credito'

const FORMAS: { key: Forma; label: string; icone: string }[] = [
  { key: 'pix',      label: 'PIX',          icone: '🟩' },
  { key: 'dinheiro', label: 'Dinheiro',      icone: '💵' },
  { key: 'debito',   label: 'Débito',        icone: '💳' },
  { key: 'credito',  label: 'Crédito',       icone: '💳' },
]

interface ModalPagamentoProps {
  total: number
  onConfirmar: (forma: Forma, valorRecebido: number, cpfConsumidor?: string, emitirNfce?: boolean) => void
  onCancelar: () => void
  loading: boolean
}

function ModalPagamento({ total, onConfirmar, onCancelar, loading }: ModalPagamentoProps) {
  const [forma, setForma]           = useState<Forma>('pix')
  const [valorRecebido, setValorRecebido] = useState(total.toFixed(2))
  const [cpf, setCpf]               = useState('')
  const [emitirNfce, setEmitirNfce] = useState(false)

  const troco = forma === 'dinheiro' ? Math.max(0, Number(valorRecebido) - total) : 0

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-gray-700">
        <h2 className="text-lg font-bold text-white mb-4">💰 Pagamento</h2>

        {/* Total */}
        <div className="bg-gray-800 rounded-xl p-4 mb-4 text-center">
          <p className="text-xs text-gray-400">Total a pagar</p>
          <p className="text-3xl font-bold text-orange-400 mt-1">
            {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>

        {/* Forma de pagamento */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {FORMAS.map(f => (
            <button key={f.key} onClick={() => setForma(f.key)}
              className={`py-3 rounded-xl text-sm font-semibold transition border ${
                forma === f.key ? 'bg-orange-500 border-orange-500 text-white'
                  : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'
              }`}>
              {f.icone} {f.label}
            </button>
          ))}
        </div>

        {/* Valor recebido (só dinheiro) */}
        {forma === 'dinheiro' && (
          <div className="mb-4">
            <label className="text-xs text-gray-400 mb-1 block">Valor recebido</label>
            <input type="number" step="0.01" value={valorRecebido}
              onChange={e => setValorRecebido(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-center text-lg font-bold focus:outline-none focus:border-orange-500" />
            {troco > 0 && (
              <p className="text-green-400 text-sm text-center mt-2 font-semibold">
                Troco: {troco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            )}
          </div>
        )}

        {/* CPF na nota + NFC-e */}
        <div className="mb-4 space-y-2">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">CPF na nota (opcional)</label>
            <input value={cpf} onChange={e => setCpf(e.target.value)}
              placeholder="000.000.000-00"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={emitirNfce} onChange={e => setEmitirNfce(e.target.checked)}
              className="accent-orange-500" />
            <span className="text-xs text-gray-300">Emitir NFC-e (nota fiscal)</span>
          </label>
        </div>

        {/* Botões */}
        <div className="flex gap-3">
          <button onClick={onCancelar} disabled={loading}
            className="flex-1 py-3 rounded-xl border border-gray-700 text-gray-400 hover:text-white text-sm font-semibold transition">
            Cancelar
          </button>
          <button onClick={() => onConfirmar(forma, Number(valorRecebido), cpf || undefined, emitirNfce)}
            disabled={loading}
            className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-bold transition disabled:opacity-50">
            {loading ? 'Processando…' : '✅ Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface SuccessProps {
  pedidoId: string
  forma: string
  total: number
  troco: number
  pontosGanhos?: number
  onFechar: () => void
}

function TicketSucesso({ pedidoId, forma, total, troco, pontosGanhos, onFechar }: SuccessProps) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-green-700 text-center">
        <div className="text-5xl mb-3">✅</div>
        <h2 className="text-xl font-bold text-green-400 mb-1">Venda Registrada!</h2>
        <p className="text-gray-400 text-xs mb-4">#{pedidoId.slice(-8).toUpperCase()}</p>
        <div className="bg-gray-800 rounded-xl p-4 space-y-2 text-sm mb-4">
          <div className="flex justify-between">
            <span className="text-gray-400">Total</span>
            <span className="font-bold text-white">{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Forma</span>
            <span className="text-white capitalize">{forma}</span>
          </div>
          {troco > 0 && (
            <div className="flex justify-between text-green-400 font-bold">
              <span>Troco</span>
              <span>{troco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
            </div>
          )}
          {(pontosGanhos ?? 0) > 0 && (
            <div className="flex justify-between text-yellow-400 font-bold border-t border-gray-700 pt-2">
              <span>⭐ Pontos ganhos</span>
              <span>+{pontosGanhos}</span>
            </div>
          )}
        </div>
        <button
          onClick={onFechar}
          className="w-full py-3 bg-orange-500 hover:bg-orange-400 text-white font-bold rounded-xl transition"
        >
          Nova Venda
        </button>
      </div>
    </div>
  )
}

export default function Carrinho() {
  const { itens, desconto, limpar, removerItem, alterarQuantidade } = usePedidoStore()
  const tipo       = usePedidoStore(s => s.tipo)
  const mesaId     = usePedidoStore(s => s.mesaId)
  const clienteId  = usePedidoStore(s => s.clienteId)
  const clienteNome = usePedidoStore(s => s.clienteNome)
  const subtotal   = usePedidoStore(s => s.subtotal)
  const total      = usePedidoStore(s => s.total)
  const totalItens = usePedidoStore(s => s.totalItens)

  const [showModal, setShowModal]           = useState(false)
  const [sucesso, setSucesso]               = useState<null | { pedidoId: string; forma: string; total: number; troco: number; pontosGanhos?: number }>(null)
  const [pedidoAberto, setPedidoAberto]     = useState<string | null>(null)
  const [modalCancelar, setModalCancelar]   = useState(false)
  const [motivoCancelar, setMotivoCancelar] = useState('')
  const [pontosResgatar, setPontosResgatar] = useState(0)

  // Busca saldo de pontos do cliente selecionado
  const { data: clienteData } = useQuery<{ pontos: number }>({
    queryKey: ['cliente-pontos', clienteId],
    queryFn: async () => {
      const res = await fetch(`${API}/clientes?q=${encodeURIComponent(clienteNome ?? '')}`, { headers: headers() })
      const list = await res.json()
      return list.find((c: any) => c.id === clienteId) ?? { pontos: 0 }
    },
    enabled: !!clienteId,
  })

  const pontosDisponiveis = clienteData?.pontos ?? 0
  const descontoPontos = pontosResgatar / 10
  const totalFinal = Math.max(0, total() - descontoPontos)

  // Reseta pontos se cliente mudou
  useEffect(() => { setPontosResgatar(0) }, [clienteId])

  const cancelarMutation = useMutation({
    mutationFn: async (pedidoId: string) => {
      const res = await fetch(`${API}/pedidos/${pedidoId}/cancelar`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({ motivo: motivoCancelar || 'Cancelado pelo operador' }),
      })
      if (!res.ok) throw new Error(await res.text())
    },
    onSuccess: () => {
      limpar()
      setPedidoAberto(null)
      setModalCancelar(false)
      setMotivoCancelar('')
    },
  })

  const mutation = useMutation({
    mutationFn: async ({ forma, valorRecebido, cpfConsumidor, emitirNfce }: { forma: Forma; valorRecebido: number; cpfConsumidor?: string; emitirNfce?: boolean }) => {
      // 1. Criar pedido com desconto de pontos
      const resPedido = await fetch(`${API}/pedidos`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          tipo,
          mesaId,
          clienteId,
          desconto: descontoPontos,
          descontoPontos: pontosResgatar,
          itens: itens.map(i => ({
            produtoId:  i.produto.id,
            quantidade: i.quantidade,
            observacao: i.observacao,
          })),
        }),
      })
      if (!resPedido.ok) throw new Error(await resPedido.text())
      const pedido = await resPedido.json()
      setPedidoAberto(pedido.id)

      // 2. Registrar pagamento
      const troco = forma === 'dinheiro' ? Math.max(0, valorRecebido - totalFinal) : 0
      const resPag = await fetch(`${API}/pedidos/${pedido.id}/pagamento`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ forma, valor: totalFinal, troco, emitirNfce, cpfCliente: cpfConsumidor }),
      })
      if (!resPag.ok) throw new Error(await resPag.text())

      if (emitirNfce) {
        fetch(`${API}/fiscal/nfce/${pedido.id}`, {
          method: 'POST', headers: headers(),
          body: JSON.stringify({ cpfConsumidor }),
        }).catch(console.error)
      }

      const pontosGanhos = Math.floor(totalFinal)
      return { pedidoId: pedido.id, forma, total: totalFinal, troco, pontosGanhos }
    },
    onSuccess: (data) => {
      setSucesso(data)
      setShowModal(false)
      setPontosResgatar(0)
    },
  })

  function fecharSucesso() {
    limpar()
    setSucesso(null)
  }

  if (itens.length === 0 && !sucesso) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-600">
        <span className="text-4xl mb-3">🛒</span>
        <p className="text-sm">Carrinho vazio</p>
        <p className="text-xs mt-1 text-gray-700">Toque num produto para adicionar</p>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col h-full p-4 gap-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-300">Pedido</h2>
          <div className="flex gap-2">
            {pedidoAberto && (
              <button onClick={() => setModalCancelar(true)} className="text-xs text-red-400 hover:text-red-300 transition">
                Cancelar
              </button>
            )}
            <button onClick={limpar} className="text-xs text-gray-600 hover:text-red-400 transition">
              Limpar
            </button>
          </div>
        </div>

        {/* Itens */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {itens.map(item => (
            <div key={item.produto.id} className="flex items-center gap-2 bg-gray-800 rounded-xl px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-200 truncate">{item.produto.nome}</p>
                <p className="text-xs text-gray-500">
                  {Number(item.produto.precoVenda).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} × {item.quantidade}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => alterarQuantidade(item.produto.id, item.quantidade - 1)}
                  className="w-6 h-6 rounded-lg bg-gray-700 text-gray-300 text-sm flex items-center justify-center hover:bg-gray-600"
                >−</button>
                <span className="text-xs w-5 text-center text-white font-bold">{item.quantidade}</span>
                <button
                  onClick={() => alterarQuantidade(item.produto.id, item.quantidade + 1)}
                  className="w-6 h-6 rounded-lg bg-gray-700 text-gray-300 text-sm flex items-center justify-center hover:bg-gray-600"
                >+</button>
              </div>
              <span className="text-xs font-bold text-gray-100 w-14 text-right">
                {(Number(item.produto.precoVenda) * item.quantidade).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
          ))}
        </div>

        {/* Pontos do cliente */}
        {clienteId && pontosDisponiveis > 0 && (
          <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-yellow-300 font-semibold">⭐ {pontosDisponiveis} pontos</span>
              <span className="text-gray-400">{(pontosDisponiveis / 10).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} disponível</span>
            </div>
            <div className="flex items-center gap-2">
              <input type="range" min={0} max={Math.min(pontosDisponiveis, Math.floor(total() * 10))}
                step={10} value={pontosResgatar}
                onChange={e => setPontosResgatar(Number(e.target.value))}
                className="flex-1 accent-yellow-400" />
              <span className="text-xs text-yellow-300 font-bold w-12 text-right">{pontosResgatar}pts</span>
            </div>
            {pontosResgatar > 0 && (
              <p className="text-xs text-green-400 text-center font-semibold">
                − {descontoPontos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} de desconto
              </p>
            )}
          </div>
        )}

        {/* Totais */}
        <div className="border-t border-gray-800 pt-3 space-y-1">
          {(desconto > 0 || descontoPontos > 0) && (
            <>
              <div className="flex justify-between text-xs text-gray-500">
                <span>Subtotal</span>
                <span>{subtotal().toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
              {descontoPontos > 0 && (
                <div className="flex justify-between text-xs text-yellow-400">
                  <span>⭐ Pontos ({pontosResgatar})</span>
                  <span>− {descontoPontos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
              )}
              {desconto > 0 && (
                <div className="flex justify-between text-xs text-green-400">
                  <span>Desconto</span>
                  <span>− {desconto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
              )}
            </>
          )}
          <div className="flex justify-between text-sm font-bold text-white">
            <span>{totalItens()} {totalItens() === 1 ? 'item' : 'itens'}</span>
            <span className="text-orange-400">{totalFinal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </div>
        </div>

        {/* Botão cobrar */}
        <button
          onClick={() => setShowModal(true)}
          className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl text-sm transition active:scale-95"
        >
          💰 Cobrar {totalFinal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </button>
      </div>

      {/* Modal de pagamento */}
      {showModal && (
        <ModalPagamento
          total={totalFinal}
          loading={mutation.isPending}
          onCancelar={() => setShowModal(false)}
          onConfirmar={(forma, valorRecebido, cpfConsumidor, emitirNfce) => mutation.mutate({ forma, valorRecebido, cpfConsumidor, emitirNfce })}
        />
      )}

      {/* Modal cancelar pedido */}
      {modalCancelar && pedidoAberto && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-sm border border-red-700 space-y-4">
            <h3 className="text-lg font-bold text-red-400">Cancelar Pedido</h3>
            <p className="text-xs text-gray-400">#{pedidoAberto.slice(-6).toUpperCase()}</p>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Motivo *</label>
              <input
                value={motivoCancelar}
                onChange={e => setMotivoCancelar(e.target.value)}
                placeholder="ex: Pedido errado, cliente desistiu..."
                autoFocus
                className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalCancelar(false)} className="flex-1 py-2 text-sm text-gray-400 hover:text-white">
                Voltar
              </button>
              <button
                onClick={() => cancelarMutation.mutate(pedidoAberto)}
                disabled={cancelarMutation.isPending || !motivoCancelar}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-lg transition disabled:opacity-50"
              >
                {cancelarMutation.isPending ? 'Cancelando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ticket de sucesso */}
      {sucesso && (
        <TicketSucesso
          pedidoId={sucesso.pedidoId}
          forma={sucesso.forma}
          total={sucesso.total}
          troco={sucesso.troco}
          pontosGanhos={sucesso.pontosGanhos}
          onFechar={fecharSucesso}
        />
      )}
    </>
  )
}
