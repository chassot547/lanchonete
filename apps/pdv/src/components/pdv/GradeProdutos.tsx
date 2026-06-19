import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { usePedidoStore } from '../../store/pedido.store'
import ModalVariacoes from './ModalVariacoes'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3010'

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

interface ProdutoAPI {
  id: string
  nome: string
  preco_venda: number
  categoria_id: string
  imagem_url?: string
  // normalizado p/ o store
  precoVenda: number
  categoriaId: string
  imagemUrl?: string
}

async function fetchProdutos(): Promise<ProdutoAPI[]> {
  const res = await fetch(`${API}/produtos?ativo=true`, { headers: authHeaders() })
  const data: any[] = await res.json()
  return data.map(p => ({
    ...p,
    precoVenda: Number(p.preco_venda),
    categoriaId: p.categoria_id,
    imagemUrl: p.imagem_url,
  }))
}

async function fetchCategorias() {
  const res = await fetch(`${API}/categorias`, { headers: authHeaders() })
  return res.json() as Promise<Array<{ id: string; nome: string; ordem: number }>>
}

export default function GradeProdutos() {
  const [categoriaSel, setCategoriaSel] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [produtoModal, setProdutoModal] = useState<ProdutoAPI | null>(null)
  const adicionarItem = usePedidoStore(s => s.adicionarItem)

  const { data: produtos = [], isLoading: loadingP } = useQuery<ProdutoAPI[]>({ queryKey: ['produtos'], queryFn: fetchProdutos })
  const { data: categorias = [], isLoading: loadingC } = useQuery({ queryKey: ['categorias'], queryFn: fetchCategorias })

  const filtrados = produtos.filter(p => {
    const naCategoria = !categoriaSel || p.categoriaId === categoriaSel
    const naBusca = !busca || p.nome.toLowerCase().includes(busca.toLowerCase())
    return naCategoria && naBusca
  })

  if (loadingP || loadingC) {
    return <div className="flex-1 flex items-center justify-center text-gray-500">Carregando…</div>
  }

  return (
    <div className="flex flex-col gap-3 p-4 h-full overflow-hidden">
      {/* Busca */}
      <input
        type="search"
        placeholder="🔍 Buscar produto…"
        value={busca}
        onChange={e => setBusca(e.target.value)}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-orange-500"
      />

      {/* Filtro de categorias */}
      <div className="flex gap-2 overflow-x-auto pb-1 shrink-0">
        <button
          onClick={() => setCategoriaSel(null)}
          className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${
            !categoriaSel ? 'bg-orange-500 border-orange-500 text-white' : 'border-gray-700 text-gray-400 hover:border-gray-500'
          }`}
        >
          Todos
        </button>
        {categorias.map(cat => (
          <button
            key={cat.id}
            onClick={() => setCategoriaSel(cat.id)}
            className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${
              categoriaSel === cat.id ? 'bg-orange-500 border-orange-500 text-white' : 'border-gray-700 text-gray-400 hover:border-gray-500'
            }`}
          >
            {cat.nome}
          </button>
        ))}
      </div>

      {/* Grade */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 overflow-y-auto flex-1">
        {filtrados.map(produto => (
          <button
            key={produto.id}
            onClick={() => setProdutoModal(produto)}
            className="bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-orange-500 rounded-xl p-3 text-left transition-all active:scale-95"
          >
            <div className="w-full h-20 bg-gray-700 rounded-lg mb-2 flex items-center justify-center text-3xl">
              {produto.nome.toLowerCase().includes('cerveja') || produto.nome.toLowerCase().includes('heineken') || produto.nome.toLowerCase().includes('brahma') || produto.nome.toLowerCase().includes('skol') || produto.nome.toLowerCase().includes('budweiser') || produto.nome.toLowerCase().includes('corona') || produto.nome.toLowerCase().includes('stella') || produto.nome.toLowerCase().includes('original') || produto.nome.toLowerCase().includes('itaipava') || produto.nome.toLowerCase().includes('eisenbahn') || produto.nome.toLowerCase().includes('colorado') || produto.nome.toLowerCase().includes('devassa') || produto.nome.toLowerCase().includes('antarctica') ? '🍺'
              : produto.nome.toLowerCase().includes('coca') || produto.nome.toLowerCase().includes('pepsi') || produto.nome.toLowerCase().includes('guaraná') || produto.nome.toLowerCase().includes('fanta') || produto.nome.toLowerCase().includes('sprite') || produto.nome.toLowerCase().includes('schweppes') || produto.nome.toLowerCase().includes('soda') ? '🥤'
              : produto.nome.toLowerCase().includes('água') ? '💧'
              : produto.nome.toLowerCase().includes('suco') ? '🍊'
              : produto.nome.toLowerCase().includes('red bull') || produto.nome.toLowerCase().includes('monster') || produto.nome.toLowerCase().includes('tnt') || produto.nome.toLowerCase().includes('burn') ? '⚡'
              : '🍽️'}
            </div>
            <div className="text-xs font-semibold text-gray-200 truncate">{produto.nome}</div>
            <div className="text-sm font-bold text-orange-400 mt-1">
              {Number(produto.preco_venda).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
          </button>
        ))}
        {filtrados.length === 0 && (
          <div className="col-span-full text-center text-gray-600 py-12">Nenhum produto encontrado</div>
        )}
      </div>

      {produtoModal && (
        <ModalVariacoes
          produto={produtoModal}
          onCancelar={() => setProdutoModal(null)}
          onConfirmar={(produto, precoFinal, variacao, adicionais, observacao) => {
            const produtoFinal = { ...produto, precoVenda: precoFinal } as any
            const obsPartes = [
              ...(variacao?.map((v: any) => `${v.nome}: ${v.opcao}`) ?? []),
              ...(adicionais?.map((a: any) => `+ ${a.nome}`) ?? []),
              ...(observacao ? [observacao] : []),
            ]
            adicionarItem(produtoFinal, 1, obsPartes.join(' | ') || undefined)
            setProdutoModal(null)
          }}
        />
      )}
    </div>
  )
}
