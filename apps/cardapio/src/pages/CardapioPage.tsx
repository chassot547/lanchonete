import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3010'

interface Produto {
  id: string; nome: string; preco_venda: number; categoria_id: string
  descricao?: string; imagem_url?: string; tipo?: string
}
interface Categoria { id: string; nome: string; ordem: number }
interface Mesa { id: string; numero: number }

function fmt(n: number) { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }

const EMOJI: Record<string, string> = {
  bebida: '🥤', 'comida': '🍔', sobremesa: '🍰', porcao: '🍟',
}

function produtoEmoji(p: Produto) {
  const n = p.nome.toLowerCase()
  if (n.includes('cerveja') || n.includes('heineken') || n.includes('brahma') || n.includes('skol')) return '🍺'
  if (n.includes('coca') || n.includes('pepsi') || n.includes('guaraná') || n.includes('suco')) return '🥤'
  if (n.includes('água')) return '💧'
  if (n.includes('red bull') || n.includes('monster')) return '⚡'
  if (n.includes('batata') || n.includes('frit')) return '🍟'
  if (n.includes('burger') || n.includes('hambur')) return '🍔'
  if (n.includes('pizza')) return '🍕'
  if (n.includes('pastel')) return '🥟'
  return EMOJI[p.tipo ?? ''] ?? '🍽️'
}

export default function CardapioPage() {
  const { qrCode } = useParams<{ qrCode?: string }>()
  const [catSel, setCatSel] = useState<string | null>(null)
  const [busca, setBusca]   = useState('')
  const [detalhe, setDetalhe] = useState<Produto | null>(null)

  // Identifica mesa pelo QR code
  const { data: mesa } = useQuery<Mesa | null>({
    queryKey: ['mesa-qr', qrCode],
    queryFn: async () => {
      if (!qrCode) return null
      const res = await fetch(`${API}/mesas?qr=${qrCode}`)
      if (!res.ok) return null
      const list = await res.json()
      return Array.isArray(list) ? list[0] ?? null : null
    },
    enabled: !!qrCode,
  })

  const { data: produtos = [] } = useQuery<Produto[]>({
    queryKey: ['cardapio-produtos'],
    queryFn: async () => {
      const res = await fetch(`${API}/produtos?ativo=true`)
      return res.json()
    },
  })

  const { data: categorias = [] } = useQuery<Categoria[]>({
    queryKey: ['categorias'],
    queryFn: async () => {
      const res = await fetch(`${API}/categorias`)
      return res.json()
    },
  })

  const filtrados = produtos.filter(p => {
    const nacat  = !catSel || p.categoria_id === catSel
    const nabusca = !busca || p.nome.toLowerCase().includes(busca.toLowerCase())
    return nacat && nabusca
  })

  // Agrupar por categoria para exibição
  const grupos: Record<string, Produto[]> = {}
  filtrados.forEach(p => {
    const cat = categorias.find(c => c.id === p.categoria_id)?.nome ?? 'Outros'
    if (!grupos[cat]) grupos[cat] = []
    grupos[cat].push(p)
  })

  return (
    <div className="min-h-screen bg-gray-950 pb-20">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold text-orange-400">🍽️ Cardápio</h1>
              {mesa && <p className="text-xs text-gray-400">Mesa {mesa.numero}</p>}
            </div>
            <div className="text-xs text-gray-500 text-right">
              <p>Chame o garçom</p>
              <p>para pedir ✋</p>
            </div>
          </div>

          {/* Busca */}
          <input type="search" placeholder="🔍 Buscar item..." value={busca}
            onChange={e => setBusca(e.target.value)}
            className="w-full bg-gray-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500" />

          {/* Filtro categorias */}
          <div className="flex gap-2 overflow-x-auto pb-1 mt-3 scrollbar-hide">
            <button onClick={() => setCatSel(null)}
              className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition ${!catSel ? 'bg-orange-500 border-orange-500 text-white' : 'border-gray-700 text-gray-400'}`}>
              Todos
            </button>
            {categorias.map(c => (
              <button key={c.id} onClick={() => setCatSel(c.id)}
                className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition ${catSel===c.id ? 'bg-orange-500 border-orange-500 text-white' : 'border-gray-700 text-gray-400'}`}>
                {c.nome}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Conteúdo */}
      <div className="max-w-lg mx-auto px-4 pt-4 space-y-8">
        {Object.entries(grupos).map(([cat, prods]) => (
          <section key={cat}>
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">{cat}</h2>
            <div className="space-y-2">
              {prods.map(p => (
                <button key={p.id} onClick={() => setDetalhe(p)}
                  className="w-full flex items-center gap-4 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-orange-500/40 rounded-2xl p-4 text-left transition active:scale-98">
                  <div className="w-14 h-14 bg-gray-800 rounded-xl flex items-center justify-center text-3xl shrink-0">
                    {produtoEmoji(p)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-100 text-sm leading-snug">{p.nome}</p>
                    {p.descricao && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{p.descricao}</p>}
                  </div>
                  <div className="text-orange-400 font-bold text-sm shrink-0">{fmt(Number(p.preco_venda))}</div>
                </button>
              ))}
            </div>
          </section>
        ))}

        {filtrados.length === 0 && (
          <div className="text-center text-gray-600 py-20">
            <div className="text-5xl mb-3">🔍</div>
            <p>Nenhum item encontrado</p>
          </div>
        )}
      </div>

      {/* Rodapé */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 py-3 text-center">
        <p className="text-xs text-gray-500">✋ Chame o garçom para fazer seu pedido</p>
      </div>

      {/* Modal detalhe */}
      {detalhe && (
        <div className="fixed inset-0 bg-black/80 flex items-end z-50 p-4" onClick={() => setDetalhe(null)}>
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-lg mx-auto border border-gray-700 space-y-3"
            onClick={e => e.stopPropagation()}>
            <div className="text-5xl text-center">{produtoEmoji(detalhe)}</div>
            <div>
              <h3 className="text-lg font-bold text-white">{detalhe.nome}</h3>
              {detalhe.descricao && <p className="text-sm text-gray-400 mt-1">{detalhe.descricao}</p>}
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-2xl font-bold text-orange-400">{fmt(Number(detalhe.preco_venda))}</span>
              <button onClick={() => setDetalhe(null)}
                className="px-5 py-2 bg-gray-800 text-gray-300 rounded-xl text-sm">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
