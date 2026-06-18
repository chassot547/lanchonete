import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

interface Produto {
  id: string; nome: string; preco_venda: number; categoria_id: string; ativo: boolean
}
interface Categoria { id: string; nome: string; ordem: number }
interface ItemCarrinho { produto: Produto; quantidade: number; observacao?: string }
interface PedidoAberto { id: string; total: number; status: string; itens_pedido: any[] }

function fmt(n: number) { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }

export default function PedidoMesaPage() {
  const { mesaId } = useParams<{ mesaId: string }>()
  const navigate   = useNavigate()
  const qc         = useQueryClient()

  const [itens, setItens]       = useState<ItemCarrinho[]>([])
  const [catSel, setCatSel]     = useState<string | null>(null)
  const [busca, setBusca]       = useState('')
  const [obsModal, setObsModal] = useState<Produto | null>(null)
  const [obsText, setObsText]   = useState('')
  const [aba, setAba]           = useState<'cardapio' | 'conta'>('cardapio')

  const { data: mesa } = useQuery<any>({
    queryKey: ['mesa', mesaId],
    queryFn: () => api.get(`/mesas/${mesaId}/pedido`).catch(() => null),
  })

  const { data: pedidoAberto } = useQuery<PedidoAberto | null>({
    queryKey: ['mesa-pedido', mesaId],
    queryFn: () => api.get(`/mesas/${mesaId}/pedido`).catch(() => null),
    refetchInterval: 15_000,
  })

  const { data: produtos = [] } = useQuery<Produto[]>({
    queryKey: ['produtos'],
    queryFn:  () => api.get('/produtos?ativo=true'),
  })

  const { data: categorias = [] } = useQuery<Categoria[]>({
    queryKey: ['categorias'],
    queryFn:  () => api.get('/categorias'),
  })

  const pedirConta = useMutation({
    mutationFn: () => api.post(`/mesas/${mesaId}/pedir-conta`, {}),
    onSuccess: () => alert('✅ Conta solicitada ao caixa!'),
  })

  const enviarPedido = useMutation({
    mutationFn: () => api.post('/pedidos', {
      tipo: 'mesa',
      mesaId,
      itens: itens.map(i => ({ produtoId: i.produto.id, quantidade: i.quantidade, observacao: i.observacao })),
    }),
    onSuccess: () => {
      setItens([])
      qc.invalidateQueries({ queryKey: ['mesa-pedido', mesaId] })
      qc.invalidateQueries({ queryKey: ['mesas'] })
      setAba('conta')
    },
  })

  function adicionarItem(produto: Produto, obs?: string) {
    setItens(prev => {
      const key = produto.id + (obs ?? '')
      const existe = prev.find(i => i.produto.id === produto.id && i.observacao === obs)
      if (existe) return prev.map(i => i.produto.id === produto.id && i.observacao === obs
        ? { ...i, quantidade: i.quantidade + 1 } : i)
      return [...prev, { produto, quantidade: 1, observacao: obs }]
    })
  }

  function remover(idx: number) {
    setItens(prev => prev.filter((_, i) => i !== idx))
  }

  function altQtd(idx: number, delta: number) {
    setItens(prev => prev.map((item, i) => i === idx
      ? { ...item, quantidade: Math.max(0, item.quantidade + delta) }
      : item
    ).filter(i => i.quantidade > 0))
  }

  const filtrados = produtos.filter(p => {
    const nacat = !catSel || p.categoria_id === catSel
    const nabusca = !busca || p.nome.toLowerCase().includes(busca.toLowerCase())
    return nacat && nabusca
  })

  const totalCarrinho = itens.reduce((s, i) => s + i.produto.preco_venda * i.quantidade, 0)
  const totalMesa     = Number(pedidoAberto?.total ?? 0)

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => navigate('/')} className="text-slate-400 hover:text-white text-xl leading-none">←</button>
        <div className="flex-1">
          <h1 className="font-bold text-white">Mesa {(mesa as any)?.numero ?? '...'}</h1>
          <p className="text-xs text-slate-400">
            {pedidoAberto ? `Conta aberta · ${fmt(totalMesa)}` : 'Mesa livre'}
          </p>
        </div>
        {/* Abas */}
        <div className="flex gap-1">
          {(['cardapio','conta'] as const).map(a => (
            <button key={a} onClick={() => setAba(a)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${aba===a ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
              {a === 'cardapio' ? '🍔 Cardápio' : '🧾 Conta'}
            </button>
          ))}
        </div>
      </header>

      {/* ABA CARDÁPIO */}
      {aba === 'cardapio' && (
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar de categorias */}
          <aside className="w-28 bg-slate-800 border-r border-slate-700 overflow-y-auto flex-shrink-0">
            <button onClick={() => setCatSel(null)}
              className={`w-full py-3 text-xs font-semibold border-b border-slate-700 transition ${!catSel ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              Todos
            </button>
            {categorias.map(c => (
              <button key={c.id} onClick={() => setCatSel(c.id)}
                className={`w-full py-3 px-2 text-xs font-semibold border-b border-slate-700/50 text-center transition ${catSel===c.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                {c.nome}
              </button>
            ))}
          </aside>

          {/* Grade de produtos */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-slate-700">
              <input type="search" placeholder="🔍 Buscar..." value={busca}
                onChange={e => setBusca(e.target.value)}
                className="w-full bg-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none" />
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <div className="grid grid-cols-2 gap-3">
                {filtrados.map(p => (
                  <button key={p.id} onClick={() => setObsModal(p)}
                    className="bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-blue-500 rounded-2xl p-3 text-left transition active:scale-95">
                    <div className="text-2xl mb-1">🍽️</div>
                    <div className="text-sm font-semibold text-slate-200 leading-tight">{p.nome}</div>
                    <div className="text-sm font-bold text-blue-400 mt-1">{fmt(Number(p.preco_venda))}</div>
                  </button>
                ))}
                {filtrados.length === 0 && (
                  <div className="col-span-2 text-center text-slate-600 py-12 text-sm">Nenhum produto</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA CONTA */}
      {aba === 'conta' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {pedidoAberto && (pedidoAberto.itens_pedido ?? []).length > 0 && (
            <div className="bg-slate-800 rounded-2xl p-4 space-y-2">
              <h3 className="text-sm font-bold text-slate-300 mb-3">Pedido em aberto</h3>
              {(pedidoAberto.itens_pedido ?? []).map((i: any) => (
                <div key={i.id} className="flex justify-between text-sm">
                  <span className="text-slate-300">{i.quantidade}× {i.produtos?.nome}</span>
                  <span className="text-slate-400">{fmt(Number(i.subtotal))}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold text-white border-t border-slate-700 pt-2 mt-2">
                <span>Total</span>
                <span className="text-blue-400">{fmt(totalMesa)}</span>
              </div>
            </div>
          )}
          {!pedidoAberto && <p className="text-slate-500 text-sm text-center py-8">Nenhum pedido aberto nesta mesa.</p>}

          {/* Botão pedir conta */}
          {pedidoAberto && (
            <button onClick={() => pedirConta.mutate()} disabled={pedirConta.isPending}
              className="w-full py-4 bg-orange-500 hover:bg-orange-400 text-white font-bold rounded-2xl transition text-lg disabled:opacity-50">
              {pedirConta.isPending ? 'Solicitando...' : '🧾 Pedir Conta'}
            </button>
          )}
        </div>
      )}

      {/* Carrinho flutuante (quando há itens) */}
      {itens.length > 0 && aba === 'cardapio' && (
        <div className="bg-slate-800 border-t border-slate-700 p-4 space-y-3">
          <div className="space-y-1 max-h-36 overflow-y-auto">
            {itens.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                <div className="flex-1 text-slate-300 truncate">{item.produto.nome}</div>
                <div className="flex items-center gap-1">
                  <button onClick={() => altQtd(idx, -1)} className="w-6 h-6 bg-slate-700 rounded text-slate-300 flex items-center justify-center">−</button>
                  <span className="text-white w-5 text-center font-bold">{item.quantidade}</span>
                  <button onClick={() => altQtd(idx, +1)} className="w-6 h-6 bg-slate-700 rounded text-slate-300 flex items-center justify-center">+</button>
                </div>
                <span className="text-slate-400 w-16 text-right text-xs">{fmt(item.produto.preco_venda * item.quantidade)}</span>
                <button onClick={() => remover(idx)} className="text-red-400 text-xs ml-1">✕</button>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">{itens.reduce((s,i)=>s+i.quantidade,0)} itens · <span className="text-white font-bold">{fmt(totalCarrinho)}</span></span>
            <button onClick={() => enviarPedido.mutate()} disabled={enviarPedido.isPending}
              className="px-6 py-2.5 bg-green-600 hover:bg-green-500 text-white text-sm font-bold rounded-xl transition disabled:opacity-50">
              {enviarPedido.isPending ? 'Enviando...' : '✅ Enviar Pedido'}
            </button>
          </div>
        </div>
      )}

      {/* Modal observação */}
      {obsModal && (
        <div className="fixed inset-0 bg-black/70 flex items-end z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-5 w-full space-y-4 border border-slate-700">
            <div>
              <h3 className="font-bold text-white">{obsModal.nome}</h3>
              <p className="text-blue-400 font-bold">{fmt(Number(obsModal.preco_venda))}</p>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Observação (opcional)</label>
              <input value={obsText} onChange={e => setObsText(e.target.value)}
                placeholder="ex: sem cebola, ponto bem passado..."
                className="w-full bg-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setObsModal(null); setObsText('') }}
                className="flex-1 py-3 text-sm text-slate-400 border border-slate-700 rounded-xl hover:text-white">
                Cancelar
              </button>
              <button onClick={() => { adicionarItem(obsModal, obsText || undefined); setObsModal(null); setObsText('') }}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl">
                + Adicionar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
