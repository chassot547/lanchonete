import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../lib/api'

interface Usuario {
  id: string
  nome: string
  email: string
  perfil: string
  ativo: boolean
  criado_em: string
}

const PERFIS = ['admin', 'gerente', 'caixa', 'cozinha', 'entregador']
const COR_PERFIL: Record<string, string> = {
  admin:      'bg-red-900/40 text-red-300',
  gerente:    'bg-purple-900/40 text-purple-300',
  caixa:      'bg-blue-900/40 text-blue-300',
  cozinha:    'bg-orange-900/40 text-orange-300',
  entregador: 'bg-green-900/40 text-green-300',
}

const VAZIO = { nome: '', email: '', senha: '', perfil: 'caixa' }

export default function Usuarios() {
  const qc = useQueryClient()
  const [modal, setModal] = useState<Partial<Usuario & { senha: string }> | null>(null)
  const [isNovo, setIsNovo] = useState(false)

  const { data: usuarios = [], isLoading } = useQuery<Usuario[]>({
    queryKey: ['usuarios'],
    queryFn: () => api.get('/usuarios'),
  })

  const salvar = useMutation({
    mutationFn: (u: any) =>
      u.id ? api.patch(`/usuarios/${u.id}`, { nome: u.nome, perfil: u.perfil, ativo: u.ativo })
            : api.post('/usuarios', { nome: u.nome, email: u.email, senha: u.senha, perfil: u.perfil }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['usuarios'] }); setModal(null) },
  })

  const desativar = useMutation({
    mutationFn: (id: string) => api.delete(`/usuarios/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
  })

  if (isLoading) return <p className="text-gray-500">Carregando usuários...</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Usuários</h2>
        <button
          onClick={() => { setModal({ ...VAZIO }); setIsNovo(true) }}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold rounded-lg transition"
        >
          + Novo usuário
        </button>
      </div>

      <div className="overflow-auto rounded-xl border border-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-900 text-gray-400">
            <tr>
              <th className="text-left px-4 py-3">Nome</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-center px-4 py-3">Perfil</th>
              <th className="text-center px-4 py-3">Status</th>
              <th className="text-center px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {usuarios.map(u => (
              <tr key={u.id} className={`hover:bg-gray-900/50 ${!u.ativo ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3 font-medium">{u.nome}</td>
                <td className="px-4 py-3 text-gray-400">{u.email}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs px-3 py-1 rounded-full capitalize ${COR_PERFIL[u.perfil] ?? 'bg-gray-800 text-gray-400'}`}>
                    {u.perfil}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs ${u.ativo ? 'text-green-400' : 'text-gray-600'}`}>
                    {u.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-4 py-3 text-center flex gap-2 justify-center">
                  <button
                    onClick={() => { setModal(u); setIsNovo(false) }}
                    className="text-xs text-orange-400 hover:text-orange-300"
                  >
                    Editar
                  </button>
                  {u.ativo && (
                    <button
                      onClick={() => { if (confirm(`Desativar ${u.nome}?`)) desativar.mutate(u.id) }}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Desativar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-gray-700 space-y-4">
            <h3 className="text-lg font-bold">{isNovo ? 'Novo Usuário' : 'Editar Usuário'}</h3>

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

              {isNovo && (
                <>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Email *</label>
                    <input
                      type="email"
                      value={modal.email ?? ''}
                      onChange={e => setModal(m => ({ ...m!, email: e.target.value }))}
                      className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Senha *</label>
                    <input
                      type="password"
                      value={(modal as any).senha ?? ''}
                      onChange={e => setModal(m => ({ ...m!, senha: e.target.value } as any))}
                      className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="text-xs text-gray-400 block mb-1">Perfil *</label>
                <select
                  value={modal.perfil ?? 'caixa'}
                  onChange={e => setModal(m => ({ ...m!, perfil: e.target.value }))}
                  className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none"
                >
                  {PERFIS.map(p => (
                    <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                  ))}
                </select>
              </div>

              {!isNovo && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={modal.ativo ?? true}
                    onChange={e => setModal(m => ({ ...m!, ativo: e.target.checked }))}
                    className="accent-orange-500"
                  />
                  <span className="text-sm text-gray-300">Usuário ativo</span>
                </label>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(null)} className="flex-1 py-2 text-sm text-gray-400 hover:text-white">
                Cancelar
              </button>
              <button
                onClick={() => salvar.mutate(modal)}
                disabled={salvar.isPending || !modal.nome}
                className="flex-1 py-2 bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50"
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
