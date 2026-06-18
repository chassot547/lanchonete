import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../lib/api'

interface Movimentacao {
  id: string; tipo: 'entrada' | 'saida'; descricao: string
  valor: number; categoria: string; criadoEm: string
}

interface ContaPagar {
  id: string; descricao: string; valor: number; vencimento: string
  status: 'pendente' | 'pago' | 'cancelado'; forma_pagamento?: string
  data_pagamento?: string; observacoes?: string
  fornecedores?: { nome: string }
  notas_fiscais_entrada?: { numero_nf: string; serie: string }
}

function fmt(n: number) { return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function fmtData(s: string) { return new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) }
function fmtDate(s: string) { return s ? new Date(s + 'T12:00:00').toLocaleDateString('pt-BR') : '—' }

const FORMAS = ['pix', 'dinheiro', 'transferencia', 'boleto', 'debito', 'credito']

const STATUS_COR: Record<string, string> = {
  pendente:  'bg-yellow-900/40 text-yellow-300',
  pago:      'bg-green-900/40 text-green-300',
  cancelado: 'bg-gray-800 text-gray-500',
}

type Aba = 'movimentacoes' | 'contas'

export default function Financeiro() {
  const qc   = useQueryClient()
  const hoje = new Date()
  const [aba, setAba]         = useState<Aba>('contas')
  const [dataIni, setDataIni] = useState(hoje.toISOString().split('T')[0])
  const [dataFim, setDataFim] = useState(hoje.toISOString().split('T')[0])
  const [filtroConta, setFiltroConta] = useState<string>('pendente')
  const [modalLiquidar, setModalLiquidar] = useState<ContaPagar | null>(null)
  const [forma, setForma]     = useState('pix')
  const [dataPag, setDataPag] = useState(hoje.toISOString().split('T')[0])
  const [modalNova, setModalNova] = useState(false)
  const [novaConta, setNovaConta] = useState<Partial<ContaPagar>>({
    descricao: '', valor: 0, vencimento: hoje.toISOString().split('T')[0], status: 'pendente',
  })

  const { data: movs = [], isLoading: loadMovs } = useQuery<Movimentacao[]>({
    queryKey: ['movimentacoes', dataIni, dataFim],
    queryFn: () => api.get(`/financeiro/movimentacoes?ini=${dataIni}&fim=${dataFim}`),
    enabled: aba === 'movimentacoes',
  })

  const { data: contas = [], isLoading: loadContas } = useQuery<ContaPagar[]>({
    queryKey: ['contas-a-pagar', filtroConta],
    queryFn: () => api.get(`/contas-a-pagar${filtroConta ? `?status=${filtroConta}` : ''}`),
    staleTime: 0,
  })

  const liquidar = useMutation({
    mutationFn: ({ id }: { id: string }) =>
      api.patch(`/contas-a-pagar/${id}`, { status: 'pago', forma_pagamento: forma, data_pagamento: dataPag }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contas-a-pagar'] }); setModalLiquidar(null) },
  })

  const cancelar = useMutation({
    mutationFn: (id: string) => api.patch(`/contas-a-pagar/${id}`, { status: 'cancelado' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contas-a-pagar'] }),
  })

  const criarConta = useMutation({
    mutationFn: (c: any) => api.post('/contas-a-pagar', c),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contas-a-pagar'] }); setModalNova(false) },
  })

  const totalPendente = contas.filter(c => c.status === 'pendente').reduce((s, c) => s + Number(c.valor), 0)
  const entradas = movs.filter(m => m.tipo === 'entrada').reduce((s, m) => s + m.valor, 0)
  const saidas   = movs.filter(m => m.tipo === 'saida').reduce((s, m) => s + m.valor, 0)

  // Alerta vencimento
  const vencidas = contas.filter(c => c.status === 'pendente' && new Date(c.vencimento) < new Date()).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold">Financeiro</h2>
        <div className="flex gap-2">
          <button onClick={() => setAba('contas')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg relative ${aba === 'contas' ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400'}`}>
            📋 Contas a Pagar
            {vencidas > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">{vencidas}</span>}
          </button>
          <button onClick={() => setAba('movimentacoes')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg ${aba === 'movimentacoes' ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400'}`}>
            💳 Movimentações
          </button>
        </div>
      </div>

      {/* ===== ABA CONTAS A PAGAR ===== */}
      {aba === 'contas' && (
        <>
          {/* Resumo */}
          {totalPendente > 0 && (
            <div className="bg-yellow-900/20 border border-yellow-700 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-yellow-400 font-semibold">⚠️ Total pendente a pagar</p>
                {vencidas > 0 && <p className="text-xs text-red-400 mt-0.5">{vencidas} conta(s) vencida(s)</p>}
              </div>
              <p className="text-2xl font-bold text-yellow-300">{fmt(totalPendente)}</p>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            {['pendente', 'pago', 'cancelado', ''].map(s => (
              <button key={s} onClick={() => setFiltroConta(s)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${filtroConta === s ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                {s === '' ? 'Todas' : s === 'pendente' ? '⏳ Pendentes' : s === 'pago' ? '✅ Pagas' : '❌ Canceladas'}
              </button>
            ))}
            <button onClick={() => setModalNova(true)}
              className="ml-auto px-4 py-1.5 bg-orange-500 hover:bg-orange-400 text-white text-xs font-semibold rounded-lg">
              + Nova Conta
            </button>
          </div>

          {loadContas ? <p className="text-gray-500">Carregando...</p> : (
            <div className="overflow-auto rounded-xl border border-gray-800">
              <table className="w-full text-sm">
                <thead className="bg-gray-900 text-gray-400">
                  <tr>
                    <th className="text-left px-4 py-3">Descrição</th>
                    <th className="text-left px-4 py-3">Fornecedor</th>
                    <th className="text-left px-4 py-3">NF</th>
                    <th className="text-left px-4 py-3">Vencimento</th>
                    <th className="text-left px-4 py-3">Pagamento</th>
                    <th className="text-right px-4 py-3">Valor</th>
                    <th className="text-center px-4 py-3">Status</th>
                    <th className="text-center px-4 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {contas.map(c => {
                    const vencida = c.status === 'pendente' && new Date(c.vencimento) < new Date()
                    return (
                      <tr key={c.id} className={`hover:bg-gray-900/50 ${vencida ? 'bg-red-950/10' : ''}`}>
                        <td className="px-4 py-3 font-medium">{c.descricao}</td>
                        <td className="px-4 py-3 text-gray-400">{c.fornecedores?.nome ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                          {c.notas_fiscais_entrada ? `${c.notas_fiscais_entrada.numero_nf}/${c.notas_fiscais_entrada.serie}` : '—'}
                        </td>
                        <td className={`px-4 py-3 ${vencida ? 'text-red-400 font-semibold' : 'text-gray-400'}`}>
                          {fmtDate(c.vencimento)}{vencida ? ' ⚠️' : ''}
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs">
                          {c.data_pagamento ? `${fmtDate(c.data_pagamento)} · ${c.forma_pagamento}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-white">{fmt(c.valor)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COR[c.status]}`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center flex gap-1 justify-center">
                          {c.status === 'pendente' && (
                            <>
                              <button onClick={() => { setModalLiquidar(c); setForma('pix'); setDataPag(hoje.toISOString().split('T')[0]) }}
                                className="text-xs bg-green-700 hover:bg-green-600 text-white px-2 py-1 rounded-lg">
                                Liquidar
                              </button>
                              <button onClick={() => { if (confirm('Cancelar conta?')) cancelar.mutate(c.id) }}
                                className="text-xs text-red-400 hover:text-red-300 px-2 py-1">
                                ✕
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {contas.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-600">Nenhuma conta encontrada</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ===== ABA MOVIMENTAÇÕES ===== */}
      {aba === 'movimentacoes' && (
        <>
          <div className="flex items-center gap-2 text-sm">
            <input type="date" value={dataIni} onChange={e => setDataIni(e.target.value)}
              className="bg-gray-800 rounded-lg px-3 py-2 outline-none" />
            <span className="text-gray-500">até</span>
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
              className="bg-gray-800 rounded-lg px-3 py-2 outline-none" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <p className="text-xs text-gray-400">Entradas</p>
              <p className="text-xl font-bold text-green-400 mt-1">{fmt(entradas)}</p>
            </div>
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <p className="text-xs text-gray-400">Saídas</p>
              <p className="text-xl font-bold text-red-400 mt-1">{fmt(saidas)}</p>
            </div>
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <p className="text-xs text-gray-400">Saldo</p>
              <p className={`text-xl font-bold mt-1 ${entradas - saidas >= 0 ? 'text-orange-400' : 'text-red-400'}`}>{fmt(entradas - saidas)}</p>
            </div>
          </div>
          {loadMovs ? <p className="text-gray-500">Carregando...</p> : (
            <div className="overflow-auto rounded-xl border border-gray-800">
              <table className="w-full text-sm">
                <thead className="bg-gray-900 text-gray-400">
                  <tr>
                    <th className="text-left px-4 py-3">Data</th>
                    <th className="text-left px-4 py-3">Descrição</th>
                    <th className="text-left px-4 py-3">Categoria</th>
                    <th className="text-right px-4 py-3">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {movs.map(m => (
                    <tr key={m.id} className="hover:bg-gray-900/50">
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{fmtData(m.criadoEm)}</td>
                      <td className="px-4 py-3">{m.descricao}</td>
                      <td className="px-4 py-3 text-gray-500">{m.categoria}</td>
                      <td className={`px-4 py-3 text-right font-medium ${m.tipo === 'entrada' ? 'text-green-400' : 'text-red-400'}`}>
                        {m.tipo === 'entrada' ? '+' : '-'}{fmt(m.valor)}
                      </td>
                    </tr>
                  ))}
                  {movs.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-600">Nenhuma movimentação no período</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ===== MODAL LIQUIDAR ===== */}
      {modalLiquidar && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-sm border border-green-700 space-y-4">
            <h3 className="text-lg font-bold text-white">✅ Liquidar Conta</h3>
            <div className="bg-gray-800 rounded-xl p-4 space-y-1">
              <p className="text-sm font-semibold text-white">{modalLiquidar.descricao}</p>
              {modalLiquidar.fornecedores && <p className="text-xs text-gray-400">{modalLiquidar.fornecedores.nome}</p>}
              <p className="text-xl font-bold text-green-400 mt-2">{fmt(modalLiquidar.valor)}</p>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Forma de Pagamento</label>
              <div className="grid grid-cols-3 gap-2">
                {FORMAS.map(f => (
                  <button key={f} onClick={() => setForma(f)}
                    className={`py-2 rounded-lg text-xs font-semibold capitalize transition ${forma === f ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Data do Pagamento</label>
              <input type="date" value={dataPag} onChange={e => setDataPag(e.target.value)}
                className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-green-500" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalLiquidar(null)}
                className="flex-1 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg">Cancelar</button>
              <button onClick={() => liquidar.mutate({ id: modalLiquidar.id })} disabled={liquidar.isPending}
                className="flex-1 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-bold rounded-lg disabled:opacity-50">
                {liquidar.isPending ? 'Salvando...' : '✅ Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL NOVA CONTA MANUAL ===== */}
      {modalNova && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-sm border border-gray-700 space-y-3">
            <h3 className="text-lg font-bold">Nova Conta a Pagar</h3>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Descrição *</label>
              <input value={novaConta.descricao ?? ''} onChange={e => setNovaConta(n => ({ ...n, descricao: e.target.value }))}
                className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Valor *</label>
                <input type="number" step="0.01" min="0" value={novaConta.valor ?? 0}
                  onChange={e => setNovaConta(n => ({ ...n, valor: Number(e.target.value) }))}
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Vencimento *</label>
                <input type="date" value={novaConta.vencimento ?? ''}
                  onChange={e => setNovaConta(n => ({ ...n, vencimento: e.target.value }))}
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-500" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Observações</label>
              <textarea rows={2} value={novaConta.observacoes ?? ''}
                onChange={e => setNovaConta(n => ({ ...n, observacoes: e.target.value }))}
                className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none resize-none focus:ring-1 focus:ring-orange-500" />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setModalNova(false)} className="flex-1 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg">Cancelar</button>
              <button onClick={() => criarConta.mutate(novaConta)} disabled={criarConta.isPending || !novaConta.descricao || !novaConta.valor}
                className="flex-1 py-2 bg-orange-500 hover:bg-orange-400 text-white text-sm font-bold rounded-lg disabled:opacity-50">
                {criarConta.isPending ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
