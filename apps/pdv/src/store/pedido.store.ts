import { create } from 'zustand'

type TipoPedido = 'balcao' | 'mesa' | 'delivery'
interface Produto { id: string; nome: string; precoVenda: number; [key: string]: unknown }
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type ItemPedido = unknown

interface CarrinhoItem {
  produto: Produto
  quantidade: number
  observacao?: string
}

interface PedidoStore {
  tipo: TipoPedido
  mesaId?: string
  clienteId?: string
  clienteNome?: string
  itens: CarrinhoItem[]
  desconto: number

  setTipo: (tipo: TipoPedido) => void
  setMesa: (mesaId: string) => void
  setCliente: (clienteId?: string, clienteNome?: string) => void
  adicionarItem: (produto: Produto, quantidade?: number, observacao?: string) => void
  removerItem: (produtoId: string) => void
  alterarQuantidade: (produtoId: string, quantidade: number) => void
  setDesconto: (valor: number) => void
  limpar: () => void

  // Computed
  subtotal: () => number
  total: () => number
  totalItens: () => number
}

export const usePedidoStore = create<PedidoStore>((set, get) => ({
  tipo:      'balcao',
  itens:     [],
  desconto:  0,

  setTipo:    (tipo)     => set({ tipo }),
  setMesa:    (mesaId)   => set({ mesaId, tipo: 'mesa' }),
  setCliente: (clienteId, clienteNome) => set({ clienteId, clienteNome }),
  setDesconto: (desconto) => set({ desconto }),

  adicionarItem: (produto, quantidade = 1, observacao) => set(state => {
    const existente = state.itens.find(i => i.produto.id === produto.id)
    if (existente) {
      return {
        itens: state.itens.map(i =>
          i.produto.id === produto.id
            ? { ...i, quantidade: i.quantidade + quantidade }
            : i
        ),
      }
    }
    return { itens: [...state.itens, { produto, quantidade, observacao }] }
  }),

  removerItem: (produtoId) => set(state => ({
    itens: state.itens.filter(i => i.produto.id !== produtoId),
  })),

  alterarQuantidade: (produtoId, quantidade) => set(state => ({
    itens: quantidade <= 0
      ? state.itens.filter(i => i.produto.id !== produtoId)
      : state.itens.map(i =>
          i.produto.id === produtoId ? { ...i, quantidade } : i
        ),
  })),

  limpar: () => set({ itens: [], desconto: 0, mesaId: undefined, clienteId: undefined, clienteNome: undefined, tipo: 'balcao' }),

  subtotal: () => get().itens.reduce((s, i) => s + i.produto.precoVenda * i.quantidade, 0),
  total:    () => get().subtotal() - get().desconto,
  totalItens: () => get().itens.reduce((s, i) => s + i.quantidade, 0),
}))
