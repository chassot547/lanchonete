import { useQuery, useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../lib/api'

interface Ingrediente {
  id: string
  nome: string
  unidade: string
  quantidadeAtual: number
  estoqueMinimo: number
}

export default function Inventario() {
  const [contagem, setContagem] = useState<Record<string, string>>({})
  const [resultado, setResultado] = useState<any[] | null>(null)

  const { data: ingredientes = [], isLoading } = useQuery<Ingrediente[]>({
    queryKey: ['estoque'],
    queryFn:  () => api.get('/estoque'),
  })

  // Inicia contagem com o valor atual como pré-preenchido
  function iniciarContagem() {
    const init: Record<string, string> = {}
    ingredientes.forEach(i => { init[i.id] = String(i.quantidadeAtual) })
    setContagem(init)
    setResultado(null)
  }

  const salvar = useMutation({
    mutationFn: () => {
      const itens = Object.entries(contagem)
        .map(([id, val]) => ({ ingredienteId: id, quantidadeContada: Number(val) }))
        .filter(i => !isNaN(i.quantidadeContada))
      return api.post('/estoque/inventario', itens)
    },
    onSuccess: (data: any) => {
      setResultado(data.ajustes ?? [])
      setContagem({})
    },
  })

  const emContagem = Object.keys(contagem).length > 0

  if (isLoading) return <p className="text-gray-500">Carregando estoque...</p>

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Inventário de Estoque</h2>
          <p className="text-xs text-gray-500 mt-0.5">Contagem física e ajuste automático das divergências</p>
        </div>
        {!emContagem && (
          <button onClick={iniciarContagem}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white text-sm font-bold rounded-lg transition">
            Iniciar Contagem
          </button>
        )}
        {emContagem && (
          <div className="flex gap-2">
            <button onClick={() => setContagem({})} className="px-4 py-2 text-sm text-gray-400 hover:text-white">
              Cancelar
            </button>
            <button onClick={() => salvar.mutate()} disabled={salvar.isPending}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-bold rounded-lg transition disabled:opacity-50">
              {salvar.isPending ? 'Salvando...' : '✅ Confirmar Ajustes'}
            </button>
          </div>
        )}
      </div>

      {/* Resultado do último inventário */}
      {resultado && (
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 space-y-3">
          <h3 className="font-semibold text-gray-200">Resultado do Inventário</h3>
          {resultado.length === 0 ? (
            <p className="text-green-400 text-sm">Nenhuma divergência encontrada — estoque conferido!</p>
          ) : (
            <div className="space-y-2">
              {resultado.map((a: any) => {
                const ing = ingredientes.find(i => i.id === a.ingredienteId)
                return (
                  <div key={a.ingredienteId} className="flex justify-between items-center bg-gray-800 rounded-lg px-3 py-2 text-sm">
                    <span className="text-gray-300">{ing?.nome ?? a.ingredienteId}</span>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-gray-500">Sistema: {a.anterior}</span>
                      <span className="text-gray-500">Contado: {a.contado}</span>
                      <span className={`font-bold ${a.dif > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {a.dif > 0 ? '+' : ''}{a.dif} {ing?.unidade}
                      </span>
                    </div>
                  </div>
                )
              })}
              <p className="text-xs text-gray-500 pt-1">{resultado.length} ingrediente(s) ajustados.</p>
            </div>
          )}
        </div>
      )}

      {/* Tabela de contagem / visualização */}
      <div className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-800 text-gray-400">
            <tr>
              <th className="text-left px-4 py-3">Ingrediente</th>
              <th className="text-right px-4 py-3">Sistema</th>
              <th className="text-right px-4 py-3">Mínimo</th>
              <th className="text-right px-4 py-3">{emContagem ? 'Contagem física' : 'Situação'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {ingredientes.map(ing => {
              const abaixoMin = ing.quantidadeAtual < ing.estoqueMinimo
              const contado   = contagem[ing.id]
              const dif       = contado !== undefined ? Number(contado) - ing.quantidadeAtual : null

              return (
                <tr key={ing.id} className={`hover:bg-gray-800/50 ${abaixoMin && !emContagem ? 'bg-red-900/10' : ''}`}>
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-200">{ing.nome}</span>
                    <span className="text-xs text-gray-600 ml-1">{ing.unidade}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">{ing.quantidadeAtual}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{ing.estoqueMinimo}</td>
                  <td className="px-4 py-3 text-right">
                    {emContagem ? (
                      <div className="flex items-center justify-end gap-2">
                        {dif !== null && dif !== 0 && (
                          <span className={`text-xs font-bold ${dif > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {dif > 0 ? '+' : ''}{dif}
                          </span>
                        )}
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={contagem[ing.id] ?? ''}
                          onChange={e => setContagem(c => ({ ...c, [ing.id]: e.target.value }))}
                          className="w-20 bg-gray-700 rounded px-2 py-1 text-sm text-right outline-none focus:ring-1 focus:ring-orange-500"
                        />
                      </div>
                    ) : (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${abaixoMin ? 'bg-red-900/40 text-red-300' : 'bg-green-900/30 text-green-400'}`}>
                        {abaixoMin ? '⚠ Baixo' : 'OK'}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
