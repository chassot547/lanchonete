import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3010'
const h   = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

interface Variacao {
  id: string; nome: string; opcoes: { label: string; preco_extra: number }[]; obrigatorio: boolean
}
interface Adicional { id: string; nome: string; preco: number; ativo: boolean }
interface Produto   { id: string; nome: string; precoVenda: number }

interface Props {
  produto: Produto
  onConfirmar: (produto: Produto, precoFinal: number, variacao: any, adicionais: any[], observacao: string) => void
  onCancelar: () => void
}

function fmt(n: number) { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }

export default function ModalVariacoes({ produto, onConfirmar, onCancelar }: Props) {
  const [varSel, setVarSel]     = useState<Record<string, string>>({})    // variacaoId → label
  const [addSel, setAddSel]     = useState<Set<string>>(new Set())        // adicionalId
  const [observacao, setObs]    = useState('')

  const { data: variacoes = [] } = useQuery<Variacao[]>({
    queryKey: ['variacoes', produto.id],
    queryFn:  () => fetch(`${API}/produtos/${produto.id}/variacoes`, { headers: h() }).then(r => r.json()),
  })
  const { data: adicionais = [] } = useQuery<Adicional[]>({
    queryKey: ['adicionais', produto.id],
    queryFn:  () => fetch(`${API}/produtos/${produto.id}/adicionais`, { headers: h() }).then(r => r.json()),
  })

  const extraVariacoes = variacoes.reduce((sum, v) => {
    const sel = varSel[v.id]
    const opc = v.opcoes.find(o => o.label === sel)
    return sum + (opc?.preco_extra ?? 0)
  }, 0)

  const extraAdicionais = adicionais
    .filter(a => addSel.has(a.id))
    .reduce((s, a) => s + a.preco, 0)

  const precoFinal = produto.precoVenda + extraVariacoes + extraAdicionais

  const obrigatoriosPendentes = variacoes
    .filter(v => v.obrigatorio && !varSel[v.id])

  function toggleAdicional(id: string) {
    setAddSel(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  function confirmar() {
    const variacaoInfo = variacoes
      .filter(v => varSel[v.id])
      .map(v => ({ nome: v.nome, opcao: varSel[v.id] }))

    const adicionaisInfo = adicionais
      .filter(a => addSel.has(a.id))
      .map(a => ({ nome: a.nome, preco: a.preco }))

    onConfirmar(produto, precoFinal, variacaoInfo, adicionaisInfo, observacao)
  }

  // Se não tem variações nem adicionais, confirma direto
  const semOpcoes = variacoes.length === 0 && adicionais.length === 0

  if (semOpcoes) {
    // Só pede observação
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-sm border border-gray-700 space-y-4">
          <h3 className="font-bold text-white">{produto.nome}</h3>
          <p className="text-2xl font-bold text-orange-400">{fmt(produto.precoVenda)}</p>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Observação</label>
            <input
              value={observacao} onChange={e => setObs(e.target.value)}
              placeholder="ex: sem cebola, bem passado..."
              autoFocus
              className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none"
            />
          </div>
          <div className="flex gap-3">
            <button onClick={onCancelar} className="flex-1 py-2 text-sm text-gray-400 hover:text-white">Cancelar</button>
            <button onClick={confirmar} className="flex-1 py-2 bg-orange-500 hover:bg-orange-400 text-white text-sm font-bold rounded-lg transition">
              Adicionar
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl p-5 w-full max-w-sm border border-gray-700 flex flex-col max-h-[90vh]">
        <div className="mb-4">
          <h3 className="font-bold text-white text-lg">{produto.nome}</h3>
          <p className="text-2xl font-bold text-orange-400 mt-1">{fmt(precoFinal)}</p>
          {(extraVariacoes + extraAdicionais) > 0 && (
            <p className="text-xs text-gray-500">
              Base {fmt(produto.precoVenda)} + extras {fmt(extraVariacoes + extraAdicionais)}
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-5">
          {/* Variações */}
          {variacoes.map(v => (
            <div key={v.id}>
              <p className="text-sm font-semibold text-gray-200 mb-2">
                {v.nome} {v.obrigatorio && <span className="text-red-400 text-xs">*obrigatório</span>}
              </p>
              <div className="flex flex-wrap gap-2">
                {v.opcoes.map(opc => (
                  <button
                    key={opc.label}
                    onClick={() => setVarSel(s => ({ ...s, [v.id]: opc.label }))}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                      varSel[v.id] === opc.label
                        ? 'bg-orange-500 border-orange-500 text-white font-semibold'
                        : 'border-gray-600 text-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {opc.label}
                    {opc.preco_extra > 0 && <span className="text-xs ml-1 opacity-70">+{fmt(opc.preco_extra)}</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Adicionais */}
          {adicionais.filter(a => a.ativo).length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-200 mb-2">Adicionais</p>
              <div className="space-y-1.5">
                {adicionais.filter(a => a.ativo).map(a => (
                  <label key={a.id} className="flex items-center justify-between cursor-pointer bg-gray-800 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={addSel.has(a.id)}
                        onChange={() => toggleAdicional(a.id)}
                        className="accent-orange-500"
                      />
                      <span className="text-sm text-gray-200">{a.nome}</span>
                    </div>
                    <span className="text-sm text-orange-400 font-semibold">+{fmt(a.preco)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Observação */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">Observação</label>
            <input
              value={observacao} onChange={e => setObs(e.target.value)}
              placeholder="ex: sem cebola, bem passado..."
              className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-4 pt-3 border-t border-gray-800">
          <button onClick={onCancelar} className="flex-1 py-2.5 text-sm text-gray-400 hover:text-white">Cancelar</button>
          <button
            onClick={confirmar}
            disabled={obrigatoriosPendentes.length > 0}
            className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-400 text-white text-sm font-bold rounded-lg transition disabled:opacity-40"
          >
            {obrigatoriosPendentes.length > 0
              ? `Escolha: ${obrigatoriosPendentes.map(v => v.nome).join(', ')}`
              : `Adicionar · ${fmt(precoFinal)}`}
          </button>
        </div>
      </div>
    </div>
  )
}
