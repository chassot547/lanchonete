import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../lib/api'

interface Cliente {
  id: string
  nome: string
  telefone: string
  cpf?: string
  pontos: number
  criado_em: string
}

interface PedidoHistorico {
  id: string
  tipo: string
  status: string
  total: number
  criado_em: string
}

const VAZIO: Partial<Cliente> = { nome: '', telefone: '', cpf: '' }

function fmtData(s: string) {
  return new Date(s).toLocaleDateString('pt-BR')
}
function fmtHora(s: string) {
  return new Date(s).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function Clientes() {
  const qc = useQueryClient()
  const [busca, setBusca] = useState('')
  const [modal, setModal] = useState<Partial<Cliente> | null>(null)
  const [historicoCli, setHistoricoCli] = useState<Cliente | null>(null)

  const { data: historico = [] } = useQuery<PedidoHistorico[]>({
    queryKey: ['cliente-historico', historicoCli?.id],
    queryFn:  () => api.get(`/clientes/${historicoCli!.id}/historico`),
    enabled:  !!historicoCli,
  })

  const { data: clientes = [], isLoading } = useQuery<Cliente[]>({
    queryKey: ['clientes'],
    queryFn: () => api.get('/clientes'),
  })

  const salvar = useMutation({
    mutationFn: (c: Partial<Cliente>) =>
      c.id
        ? api.patch(`/clientes/${c.id}`, { nome: c.nome, telefone: c.telefone, cpf: c.cpf })
        : api.post('/clientes', { nome: c.nome, telefone: c.telefone, cpf: c.cpf }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clientes'] }); setModal(null) },
  })

  const excluir = useMutation({
    mutationFn: (id: string) => api.delete(`/clientes/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clientes'] }); setModal(null) },
  })

  const filtrados = clientes.filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase()) ||
    c.telefone.includes(busca) ||
    (c.cpf ?? '').includes(busca)
  )

  if (isLoading) return <p className="text-gray-500">Carregando clientes...</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Clientes</h2>
        <div className="flex gap-2">
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Nome, telefone ou CPF..."
            className="bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none w-56"
          />
          <button
            onClick={() => setModal({ ...VAZIO })}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold rounded-lg transition"
          >
            + Novo
          </button>
        </div>
      </div>

      <div className="overflow-auto rounded-xl border border-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-900 text-gray-400">
            <tr>
              <th className="text-left px-4 py-3">Nome</th>
              <th className="text-left px-4 py-3">Telefone</th>
              <th className="text-left px-4 py-3">CPF</th>
              <th className="text-right px-4 py-3">Pontos</th>
              <th className="text-left px-4 py-3">Cadastro</th>
              <th className="text-center px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {filtrados.map(c => (
              <tr key={c.id} className="hover:bg-gray-900/50">
                <td className="px-4 py-3 font-medium">{c.nome}</td>
                <td className="px-4 py-3 text-gray-400">{c.telefone}</td>
                <td className="px-4 py-3 text-gray-400">{c.cpf ?? '—'}</td>
                <td className="px-4 py-3 text-right text-orange-400">{c.pontos}</td>
                <td className="px-4 py-3 text-gray-500">{fmtData(c.criado_em)}</td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => setHistoricoCli(c)}
                    className="text-xs text-blue-400 hover:text-blue-300 px-2"
                  >
                    Histórico
                  </button>
                  <button
                    onClick={() => setModal(c)}
                    className="text-xs text-orange-400 hover:text-orange-300 px-2"
                  >
                    Editar
                  </button>
                </td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-600">Nenhum cliente encontrado</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal histórico do cliente */}
      {historicoCli && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-lg border border-gray-700 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">{historicoCli.nome}</h3>
                <p className="text-xs text-gray-400">{historicoCli.telefone} · {historicoCli.pontos} pontos</p>
              </div>
              <button onClick={() => setHistoricoCli(null)} className="text-gray-500 hover:text-white text-xl">×</button>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {historico.length === 0 && <p className="text-gray-500 text-sm text-center py-6">Nenhum pedido encontrado.</p>}
              {historico.map(p => (
                <div key={p.id} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2 text-sm">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-xs">{fmtData(p.criado_em)} {fmtHora(p.criado_em)}</span>
                      <span className="text-xs capitalize text-gray-500">{p.tipo}</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${p.status === 'pago' ? 'bg-green-900/40 text-green-300' : p.status === 'cancelado' ? 'bg-red-900/40 text-red-300' : 'bg-gray-700 text-gray-400'}`}>
                      {p.status}
                    </span>
                  </div>
                  <span className="font-bold text-green-400">{fmt(Number(p.total))}</span>
                </div>
              ))}
            </div>
            {historico.length > 0 && (
              <div className="flex justify-between text-sm border-t border-gray-700 pt-3 text-gray-400">
                <span>{historico.length} pedidos</span>
                <span className="font-bold text-white">{fmt(historico.reduce((s, p) => s + Number(p.total), 0))}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-gray-700 space-y-4">
            <h3 className="text-lg font-bold">{modal.id ? 'Editar Cliente' : 'Novo Cliente'}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Nome *</label>
                <input
                  value={modal.nome ?? ''}
                  onChange={e => setModal(m => ({ ...m!, nome: e.target.value }))}
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-500"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Telefone</label>
                  <input
                    value={modal.telefone ?? ''}
                    onChange={e => setModal(m => ({ ...m!, telefone: e.target.value }))}
                    placeholder="(00) 00000-0000"
                    className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">CPF</label>
                  <input
                    value={modal.cpf ?? ''}
                    onChange={e => setModal(m => ({ ...m!, cpf: e.target.value }))}
                    placeholder="000.000.000-00"
                    className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              {modal.id && (
                <button
                  onClick={() => { if (confirm('Excluir cliente?')) excluir.mutate(modal.id!) }}
                  className="px-4 py-2 text-sm text-red-400 hover:text-red-300 transition"
                >
                  Excluir
                </button>
              )}
              <div className="flex-1" />
              <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">
                Cancelar
              </button>
              <button
                onClick={() => salvar.mutate(modal)}
                disabled={salvar.isPending || !modal.nome || !modal.telefone}
                className="px-5 py-2 bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50"
              >
                {salvar.isPending ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
