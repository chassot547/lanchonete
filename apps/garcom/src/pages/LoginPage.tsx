import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const [email, setEmail]     = useState('')
  const [senha, setSenha]     = useState('')
  const [erro, setErro]       = useState('')
  const [loading, setLoading] = useState(false)

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setErro('')
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) setErro('Email ou senha incorretos')
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="text-5xl mb-3">🍽️</div>
          <h1 className="text-2xl font-bold text-white">App do Garçom</h1>
          <p className="text-slate-400 text-sm mt-1">Acesse com suas credenciais</p>
        </div>
        <form onSubmit={entrar} className="space-y-3">
          <input type="email" placeholder="Email" value={email}
            onChange={e => setEmail(e.target.value)} required
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500" />
          <input type="password" placeholder="Senha" value={senha}
            onChange={e => setSenha(e.target.value)} required
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500" />
          {erro && <p className="text-red-400 text-xs text-center">{erro}</p>}
          <button type="submit" disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition disabled:opacity-50">
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
