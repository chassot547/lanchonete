// ── Enums ────────────────────────────────────────────────────────────────────

export type TipoPedido = 'balcao' | 'mesa' | 'delivery'

export type StatusPedido =
  | 'aberto'
  | 'em_producao'
  | 'pronto'
  | 'pago'
  | 'cancelado'

export type StatusItemKDS = 'aguardando' | 'em_producao' | 'pronto'

export type FormaPagamento =
  | 'dinheiro'
  | 'pix'
  | 'debito'
  | 'credito'
  | 'assinatura'
  | 'vale'

export type PerfilUsuario = 'admin' | 'gerente' | 'caixa' | 'cozinha' | 'entregador'

export type StatusMesa = 'livre' | 'ocupada' | 'reservada'

export type TipoMovimentacao = 'receita' | 'despesa' | 'sangria' | 'suprimento'

export type StatusAssinatura = 'ativa' | 'suspensa' | 'cancelada'

export type OrigemDelivery = 'proprio' | 'ifood' | 'rappi' | 'ubereats' | 'whatsapp'

export type UnidadeMedida = 'g' | 'kg' | 'ml' | 'L' | 'un' | 'cx'

// ── Entidades ────────────────────────────────────────────────────────────────

export interface Usuario {
  id: string
  nome: string
  email: string
  perfil: PerfilUsuario
  ativo: boolean
  criadoEm: string
}

export interface Categoria {
  id: string
  nome: string
  ordem: number
  ativo: boolean
}

export interface Ingrediente {
  id: string
  nome: string
  unidade: UnidadeMedida
  estoqueAtual: number
  estoqueMinimo: number
  custoUnit: number
}

export interface FichaTecnicaItem {
  ingredienteId: string
  ingredienteNome?: string
  quantidade: number
  unidade: UnidadeMedida
  custoParcial?: number
}

export interface Produto {
  id: string
  categoriaId: string
  categoriaNome?: string
  nome: string
  descricao?: string
  precoVenda: number
  custoTotal?: number
  tipo: 'simples' | 'combo' | 'variante'
  fichaTecnica?: FichaTecnicaItem[]
  imagemUrl?: string
  ativo: boolean
}

export interface Mesa {
  id: string
  numero: number
  status: StatusMesa
  capacidade: number
  qrCode: string
  pedidoAtivoId?: string
  tempoOcupada?: number
}

export interface ItemPedido {
  id: string
  pedidoId: string
  produtoId: string
  produtoNome?: string
  quantidade: number
  precoUnit: number
  subtotal: number
  observacao?: string
  statusKds: StatusItemKDS
}

export interface Pedido {
  id: string
  clienteId?: string
  mesaId?: string
  operadorId: string
  tipo: TipoPedido
  status: StatusPedido
  itens: ItemPedido[]
  subtotal: number
  desconto: number
  total: number
  criadoEm: string
  fechadoEm?: string
}

export interface Pagamento {
  id: string
  pedidoId: string
  forma: FormaPagamento
  valor: number
  troco?: number
  nfceChave?: string
  criadoEm: string
}

export interface Cliente {
  id: string
  nome: string
  telefone: string
  cpf?: string
  pontos: number
  endereco?: Endereco
  criadoEm: string
}

export interface Endereco {
  cep: string
  logradouro: string
  numero: string
  complemento?: string
  bairro: string
  cidade: string
  uf: string
}

export interface PlanoAssinatura {
  id: string
  nome: string
  descricao?: string
  valorMensal: number
  itens: { produtoId: string; produtoNome?: string; quantidade: number }[]
  ativo: boolean
}

export interface Assinatura {
  id: string
  clienteId: string
  planoId: string
  planoNome?: string
  status: StatusAssinatura
  saldoItens: Record<string, number>
  vencimento: string
  renovacaoAuto: boolean
  criadoEm: string
}

export interface EntradaEstoque {
  id: string
  ingredienteId: string
  fornecedorId?: string
  quantidade: number
  custoTotal: number
  notaXml?: string
  dataEntrada: string
}

export interface CaixaSessao {
  id: string
  operadorId: string
  abertura: string
  fechamento?: string
  saldoInicial: number
  saldoFinal?: number
  diferenca?: number
}

export interface MovimentacaoFinanceira {
  id: string
  caixaId: string
  tipo: TipoMovimentacao
  valor: number
  descricao: string
  data: string
}

export interface Promocao {
  id: string
  nome: string
  tipo: 'desconto_fixo' | 'desconto_pct' | 'combo'
  valor: number
  horarioInicio?: string
  horarioFim?: string
  diasSemana?: number[]
  ativo: boolean
}

export interface DeliveryInfo {
  id: string
  pedidoId: string
  clienteId: string
  enderecoEntrega: Endereco
  taxaEntrega: number
  status: 'confirmado' | 'em_preparo' | 'saiu' | 'entregue' | 'cancelado'
  origem: OrigemDelivery
  estimativaMin?: number
}

// ── DTOs / Payloads ──────────────────────────────────────────────────────────

export interface CriarPedidoDTO {
  tipo: TipoPedido
  mesaId?: string
  clienteId?: string
  itens: { produtoId: string; quantidade: number; observacao?: string }[]
}

export interface FinalizarPagamentoDTO {
  pedidoId: string
  forma: FormaPagamento
  valor: number
  troco?: number
  emitirNfce?: boolean
  cpfCliente?: string
}

export interface CriarProdutoDTO {
  categoriaId: string
  nome: string
  descricao?: string
  precoVenda: number
  tipo: 'simples' | 'combo' | 'variante'
  fichaTecnica?: { ingredienteId: string; quantidade: number; unidade: UnidadeMedida }[]
}

// ── KPIs / Relatórios ────────────────────────────────────────────────────────

export interface KPIsDia {
  faturamento: number
  totalPedidos: number
  ticketMedio: number
  cmvPercentual: number
  lucroBruto: number
  porFormaPagamento: Record<FormaPagamento, number>
  topProdutos: { produtoId: string; nome: string; quantidade: number; receita: number }[]
}
