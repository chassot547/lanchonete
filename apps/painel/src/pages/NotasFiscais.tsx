import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

interface Fornecedor { id: string; nome: string; cnpj?: string }
interface Ingrediente { id: string; nome: string; unidade: string }

interface ItemNF {
  ingrediente_id?: string
  descricao: string
  quantidade: number
  unidade: string
  valor_unit: number
  valor_total: number
}

interface NotaFiscal {
  id: string
  fornecedor_id?: string
  numero_nf: string
  serie: string
  chave_acesso?: string
  data_emissao: string
  data_entrada: string
  vencimento?: string
  valor_total: number
  frete: number
  desconto: number
  observacoes?: string
  status_pagamento?: 'pendente' | 'pago' | 'cancelado'
  fornecedores?: { nome: string; cnpj?: string }
  itens_nf_entrada?: any[]
}

const STATUS_PAG: Record<string, string> = {
  pendente:  'bg-yellow-900/40 text-yellow-300',
  pago:      'bg-green-900/40 text-green-300',
  cancelado: 'bg-gray-800 text-gray-500',
}

function fmt(n: number) { return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function fmtData(d: string) { return d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—' }

const ITEM_VAZIO: ItemNF = { descricao: '', quantidade: 1, unidade: 'un', valor_unit: 0, valor_total: 0 }

export default function NotasFiscais() {
  const qc = useQueryClient()
  const [modal, setModal]   = useState<Partial<NotaFiscal> | null>(null)
  const [itens, setItens]   = useState<ItemNF[]>([])
  const [detalhe, setDetalhe] = useState<NotaFiscal | null>(null)
  const [busca, setBusca]   = useState('')

  const { data: notas = [], isLoading } = useQuery<NotaFiscal[]>({
    queryKey: ['notas-entrada'],
    queryFn: () => api.get('/notas-entrada'),
    staleTime: 0,
  })

  const { data: fornecedores = [] } = useQuery<Fornecedor[]>({
    queryKey: ['fornecedores'],
    queryFn: () => api.get('/fornecedores'),
  })

  const { data: ingredientes = [] } = useQuery<Ingrediente[]>({
    queryKey: ['ingredientes-lista'],
    queryFn: () => api.get('/estoque'),
  })

  const salvar = useMutation({
    mutationFn: (payload: any) =>
      payload.id
        ? api.patch(`/notas-entrada/${payload.id}`, payload)
        : api.post('/notas-entrada', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notas-entrada'] })
      qc.invalidateQueries({ queryKey: ['estoque'] })
      setModal(null)
      setItens([])
    },
  })

  const excluir = useMutation({
    mutationFn: (id: string) => api.delete(`/notas-entrada/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notas-entrada'] }); setDetalhe(null) },
  })

  function abrirNovo() {
    setModal({
      serie: '1',
      data_emissao: new Date().toISOString().split('T')[0],
      data_entrada: new Date().toISOString().split('T')[0],
      vencimento: new Date().toISOString().split('T')[0],
      valor_total: 0, frete: 0, desconto: 0,
    })
    setItens([{ ...ITEM_VAZIO }])
  }

  function atualizarItem(idx: number, campo: keyof ItemNF, valor: any) {
    setItens(prev => prev.map((it, i) => {
      if (i !== idx) return it
      const novo = { ...it, [campo]: valor }
      if (campo === 'quantidade' || campo === 'valor_unit') {
        novo.valor_total = Number((Number(novo.quantidade) * Number(novo.valor_unit)).toFixed(2))
      }
      if (campo === 'ingrediente_id' && valor) {
        const ing = ingredientes.find(x => x.id === valor)
        if (ing) { novo.descricao = ing.nome; novo.unidade = ing.unidade }
      }
      return novo
    }))
  }

  function totalItens() { return itens.reduce((s, i) => s + Number(i.valor_total), 0) }

  function confirmar() {
    const total = Number(modal?.valor_total ?? totalItens())
    salvar.mutate({ ...modal, itens, valor_total: total || totalItens() })
  }

  const filtradas = notas.filter(n =>
    n.numero_nf.includes(busca) ||
    (n.fornecedores?.nome ?? '').toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Notas Fiscais de Entrada</h2>
        <div className="flex gap-2">
          <input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar NF ou fornecedor..."
            className="bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none w-52" />
          <button onClick={abrirNovo}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold rounded-lg transition">
            + Nova NF
          </button>
        </div>
      </div>

      {isLoading ? <p className="text-gray-500">Carregando...</p> : (
        <div className="overflow-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-gray-400">
              <tr>
                <th className="text-left px-4 py-3">NF / Série</th>
                <th className="text-left px-4 py-3">Fornecedor</th>
                <th className="text-left px-4 py-3">Emissão</th>
                <th className="text-left px-4 py-3">Entrada</th>
                <th className="text-left px-4 py-3">Vencimento</th>
                <th className="text-right px-4 py-3">Valor Total</th>
                <th className="text-center px-4 py-3">Pagamento</th>
                <th className="text-center px-4 py-3">Itens</th>
                <th className="text-center px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtradas.map(n => (
                <tr key={n.id} className="hover:bg-gray-900/50">
                  <td className="px-4 py-3 font-mono text-xs">
                    <span className="font-bold text-white">{n.numero_nf}</span>
                    <span className="text-gray-500 ml-1">/ {n.serie}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{n.fornecedores?.nome ?? '—'}</div>
                    {n.fornecedores?.cnpj && <div className="text-xs text-gray-500">{n.fornecedores.cnpj}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{fmtData(n.data_emissao)}</td>
                  <td className="px-4 py-3 text-gray-400">{fmtData(n.data_entrada)}</td>
                  <td className="px-4 py-3 text-gray-400">{n.vencimento ? fmtData(n.vencimento) : '—'}</td>
                  <td className="px-4 py-3 text-right font-bold text-green-400">{fmt(n.valor_total)}</td>
                  <td className="px-4 py-3 text-center">
                    {n.status_pagamento ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_PAG[n.status_pagamento]}`}>
                        {n.status_pagamento}
                      </span>
                    ) : <span className="text-xs text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-400">{n.itens_nf_entrada?.length ?? 0}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => setDetalhe(n)}
                      className="text-xs text-blue-400 hover:text-blue-300 mr-2">Ver</button>
                    <button onClick={() => { if (confirm('Excluir nota fiscal?')) excluir.mutate(n.id) }}
                      className="text-xs text-red-400 hover:text-red-300">Excluir</button>
                  </td>
                </tr>
              ))}
              {filtradas.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-600">Nenhuma nota fiscal cadastrada</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ===== MODAL NOVA NF ===== */}
      {modal && (
        <div className="fixed inset-0 bg-black/70 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-3xl border border-gray-700 space-y-5 my-4">
            <h3 className="text-lg font-bold">Nova Nota Fiscal de Entrada</h3>

            {/* Cabeçalho da NF */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="col-span-2 md:col-span-1">
                <label className="text-xs text-gray-400 block mb-1">Fornecedor</label>
                <select value={modal.fornecedor_id ?? ''}
                  onChange={e => setModal(m => ({ ...m!, fornecedor_id: e.target.value || undefined }))}
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none">
                  <option value="">Selecione...</option>
                  {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Número NF *</label>
                <input value={modal.numero_nf ?? ''} onChange={e => setModal(m => ({ ...m!, numero_nf: e.target.value }))}
                  placeholder="000001"
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none font-mono focus:ring-1 focus:ring-orange-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Série</label>
                <input value={modal.serie ?? '1'} onChange={e => setModal(m => ({ ...m!, serie: e.target.value }))}
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none font-mono focus:ring-1 focus:ring-orange-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Data Emissão *</label>
                <input type="date" value={modal.data_emissao ?? ''}
                  onChange={e => setModal(m => ({ ...m!, data_emissao: e.target.value }))}
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Data Entrada</label>
                <input type="date" value={modal.data_entrada ?? ''}
                  onChange={e => setModal(m => ({ ...m!, data_entrada: e.target.value }))}
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Vencimento *</label>
                <input type="date" value={modal.vencimento ?? ''}
                  onChange={e => setModal(m => ({ ...m!, vencimento: e.target.value }))}
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Frete</label>
                <input type="number" step="0.01" min="0" value={modal.frete ?? 0}
                  onChange={e => setModal(m => ({ ...m!, frete: Number(e.target.value) }))}
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-500" />
              </div>
              <div className="col-span-2 md:col-span-3">
                <label className="text-xs text-gray-400 block mb-1">Chave de Acesso NF-e (44 dígitos)</label>
                <input value={modal.chave_acesso ?? ''}
                  onChange={e => setModal(m => ({ ...m!, chave_acesso: e.target.value.replace(/\D/g,'').slice(0,44) }))}
                  maxLength={44} placeholder="00000000000000000000000000000000000000000000"
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none font-mono text-xs focus:ring-1 focus:ring-orange-500" />
              </div>
              <div className="col-span-2 md:col-span-3">
                <label className="text-xs text-gray-400 block mb-1">Observações</label>
                <textarea value={modal.observacoes ?? ''} rows={2}
                  onChange={e => setModal(m => ({ ...m!, observacoes: e.target.value }))}
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none resize-none focus:ring-1 focus:ring-orange-500" />
              </div>
            </div>

            {/* Itens da NF */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold text-gray-300">Itens da Nota</h4>
                <button onClick={() => setItens(p => [...p, { ...ITEM_VAZIO }])}
                  className="text-xs text-orange-400 hover:text-orange-300">+ Adicionar item</button>
              </div>
              <div className="space-y-2">
                {itens.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-end bg-gray-800 rounded-xl p-3">
                    <div className="col-span-3">
                      <label className="text-xs text-gray-500 block mb-1">Ingrediente</label>
                      <select value={item.ingrediente_id ?? ''}
                        onChange={e => atualizarItem(idx, 'ingrediente_id', e.target.value || undefined)}
                        className="w-full bg-gray-700 rounded-lg px-2 py-1.5 text-xs outline-none">
                        <option value="">Manual</option>
                        {ingredientes.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
                      </select>
                    </div>
                    <div className="col-span-3">
                      <label className="text-xs text-gray-500 block mb-1">Descrição *</label>
                      <input value={item.descricao} onChange={e => atualizarItem(idx, 'descricao', e.target.value)}
                        className="w-full bg-gray-700 rounded-lg px-2 py-1.5 text-xs outline-none" />
                    </div>
                    <div className="col-span-1">
                      <label className="text-xs text-gray-500 block mb-1">Qtd</label>
                      <input type="number" step="0.001" min="0" value={item.quantidade}
                        onChange={e => atualizarItem(idx, 'quantidade', Number(e.target.value))}
                        className="w-full bg-gray-700 rounded-lg px-2 py-1.5 text-xs outline-none" />
                    </div>
                    <div className="col-span-1">
                      <label className="text-xs text-gray-500 block mb-1">Un.</label>
                      <input value={item.unidade} onChange={e => atualizarItem(idx, 'unidade', e.target.value)}
                        className="w-full bg-gray-700 rounded-lg px-2 py-1.5 text-xs outline-none" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500 block mb-1">Valor Unit.</label>
                      <input type="number" step="0.0001" min="0" value={item.valor_unit}
                        onChange={e => atualizarItem(idx, 'valor_unit', Number(e.target.value))}
                        className="w-full bg-gray-700 rounded-lg px-2 py-1.5 text-xs outline-none" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500 block mb-1">Total</label>
                      <input type="number" step="0.01" value={item.valor_total}
                        onChange={e => atualizarItem(idx, 'valor_total', Number(e.target.value))}
                        className="w-full bg-gray-700 rounded-lg px-2 py-1.5 text-xs outline-none text-green-400 font-bold" />
                    </div>
                    <div className="col-span-12 md:col-span-1 flex justify-end">
                      <button onClick={() => setItens(p => p.filter((_, i) => i !== idx))}
                        className="text-red-400 hover:text-red-300 text-sm">✕</button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totalizador */}
              <div className="flex justify-end gap-6 mt-3 text-sm">
                <span className="text-gray-400">Subtotal itens: <span className="text-white font-bold">{fmt(totalItens())}</span></span>
                <span className="text-gray-400">Frete: <span className="text-white">{fmt(modal.frete ?? 0)}</span></span>
                <span className="text-gray-400">Total NF:
                  <input type="number" step="0.01" min="0"
                    value={modal.valor_total ?? totalItens()}
                    onChange={e => setModal(m => ({ ...m!, valor_total: Number(e.target.value) }))}
                    className="ml-1 bg-gray-800 border border-orange-500 rounded px-2 py-0.5 text-orange-400 font-bold w-28 text-right outline-none" />
                </span>
              </div>
            </div>

            <div className="flex gap-3 pt-2 border-t border-gray-800">
              <div className="flex-1" />
              <button onClick={() => { setModal(null); setItens([]) }}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancelar</button>
              <button onClick={confirmar}
                disabled={salvar.isPending || !modal.numero_nf || !modal.data_emissao}
                className="px-5 py-2 bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold rounded-lg disabled:opacity-50">
                {salvar.isPending ? 'Salvando...' : '✅ Salvar NF'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL DETALHE NF ===== */}
      {detalhe && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-2xl border border-gray-700 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold">NF {detalhe.numero_nf}/{detalhe.serie}</h3>
                <p className="text-sm text-gray-400">{detalhe.fornecedores?.nome ?? 'Sem fornecedor'}</p>
              </div>
              <button onClick={() => setDetalhe(null)} className="text-gray-500 hover:text-white text-2xl">×</button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="bg-gray-800 rounded-xl p-3">
                <p className="text-xs text-gray-400">Emissão</p>
                <p className="font-semibold">{fmtData(detalhe.data_emissao)}</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-3">
                <p className="text-xs text-gray-400">Entrada</p>
                <p className="font-semibold">{fmtData(detalhe.data_entrada)}</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-3">
                <p className="text-xs text-gray-400">Vencimento</p>
                <p className="font-semibold">{detalhe.vencimento ? fmtData(detalhe.vencimento) : '—'}</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-3">
                <p className="text-xs text-gray-400">Total</p>
                <p className="font-bold text-green-400">{fmt(detalhe.valor_total)}</p>
              </div>
            </div>
            {detalhe.status_pagamento && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Pagamento:</span>
                <span className={`text-xs px-3 py-1 rounded-full font-semibold ${STATUS_PAG[detalhe.status_pagamento]}`}>
                  {detalhe.status_pagamento}
                </span>
              </div>
            )}

            {detalhe.chave_acesso && (
              <div className="bg-gray-800 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1">Chave NF-e</p>
                <p className="font-mono text-xs text-gray-300 break-all">{detalhe.chave_acesso}</p>
              </div>
            )}

            {(detalhe.itens_nf_entrada ?? []).length > 0 && (
              <div className="overflow-auto rounded-xl border border-gray-800">
                <table className="w-full text-xs">
                  <thead className="bg-gray-800 text-gray-400">
                    <tr>
                      <th className="text-left px-3 py-2">Descrição</th>
                      <th className="text-center px-3 py-2">Qtd</th>
                      <th className="text-center px-3 py-2">Un.</th>
                      <th className="text-right px-3 py-2">Unit.</th>
                      <th className="text-right px-3 py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {(detalhe.itens_nf_entrada ?? []).map((i: any) => (
                      <tr key={i.id}>
                        <td className="px-3 py-2">{i.descricao}</td>
                        <td className="px-3 py-2 text-center">{Number(i.quantidade).toLocaleString('pt-BR')}</td>
                        <td className="px-3 py-2 text-center text-gray-400">{i.unidade}</td>
                        <td className="px-3 py-2 text-right text-gray-400">{fmt(i.valor_unit)}</td>
                        <td className="px-3 py-2 text-right font-bold text-green-400">{fmt(i.valor_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {detalhe.observacoes && (
              <p className="text-xs text-gray-400 italic">Obs: {detalhe.observacoes}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
