import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'

interface KPIs {
  faturamentoDia: number
  ticketMedio: number
  totalPedidos: number
  cmvPercent: number
  lucroLiquidoDia: number
  pedidosPendentes: number
}

interface UltimaVenda {
  id: string
  tipo: string
  total: number
  forma: string
  criadoEm: string
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtHora(s: string) {
  return new Date(s).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function Card({
  label, value, cor, sub, pulse,
}: { label: string; value: string; cor?: string; sub?: string; pulse?: boolean }) {
  return (
    <div className={`bg-gray-900 rounded-xl p-5 border ${pulse ? 'border-orange-500/60 shadow-orange-900/40 shadow-lg' : 'border-gray-800'} transition-all`}>
      <p className="text-sm text-gray-400">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${cor ?? 'text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

async function fetchKPIs(hoje: string): Promise<KPIs> {
  try {
    return await api.get(`/financeiro/kpis?data=${hoje}`)
  } catch {
    return { faturamentoDia: 0, ticketMedio: 0, totalPedidos: 0, cmvPercent: 0, lucroLiquidoDia: 0, pedidosPendentes: 0 }
  }
}

async function fetchUltimasVendas(): Promise<UltimaVenda[]> {
  const { data } = await supabase
    .from('pedidos')
    .select('id, tipo, total, criado_em, pagamentos(forma)')
    .eq('status', 'pago')
    .order('criado_em', { ascending: false })
    .limit(8)

  return (data ?? []).map((p: any) => ({
    id: p.id,
    tipo: p.tipo,
    total: Number(p.total),
    forma: p.pagamentos?.[0]?.forma ?? '—',
    criadoEm: p.criado_em,
  }))
}

const FORMA_COR: Record<string, string> = {
  pix:      'text-blue-400',
  dinheiro: 'text-green-400',
  debito:   'text-purple-400',
  credito:  'text-pink-400',
}

export default function Dashboard() {
  const hoje = new Date().toISOString().split('T')[0]
  const [kpis, setKpis]   = useState<KPIs | null>(null)
  const [vendas, setVendas] = useState<UltimaVenda[]>([])
  const [pulseId, setPulseId] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)

  async function reload() {
    const [k, v] = await Promise.all([fetchKPIs(hoje), fetchUltimasVendas()])
    setKpis(k)
    setVendas(v)
    setCarregando(false)
  }

  useEffect(() => {
    reload()

    // Realtime — nova venda ou pedido atualizado
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pagamentos' }, (payload) => {
        reload()
        // Flash no card de faturamento
        setPulseId('fat')
        setTimeout(() => setPulseId(null), 3000)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos' }, () => reload())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const k = kpis ?? { faturamentoDia: 0, ticketMedio: 0, totalPedidos: 0, cmvPercent: 0, lucroLiquidoDia: 0, pedidosPendentes: 0 }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Dashboard</h2>
          <p className="text-sm text-gray-400">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-green-400">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
          Tempo real
        </div>
      </div>

      {carregando ? (
        <p className="text-gray-500">Carregando...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <Card
              label="Faturamento hoje"
              value={fmt(k.faturamentoDia)}
              cor="text-green-400"
              pulse={pulseId === 'fat'}
            />
            <Card label="Ticket médio"        value={fmt(k.ticketMedio)} />
            <Card label="Pedidos finalizados" value={String(k.totalPedidos)} sub={`${k.pedidosPendentes} pendente${k.pedidosPendentes !== 1 ? 's' : ''}`} />
            <Card
              label="CMV %"
              value={`${k.cmvPercent.toFixed(1)}%`}
              cor={k.cmvPercent > 35 ? 'text-red-400' : 'text-white'}
            />
            <Card label="Lucro líquido" value={fmt(k.lucroLiquidoDia)} cor="text-orange-400" />
            <Card
              label="Em aberto / produção"
              value={String(k.pedidosPendentes)}
              cor={k.pedidosPendentes > 0 ? 'text-yellow-400' : 'text-white'}
            />
          </div>

          {/* Últimas vendas */}
          <div>
            <h3 className="text-sm font-semibold text-gray-400 mb-3">Últimas vendas</h3>
            <div className="space-y-2">
              {vendas.length === 0 && (
                <p className="text-gray-600 text-sm">Nenhuma venda hoje ainda</p>
              )}
              {vendas.map(v => (
                <div key={v.id} className="flex items-center justify-between bg-gray-900 rounded-xl px-4 py-3 border border-gray-800">
                  <div className="flex items-center gap-3">
                    <span className="text-sm">
                      {v.tipo === 'mesa' ? '🪑' : v.tipo === 'delivery' ? '🛵' : '🏪'}
                    </span>
                    <div>
                      <p className="text-sm font-medium capitalize">{v.tipo}</p>
                      <p className="text-xs text-gray-500">#{v.id.slice(-6).toUpperCase()} · {fmtHora(v.criadoEm)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-white">{fmt(v.total)}</p>
                    <p className={`text-xs capitalize ${FORMA_COR[v.forma] ?? 'text-gray-400'}`}>{v.forma}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
