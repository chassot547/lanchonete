import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../lib/api'

interface ItemEstoque {
  id: string
  nome: string
  unidade: string
  quantidadeAtual: number
  estoqueMinimo: number
  situacao: 'zerado' | 'critico' | 'baixo' | 'ok'
  custoMedio: number
}

const COR: Record<string, string> = {
  zerado:  'bg-red-900/40 text-red-400',
  critico: 'bg-orange-900/40 text-orange-400',
  baixo:   'bg-yellow-900/40 text-yellow-300',
  ok:      'bg-green-900/40 text-green-400',
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function Estoque() {
  const qc = useQueryClient()
  const [modalEntrada, setModalEntrada] = useState<ItemEstoque | null>(null)
  const [qtd, setQtd]     = useState('')
  const [custo, setCusto] = useState('')
  const [obs, setObs]     = useState('')

  const { data: itens = [], isLoading } = useQuery<ItemEstoque[]>({
    queryKey: ['estoque'],
    queryFn: () => api.get('/estoque'),
    refetchInterval: 30_000,
  })

  const entrada = useMutation({
    mutationFn: (body: object) => api.post('/estoque/entrada', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['estoque'] })
      setModalEntrada(null)
      setQtd(''); setCusto(''); setObs('')
    },
  })

  const alertas = itens.filter(i => i.situacao !== 'ok')

  if (isLoading) return <p className="text-gray-500">Carregando estoque...</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Estoque</h2>
        {alertas.length > 0 && (
          <span className="text-sm bg-red-900/40 text-red-400 px-3 py-1 rounded-full">
            ⚠️ {alertas.length} alerta{alertas.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="overflow-auto rounded-xl border border-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-900 text-gray-400">
            <tr>
              <th className="text-left px-4 py-3">Ingrediente</th>
              <th className="text-left px-4 py-3">Un.</th>
              <th className="text-right px-4 py-3">Quantidade</th>
              <th className="text-right px-4 py-3">Mínimo</th>
              <th className="text-right px-4 py-3">Custo médio</th>
              <th className="text-center px-4 py-3">Situação</th>
              <th className="text-center px-4 py-3">Entrada</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {itens.map(i => (
              <tr key={i.id} className="hover:bg-gray-900/50">
                <td className="px-4 py-3 font-medium">{i.nome}</td>
                <td className="px-4 py-3 text-gray-400">{i.unidade}</td>
                <td className="px-4 py-3 text-right">{i.quantidadeAtual.toFixed(3)}</td>
                <td className="px-4 py-3 text-right text-gray-500">{i.estoqueMinimo.toFixed(3)}</td>
                <td className="px-4 py-3 text-right text-gray-400">{fmt(i.custoMedio)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs px-3 py-1 rounded-full capitalize ${COR[i.situacao]}`}>
                    {i.situacao}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => { setModalEntrada(i); setQtd(''); setCusto(''); setObs('') }}
                    className="text-xs text-orange-400 hover:text-orange-300 font-medium"
                  >
                    + Entrada
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Entrada */}
      {modalEntrada && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-sm border border-gray-700 space-y-4">
            <h3 className="text-lg font-bold">Entrada de Estoque</h3>
            <p className="text-orange-400 font-semibold">{modalEntrada.nome}</p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">
                  Quantidade ({modalEntrada.unidade}) *
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={qtd}
                  onChange={e => setQtd(e.target.value)}
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Custo unitário (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={custo}
                  onChange={e => setCusto(e.target.value)}
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Observação</label>
                <input
                  value={obs}
                  onChange={e => setObs(e.target.value)}
                  placeholder="ex: NF 12345"
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => setModalEntrada(null)} className="flex-1 py-2 text-sm text-gray-400 hover:text-white">
                Cancelar
              </button>
              <button
                onClick={() => entrada.mutate({
                  ingredienteId: modalEntrada.id,
                  quantidade: Number(qtd),
                  custoUnit: custo ? Number(custo) : undefined,
                  observacao: obs || undefined,
                })}
                disabled={entrada.isPending || !qtd || Number(qtd) <= 0}
                className="flex-1 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-bold rounded-lg transition disabled:opacity-50"
              >
                {entrada.isPending ? 'Registrando...' : '✅ Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
