import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../lib/api'

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtPct(n: number) { return `${n.toFixed(1)}%` }

const CURVA_COR: Record<string, string> = {
  A: 'bg-green-900/50 text-green-300 border-green-700',
  B: 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
  C: 'bg-gray-800 text-gray-400 border-gray-700',
}

const FORMA_ICONE: Record<string, string> = {
  pix: '🟩', dinheiro: '💵', debito: '💳', credito: '💳',
}

export default function Relatorios() {
  const hoje = new Date().toISOString().split('T')[0]
  const [ini, setIni] = useState(hoje)
  const [fim, setFim] = useState(hoje)
  const [aba,  setAba]  = useState<'vendas' | 'produtos'>('vendas')

  const { data: vendas, isLoading: loadVendas } = useQuery<any>({
    queryKey: ['rel-vendas', ini, fim],
    queryFn:  () => api.get(`/relatorios/vendas?ini=${ini}&fim=${fim}`),
  })

  const { data: produtos = [], isLoading: loadProdutos } = useQuery<any[]>({
    queryKey: ['rel-produtos', ini, fim],
    queryFn:  () => api.get(`/relatorios/produtos?ini=${ini}&fim=${fim}`),
    enabled: aba === 'produtos',
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold">Relatórios</h2>
        <div className="flex items-center gap-2 text-sm">
          <input type="date" value={ini} onChange={e => setIni(e.target.value)}
            className="bg-gray-800 rounded-lg px-3 py-2 outline-none" />
          <span className="text-gray-500">até</span>
          <input type="date" value={fim} onChange={e => setFim(e.target.value)}
            className="bg-gray-800 rounded-lg px-3 py-2 outline-none" />
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-2">
        {(['vendas', 'produtos'] as const).map(a => (
          <button key={a} onClick={() => setAba(a)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition capitalize ${aba === a ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            {a === 'vendas' ? '📊 Vendas' : '🏆 Produtos (Curva ABC)'}
          </button>
        ))}
      </div>

      {/* ABA VENDAS */}
      {aba === 'vendas' && (
        loadVendas ? <p className="text-gray-500">Carregando...</p> : (
          <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                <p className="text-xs text-gray-400">Faturamento</p>
                <p className="text-2xl font-bold text-green-400 mt-1">{fmt(vendas?.totalVendas ?? 0)}</p>
              </div>
              <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                <p className="text-xs text-gray-400">Pedidos pagos</p>
                <p className="text-2xl font-bold text-white mt-1">{vendas?.totalPedidos ?? 0}</p>
              </div>
              <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                <p className="text-xs text-gray-400">Ticket médio</p>
                <p className="text-2xl font-bold text-orange-400 mt-1">{fmt(vendas?.ticketMedio ?? 0)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* Por forma de pagamento */}
              <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                <h4 className="text-sm font-semibold text-gray-400 mb-3">Por forma de pagamento</h4>
                <div className="space-y-2">
                  {Object.entries(vendas?.porForma ?? {}).map(([forma, val]: any) => (
                    <div key={forma} className="flex items-center justify-between">
                      <span className="text-sm capitalize">{FORMA_ICONE[forma] ?? '—'} {forma}</span>
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-2 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-orange-500 rounded-full"
                            style={{ width: `${vendas.totalVendas > 0 ? (val / vendas.totalVendas) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold text-white w-20 text-right">{fmt(val)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Por tipo de pedido */}
              <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                <h4 className="text-sm font-semibold text-gray-400 mb-3">Por tipo de pedido</h4>
                <div className="space-y-2">
                  {Object.entries(vendas?.porTipo ?? {}).map(([tipo, val]: any) => (
                    <div key={tipo} className="flex items-center justify-between">
                      <span className="text-sm capitalize">
                        {tipo === 'mesa' ? '🪑' : tipo === 'delivery' ? '🛵' : '🏪'} {tipo}
                      </span>
                      <span className="text-sm font-bold text-white">{fmt(val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Lista de pedidos */}
            <div>
              <h4 className="text-sm font-semibold text-gray-400 mb-3">Pedidos do período</h4>
              <div className="overflow-auto rounded-xl border border-gray-800 max-h-96">
                <table className="w-full text-sm">
                  <thead className="bg-gray-900 text-gray-400 sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-3">#</th>
                      <th className="text-left px-4 py-3">Tipo</th>
                      <th className="text-left px-4 py-3">Pagamento</th>
                      <th className="text-left px-4 py-3">Horário</th>
                      <th className="text-right px-4 py-3">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {(vendas?.pedidos ?? []).map((p: any) => (
                      <tr key={p.id} className="hover:bg-gray-900/50">
                        <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{p.id.slice(-6).toUpperCase()}</td>
                        <td className="px-4 py-2.5 capitalize text-gray-300">{p.tipo}</td>
                        <td className="px-4 py-2.5 text-gray-400 capitalize">{p.pagamentos?.[0]?.forma ?? '—'}</td>
                        <td className="px-4 py-2.5 text-gray-500 text-xs">
                          {new Date(p.criado_em).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-green-400">{fmt(Number(p.total))}</td>
                      </tr>
                    ))}
                    {(vendas?.pedidos ?? []).length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-600">Nenhuma venda no período</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      )}

      {/* ABA PRODUTOS — Curva ABC */}
      {aba === 'produtos' && (
        loadProdutos ? <p className="text-gray-500">Carregando...</p> : (
          <div className="space-y-4">
            <div className="flex gap-3 text-xs">
              <span className="px-3 py-1 rounded-full bg-green-900/50 text-green-300 border border-green-700">A — Top 80% do faturamento</span>
              <span className="px-3 py-1 rounded-full bg-yellow-900/50 text-yellow-300 border border-yellow-700">B — 80–95%</span>
              <span className="px-3 py-1 rounded-full bg-gray-800 text-gray-400 border border-gray-700">C — Cauda 5%</span>
            </div>
            <div className="overflow-auto rounded-xl border border-gray-800">
              <table className="w-full text-sm">
                <thead className="bg-gray-900 text-gray-400">
                  <tr>
                    <th className="text-center px-3 py-3">#</th>
                    <th className="text-left px-4 py-3">Produto</th>
                    <th className="text-right px-4 py-3">Qtde</th>
                    <th className="text-right px-4 py-3">Faturamento</th>
                    <th className="text-right px-4 py-3">% Individual</th>
                    <th className="text-right px-4 py-3">% Acumulado</th>
                    <th className="text-center px-4 py-3">Curva</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {produtos.map((p: any, i: number) => (
                    <tr key={p.nome} className="hover:bg-gray-900/50">
                      <td className="px-3 py-2.5 text-center text-gray-500">{i + 1}</td>
                      <td className="px-4 py-2.5 font-medium">{p.nome}</td>
                      <td className="px-4 py-2.5 text-right text-gray-300">{p.quantidade}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-green-400">{fmt(p.total)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-400">{fmtPct(p.pct)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-500">{fmtPct(p.acumPct)}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${CURVA_COR[p.curva]}`}>
                          {p.curva}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {produtos.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-600">Nenhuma venda no período</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  )
}
