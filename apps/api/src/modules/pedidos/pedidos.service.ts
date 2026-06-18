import { supabase } from '../../lib/supabase'
import { broadcast } from '../../lib/websocket'
import type { CriarPedidoDTO, FinalizarPagamentoDTO, Pedido } from '@lanchonete/types'

export async function criarPedido(dto: CriarPedidoDTO, operadorId: string): Promise<Pedido> {
  const { data: pedido, error } = await supabase
    .from('pedidos')
    .insert({
      tipo:        dto.tipo,
      mesa_id:     dto.mesaId,
      cliente_id:  dto.clienteId,
      operador_id: operadorId,
      status:      'aberto',
      subtotal:    0,
      desconto:    dto.desconto ?? 0,
      desconto_pontos: dto.descontoPontos ?? 0,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  // Inserir itens — o trigger fn_baixa_estoque dispara automaticamente
  const itens = dto.itens.map(i => ({
    pedido_id:  pedido.id,
    produto_id: i.produtoId,
    quantidade: i.quantidade,
    observacao: i.observacao,
    preco_unit: 0, // será preenchido via RPC com preço atual do produto
  }))

  // Buscar preços atuais
  const produtoIds = dto.itens.map(i => i.produtoId)
  const { data: produtos } = await supabase
    .from('produtos')
    .select('id, preco_venda')
    .in('id', produtoIds)

  const precoMap = Object.fromEntries((produtos ?? []).map(p => [p.id, p.preco_venda]))
  const itensComPreco = itens.map(i => ({ ...i, preco_unit: precoMap[i.produto_id] ?? 0 }))

  const { error: erroItens } = await supabase.from('itens_pedido').insert(itensComPreco)
  if (erroItens) throw new Error(erroItens.message)

  // Marcar mesa como ocupada quando pedido é de mesa
  if (dto.mesaId) {
    await supabase.from('mesas').update({ status: 'ocupada' }).eq('id', dto.mesaId)
  }

  // Buscar pedido completo para retornar
  const pedidoCompleto = await buscarPedido(pedido.id)

  // Notificar KDS via WebSocket
  broadcast('kds', { evento: 'novo_pedido', dados: pedidoCompleto })

  return pedidoCompleto
}

export async function buscarPedido(id: string): Promise<Pedido> {
  const { data, error } = await supabase
    .from('pedidos')
    .select(`
      *,
      itens_pedido (
        id, produto_id, quantidade, preco_unit, subtotal, observacao, status_kds,
        produtos ( nome )
      )
    `)
    .eq('id', id)
    .single()

  if (error || !data) throw new Error('Pedido não encontrado')

  return normalizarPedido(data)
}

export async function atualizarStatusItem(
  itemId: string,
  statusKds: 'aguardando' | 'em_producao' | 'pronto'
) {
  const { error } = await supabase
    .from('itens_pedido')
    .update({ status_kds: statusKds })
    .eq('id', itemId)

  if (error) throw new Error(error.message)

  // Verificar se todos os itens do pedido estão prontos
  const { data: item } = await supabase
    .from('itens_pedido')
    .select('pedido_id')
    .eq('id', itemId)
    .single()

  if (item) {
    const { data: itens } = await supabase
      .from('itens_pedido')
      .select('status_kds')
      .eq('pedido_id', item.pedido_id)

    const todosProntos = itens?.every(i => i.status_kds === 'pronto')
    if (todosProntos) {
      await supabase
        .from('pedidos')
        .update({ status: 'pronto' })
        .eq('id', item.pedido_id)

      // Buscar tipo e mesa para notificar o PDV
      const { data: pedido } = await supabase
        .from('pedidos')
        .select('tipo, mesa_id, mesas(numero)')
        .eq('id', item.pedido_id)
        .single()

      broadcast('pdv', {
        evento: 'pedido_pronto',
        dados: {
          pedidoId:    item.pedido_id,
          tipo:        pedido?.tipo,
          mesaNumero:  (pedido?.mesas as any)?.numero,
        },
      })
    }
  }
}

export async function finalizarPagamento(dto: FinalizarPagamentoDTO) {
  const { error } = await supabase.from('pagamentos').insert({
    pedido_id: dto.pedidoId,
    forma:     dto.forma,
    valor:     dto.valor,
    troco:     dto.troco ?? 0,
  })
  if (error) throw new Error(error.message)

  // Buscar dados do pedido antes de fechar
  const { data: pedido } = await supabase
    .from('pedidos')
    .select('total, cliente_id, desconto_pontos, mesa_id')
    .eq('id', dto.pedidoId)
    .single()

  await supabase
    .from('pedidos')
    .update({ status: 'pago', fechado_em: new Date().toISOString() })
    .eq('id', dto.pedidoId)

  // Liberar mesa automaticamente após pagamento
  if (pedido?.mesa_id) {
    await supabase.from('mesas').update({ status: 'livre' }).eq('id', pedido.mesa_id)
    broadcast('painel', { evento: 'mesa_liberada', dados: { mesaId: pedido.mesa_id } })
  }

  // Acúmulo e resgate de pontos
  if (pedido?.cliente_id) {
    const totalPago = Number(pedido.total)
    const pontosResgatados = Number(pedido.desconto_pontos ?? 0)
    const pontosGanhos = Math.floor(totalPago) // 1 ponto por R$ 1,00

    const { data: cli } = await supabase
      .from('clientes')
      .select('pontos')
      .eq('id', pedido.cliente_id)
      .single()

    const pontosAtuais = Number(cli?.pontos ?? 0)
    const novoSaldo = pontosAtuais - pontosResgatados + pontosGanhos

    await supabase
      .from('clientes')
      .update({ pontos: Math.max(0, novoSaldo) })
      .eq('id', pedido.cliente_id)
  }

  if (dto.emitirNfce) {
    const { emitirNFCe } = await import('../fiscal/fiscal.service')
    emitirNFCe(dto.pedidoId, dto.cpfCliente).catch(console.error)
  }

  broadcast('painel', { evento: 'venda_realizada', dados: { pedidoId: dto.pedidoId } })
}

function normalizarPedido(raw: any): Pedido {
  return {
    id:         raw.id,
    clienteId:  raw.cliente_id,
    mesaId:     raw.mesa_id,
    operadorId: raw.operador_id,
    tipo:       raw.tipo,
    status:     raw.status,
    subtotal:   Number(raw.subtotal),
    desconto:   Number(raw.desconto),
    total:      Number(raw.total),
    criadoEm:   raw.criado_em,
    fechadoEm:  raw.fechado_em,
    itens: (raw.itens_pedido ?? []).map((i: any) => ({
      id:          i.id,
      pedidoId:    raw.id,
      produtoId:   i.produto_id,
      produtoNome: i.produtos?.nome,
      quantidade:  i.quantidade,
      precoUnit:   Number(i.preco_unit),
      subtotal:    Number(i.subtotal),
      observacao:  i.observacao,
      statusKds:   i.status_kds,
    })),
  }
}
