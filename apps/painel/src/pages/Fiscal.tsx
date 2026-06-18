import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../lib/api'

interface Nota {
  id: string
  pedido_id: string
  tipo: string
  chave_acesso?: string
  status_sefaz: string
  danfe_url?: string
  emitida_em: string
  pedidos?: { tipo: string; total: number }
}

const COR_STATUS: Record<string, string> = {
  autorizada: 'bg-green-900/40 text-green-300',
  pendente:   'bg-yellow-900/40 text-yellow-300',
  cancelada:  'bg-red-900/40 text-red-300',
  rejeitada:  'bg-red-900/40 text-red-400',
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDt(s: string) {
  return new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function Fiscal() {
  const hoje = new Date().toISOString().split('T')[0]
  const [ini, setIni] = useState(hoje)
  const [fim, setFim] = useState(hoje)

  const { data: notas = [], isLoading, refetch } = useQuery<Nota[]>({
    queryKey: ['notas-fiscais', ini, fim],
    queryFn: () => api.get(`/fiscal/notas?ini=${ini}&fim=${fim}`),
  })

  const totAutorizadas = notas.filter(n => n.status_sefaz === 'autorizada').length
  const totPendentes   = notas.filter(n => n.status_sefaz === 'pendente').length
  const totCanceladas  = notas.filter(n => n.status_sefaz === 'cancelada').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold">NFC-e / Notas Fiscais</h2>
        <div className="flex items-center gap-2 text-sm">
          <input type="date" value={ini} onChange={e => setIni(e.target.value)}
            className="bg-gray-800 rounded-lg px-3 py-2 outline-none" />
          <span className="text-gray-500">até</span>
          <input type="date" value={fim} onChange={e => setFim(e.target.value)}
            className="bg-gray-800 rounded-lg px-3 py-2 outline-none" />
        </div>
      </div>

      {/* Aviso de configuração */}
      <div className="bg-yellow-900/20 border border-yellow-700 rounded-xl p-4 text-sm text-yellow-300">
        <p className="font-semibold mb-1">⚙️ Configuração necessária para emitir NFC-e</p>
        <p className="text-yellow-400/80">Preencha no arquivo <code className="bg-black/30 px-1 rounded">.env</code> da API:</p>
        <ul className="mt-2 space-y-0.5 text-yellow-400/70 text-xs font-mono">
          <li>FOCUSNFE_TOKEN= <span className="text-gray-500"># Token da conta Focus NFe</span></li>
          <li>EMPRESA_CNPJ= <span className="text-gray-500"># CNPJ sem pontuação</span></li>
          <li>EMPRESA_IE= <span className="text-gray-500"># Inscrição Estadual</span></li>
          <li>EMPRESA_NOME= <span className="text-gray-500"># Razão Social</span></li>
          <li>EMPRESA_UF= <span className="text-gray-500"># SP, PR, etc.</span></li>
          <li>EMPRESA_COD_MUNICIPIO= <span className="text-gray-500"># Código IBGE do município</span></li>
        </ul>
        <p className="mt-2 text-yellow-400/60 text-xs">
          Cadastre-se em <span className="underline">focusnfe.com.br</span> — plano gratuito para testes (homologação).
          Para produção, configure também o certificado digital A1 (.pfx).
        </p>
      </div>

      {/* Contadores */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <p className="text-xs text-gray-400">Autorizadas</p>
          <p className="text-2xl font-bold text-green-400 mt-1">{totAutorizadas}</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <p className="text-xs text-gray-400">Pendentes</p>
          <p className="text-2xl font-bold text-yellow-400 mt-1">{totPendentes}</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <p className="text-xs text-gray-400">Canceladas</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{totCanceladas}</p>
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <p className="text-gray-500">Carregando...</p>
      ) : (
        <div className="overflow-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-gray-400">
              <tr>
                <th className="text-left px-4 py-3">Emissão</th>
                <th className="text-left px-4 py-3">Pedido</th>
                <th className="text-left px-4 py-3">Chave de Acesso</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-center px-4 py-3">Status</th>
                <th className="text-center px-4 py-3">DANFE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {notas.map(n => (
                <tr key={n.id} className="hover:bg-gray-900/50">
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{fmtDt(n.emitida_em)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    {n.pedido_id.slice(-8).toUpperCase()}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 max-w-[200px] truncate">
                    {n.chave_acesso ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-green-400">
                    {n.pedidos?.total ? fmt(Number(n.pedidos.total)) : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-3 py-1 rounded-full capitalize ${COR_STATUS[n.status_sefaz] ?? 'bg-gray-800 text-gray-400'}`}>
                      {n.status_sefaz}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {n.danfe_url ? (
                      <a href={n.danfe_url} target="_blank" rel="noreferrer"
                        className="text-xs text-orange-400 hover:text-orange-300 underline">
                        Ver
                      </a>
                    ) : '—'}
                  </td>
                </tr>
              ))}
              {notas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-600">
                    Nenhuma nota emitida no período
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
