import type { FastifyInstance } from 'fastify'
import { supabase } from '../../lib/supabase'
import { broadcast } from '../../lib/websocket'
import { caixaOuMais } from '../../lib/guard'

export async function mesasRoutes(app: FastifyInstance) {
  // Listar mesas — suporta ?qr=mesa-01 para cardápio digital (público)
  app.get('/mesas', async (req, reply) => {
    const { qr } = req.query as { qr?: string }
    let query = supabase.from('mesas').select('*').order('numero')
    if (qr) query = query.eq('qr_code', qr)
    const { data, error } = await query
    if (error) return reply.code(500).send({ error: error.message })
    return data
  })

  // POST /mesas/:id/pedir-conta — garçom solicita conta ao caixa
  app.post<{ Params: { id: string } }>('/mesas/:id/pedir-conta', async (req, reply) => {
    const { data: mesa } = await supabase.from('mesas').select('numero').eq('id', req.params.id).single()
    const { data: pedido } = await supabase
      .from('pedidos').select('id, total').eq('mesa_id', req.params.id).eq('status', 'pronto').maybeSingle()
      ?? await supabase.from('pedidos').select('id, total').eq('mesa_id', req.params.id).in('status', ['aberto','em_producao']).maybeSingle()

    broadcast('pdv', {
      evento: 'pedido_conta',
      dados: { mesaId: req.params.id, mesaNumero: mesa?.numero, pedidoId: pedido?.id, total: pedido?.total },
    })
    broadcast('painel', {
      evento: 'pedido_conta',
      dados: { mesaId: req.params.id, mesaNumero: mesa?.numero, total: pedido?.total },
    })
    return reply.send({ ok: true })
  })

  app.patch<{ Params: { id: string } }>('/mesas/:id', async (req, reply) => {
    const { data, error } = await supabase
      .from('mesas').update(req.body as any).eq('id', req.params.id).select().single()
    if (error) return reply.code(400).send(error)
    return data
  })

  app.post('/mesas', async (req, reply) => {
    const { data, error } = await supabase
      .from('mesas').insert(req.body as any).select().single()
    if (error) return reply.code(400).send(error)
    return reply.code(201).send(data)
  })

  // Pedido aberto de uma mesa
  app.get<{ Params: { id: string } }>('/mesas/:id/pedido', async (req, reply) => {
    const { data } = await supabase
      .from('pedidos')
      .select(`*, itens_pedido(*, produtos(nome, preco_venda))`)
      .eq('mesa_id', req.params.id)
      .in('status', ['aberto', 'em_producao', 'pronto'])
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle()
    return reply.send(data ?? null)
  })

  // Histórico de pedidos de uma mesa
  app.get<{ Params: { id: string } }>('/mesas/:id/historico', async (req, reply) => {
    const { data, error } = await supabase
      .from('pedidos')
      .select(`id, tipo, status, total, criado_em, fechado_em, pagamentos(forma, valor)`)
      .eq('mesa_id', req.params.id)
      .order('criado_em', { ascending: false })
      .limit(20)
    if (error) return reply.code(500).send({ error: error.message })
    return data
  })

  // Transferir pedido para outra mesa
  app.post<{ Params: { id: string }; Body: { mesaDestinoId: string } }>(
    '/mesas/:id/transferir',
    { preHandler: caixaOuMais },
    async (req, reply) => {
      const mesaOrigemId  = req.params.id
      const { mesaDestinoId } = req.body
      const operadorId = (req as any).usuario?.id

      const { data: pedido } = await supabase
        .from('pedidos').select('id')
        .eq('mesa_id', mesaOrigemId)
        .in('status', ['aberto', 'em_producao', 'pronto'])
        .maybeSingle()

      if (!pedido) return reply.code(404).send({ error: 'Nenhum pedido aberto nessa mesa' })

      const { data: destino } = await supabase
        .from('mesas').select('status').eq('id', mesaDestinoId).single()

      if (destino?.status !== 'livre')
        return reply.code(409).send({ error: 'Mesa destino não está livre' })

      await supabase.from('pedidos').update({
        mesa_id:          mesaDestinoId,
        mesa_id_original: mesaOrigemId,
      }).eq('id', pedido.id)

      await supabase.from('transferencias_mesa').insert({
        pedido_id: pedido.id, mesa_origem: mesaOrigemId,
        mesa_destino: mesaDestinoId, operador_id: operadorId,
      })

      return reply.send({ ok: true, pedidoId: pedido.id })
    }
  )

  // Dividir conta
  app.post<{ Params: { id: string }; Body: { partes: number } }>(
    '/mesas/:id/dividir',
    { preHandler: caixaOuMais },
    async (req, reply) => {
      const { partes } = req.body
      if (!partes || partes < 2) return reply.code(400).send({ error: 'Mínimo 2 partes' })

      const { data: pedido } = await supabase
        .from('pedidos')
        .select('id, total, itens_pedido(id, quantidade, preco_unit, subtotal, produtos(nome))')
        .eq('mesa_id', req.params.id)
        .in('status', ['aberto', 'em_producao', 'pronto'])
        .maybeSingle()

      if (!pedido) return reply.code(404).send({ error: 'Nenhum pedido aberto nessa mesa' })

      const valorParte = Number(pedido.total) / partes

      await supabase.from('divisoes_conta').insert({
        pedido_id: pedido.id, partes,
        valor_parte: Number(valorParte.toFixed(2)),
      })

      return reply.send({
        pedidoId:   pedido.id,
        total:      Number(pedido.total),
        partes,
        valorParte: Number(valorParte.toFixed(2)),
        itens:      pedido.itens_pedido,
      })
    }
  )
}
