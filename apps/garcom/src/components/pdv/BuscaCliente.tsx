import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { usePedidoStore } from '../../store/pedido.store'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3010'
const h   = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

interface Cliente { id: string; nome: string; telefone: string; cpf?: string; pontos: number }

export default function BuscaCliente() {
  const [busca, setBusca]   = useState('')
  const [aberto, setAberto] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const clienteId   = usePedidoStore(s => s.clienteId)
  const clienteNome = usePedidoStore(s => s.clienteNome)
  const setCliente  = usePedidoStore(s => s.setCliente)

  const { data: clientes = [] } = useQuery<Cliente[]>({
    queryKey: ['clientes-busca', busca],
    queryFn: () => fetch(`${API}/clientes?q=${encodeURIComponent(busca)}`, { headers: h() }).then(r => r.json()),
    enabled: busca.length >= 2,
  })

  function selecionar(c: Cliente) {
    setCliente(c.id, c.nome)
    setBusca('')
    setAberto(false)
  }

  function limpar() {
    setCliente(undefined, undefined)
    setBusca('')
  }

  return (
    <div className="px-4 py-2 border-b border-gray-800 relative">
      {clienteId ? (
        <div className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2">
          <div>
            <p className="text-xs text-gray-400">Cliente</p>
            <p className="text-sm font-semibold text-white">{clienteNome}</p>
          </div>
          <button onClick={limpar} className="text-gray-500 hover:text-red-400 text-lg leading-none">×</button>
        </div>
      ) : (
        <div className="relative">
          <input
            ref={inputRef}
            value={busca}
            onChange={e => { setBusca(e.target.value); setAberto(true) }}
            onFocus={() => setAberto(true)}
            placeholder="👤 Identificar cliente (opcional)"
            className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-gray-600 outline-none focus:ring-1 focus:ring-orange-500"
          />
          {aberto && clientes.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-40 max-h-48 overflow-y-auto">
              {clientes.map(c => (
                <button
                  key={c.id}
                  onClick={() => selecionar(c)}
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-700 transition border-b border-gray-700 last:border-0"
                >
                  <p className="text-sm font-medium text-white">{c.nome}</p>
                  <p className="text-xs text-gray-400">{c.telefone} {c.pontos > 0 ? `· ⭐ ${c.pontos} pts` : ''}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
