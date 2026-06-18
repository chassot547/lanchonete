import type { FastifyInstance } from 'fastify'
import { criarPedido, buscarPedido, atualizarStatusItem, finalizarPagamento } from './pedidos.service'
import { caixaOuMais, gerenteOuMais } from '../../lib/guard'

export async function pedidosRoutes(app: FastifyInstance) {
  // POST /pedidos — criar novo pedido
  app.post('/pedidos', async (req, reply) => {
    const operadorId = (req as any).usuario?.id ?? 'anonimo'
    const pedido = await criarPedido(req.body as any, operadorId)
    return reply.code(201).send(pedido)
  })

  // GET /pedidos/:id
  app.get<{ Params: { id: string } }>('/pedidos/:id', async (req, reply) => {
    const pedido = await buscarPedido(req.params.id)
    return reply.send(pedido)
  })

  // GET /pedidos?status=aberto — listar pedidos ativos (KDS)
  app.get<{ Querystring: { status?: string; tipo?: string } }>('/pedidos', async (req, reply) => {
    const { supabase } = await import('../../lib/supabase')
    let query = supabase
      .from('pedidos')
      .select(`*, mesas(numero), itens_pedido(*, produtos(nome))`)
      .order('criado_em', { ascending: true })

    if (req.query.status) query = query.eq('status', req.query.status)
    if (req.query.tipo)   query = query.eq('tipo', req.query.tipo)

    const { data, error } = await query
    if (error) return reply.code(500).send({ error: error.message })
    return reply.send(data)
  })

  // PATCH /pedidos/itens/:id/status — KDS atualiza status do item
  app.patch<{ Params: { id: string }; Body: { statusKds: string } }>(
    '/pedidos/itens/:id/status',
    async (req, reply) => {
      await atualizarStatusItem(req.params.id, req.body.statusKds as any)
      return reply.send({ ok: true })
    }
  )

  // POST /pedidos/:id/pagamento — finalizar pagamento (caixa+)
  app.post<{ Params: { id: string } }>('/pedidos/:id/pagamento', { preHandler: caixaOuMais }, async (req, reply) => {
    await finalizarPagamento({ pedidoId: req.params.id, ...(req.body as any) })
    return reply.send({ ok: true })
  })

  // PATCH /pedidos/:id/cancelar — cancelar pedido (gerente+)
  app.patch<{ Params: { id: string }; Body: { motivo: string } }>(
    '/pedidos/:id/cancelar',
    { preHandler: gerenteOuMais },
    async (req, reply) => {
      const { supabase } = await import('../../lib/supabase')
      const { error } = await supabase
        .from('pedidos')
        .update({
          status: 'cancelado',
          cancelado_em: new Date().toISOString(),
          motivo_cancelamento: req.body.motivo ?? 'Sem motivo informado',
        })
        .eq('id', req.params.id)
        .in('status', ['aberto', 'em_producao', 'pronto'])

      if (error) return reply.code(500).send({ error: error.message })
      return reply.send({ ok: true })
    }
  )
}
