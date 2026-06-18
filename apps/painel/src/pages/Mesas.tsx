import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../lib/api'

interface Mesa { id: string; numero: number; status: 'livre' | 'ocupada' | 'reservada'; capacidade: number }
interface Pedido { id: string; tipo: string; status: string; total: number; criado_em: string }

const COR: Record<string, string> = {
  livre:     'border-green-600 bg-green-900/20 text-green-300',
  ocupada:   'border-yellow-500 bg-yellow-900/20 text-yellow-300',
  reservada: 'border-blue-600 bg-blue-900/20 text-blue-300',
}

function fmt(n: number) { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function fmtHora(s: string) { return new Date(s).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }

export default function Mesas() {
  const qc = useQueryClient()
  const [mesaSel, setMesaSel]   = useState<Mesa | null>(null)
  const [aba, setAba]           = useState<'pedido' | 'historico' | 'transferir' | 'dividir'>('pedido')
  const [mesaDestino, setMesaDestino] = useState('')
  const [partes, setPartes]     = useState('2')

  const { data: mesas = [], isLoading } = useQuery<Mesa[]>({
    queryKey: ['mesas'],
    queryFn:  () => api.get('/mesas'),
    refetchInterval: 30_000,
  })

  const { data: pedidoAberto } = useQuery<any>({
    queryKey: ['mesa-pedido', mesaSel?.id],
    queryFn:  () => api.get(`/mesas/${mesaSel!.id}/pedido`),
    enabled: !!mesaSel,
  })

  const { data: historico = [] } = useQuery<Pedido[]>({
    queryKey: ['mesa-historico', mesaSel?.id],
    queryFn:  () => api.get(`/mesas/${mesaSel!.id}/historico`),
    enabled: !!mesaSel && aba === 'historico',
  })

  const liberar = useMutation({
    mutationFn: (id: string) => api.patch(`/mesas/${id}`, { status: 'livre' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mesas'] }); setMesaSel(null) },
  })

  const transferir = useMutation({
    mutationFn: () => api.post(`/mesas/${mesaSel!.id}/transferir`, { mesaDestinoId: mesaDestino }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mesas'] }); setMesaSel(null) },
  })

  const dividir = useMutation({
    mutationFn: () => api.post(`/mesas/${mesaSel!.id}/dividir`, { partes: Number(partes) }),
    onSuccess: (data: any) => {
      alert(`Divisão: ${data.partes}x de ${fmt(data.valorParte)}`)
      setMesaSel(null)
    },
  })

  const mesasLivres = mesas.filter(m => m.status === 'livre' && m.id !== mesaSel?.id)

  if (isLoading) return <p className="text-gray-500">Carregando mesas...</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Mesas</h2>
        <div className="flex gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />Livre: {mesas.filter(m=>m.status==='livre').length}</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" />Ocupada: {mesas.filter(m=>m.status==='ocupada').length}</span>
        </div>
      </div>

      <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
        {mesas.map(m => (
          <button key={m.id} onClick={() => { setMesaSel(m); setAba('pedido') }}
            className={`border rounded-xl p-3 text-center transition hover:opacity-80 ${COR[m.status]} ${mesaSel?.id === m.id ? 'ring-2 ring-orange-500' : ''}`}>
            <div className="text-xl font-bold">{m.numero}</div>
            <div className="text-xs mt-0.5 capitalize">{m.status}</div>
          </button>
        ))}
      </div>

      {/* Painel lateral da mesa selecionada */}
      {mesaSel && (
        <div className="bg-gray-900 rounded-2xl border border-gray-700 p-5 space-y-4 max-w-lg">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg">Mesa {mesaSel.numero}
              <span className={`text-xs ml-2 px-2 py-0.5 rounded-full capitalize ${COR[mesaSel.status]}`}>{mesaSel.status}</span>
            </h3>
            <button onClick={() => setMesaSel(null)} className="text-gray-500 hover:text-white text-xl">×</button>
          </div>

          {/* Abas */}
          <div className="flex gap-1 flex-wrap">
            {(['pedido','historico','transferir','dividir'] as const).map(a => (
              <button key={a} onClick={() => setAba(a)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition ${aba===a ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                {a === 'pedido' ? '🧾 Pedido' : a === 'historico' ? '📋 Histórico' : a === 'transferir' ? '↔️ Transferir' : '➗ Dividir'}
              </button>
            ))}
          </div>

          {/* ABA PEDIDO */}
          {aba === 'pedido' && (
            <div>
              {!pedidoAberto ? (
                <p className="text-gray-500 text-sm">Nenhum pedido aberto nessa mesa.</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">#{pedidoAberto.id.slice(-6).toUpperCase()}</span>
                    <span className="text-gray-400">{fmtHora(pedidoAberto.criado_em)}</span>
                  </div>
                  <div className="space-y-1">
                    {(pedidoAberto.itens_pedido ?? []).map((i: any) => (
                      <div key={i.id} className="flex justify-between text-sm">
                        <span className="text-gray-300">{i.quantidade}× {i.produtos?.nome}</span>
                        <span className="text-gray-400">{fmt(Number(i.subtotal))}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between font-bold text-white border-t border-gray-700 pt-2">
                    <span>Total</span>
                    <span className="text-orange-400">{fmt(Number(pedidoAberto.total))}</span>
                  </div>
                  <button onClick={() => liberar.mutate(mesaSel.id)}
                    className="w-full py-2 bg-green-700 hover:bg-green-600 text-white text-sm font-bold rounded-lg transition">
                    Liberar mesa
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ABA HISTÓRICO */}
          {aba === 'historico' && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {historico.length === 0 && <p className="text-gray-500 text-sm">Nenhum histórico.</p>}
              {historico.map(p => (
                <div key={p.id} className="flex justify-between bg-gray-800 rounded-lg px-3 py-2 text-sm">
                  <div>
                    <span className="text-gray-400 text-xs">{fmtHora(p.criado_em)}</span>
                    <span className={`ml-2 text-xs px-2 py-0.5 rounded-full capitalize ${p.status === 'pago' ? 'bg-green-900/40 text-green-300' : 'bg-gray-700 text-gray-400'}`}>{p.status}</span>
                  </div>
                  <span className="font-bold text-green-400">{fmt(Number(p.total))}</span>
                </div>
              ))}
            </div>
          )}

          {/* ABA TRANSFERIR */}
          {aba === 'transferir' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-400">Mover o pedido aberto para outra mesa livre:</p>
              <div className="grid grid-cols-4 gap-2">
                {mesasLivres.map(m => (
                  <button key={m.id} onClick={() => setMesaDestino(m.id)}
                    className={`py-2 rounded-lg text-sm font-bold border transition ${mesaDestino === m.id ? 'bg-orange-500 border-orange-500 text-white' : 'border-gray-700 text-gray-300 hover:border-orange-400'}`}>
                    {m.numero}
                  </button>
                ))}
              </div>
              {mesasLivres.length === 0 && <p className="text-gray-500 text-sm">Nenhuma mesa livre disponível.</p>}
              <button onClick={() => transferir.mutate()} disabled={!mesaDestino || transferir.isPending}
                className="w-full py-2 bg-orange-500 hover:bg-orange-400 text-white text-sm font-bold rounded-lg transition disabled:opacity-50">
                {transferir.isPending ? 'Transferindo...' : 'Confirmar Transferência'}
              </button>
            </div>
          )}

          {/* ABA DIVIDIR */}
          {aba === 'dividir' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-400">Dividir a conta em partes iguais:</p>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Número de partes</label>
                <input type="number" min="2" max="20" value={partes}
                  onChange={e => setPartes(e.target.value)}
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-500" />
              </div>
              {pedidoAberto && Number(partes) >= 2 && (
                <p className="text-center text-orange-400 font-bold">
                  {Number(partes)}× de {fmt(Number(pedidoAberto.total) / Number(partes))}
                </p>
              )}
              <button onClick={() => dividir.mutate()} disabled={!pedidoAberto || Number(partes) < 2 || dividir.isPending}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg transition disabled:opacity-50">
                {dividir.isPending ? 'Calculando...' : '➗ Dividir Conta'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
