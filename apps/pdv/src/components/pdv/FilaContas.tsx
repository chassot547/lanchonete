import type { ContaPendente } from '../../hooks/usePedidoPronto'

interface Props {
  contas: ContaPendente[]
  onAbrirConta: (conta: ContaPendente) => void
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function FilaContas({ contas, onAbrirConta }: Props) {
  if (contas.length === 0) return null

  return (
    <div className="border-b border-gray-800 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-orange-400 uppercase tracking-wide">🧾 Contas Solicitadas</span>
        <span className="bg-orange-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full animate-pulse">
          {contas.length}
        </span>
      </div>
      <div className="space-y-1.5">
        {contas.map(c => (
          <button
            key={c.id}
            onClick={() => onAbrirConta(c)}
            className="w-full flex items-center justify-between bg-orange-950/40 hover:bg-orange-900/50 border border-orange-800 rounded-xl px-3 py-2 transition active:scale-95"
          >
            <div className="text-left">
              <p className="text-sm font-bold text-orange-300">Mesa {c.mesaNumero}</p>
              <p className="text-xs text-gray-500">solicitado às {c.hora}</p>
            </div>
            <div className="text-right">
              {c.total ? (
                <p className="text-sm font-bold text-white">{fmt(Number(c.total))}</p>
              ) : null}
              <p className="text-xs text-orange-400 font-semibold">Fechar →</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
