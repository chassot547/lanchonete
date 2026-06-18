import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, useParams, Link } from 'react-router-dom'
import FilaKDS from './components/FilaKDS'

function KDSPage() {
  const { estacao } = useParams<{ estacao?: string }>()
  const est = (estacao === 'bar' ? 'bar' : estacao === 'cozinha' ? 'cozinha' : undefined)

  const [hora, setHora] = useState('')
  useEffect(() => {
    const tick = () => setHora(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
    tick()
    const id = setInterval(tick, 10_000)
    return () => clearInterval(id)
  }, [])

  const titulo = est === 'bar' ? '🍺 Bar — KDS' : est === 'cozinha' ? '🍳 Cozinha — KDS' : '📋 Todas as Estações'

  return (
    <div className="min-h-screen bg-gray-950 p-4">
      <header className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">{titulo}</h1>
        <nav className="flex gap-2">
          <Link to="/cozinha" className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${est==='cozinha' ? 'bg-orange-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            🍳 Cozinha
          </Link>
          <Link to="/bar" className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${est==='bar' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            🍺 Bar
          </Link>
          <Link to="/" className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${!est ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            📋 Todas
          </Link>
        </nav>
        <span className="text-gray-400 text-sm tabular-nums">{hora}</span>
      </header>
      <FilaKDS estacao={est} />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/:estacao" element={<KDSPage />} />
        <Route path="/" element={<KDSPage />} />
      </Routes>
    </BrowserRouter>
  )
}
