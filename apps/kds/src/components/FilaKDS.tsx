import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAlertaNovosPedidos } from '../hooks/useAlertaNovosPedidos'
import { imprimirComanda } from '../lib/comanda'

type StatusKDS = 'aguardando' | 'em_producao' | 'pronto'
type Estacao = 'cozinha' | 'bar' | undefined

interface ItemKDS {
  id: string
  produto_nome: string
  quantidade: number
  observacao?: string
  status_kds: StatusKDS
  estacao: string
}

interface PedidoKDS {
  id: string
  tipo: string
  mesa_numero?: number
  itens: ItemKDS[]
  criado_em: string
  minutos: number
}

const COR_CARD = (min: number) =>
  min >= 15 ? 'border-red-500 bg-red-950/30' :
  min >= 8  ? 'border-yellow-500 bg-yellow-950/20' :
              'border-green-500 bg-green-950/20'

const COR_ITEM: Record<StatusKDS, string> = {
  aguardando:  'border-gray-600 bg-gray-800 text-gray-300',
  em_producao: 'border-yellow-600 bg-yellow-900/30 text-yellow-200',
  pronto:      'border-green-600 bg-green-900/30 text-green-300 line-through opacity-60',
}

const LABEL: Record<StatusKDS, string> = {
  aguardando:  '⏳',
  em_producao: '🔥',
  pronto:      '✅',
}

function minutosDesde(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
}

async function carregarPedidos(estacao?: Estacao): Promise<PedidoKDS[]> {
  const { data, error } = await supabase
    .from('pedidos')
    .select(`
      id, tipo, status, criado_em,
      mesas!pedidos_mesa_id_fkey(numero),
      itens_pedido(id, quantidade, observacao, status_kds, produtos(nome, categorias(estacao)))
    `)
    .in('status', ['aberto', 'em_producao', 'pronto'])
    .order('criado_em', { ascending: true })

  if (error || !data) return []

  return (data as any[])
    .map(p => {
      const itens: ItemKDS[] = (p.itens_pedido ?? []).map((i: any) => ({
        id: i.id,
        produto_nome: i.produtos?.nome ?? '—',
        quantidade: i.quantidade,
        observacao: i.observacao,
        status_kds: i.status_kds ?? 'aguardando',
        estacao: i.produtos?.categorias?.estacao ?? 'cozinha',
      }))

      // filtra itens pela estação se especificada
      const itensFiltrados = estacao ? itens.filter(i => i.estacao === estacao) : itens

      return {
        id: p.id,
        tipo: p.tipo,
        mesa_numero: (p.mesas as any)?.numero,
        criado_em: p.criado_em,
        minutos: minutosDesde(p.criado_em),
        itens: itensFiltrados,
      }
    })
    .filter(p => p.itens.length > 0 && p.itens.some(i => i.status_kds !== 'pronto'))
}

async function avancarStatus(itemId: string, atual: StatusKDS) {
  const proximo: StatusKDS = atual === 'aguardando' ? 'em_producao' : 'pronto'
  await supabase.from('itens_pedido').update({ status_kds: proximo }).eq('id', itemId)
}

interface Props {
  estacao?: Estacao
}

export default function FilaKDS({ estacao }: Props) {
  const [pedidos, setPedidos] = useState<PedidoKDS[]>([])
  const [novoPedidoId, setNovoPedidoId] = useState<string | null>(null)

  useAlertaNovosPedidos(pedidos.length)

  async function reload() {
    const data = await carregarPedidos(estacao)
    setPedidos(data)
  }

  useEffect(() => {
    reload()

    const channel = supabase
      .channel(`kds-realtime-${estacao ?? 'all'}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'itens_pedido' }, (payload) => {
        const pedidoId = (payload.new as any)?.pedido_id
        if (pedidoId) setNovoPedidoId(pedidoId)
        reload()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'itens_pedido' }, () => reload())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos' }, () => reload())
      .subscribe()

    const interval = setInterval(() => reload(), 30_000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [estacao])

  useEffect(() => {
    if (!novoPedidoId) return
    const t = setTimeout(() => setNovoPedidoId(null), 4000)
    return () => clearTimeout(t)
  }, [novoPedidoId])

  const pedidosAtualizados = pedidos.map(p => ({ ...p, minutos: minutosDesde(p.criado_em) }))

  async function handleItemClick(item: ItemKDS) {
    if (item.status_kds === 'pronto') return
    await avancarStatus(item.id, item.status_kds)
    await reload()
  }

  const counts = {
    aguardando:  pedidosAtualizados.flatMap(p => p.itens).filter(i => i.status_kds === 'aguardando').length,
    em_producao: pedidosAtualizados.flatMap(p => p.itens).filter(i => i.status_kds === 'em_producao').length,
    atrasados:   pedidosAtualizados.filter(p => p.minutos >= 15).length,
  }

  return (
    <div className="space-y-4">
      {/* Contadores */}
      <div className="flex gap-4 text-sm flex-wrap">
        <span className="text-green-400 font-semibold">⏳ Aguardando: {counts.aguardando}</span>
        <span className="text-yellow-400 font-semibold">🔥 Produzindo: {counts.em_producao}</span>
        {counts.atrasados > 0 && (
          <span className="text-red-400 font-semibold animate-pulse">🚨 Atrasados (+15min): {counts.atrasados}</span>
        )}
        <span className="text-gray-600 text-xs ml-auto">Toque no item para avançar status</span>
      </div>

      {/* Banner novo pedido */}
      {novoPedidoId && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-orange-500 text-white px-6 py-3 rounded-2xl shadow-2xl font-bold text-lg animate-bounce flex items-center gap-3">
          🔔 Novo pedido chegou!
        </div>
      )}

      {/* Fila */}
      {pedidosAtualizados.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-700">
          <span className="text-5xl mb-3">✅</span>
          <p className="text-lg font-semibold">Cozinha em dia!</p>
          <p className="text-sm mt-1">Nenhum pedido pendente</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {pedidosAtualizados.map(pedido => (
            <div
              key={pedido.id}
              className={`border-l-4 rounded-r-xl p-3 ${COR_CARD(pedido.minutos)} ${novoPedidoId === pedido.id ? 'ring-2 ring-orange-400 animate-pulse' : ''}`}
            >
              {/* Cabeçalho */}
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-xs font-bold text-white">
                    {pedido.tipo === 'mesa' ? `Mesa ${pedido.mesa_numero}` :
                     pedido.tipo === 'delivery' ? '🛵 Delivery' : '🏪 Balcão'}
                  </p>
                  <p className="text-xs text-gray-500">#{pedido.id.slice(-6).toUpperCase()}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-xs font-bold ${pedido.minutos >= 15 ? 'text-red-400 animate-pulse' : pedido.minutos >= 8 ? 'text-yellow-400' : 'text-green-400'}`}>
                    ⏱ {pedido.minutos}min
                  </span>
                  <button
                    onClick={() => imprimirComanda(pedido)}
                    title="Imprimir comanda"
                    className="text-gray-500 hover:text-white text-xs leading-none transition"
                  >
                    🖨️
                  </button>
                </div>
              </div>

              {/* Itens */}
              <div className="space-y-1">
                {pedido.itens.map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    disabled={item.status_kds === 'pronto'}
                    className={`w-full text-left text-xs px-2 py-1.5 rounded-lg border transition-all ${COR_ITEM[item.status_kds]} ${item.status_kds !== 'pronto' ? 'hover:opacity-80 active:scale-95' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span><span className="font-bold">{item.quantidade}×</span> {item.produto_nome}</span>
                      <span>{LABEL[item.status_kds]}</span>
                    </div>
                    {item.observacao && (
                      <p className="text-xs text-gray-500 mt-0.5 italic">"{item.observacao}"</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
