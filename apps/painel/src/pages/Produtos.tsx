import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../lib/api'

interface Categoria { id: string; nome: string; ordem: number; estacao: 'cozinha' | 'bar' }
interface Produto {
  id: string
  nome: string
  descricao?: string
  preco_venda: number
  tipo: string
  imagem_url?: string
  ativo: boolean
  categoria_id?: string
  categoria?: string
}

const TIPOS = ['simples', 'combo', 'porcao', 'bebida', 'unidade']
const VAZIO_PROD: Partial<Produto> = { nome: '', preco_venda: 0, tipo: 'simples', ativo: true }
const VAZIO_CAT: Partial<Categoria> = { nome: '', ordem: 0, estacao: 'cozinha' }

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const ESTACAO_LABEL: Record<string, string> = {
  cozinha: '🍳 Cozinha',
  bar:     '🍺 Bar',
}

const ESTACAO_COR: Record<string, string> = {
  cozinha: 'bg-orange-900/40 text-orange-300',
  bar:     'bg-blue-900/40 text-blue-300',
}

export default function Produtos() {
  const qc = useQueryClient()
  const [aba, setAba]       = useState<'produtos' | 'categorias'>('produtos')
  const [busca, setBusca]   = useState('')
  const [catFiltro, setCatFiltro] = useState<string>('')
  const [modal, setModal]   = useState<Partial<Produto> | null>(null)
  const [modalCat, setModalCat] = useState<Partial<Categoria> | null>(null)

  const { data: produtos = [], isLoading } = useQuery<Produto[]>({
    queryKey: ['produtos'],
    queryFn: () => api.get('/produtos'),
    staleTime: 0,
  })

  const { data: categorias = [] } = useQuery<Categoria[]>({
    queryKey: ['categorias'],
    queryFn: () => api.get('/categorias'),
    staleTime: 0,
  })

  // Produto mutations
  const salvar = useMutation({
    mutationFn: (p: Partial<Produto>) =>
      p.id ? api.patch(`/produtos/${p.id}`, p) : api.post('/produtos', p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['produtos'] }); setModal(null) },
  })

  const toggle = useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) =>
      api.patch(`/produtos/${id}`, { ativo }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['produtos'] }),
  })

  const excluir = useMutation({
    mutationFn: (id: string) => api.delete(`/produtos/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['produtos'] }); setModal(null) },
  })

  // Categoria mutations
  const salvarCat = useMutation({
    mutationFn: (c: Partial<Categoria>) =>
      c.id ? api.patch(`/categorias/${c.id}`, c) : api.post('/categorias', c),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categorias'] }); setModalCat(null) },
  })

  const excluirCat = useMutation({
    mutationFn: (id: string) => api.delete(`/categorias/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categorias'] }); setModalCat(null) },
  })

  // Filtragem de produtos
  const filtrados = produtos.filter(p => {
    const nasBusca = p.nome.toLowerCase().includes(busca.toLowerCase())
    const naCat    = !catFiltro || p.categoria_id === catFiltro
    return nasBusca && naCat
  })

  // Mapa categoria_id → estacao para mostrar na tabela
  const catMap = Object.fromEntries(categorias.map(c => [c.id, c]))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Cardápio</h2>
        <div className="flex gap-2">
          <button onClick={() => setAba('produtos')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${aba==='produtos' ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            🍔 Produtos
          </button>
          <button onClick={() => setAba('categorias')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${aba==='categorias' ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            🗂️ Categorias
          </button>
        </div>
      </div>

      {/* ===== ABA PRODUTOS ===== */}
      {aba === 'produtos' && (
        <>
          <div className="flex gap-2 flex-wrap">
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar produto..."
              className="bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none w-48"
            />
            <select
              value={catFiltro}
              onChange={e => setCatFiltro(e.target.value)}
              className="bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none"
            >
              <option value="">Todas as categorias</option>
              {categorias.map(c => (
                <option key={c.id} value={c.id}>{ESTACAO_LABEL[c.estacao] ?? c.estacao} — {c.nome}</option>
              ))}
            </select>
            <button
              onClick={() => setModal({ ...VAZIO_PROD })}
              className="ml-auto px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold rounded-lg transition"
            >
              + Novo Produto
            </button>
          </div>

          {isLoading ? (
            <p className="text-gray-500">Carregando...</p>
          ) : (
            <div className="overflow-auto rounded-xl border border-gray-800">
              <table className="w-full text-sm">
                <thead className="bg-gray-900 text-gray-400">
                  <tr>
                    <th className="text-left px-4 py-3">Produto</th>
                    <th className="text-left px-4 py-3">Categoria</th>
                    <th className="text-left px-4 py-3">Estação</th>
                    <th className="text-left px-4 py-3">Tipo</th>
                    <th className="text-right px-4 py-3">Preço</th>
                    <th className="text-center px-4 py-3">Status</th>
                    <th className="text-center px-4 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filtrados.map(p => {
                    const cat = catMap[p.categoria_id ?? '']
                    return (
                      <tr key={p.id} className="hover:bg-gray-900/50">
                        <td className="px-4 py-3 font-medium">{p.nome}</td>
                        <td className="px-4 py-3 text-gray-400">{p.categoria ?? '—'}</td>
                        <td className="px-4 py-3">
                          {cat ? (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${ESTACAO_COR[cat.estacao]}`}>
                              {ESTACAO_LABEL[cat.estacao]}
                            </span>
                          ) : <span className="text-gray-600">—</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-400 capitalize">{p.tipo}</td>
                        <td className="px-4 py-3 text-right text-green-400">{fmt(p.preco_venda)}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => toggle.mutate({ id: p.id, ativo: !p.ativo })}
                            className={`text-xs px-3 py-1 rounded-full ${p.ativo ? 'bg-green-900 text-green-300' : 'bg-gray-800 text-gray-500'}`}
                          >
                            {p.ativo ? 'Ativo' : 'Inativo'}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => setModal(p)}
                            className="text-xs text-orange-400 hover:text-orange-300 px-2"
                          >
                            Editar
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {filtrados.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-600">Nenhum produto encontrado</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ===== ABA CATEGORIAS ===== */}
      {aba === 'categorias' && (
        <>
          <div className="flex justify-end">
            <button
              onClick={() => setModalCat({ ...VAZIO_CAT })}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold rounded-lg transition"
            >
              + Nova Categoria
            </button>
          </div>
          <div className="overflow-auto rounded-xl border border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-900 text-gray-400">
                <tr>
                  <th className="text-left px-4 py-3">Categoria</th>
                  <th className="text-left px-4 py-3">Estação (KDS)</th>
                  <th className="text-center px-4 py-3">Ordem</th>
                  <th className="text-center px-4 py-3">Produtos</th>
                  <th className="text-center px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {categorias.map(c => {
                  const qtd = produtos.filter(p => p.categoria_id === c.id).length
                  return (
                    <tr key={c.id} className="hover:bg-gray-900/50">
                      <td className="px-4 py-3 font-medium">{c.nome}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${ESTACAO_COR[c.estacao]}`}>
                          {ESTACAO_LABEL[c.estacao]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-400">{c.ordem}</td>
                      <td className="px-4 py-3 text-center text-gray-400">{qtd}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setModalCat(c)}
                          className="text-xs text-orange-400 hover:text-orange-300 px-2"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ===== MODAL PRODUTO ===== */}
      {modal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-gray-700 space-y-4">
            <h3 className="text-lg font-bold">{modal.id ? 'Editar Produto' : 'Novo Produto'}</h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Nome *</label>
                <input
                  value={modal.nome ?? ''}
                  onChange={e => setModal(m => ({ ...m!, nome: e.target.value }))}
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Preço de venda *</label>
                  <input
                    type="number" step="0.01" min="0"
                    value={modal.preco_venda ?? 0}
                    onChange={e => setModal(m => ({ ...m!, preco_venda: Number(e.target.value) }))}
                    className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Tipo</label>
                  <select
                    value={modal.tipo ?? 'simples'}
                    onChange={e => setModal(m => ({ ...m!, tipo: e.target.value }))}
                    className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none"
                  >
                    {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Categoria</label>
                <select
                  value={modal.categoria_id ?? ''}
                  onChange={e => setModal(m => ({ ...m!, categoria_id: e.target.value || undefined }))}
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none"
                >
                  <option value="">Sem categoria</option>
                  {categorias.map(c => (
                    <option key={c.id} value={c.id}>
                      {ESTACAO_LABEL[c.estacao]} — {c.nome}
                    </option>
                  ))}
                </select>
                {modal.categoria_id && catMap[modal.categoria_id] && (
                  <p className="text-xs text-gray-500 mt-1">
                    Pedidos deste produto vão para o KDS da {ESTACAO_LABEL[catMap[modal.categoria_id].estacao]}
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Descrição</label>
                <textarea
                  value={modal.descricao ?? ''}
                  onChange={e => setModal(m => ({ ...m!, descricao: e.target.value }))}
                  rows={2}
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-500 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              {modal.id && (
                <button
                  onClick={() => { if (confirm('Excluir produto?')) excluir.mutate(modal.id!) }}
                  className="px-4 py-2 text-sm text-red-400 hover:text-red-300 transition"
                >
                  Excluir
                </button>
              )}
              <div className="flex-1" />
              <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">
                Cancelar
              </button>
              <button
                onClick={() => salvar.mutate(modal)}
                disabled={salvar.isPending || !modal.nome}
                className="px-5 py-2 bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50"
              >
                {salvar.isPending ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL CATEGORIA ===== */}
      {modalCat && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-sm border border-gray-700 space-y-4">
            <h3 className="text-lg font-bold">{modalCat.id ? 'Editar Categoria' : 'Nova Categoria'}</h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Nome *</label>
                <input
                  value={modalCat.nome ?? ''}
                  onChange={e => setModalCat(m => ({ ...m!, nome: e.target.value }))}
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Estação (onde aparece no KDS)</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['cozinha', 'bar'] as const).map(e => (
                    <button key={e}
                      onClick={() => setModalCat(m => ({ ...m!, estacao: e }))}
                      className={`py-3 rounded-xl text-sm font-semibold border-2 transition ${modalCat.estacao === e ? (e === 'cozinha' ? 'border-orange-500 bg-orange-900/30 text-orange-300' : 'border-blue-500 bg-blue-900/30 text-blue-300') : 'border-gray-700 text-gray-500'}`}>
                      {ESTACAO_LABEL[e]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Ordem de exibição</label>
                <input
                  type="number" min="0"
                  value={modalCat.ordem ?? 0}
                  onChange={e => setModalCat(m => ({ ...m!, ordem: Number(e.target.value) }))}
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              {modalCat.id && (
                <button
                  onClick={() => { if (confirm('Excluir categoria?')) excluirCat.mutate(modalCat.id!) }}
                  className="px-4 py-2 text-sm text-red-400 hover:text-red-300 transition"
                >
                  Excluir
                </button>
              )}
              <div className="flex-1" />
              <button onClick={() => setModalCat(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">
                Cancelar
              </button>
              <button
                onClick={() => salvarCat.mutate(modalCat)}
                disabled={salvarCat.isPending || !modalCat.nome}
                className="px-5 py-2 bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50"
              >
                {salvarCat.isPending ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
