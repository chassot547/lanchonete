import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

interface Fornecedor {
  id: string; nome: string; cnpj?: string; email?: string; telefone?: string
  contato?: string; endereco?: string; cidade?: string; estado?: string; ativo: boolean
}

const VAZIO: Partial<Fornecedor> = { nome: '', ativo: true }
const ESTADOS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

function maskCNPJ(v: string) {
  return v.replace(/\D/g,'').slice(0,14)
    .replace(/(\d{2})(\d)/,'$1.$2')
    .replace(/(\d{3})(\d)/,'$1.$2')
    .replace(/(\d{3})(\d)/,'$1/$2')
    .replace(/(\d{4})(\d)/,'$1-$2')
}

export default function Fornecedores() {
  const qc = useQueryClient()
  const [busca, setBusca] = useState('')
  const [modal, setModal] = useState<Partial<Fornecedor> | null>(null)

  const { data: fornecedores = [], isLoading } = useQuery<Fornecedor[]>({
    queryKey: ['fornecedores'],
    queryFn: () => api.get('/fornecedores'),
    staleTime: 0,
  })

  const salvar = useMutation({
    mutationFn: (f: Partial<Fornecedor>) =>
      f.id ? api.patch(`/fornecedores/${f.id}`, f) : api.post('/fornecedores', f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fornecedores'] }); setModal(null) },
  })

  const excluir = useMutation({
    mutationFn: (id: string) => api.delete(`/fornecedores/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fornecedores'] }); setModal(null) },
  })

  const toggle = useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) =>
      api.patch(`/fornecedores/${id}`, { ativo }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fornecedores'] }),
  })

  const filtrados = fornecedores.filter(f =>
    f.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (f.cnpj ?? '').includes(busca)
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Fornecedores</h2>
        <div className="flex gap-2">
          <input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar nome ou CNPJ..."
            className="bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none w-52" />
          <button onClick={() => setModal({ ...VAZIO })}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold rounded-lg transition">
            + Novo
          </button>
        </div>
      </div>

      {isLoading ? <p className="text-gray-500">Carregando...</p> : (
        <div className="overflow-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-gray-400">
              <tr>
                <th className="text-left px-4 py-3">Fornecedor</th>
                <th className="text-left px-4 py-3">CNPJ</th>
                <th className="text-left px-4 py-3">Contato</th>
                <th className="text-left px-4 py-3">Telefone</th>
                <th className="text-left px-4 py-3">Cidade/UF</th>
                <th className="text-center px-4 py-3">Status</th>
                <th className="text-center px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtrados.map(f => (
                <tr key={f.id} className="hover:bg-gray-900/50">
                  <td className="px-4 py-3 font-medium">{f.nome}</td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{f.cnpj ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-400">{f.contato ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-400">{f.telefone ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-400">{[f.cidade, f.estado].filter(Boolean).join('/') || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => toggle.mutate({ id: f.id, ativo: !f.ativo })}
                      className={`text-xs px-3 py-1 rounded-full ${f.ativo ? 'bg-green-900 text-green-300' : 'bg-gray-800 text-gray-500'}`}>
                      {f.ativo ? 'Ativo' : 'Inativo'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => setModal(f)}
                      className="text-xs text-orange-400 hover:text-orange-300">Editar</button>
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-600">Nenhum fornecedor cadastrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-lg border border-gray-700 space-y-4">
            <h3 className="text-lg font-bold">{modal.id ? 'Editar Fornecedor' : 'Novo Fornecedor'}</h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-gray-400 block mb-1">Razão Social / Nome *</label>
                <input value={modal.nome ?? ''} onChange={e => setModal(m => ({ ...m!, nome: e.target.value }))}
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">CNPJ</label>
                <input value={modal.cnpj ?? ''} placeholder="00.000.000/0001-00"
                  onChange={e => setModal(m => ({ ...m!, cnpj: maskCNPJ(e.target.value) }))}
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none font-mono focus:ring-1 focus:ring-orange-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Telefone</label>
                <input value={modal.telefone ?? ''} onChange={e => setModal(m => ({ ...m!, telefone: e.target.value }))}
                  placeholder="(00) 00000-0000"
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">E-mail</label>
                <input type="email" value={modal.email ?? ''} onChange={e => setModal(m => ({ ...m!, email: e.target.value }))}
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Nome do Contato</label>
                <input value={modal.contato ?? ''} onChange={e => setModal(m => ({ ...m!, contato: e.target.value }))}
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-500" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-400 block mb-1">Endereço</label>
                <input value={modal.endereco ?? ''} onChange={e => setModal(m => ({ ...m!, endereco: e.target.value }))}
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Cidade</label>
                <input value={modal.cidade ?? ''} onChange={e => setModal(m => ({ ...m!, cidade: e.target.value }))}
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Estado</label>
                <select value={modal.estado ?? ''} onChange={e => setModal(m => ({ ...m!, estado: e.target.value }))}
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none">
                  <option value="">UF</option>
                  {ESTADOS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              {modal.id && (
                <button onClick={() => { if (confirm('Excluir fornecedor?')) excluir.mutate(modal.id!) }}
                  className="px-4 py-2 text-sm text-red-400 hover:text-red-300">Excluir</button>
              )}
              <div className="flex-1" />
              <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancelar</button>
              <button onClick={() => salvar.mutate(modal)} disabled={salvar.isPending || !modal.nome}
                className="px-5 py-2 bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold rounded-lg disabled:opacity-50">
                {salvar.isPending ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
