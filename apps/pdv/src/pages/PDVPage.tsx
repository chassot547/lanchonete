import { useState } from 'react'
import { supabase } from '../lib/supabase'
import GradeProdutos from '../components/pdv/GradeProdutos'
import Carrinho from '../components/pdv/Carrinho'
import SeletorTipo from '../components/pdv/SeletorTipo'
import NotificacaoPronto from '../components/pdv/NotificacaoPronto'
import BuscaCliente from '../components/pdv/BuscaCliente'
import FilaContas from '../components/pdv/FilaContas'
import ModalFecharContaMesa from '../components/pdv/ModalFecharContaMesa'
import { usePedidoPronto } from '../hooks/usePedidoPronto'
import type { ContaPendente } from '../hooks/usePedidoPronto'

export default function PDVPage() {
  const { pedidos, dispensar, contasPendentes, removerConta } = usePedidoPronto()
  const [contaAberta, setContaAberta] = useState<ContaPendente | null>(null)

  function abrirConta(conta: ContaPendente) {
    setContaAberta(conta)
  }

  function fecharModal() {
    setContaAberta(null)
  }

  function onPago(mesaId: string) {
    removerConta(mesaId)
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Notificações flutuantes */}
      <NotificacaoPronto
        pedidos={pedidos}
        onDispensар={dispensar}
        onAbrirConta={abrirConta}
      />

      {/* Modal fechar conta de mesa */}
      {contaAberta && (
        <ModalFecharContaMesa
          conta={contaAberta}
          onPago={onPago}
          onFechar={fecharModal}
        />
      )}

      {/* Conteúdo principal */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="flex items-center justify-between bg-gray-900 px-4 py-3 border-b border-gray-800">
          <h1 className="text-lg font-bold text-orange-400">🍔 PDV</h1>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-sm text-gray-400 hover:text-white"
          >
            Sair
          </button>
        </header>
        <main className="flex-1 overflow-y-auto">
          <GradeProdutos />
        </main>
      </div>

      {/* Carrinho + Fila de contas lateral */}
      <aside className="w-80 border-l border-gray-800 bg-gray-900 flex flex-col overflow-hidden">
        <SeletorTipo />
        <BuscaCliente />

        {/* Fila de contas pendentes */}
        <FilaContas contas={contasPendentes} onAbrirConta={abrirConta} />

        <div className="flex-1 overflow-hidden">
          <Carrinho />
        </div>
      </aside>
    </div>
  )
}
