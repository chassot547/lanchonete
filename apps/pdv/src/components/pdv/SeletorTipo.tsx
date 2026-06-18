import { useQuery } from '@tanstack/react-query'
import { usePedidoStore } from '../../store/pedido.store'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3010'
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

type Tipo = 'balcao' | 'mesa' | 'delivery'

const TIPOS: { key: Tipo; label: string; icone: string }[] = [
  { key: 'balcao',   label: 'Balcão',   icone: '🏪' },
  { key: 'mesa',     label: 'Mesa',     icone: '🪑' },
  { key: 'delivery', label: 'Delivery', icone: '🛵' },
]

export default function SeletorTipo() {
  const tipo   = usePedidoStore(s => s.tipo)
  const mesaId = usePedidoStore(s => s.mesaId)
  const setTipo = usePedidoStore(s => s.setTipo)
  const setMesa = usePedidoStore(s => s.setMesa)

  const { data: mesas = [] } = useQuery<Array<{ id: string; numero: number; status: string }>>({
    queryKey: ['mesas-pdv'],
    queryFn: () => fetch(`${API}/mesas`, { headers: headers() }).then(r => r.json()),
    enabled: tipo === 'mesa',
  })

  const mesasLivres = mesas.filter(m => m.status === 'livre')
  const mesaSel = mesas.find(m => m.id === mesaId)

  return (
    <div className="px-4 pt-3 pb-2 border-b border-gray-800 space-y-2">
      {/* Tipo */}
      <div className="flex gap-2">
        {TIPOS.map(t => (
          <button
            key={t.key}
            onClick={() => { setTipo(t.key as any); if (t.key !== 'mesa') usePedidoStore.setState({ mesaId: undefined }) }}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition border ${
              tipo === t.key
                ? 'bg-orange-500 border-orange-500 text-white'
                : 'border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300'
            }`}
          >
            {t.icone} {t.label}
          </button>
        ))}
      </div>

      {/* Seletor de mesa */}
      {tipo === 'mesa' && (
        <div>
          <div className="flex flex-wrap gap-1.5">
            {mesasLivres.length === 0 && (
              <span className="text-xs text-gray-500">Nenhuma mesa livre</span>
            )}
            {mesasLivres.map(m => (
              <button
                key={m.id}
                onClick={() => setMesa(m.id)}
                className={`w-10 h-10 rounded-lg text-xs font-bold border transition ${
                  mesaId === m.id
                    ? 'bg-orange-500 border-orange-500 text-white'
                    : 'border-gray-700 text-gray-400 hover:border-orange-400 hover:text-white'
                }`}
              >
                {m.numero}
              </button>
            ))}
          </div>
          {mesaSel && (
            <p className="text-xs text-orange-400 mt-1">Mesa {mesaSel.numero} selecionada</p>
          )}
        </div>
      )}
    </div>
  )
}
