import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../lib/api'

interface CaixaStatus {
  aberto: boolean
  caixaId?: string
  abertoEm?: string
  totalVendas?: number
  totalDinheiro?: number
  totalPix?: number
  totalDebito?: number
  totalCredito?: number
}

interface Movimentacao {
  id: string
  tipo: 'sangria' | 'suprimento' | 'receita' | 'despesa'
  valor: number
  descricao: string
  data: string
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtHora(s?: string) {
  if (!s) return '—'
  return new Date(s).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

const COR_MOV: Record<string, string> = {
  sangria:    'text-red-400',
  suprimento: 'text-green-400',
  receita:    'text-blue-400',
  despesa:    'text-orange-400',
}

export default function Caixa() {
  const qc = useQueryClient()
  const hoje = new Date().toISOString().split('T')[0]

  const [saldoInicial, setSaldoInicial] = useState('0')
  const [saldoFinal,   setSaldoFinal]   = useState('')
  const [modalTipo,    setModalTipo]    = useState<'sangria' | 'suprimento' | null>(null)
  const [movValor,     setMovValor]     = useState('')
  const [movDesc,      setMovDesc]      = useState('')

  const { data: status, isLoading } = useQuery<CaixaStatus>({
    queryKey: ['caixa-status'],
    queryFn:  () => api.get('/caixa/status'),
    refetchInterval: 10_000,
  })

  const { data: movs = [] } = useQuery<Movimentacao[]>({
    queryKey: ['caixa-movs', hoje],
    queryFn:  () => api.get(`/financeiro/movimentacoes?ini=${hoje}&fim=${hoje}`),
    enabled: !!status?.aberto,
    refetchInterval: 30_000,
  })

  const abrir = useMutation({
    mutationFn: () => api.post('/caixa/abrir', { saldoInicial: Number(saldoInicial) }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['caixa-status'] }); setSaldoInicial('0') },
  })

  const fechar = useMutation({
    mutationFn: () => api.post('/caixa/fechar', { saldoFinal: Number(saldoFinal) }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['caixa-status'] }); setSaldoFinal('') },
  })

  const registrarMov = useMutation({
    mutationFn: () => api.post(`/financeiro/${modalTipo}`, { valor: Number(movValor), descricao: movDesc }),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['caixa-movs'] })
      qc.invalidateQueries({ queryKey: ['caixa-status'] })
      setModalTipo(null); setMovValor(''); setMovDesc('')
    },
  })

  if (isLoading) return <p className="text-gray-500">Carregando caixa...</p>

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-xl font-bold">Controle de Caixa</h2>

      {!status?.aberto ? (
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-4">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-red-500" />
            <p className="font-semibold text-gray-300">Caixa Fechado</p>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Troco inicial (fundo de caixa)</label>
            <input type="number" step="0.01" value={saldoInicial}
              onChange={e => setSaldoInicial(e.target.value)}
              className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-500" />
          </div>
          <button onClick={() => abrir.mutate()} disabled={abrir.isPending}
            className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl transition disabled:opacity-50">
            {abrir.isPending ? 'Abrindo...' : '🔓 Abrir Caixa'}
          </button>
        </div>
      ) : (
        <>
          {/* Status do caixa */}
          <div className="bg-gray-900 rounded-2xl p-6 border border-green-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                <p className="font-semibold text-green-400">Caixa Aberto</p>
              </div>
              <p className="text-xs text-gray-500">Desde {fmtHora(status.abertoEm)}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-800 rounded-xl p-4 col-span-2">
                <p className="text-xs text-gray-400">Total de Vendas</p>
                <p className="text-3xl font-bold text-white mt-1">{fmt(status.totalVendas ?? 0)}</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-3">
                <p className="text-xs text-gray-400">💵 Dinheiro</p>
                <p className="text-lg font-bold text-green-400 mt-1">{fmt(status.totalDinheiro ?? 0)}</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-3">
                <p className="text-xs text-gray-400">🟩 PIX</p>
                <p className="text-lg font-bold text-blue-400 mt-1">{fmt(status.totalPix ?? 0)}</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-3">
                <p className="text-xs text-gray-400">💳 Débito</p>
                <p className="text-lg font-bold text-purple-400 mt-1">{fmt(status.totalDebito ?? 0)}</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-3">
                <p className="text-xs text-gray-400">💳 Crédito</p>
                <p className="text-lg font-bold text-pink-400 mt-1">{fmt(status.totalCredito ?? 0)}</p>
              </div>
            </div>

            {/* Sangria / Suprimento */}
            <div className="flex gap-3">
              <button onClick={() => setModalTipo('sangria')}
                className="flex-1 py-2.5 bg-red-900/40 hover:bg-red-900/60 text-red-300 text-sm font-semibold rounded-xl border border-red-800 transition">
                💸 Sangria
              </button>
              <button onClick={() => setModalTipo('suprimento')}
                className="flex-1 py-2.5 bg-green-900/40 hover:bg-green-900/60 text-green-300 text-sm font-semibold rounded-xl border border-green-800 transition">
                💰 Suprimento
              </button>
            </div>
          </div>

          {/* Movimentações do dia */}
          {movs.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-400">Movimentações do dia</h3>
              {movs.map(m => (
                <div key={m.id} className="flex items-center justify-between bg-gray-900 rounded-xl px-4 py-3 border border-gray-800">
                  <div>
                    <p className="text-sm font-medium capitalize text-gray-300">{m.descricao}</p>
                    <p className="text-xs text-gray-500">{fmtHora(m.data)}</p>
                  </div>
                  <span className={`text-sm font-bold ${COR_MOV[m.tipo]}`}>
                    {m.tipo === 'sangria' ? '−' : '+'}{fmt(m.valor)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Fechar caixa */}
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-4">
            <h3 className="font-semibold">Fechar Caixa</h3>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Valor em dinheiro contado fisicamente</label>
              <input type="number" step="0.01" value={saldoFinal}
                onChange={e => setSaldoFinal(e.target.value)}
                className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-500" />
            </div>
            <button
              onClick={() => { if (confirm('Fechar o caixa agora?')) fechar.mutate() }}
              disabled={fechar.isPending}
              className="w-full py-3 bg-red-700 hover:bg-red-600 text-white font-bold rounded-xl transition disabled:opacity-50">
              {fechar.isPending ? 'Fechando...' : '🔒 Fechar Caixa'}
            </button>
          </div>
        </>
      )}

      {/* Modal Sangria / Suprimento */}
      {modalTipo && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-sm border border-gray-700 space-y-4">
            <h3 className="text-lg font-bold capitalize">{modalTipo}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Valor (R$) *</label>
                <input type="number" step="0.01" value={movValor}
                  onChange={e => setMovValor(e.target.value)} autoFocus
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Descrição</label>
                <input value={movDesc} onChange={e => setMovDesc(e.target.value)}
                  placeholder={modalTipo === 'sangria' ? 'ex: Pagamento fornecedor' : 'ex: Troco reforço'}
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalTipo(null)} className="flex-1 py-2 text-sm text-gray-400 hover:text-white">Cancelar</button>
              <button
                onClick={() => registrarMov.mutate()}
                disabled={registrarMov.isPending || !movValor || Number(movValor) <= 0}
                className="flex-1 py-2 bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50">
                {registrarMov.isPending ? 'Registrando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
