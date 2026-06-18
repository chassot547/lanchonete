import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErro('')
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) setErro(error.message)
    setLoading(false)
  }

  return (
    <div className="flex h-screen items-center justify-center bg-gray-950">
      <form onSubmit={entrar} className="bg-gray-900 rounded-2xl p-8 w-80 space-y-4 shadow-xl">
        <h1 className="text-2xl font-bold text-orange-400 text-center">Painel Gerencial</h1>
        <p className="text-gray-400 text-sm text-center">Lanchonete</p>
        {erro && <p className="text-red-400 text-sm">{erro}</p>}
        <input
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full rounded-lg bg-gray-800 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-500"
          required
        />
        <input
          type="password"
          placeholder="Senha"
          value={senha}
          onChange={e => setSenha(e.target.value)}
          className="w-full rounded-lg bg-gray-800 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-500"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-orange-500 py-3 font-semibold hover:bg-orange-400 disabled:opacity-50 transition"
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
