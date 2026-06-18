import type { PedidoPronto, ContaPendente } from '../../hooks/usePedidoPronto'

interface Props {
  pedidos: PedidoPronto[]
  onDispensар: (id: string) => void
  onAbrirConta: (conta: ContaPendente) => void
}

export default function NotificacaoPronto({ pedidos, onDispensар: dispensar, onAbrirConta }: Props) {
  if (pedidos.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-xs w-full">
      {pedidos.map(p => (
        <div
          key={p.id}
          className={`border rounded-2xl px-4 py-3 shadow-2xl flex items-center gap-3 animate-bounce ${
            p.isConta ? 'bg-orange-500 border-orange-400' : 'bg-green-600 border-green-400'
          }`}
          style={{ animationIterationCount: 3 }}
        >
          <span className="text-2xl">{p.isConta ? '🧾' : '✅'}</span>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm">
              {p.isConta ? 'Conta Solicitada!' : 'Pedido Pronto!'}
            </p>
            <p className={`text-xs truncate ${p.isConta ? 'text-orange-100' : 'text-green-200'}`}>
              {p.tipo === 'mesa' ? `Mesa ${p.mesaNumero}` :
               p.tipo === 'delivery' ? '🛵 Delivery' : '🏪 Balcão'}
              {!p.isConta && ` — #${p.id.slice(-6).toUpperCase()}`}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {p.isConta && p.mesaId && (
              <button
                onClick={() => onAbrirConta({
                  id: p.mesaId!,
                  mesaId: p.mesaId!,
                  mesaNumero: p.mesaNumero!,
                  pedidoId: p.pedidoId,
                  total: p.total,
                  hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                })}
                className="bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-2 py-1 rounded-lg transition"
              >
                Fechar →
              </button>
            )}
            <button
              onClick={() => dispensar(p.id)}
              className="text-white/70 hover:text-white text-xl leading-none ml-1"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
