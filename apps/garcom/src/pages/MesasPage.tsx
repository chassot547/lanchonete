import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { supabase } from '../lib/supabase'

interface Mesa { id: string; numero: number; status: 'livre' | 'ocupada' | 'reservada'; capacidade: number }

type StatusKDS = 'aguardando' | 'em_producao' | 'pronto'

interface ItemFila {
  id: string
  produto_nome: string
  quantidade: number
  observacao?: string
  status_kds: StatusKDS
}

interface PedidoFila {
  id: string
  mesa_numero?: number
  tipo: string
  criado_em: string
  itens: ItemFila[]
}

const COR_MESA: Record<string, string> = {
  livre:     'bg-slate-800 border-slate-600 text-slate-300',
  ocupada:   'bg-amber-900/40 border-amber-500 text-amber-300',
  reservada: 'bg-blue-900/40 border-blue-500 text-blue-300',
}

const ICONE: Record<string, string> = {
  livre: '🟢', ocupada: '🔴', reservada: '🔵',
}

const COR_STATUS: Record<StatusKDS, string> = {
  aguardando:  'bg-slate-700 text-slate-300',
  em_producao: 'bg-yellow-900/50 text-yellow-300 border border-yellow-700',
  pronto:      'bg-green-900/50 text-green-300 border border-green-700',
}

const LABEL_STATUS: Record<StatusKDS, string> = {
  aguardando:  '⏳',
  em_producao: '🔥 Produzindo',
  pronto:      '✅ Pronto',
}

function minutosDesde(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
}

async function carregarFilaCozinha(): Promise<PedidoFila[]> {
  const { data, error } = await supabase
    .from('pedidos')
    .select(`
      id, tipo, criado_em,
      mesas!pedidos_mesa_id_fkey(numero),
      itens_pedido(id, quantidade, observacao, status_kds, produtos(nome, categorias(estacao)))
    `)
    .in('status', ['aberto', 'em_producao', 'pronto'])
    .order('criado_em', { ascending: true })

  if (error || !data) return []

  return (data as any[])
    .map(p => ({
      id: p.id,
      tipo: p.tipo,
      mesa_numero: p.mesas?.numero,
      criado_em: p.criado_em,
      itens: (p.itens_pedido ?? [])
        .filter((i: any) => (i.produtos?.categorias?.estacao ?? 'cozinha') === 'cozinha')
        .map((i: any) => ({
          id: i.id,
          produto_nome: i.produtos?.nome ?? '—',
          quantidade: i.quantidade,
          observacao: i.observacao,
          status_kds: i.status_kds ?? 'aguardando',
        })),
    }))
    .filter(p => p.itens.length > 0 && p.itens.some((i: ItemFila) => i.status_kds !== 'pronto'))
}

type Aba = 'mesas' | 'cozinha'

export default function MesasPage() {
  const navigate = useNavigate()
  const qc       = useQueryClient()
  const [aba, setAba]         = useState<Aba>('mesas')
  const [fila, setFila]       = useState<PedidoFila[]>([])
  const [novoPedido, setNovoPedido] = useState(false)

  const { data: mesas = [], isLoading } = useQuery<Mesa[]>({
    queryKey: ['mesas'],
    queryFn:  () => api.get('/mesas'),
    refetchInterval: 20_000,
  })

  const livres   = mesas.filter(m => m.status === 'livre').length
  const ocupadas = mesas.filter(m => m.status === 'ocupada').length

  async function reloadFila() {
    const data = await carregarFilaCozinha()
    setFila(data)
  }

  useEffect(() => {
    reloadFila()

    const channel = supabase
      .channel('garcom-cozinha')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'itens_pedido' }, () => {
        setNovoPedido(true)
        setTimeout(() => setNovoPedido(false), 3000)
        reloadFila()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'itens_pedido' }, () => reloadFila())
      .subscribe()

    const interval = setInterval(reloadFila, 30_000)
    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [])

  const pendentes = fila.reduce((s, p) => s + p.itens.filter(i => i.status_kds !== 'pronto').length, 0)
  const prontos   = fila.reduce((s, p) => s + p.itens.filter(i => i.status_kds === 'pronto').length, 0)

  if (isLoading) return (
    <div className="flex items-center justify-center h-screen bg-slate-900">
      <p className="text-slate-400">Carregando...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-lg font-bold text-white">🍽️ Garçom</h1>
          <p className="text-xs text-slate-400">{livres} livres · {ocupadas} ocupadas</p>
        </div>
        <button onClick={() => supabase.auth.signOut()}
          className="text-xs text-slate-500 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700">
          Sair
        </button>
      </div>

      {/* Abas */}
      <div className="flex border-b border-slate-700 bg-slate-800">
        <button
          onClick={() => setAba('mesas')}
          className={`flex-1 py-3 text-sm font-semibold transition ${aba === 'mesas' ? 'text-blue-400 border-b-2 border-blue-500' : 'text-slate-400'}`}>
          🪑 Mesas
        </button>
        <button
          onClick={() => setAba('cozinha')}
          className={`flex-1 py-3 text-sm font-semibold transition relative ${aba === 'cozinha' ? 'text-orange-400 border-b-2 border-orange-500' : 'text-slate-400'}`}>
          🍳 Cozinha
          {pendentes > 0 && (
            <span className={`absolute top-2 right-6 w-5 h-5 rounded-full text-xs flex items-center justify-center text-white font-bold ${novoPedido ? 'bg-red-500 animate-bounce' : 'bg-orange-500'}`}>
              {pendentes}
            </span>
          )}
        </button>
      </div>

      {/* ABA MESAS */}
      {aba === 'mesas' && (
        <div className="p-4 flex-1">
          <div className="flex gap-4 mb-5 text-xs text-slate-400">
            <span>🟢 Livre</span>
            <span>🔴 Ocupada</span>
            <span>🔵 Reservada</span>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {mesas.map(m => (
              <button key={m.id}
                onClick={() => navigate(`/mesa/${m.id}`)}
                className={`border-2 rounded-2xl p-4 text-center transition active:scale-95 ${COR_MESA[m.status]}`}>
                <div className="text-2xl mb-1">{ICONE[m.status]}</div>
                <div className="text-xl font-bold">{m.numero}</div>
                <div className="text-xs mt-0.5 capitalize opacity-70">{m.status}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ABA COZINHA */}
      {aba === 'cozinha' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Resumo */}
          <div className="flex gap-3 mb-2">
            <div className="flex-1 bg-yellow-900/30 border border-yellow-700 rounded-xl px-3 py-2 text-center">
              <div className="text-xl font-bold text-yellow-300">{pendentes}</div>
              <div className="text-xs text-yellow-400">em preparo</div>
            </div>
            <div className="flex-1 bg-green-900/30 border border-green-700 rounded-xl px-3 py-2 text-center">
              <div className="text-xl font-bold text-green-300">{prontos}</div>
              <div className="text-xs text-green-400">prontos p/ servir</div>
            </div>
          </div>

          {fila.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-600">
              <span className="text-5xl mb-3">✅</span>
              <p className="font-semibold">Cozinha em dia!</p>
              <p className="text-sm mt-1">Nenhum prato pendente</p>
            </div>
          ) : (
            fila.map(pedido => (
              <div key={pedido.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
                {/* Header do pedido */}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="font-bold text-white text-sm">
                      {pedido.tipo === 'mesa' ? `Mesa ${pedido.mesa_numero}` :
                       pedido.tipo === 'delivery' ? '🛵 Delivery' : '🏪 Balcão'}
                    </span>
                    <span className="text-slate-500 text-xs ml-2">#{pedido.id.slice(-6).toUpperCase()}</span>
                  </div>
                  <span className="text-xs text-slate-400">⏱ {minutosDesde(pedido.criado_em)}min</span>
                </div>

                {/* Itens */}
                <div className="space-y-2">
                  {pedido.itens.map(item => (
                    <div key={item.id} className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${COR_STATUS[item.status_kds]}`}>
                      <div className="flex-1">
                        <span className="font-bold">{item.quantidade}×</span> {item.produto_nome}
                        {item.observacao && (
                          <div className="text-xs opacity-70 mt-0.5 italic">"{item.observacao}"</div>
                        )}
                      </div>
                      <span className="text-xs font-semibold ml-3 shrink-0">{LABEL_STATUS[item.status_kds]}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}

          <button onClick={reloadFila}
            className="w-full py-2 text-xs text-slate-500 hover:text-slate-300 transition">
            ↻ Atualizar
          </button>
        </div>
      )}
    </div>
  )
}
