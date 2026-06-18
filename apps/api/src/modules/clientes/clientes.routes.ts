import type { FastifyInstance } from 'fastify'
import { supabase } from '../../lib/supabase'

export async function clientesRoutes(app: FastifyInstance) {
  app.get('/clientes', async (req, reply) => {
    const { q } = req.query as { q?: string }
    let query = supabase
      .from('clientes')
      .select('id, nome, telefone, cpf, pontos, criado_em')
      .order('nome')
    if (q) query = query.or(`nome.ilike.%${q}%,telefone.ilike.%${q}%,cpf.ilike.%${q}%`)
    const { data, error } = await query
    if (error) return reply.code(500).send({ error: error.message })
    return data
  })

  // Histórico de pedidos do cliente
  app.get<{ Params: { id: string } }>('/clientes/:id/historico', async (req, reply) => {
    const { data, error } = await supabase
      .from('pedidos')
      .select(`id, tipo, status, total, criado_em, itens_pedido(quantidade, produtos(nome)), pagamentos(forma)`)
      .eq('cliente_id', req.params.id)
      .order('criado_em', { ascending: false })
      .limit(20)
    if (error) return reply.code(500).send({ error: error.message })
    return data
  })

  app.post('/clientes', async (req, reply) => {
    const { nome, telefone, cpf } = req.body as any
    const { data, error } = await supabase
      .from('clientes')
      .insert({ nome, telefone, cpf })
      .select()
      .single()
    if (error) return reply.code(500).send({ error: error.message })
    return reply.code(201).send(data)
  })

  app.patch<{ Params: { id: string } }>('/clientes/:id', async (req, reply) => {
    const { nome, telefone, cpf } = req.body as any
    const { data, error } = await supabase
      .from('clientes')
      .update({ nome, telefone, cpf })
      .eq('id', req.params.id)
      .select()
      .single()
    if (error) return reply.code(500).send({ error: error.message })
    return data
  })

  app.delete<{ Params: { id: string } }>('/clientes/:id', async (req, reply) => {
    const { error } = await supabase.from('clientes').delete().eq('id', req.params.id)
    if (error) return reply.code(500).send({ error: error.message })
    return reply.code(204).send()
  })

  // POST /clientes/:id/resgatar-pontos — aplica desconto de pontos no pedido
  // Regra: 10 pontos = R$ 1,00 de desconto
  app.post<{ Params: { id: string }; Body: { pedidoId: string; pontos: number } }>(
    '/clientes/:id/resgatar-pontos',
    async (req, reply) => {
      const { pedidoId, pontos } = req.body
      if (!pedidoId || !pontos || pontos <= 0) return reply.code(400).send({ error: 'pedidoId e pontos são obrigatórios' })

      const { data: cli } = await supabase.from('clientes').select('pontos').eq('id', req.params.id).single()
      if (!cli) return reply.code(404).send({ error: 'Cliente não encontrado' })

      const pontosDisponiveis = Number(cli.pontos)
      const pontosAUsar = Math.min(pontos, pontosDisponiveis)
      const desconto = pontosAUsar / 10

      const { data: pedido } = await supabase.from('pedidos').select('desconto').eq('id', pedidoId).single()
      const descontoAtual = Number((pedido as any)?.desconto ?? 0)
      await supabase.from('pedidos').update({ desconto_pontos: pontosAUsar, desconto: descontoAtual + desconto }).eq('id', pedidoId)

      return reply.send({ pontosUsados: pontosAUsar, desconto, saldoRestante: pontosDisponiveis - pontosAUsar })
    }
  )
}
