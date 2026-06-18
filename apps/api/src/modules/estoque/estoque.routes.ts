import { FastifyInstance } from 'fastify'
import { listarIngredientes, registrarEntrada, calcularCMV } from './estoque.service'
import { supabase } from '../../lib/supabase'

export async function estoqueRoutes(app: FastifyInstance) {
  app.get('/estoque', async (_req, reply) => {
    const data = await listarIngredientes()
    return data
  })

  app.post('/estoque/entrada', async (req, reply) => {
    const { ingredienteId, quantidade, custoUnit, observacao } =
      req.body as {
        ingredienteId: string
        quantidade: number
        custoUnit?: number
        observacao?: string
      }
    const custoTotal = custoUnit ? custoUnit * quantidade : 0
    await registrarEntrada(ingredienteId, quantidade, custoTotal, observacao)
    return reply.status(204).send()
  })

  app.get('/estoque/cmv', async (req, reply) => {
    const { ini, fim } = req.query as { ini: string; fim: string }
    const data = await calcularCMV(ini, fim)
    return data
  })

  app.post('/ingredientes', async (req, reply) => {
    const body = req.body as Record<string, unknown>
    const { data, error } = await supabase.from('ingredientes').insert(body).select().single()
    if (error) return reply.status(400).send(error)
    return reply.status(201).send(data)
  })

  app.patch('/ingredientes/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = req.body as Record<string, unknown>
    const { data, error } = await supabase.from('ingredientes').update(body).eq('id', id).select().single()
    if (error) return reply.status(400).send(error)
    return data
  })

  // POST /estoque/inventario — ajuste de contagem física
  // Body: [{ ingredienteId, quantidadeContada }]
  app.post('/estoque/inventario', async (req, reply) => {
    const itens = req.body as { ingredienteId: string; quantidadeContada: number }[]
    if (!Array.isArray(itens) || itens.length === 0) return reply.code(400).send({ error: 'Lista de itens obrigatória' })

    const ids = itens.map(i => i.ingredienteId)
    const { data: atuais } = await supabase.from('ingredientes').select('id, estoque_atual').in('id', ids)
    const mapaAtual = Object.fromEntries((atuais ?? []).map(a => [a.id, Number(a.estoque_atual ?? 0)]))

    const ajustes = []
    for (const item of itens) {
      const atual   = mapaAtual[item.ingredienteId] ?? 0
      const dif     = item.quantidadeContada - atual
      if (dif === 0) continue

      await supabase.from('ingredientes').update({ estoque_atual: item.quantidadeContada }).eq('id', item.ingredienteId)

      // Loga entradas positivas; saídas são apenas ajuste de saldo
      if (dif > 0) {
        await supabase.from('entradas_estoque').insert({
          ingrediente_id: item.ingredienteId,
          quantidade:     dif,
          custo_total:    0,
        })
      }

      ajustes.push({ ingredienteId: item.ingredienteId, anterior: atual, contado: item.quantidadeContada, dif })
    }

    return reply.send({ ajustes, total: ajustes.length })
  })
}
