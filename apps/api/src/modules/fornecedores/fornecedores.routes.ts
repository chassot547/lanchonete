import type { FastifyInstance } from 'fastify'
import { supabase } from '../../lib/supabase'
import { gerenteOuMais } from '../../lib/guard'

export async function fornecedoresRoutes(app: FastifyInstance) {

  // ── Fornecedores ──────────────────────────────────────────────────────────

  app.get('/fornecedores', async (_req, reply) => {
    const { data, error } = await supabase
      .from('fornecedores')
      .select('*')
      .order('nome')
    if (error) return reply.code(500).send(error)
    return data
  })

  app.post('/fornecedores', { preHandler: gerenteOuMais }, async (req, reply) => {
    const { data, error } = await supabase
      .from('fornecedores')
      .insert(req.body as any)
      .select()
      .single()
    if (error) return reply.code(400).send(error)
    return reply.code(201).send(data)
  })

  app.patch<{ Params: { id: string } }>('/fornecedores/:id', { preHandler: gerenteOuMais }, async (req, reply) => {
    const { data, error } = await supabase
      .from('fornecedores')
      .update(req.body as any)
      .eq('id', req.params.id)
      .select()
      .single()
    if (error) return reply.code(400).send(error)
    return data
  })

  app.delete<{ Params: { id: string } }>('/fornecedores/:id', { preHandler: gerenteOuMais }, async (req, reply) => {
    const { error } = await supabase.from('fornecedores').delete().eq('id', req.params.id)
    if (error) return reply.code(400).send(error)
    return { ok: true }
  })

  // ── Notas Fiscais de Entrada ───────────────────────────────────────────────

  app.get('/notas-entrada', async (req, reply) => {
    const { fornecedor_id } = req.query as { fornecedor_id?: string }
    let q = supabase
      .from('notas_fiscais_entrada')
      .select(`*, fornecedores(id, nome, cnpj), itens_nf_entrada(*, ingredientes(nome, unidade))`)
      .order('data_emissao', { ascending: false })
    if (fornecedor_id) q = q.eq('fornecedor_id', fornecedor_id)
    const { data, error } = await q
    if (error) return reply.code(500).send(error)
    return data
  })

  app.get<{ Params: { id: string } }>('/notas-entrada/:id', async (req, reply) => {
    const { data, error } = await supabase
      .from('notas_fiscais_entrada')
      .select(`*, fornecedores(id, nome, cnpj), itens_nf_entrada(*, ingredientes(nome, unidade))`)
      .eq('id', req.params.id)
      .single()
    if (error) return reply.code(404).send(error)
    return data
  })

  app.post('/notas-entrada', { preHandler: gerenteOuMais }, async (req, reply) => {
    const body = req.body as any
    const { itens, ...nf } = body

    const { data: nota, error } = await supabase
      .from('notas_fiscais_entrada')
      .insert(nf)
      .select()
      .single()
    if (error) return reply.code(400).send(error)

    if (itens?.length) {
      const itensInsert = itens.map((i: any) => ({ ...i, nf_id: nota.id }))
      const { error: errItens } = await supabase.from('itens_nf_entrada').insert(itensInsert)
      if (errItens) return reply.code(400).send(errItens)

      // Atualiza estoque dos ingredientes vinculados
      for (const item of itens) {
        if (item.ingrediente_id) {
          const { data: ing } = await supabase
            .from('ingredientes')
            .select('estoque_atual')
            .eq('id', item.ingrediente_id)
            .single()
          if (ing) {
            await supabase.from('ingredientes').update({
              estoque_atual: Number(ing.estoque_atual) + Number(item.quantidade),
              atualizado_em: new Date().toISOString(),
            }).eq('id', item.ingrediente_id)
          }
        }
      }

      // Registra no histórico de entradas
      await supabase.from('entradas_estoque').insert({
        descricao: `NF ${nf.numero_nf} - ${nota.id}`,
        quantidade: itens.reduce((s: number, i: any) => s + Number(i.quantidade), 0),
        custo_total: Number(nf.valor_total),
        data: nf.data_entrada ?? new Date().toISOString().split('T')[0],
      })
    }

    // Cria conta a pagar automaticamente
    const vencimento = (body.vencimento ?? body.data_entrada ?? new Date().toISOString().split('T')[0])
    await supabase.from('contas_a_pagar').insert({
      nf_id:         nota.id,
      fornecedor_id: nf.fornecedor_id ?? null,
      descricao:     `NF ${nf.numero_nf}${nf.fornecedor_id ? '' : ''}`,
      valor:         Number(nf.valor_total),
      vencimento,
      status:        'pendente',
    })

    return reply.code(201).send({ ...nota, itens })
  })

  app.patch<{ Params: { id: string } }>('/notas-entrada/:id', { preHandler: gerenteOuMais }, async (req, reply) => {
    const { data, error } = await supabase
      .from('notas_fiscais_entrada')
      .update(req.body as any)
      .eq('id', req.params.id)
      .select()
      .single()
    if (error) return reply.code(400).send(error)
    return data
  })

  app.delete<{ Params: { id: string } }>('/notas-entrada/:id', { preHandler: gerenteOuMais }, async (req, reply) => {
    const { error } = await supabase.from('notas_fiscais_entrada').delete().eq('id', req.params.id)
    if (error) return reply.code(400).send(error)
    return { ok: true }
  })

  // ── Contas a Pagar ────────────────────────────────────────────────────────

  app.get('/contas-a-pagar', async (req, reply) => {
    const { status } = req.query as { status?: string }
    let q = supabase
      .from('contas_a_pagar')
      .select(`*, fornecedores(nome), notas_fiscais_entrada(numero_nf, serie)`)
      .order('vencimento', { ascending: true })
    if (status) q = q.eq('status', status)
    const { data, error } = await q
    if (error) return reply.code(500).send(error)
    return data
  })

  app.patch<{ Params: { id: string } }>('/contas-a-pagar/:id', { preHandler: gerenteOuMais }, async (req, reply) => {
    const body = req.body as any
    // Se liquidando, registra data_pagamento
    if (body.status === 'pago' && !body.data_pagamento) {
      body.data_pagamento = new Date().toISOString().split('T')[0]
    }
    const { data, error } = await supabase
      .from('contas_a_pagar')
      .update(body)
      .eq('id', req.params.id)
      .select()
      .single()
    if (error) return reply.code(400).send(error)

    // Sincroniza status na NF se houver vínculo
    if (data.nf_id && body.status) {
      await supabase.from('notas_fiscais_entrada')
        .update({ status_pagamento: body.status })
        .eq('id', data.nf_id)
    }
    return data
  })

  app.post('/contas-a-pagar', { preHandler: gerenteOuMais }, async (req, reply) => {
    const { data, error } = await supabase
      .from('contas_a_pagar')
      .insert(req.body as any)
      .select()
      .single()
    if (error) return reply.code(400).send(error)
    return reply.code(201).send(data)
  })

  app.delete<{ Params: { id: string } }>('/contas-a-pagar/:id', { preHandler: gerenteOuMais }, async (req, reply) => {
    const { error } = await supabase.from('contas_a_pagar').delete().eq('id', req.params.id)
    if (error) return reply.code(400).send(error)
    return { ok: true }
  })
}
