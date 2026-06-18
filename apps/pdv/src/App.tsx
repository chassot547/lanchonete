import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import PDVPage from './pages/PDVPage'
import LoginPage from './pages/LoginPage'

export default function App() {
  const [session, setSession] = useState<boolean | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(!!data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      setSession(!!s)
      if (s?.access_token) localStorage.setItem('token', s.access_token)
      else localStorage.removeItem('token')
    })
    return () => subscription.unsubscribe()
  }, [])

  if (session === null) return (
    <div className="flex h-screen items-center justify-center">
      <span className="text-gray-400">Carregando...</span>
    </div>
  )

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={session ? <Navigate to="/" /> : <LoginPage />} />
        <Route path="/*" element={session ? <PDVPage /> : <Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  )
}
