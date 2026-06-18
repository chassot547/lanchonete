import { FastifyInstance } from 'fastify'
import { supabase } from '../../lib/supabase'

export async function produtosRoutes(app: FastifyInstance) {
  app.get('/produtos', async (req, reply) => {
    const { ativo } = req.query as { ativo?: string }

    let q = supabase
      .from('produtos')
      .select(`
        id, nome, descricao, preco_venda, tipo, imagem_url, ativo, criado_em,
        categorias ( id, nome, ordem )
      `)
      .order('nome')

    if (ativo !== undefined) q = q.eq('ativo', ativo === 'true')

    const { data, error } = await q
    if (error) return reply.status(500).send(error)

    // Normaliza para facilitar no frontend
    return data?.map(p => ({
      ...p,
      categoria_id: (p.categorias as any)?.id,
      categoria: (p.categorias as any)?.nome,
    }))
  })

  app.get('/produtos/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { data, error } = await supabase
      .from('produtos')
      .select('*, categorias(id, nome)')
      .eq('id', id)
      .single()
    if (error) return reply.status(404).send(error)
    return data
  })

  app.post('/produtos', async (req, reply) => {
    const body = req.body as Record<string, unknown>
    const { data, error } = await supabase
      .from('produtos')
      .insert(body)
      .select()
      .single()
    if (error) return reply.status(400).send(error)
    return reply.status(201).send(data)
  })

  app.patch('/produtos/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = req.body as Record<string, unknown>
    const { data, error } = await supabase
      .from('produtos')
      .update(body)
      .eq('id', id)
      .select()
      .single()
    if (error) return reply.status(400).send(error)
    return data
  })

  app.delete('/produtos/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { error } = await supabase.from('produtos').delete().eq('id', id)
    if (error) return reply.status(400).send(error)
    return reply.status(204).send()
  })

  // Ficha técnica
  app.get('/produtos/:id/ficha-tecnica', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { data, error } = await supabase
      .from('ficha_tecnica')
      .select('*, ingredientes(nome, unidade)')
      .eq('produto_id', id)
    if (error) return reply.status(500).send(error)
    return data
  })

  app.put('/produtos/:id/ficha-tecnica', async (req, reply) => {
    const { id } = req.params as { id: string }
    const itens = req.body as Array<{ ingrediente_id: string; quantidade: number; unidade: string }>
    await supabase.from('ficha_tecnica').delete().eq('produto_id', id)
    if (itens.length > 0) {
      const { error } = await supabase
        .from('ficha_tecnica')
        .insert(itens.map(i => ({ ...i, produto_id: id })))
      if (error) return reply.status(400).send(error)
    }
    return reply.status(204).send()
  })

  // ── Variações ────────────────────────────────────────────────────────────────
  app.get<{ Params: { id: string } }>('/produtos/:id/variacoes', async (req, reply) => {
    const { data, error } = await supabase
      .from('produto_variacoes').select('*').eq('produto_id', req.params.id).order('criado_em')
    if (error) return reply.code(500).send(error)
    return data
  })

  app.post<{ Params: { id: string } }>('/produtos/:id/variacoes', async (req, reply) => {
    const { nome, opcoes, obrigatorio } = req.body as any
    const { data, error } = await supabase
      .from('produto_variacoes')
      .insert({ produto_id: req.params.id, nome, opcoes, obrigatorio: obrigatorio ?? false })
      .select().single()
    if (error) return reply.code(500).send(error)
    return reply.code(201).send(data)
  })

  app.patch<{ Params: { varId: string } }>('/variacoes/:varId', async (req, reply) => {
    const { data, error } = await supabase
      .from('produto_variacoes').update(req.body as any).eq('id', req.params.varId).select().single()
    if (error) return reply.code(500).send(error)
    return data
  })

  app.delete<{ Params: { varId: string } }>('/variacoes/:varId', async (req, reply) => {
    await supabase.from('produto_variacoes').delete().eq('id', req.params.varId)
    return reply.code(204).send()
  })

  // ── Adicionais ───────────────────────────────────────────────────────────────
  app.get<{ Params: { id: string } }>('/produtos/:id/adicionais', async (req, reply) => {
    const { data, error } = await supabase
      .from('produto_adicionais').select('*').eq('produto_id', req.params.id).order('nome')
    if (error) return reply.code(500).send(error)
    return data
  })

  app.post<{ Params: { id: string } }>('/produtos/:id/adicionais', async (req, reply) => {
    const { nome, preco } = req.body as any
    const { data, error } = await supabase
      .from('produto_adicionais')
      .insert({ produto_id: req.params.id, nome, preco: preco ?? 0 })
      .select().single()
    if (error) return reply.code(500).send(error)
    return reply.code(201).send(data)
  })

  app.patch<{ Params: { addId: string } }>('/adicionais/:addId', async (req, reply) => {
    const { data, error } = await supabase
      .from('produto_adicionais').update(req.body as any).eq('id', req.params.addId).select().single()
    if (error) return reply.code(500).send(error)
    return data
  })

  app.delete<{ Params: { addId: string } }>('/adicionais/:addId', async (req, reply) => {
    await supabase.from('produto_adicionais').delete().eq('id', req.params.addId)
    return reply.code(204).send()
  })

  // Categorias
  app.get('/categorias', async (_req, reply) => {
    const { data, error } = await supabase
      .from('categorias')
      .select('id, nome, ordem, estacao')
      .order('ordem')
    if (error) return reply.status(500).send(error)
    return data
  })

  app.post('/categorias', async (req, reply) => {
    const { data, error } = await supabase
      .from('categorias')
      .insert(req.body as any)
      .select()
      .single()
    if (error) return reply.status(400).send(error)
    return reply.code(201).send(data)
  })

  app.patch<{ Params: { id: string } }>('/categorias/:id', async (req, reply) => {
    const { data, error } = await supabase
      .from('categorias')
      .update(req.body as any)
      .eq('id', req.params.id)
      .select()
      .single()
    if (error) return reply.status(400).send(error)
    return data
  })

  app.delete<{ Params: { id: string } }>('/categorias/:id', async (req, reply) => {
    const { error } = await supabase
      .from('categorias')
      .delete()
      .eq('id', req.params.id)
    if (error) return reply.status(400).send(error)
    return reply.send({ ok: true })
  })
}
