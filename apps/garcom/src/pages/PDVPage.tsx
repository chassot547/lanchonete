import { supabase } from '../lib/supabase'
import GradeProdutos from '../components/pdv/GradeProdutos'
import Carrinho from '../components/pdv/Carrinho'
import SeletorTipo from '../components/pdv/SeletorTipo'
import NotificacaoPronto from '../components/pdv/NotificacaoPronto'
import BuscaCliente from '../components/pdv/BuscaCliente'

export default function PDVPage() {
  return (
    <div className="flex h-screen overflow-hidden">
      <NotificacaoPronto />
      {/* Header */}
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

      {/* Carrinho lateral */}
      <aside className="w-80 border-l border-gray-800 bg-gray-900 flex flex-col">
        <SeletorTipo />
        <BuscaCliente />
        <div className="flex-1 overflow-hidden">
          <Carrinho />
        </div>
      </aside>
    </div>
  )
}
