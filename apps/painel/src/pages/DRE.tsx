import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../lib/api'

function fmt(n: number) { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }

interface DREData {
  periodo: string
  receitaBruta: number
  descontos: number
  receitaLiquida: number
  cmv: number
  margemBruta: string
  lucroBruto: number
  sangrias: number
  suprimentos: number
  lucroLiquido: number
  margemLiquida: string
  totalPedidos: number
  ticketMedio: number
  porTipo: Record<string, number>
}

function Linha({ label, valor, destaque, negativo, sub }: { label: string; valor: number; destaque?: boolean; negativo?: boolean; sub?: boolean }) {
  return (
    <div className={`flex justify-between py-2 ${sub ? 'pl-4 text-gray-400' : 'font-semibold text-gray-200'} ${destaque ? 'border-t border-gray-700 mt-1 pt-3 text-white text-lg' : ''}`}>
      <span>{label}</span>
      <span className={negativo ? 'text-red-400' : destaque ? 'text-green-400' : ''}>{negativo ? `(${fmt(valor)})` : fmt(valor)}</span>
    </div>
  )
}

export default function DRE() {
  const agora = new Date()
  const [mes, setMes]   = useState(String(agora.getMonth() + 1))
  const [ano, setAno]   = useState(String(agora.getFullYear()))

  const { data, isLoading, isError } = useQuery<DREData>({
    queryKey: ['dre', mes, ano],
    queryFn:  () => api.get(`/relatorios/dre?mes=${mes}&ano=${ano}`),
  })

  const anos = [String(agora.getFullYear()), String(agora.getFullYear() - 1)]
  const meses = [
    { v: '1', l: 'Janeiro' }, { v: '2', l: 'Fevereiro' }, { v: '3', l: 'Março' },
    { v: '4', l: 'Abril' },   { v: '5', l: 'Maio' },      { v: '6', l: 'Junho' },
    { v: '7', l: 'Julho' },   { v: '8', l: 'Agosto' },    { v: '9', l: 'Setembro' },
    { v: '10', l: 'Outubro' },{ v: '11', l: 'Novembro' },  { v: '12', l: 'Dezembro' },
  ]

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">DRE — Demonstrativo de Resultado</h2>
        <div className="flex gap-2">
          <select value={mes} onChange={e => setMes(e.target.value)}
            className="bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none">
            {meses.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
          </select>
          <select value={ano} onChange={e => setAno(e.target.value)}
            className="bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none">
            {anos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {isLoading && <p className="text-gray-500">Calculando...</p>}
      {isError   && <p className="text-red-400">Erro ao carregar dados.</p>}

      {data && (
        <>
          {/* KPIs rápidos */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-400 mb-1">Pedidos</p>
              <p className="text-2xl font-bold text-white">{data.totalPedidos}</p>
            </div>
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-400 mb-1">Ticket Médio</p>
              <p className="text-2xl font-bold text-orange-400">{fmt(data.ticketMedio)}</p>
            </div>
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-400 mb-1">Margem Líquida</p>
              <p className={`text-2xl font-bold ${Number(data.margemLiquida) >= 0 ? 'text-green-400' : 'text-red-400'}`}>{data.margemLiquida}%</p>
            </div>
          </div>

          {/* DRE */}
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 space-y-0 divide-y divide-gray-800/50">
            <div className="pb-2 text-xs text-gray-500 uppercase tracking-wide">Período: {data.periodo}</div>

            <Linha label="(+) Receita Bruta" valor={data.receitaBruta} />
            <Linha label="(−) Descontos concedidos" valor={data.descontos} negativo sub />
            <Linha label="(=) Receita Líquida" valor={data.receitaLiquida} />

            <div className="pt-1" />
            <Linha label="(−) CMV — Custo das Mercadorias" valor={data.cmv} negativo sub />
            <Linha label={`(=) Lucro Bruto  (margem ${data.margemBruta}%)`} valor={data.lucroBruto} destaque />

            <div className="pt-1" />
            <Linha label="(−) Sangrias / Despesas op." valor={data.sangrias} negativo sub />
            <Linha label={`(=) Resultado Líquido  (margem ${data.margemLiquida}%)`} valor={data.lucroLiquido} destaque />
          </div>

          {/* Faturamento por tipo */}
          {Object.keys(data.porTipo).length > 0 && (
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Faturamento por canal</h3>
              <div className="space-y-2">
                {Object.entries(data.porTipo).sort((a, b) => b[1] - a[1]).map(([tipo, val]) => {
                  const pct = data.receitaBruta > 0 ? (val / data.receitaBruta) * 100 : 0
                  return (
                    <div key={tipo}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-400 capitalize">{tipo}</span>
                        <span className="text-gray-300">{fmt(val)} ({pct.toFixed(0)}%)</span>
                      </div>
                      <div className="h-1.5 bg-gray-800 rounded-full">
                        <div className="h-1.5 bg-orange-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
