import { usePedidoPronto } from '../../hooks/usePedidoPronto'

export default function NotificacaoPronto() {
  const { pedidos, dispensar } = usePedidoPronto()

  if (pedidos.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-xs w-full">
      {pedidos.map(p => (
        <div
          key={p.id}
          className="bg-green-600 border border-green-400 rounded-2xl px-4 py-3 shadow-2xl flex items-center gap-3 animate-bounce"
          style={{ animationIterationCount: 3 }}
        >
          <span className="text-2xl">✅</span>
          <div className="flex-1">
            <p className="text-white font-bold text-sm">Pedido Pronto!</p>
            <p className="text-green-200 text-xs">
              {p.tipo === 'mesa' ? `Mesa ${p.mesaNumero}` :
               p.tipo === 'delivery' ? '🛵 Delivery' : '🏪 Balcão'}
              {' '}— #{p.id.slice(-6).toUpperCase()}
            </p>
          </div>
          <button
            onClick={() => dispensar(p.id)}
            className="text-green-200 hover:text-white text-xl leading-none"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
