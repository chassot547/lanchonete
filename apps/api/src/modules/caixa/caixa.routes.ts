import type { FastifyInstance } from 'fastify'
import { supabase } from '../../lib/supabase'

export async function caixaRoutes(app: FastifyInstance) {
  app.get('/caixa/status', async (req, reply) => {
    const { data: caixa } = await supabase
      .from('caixa_sessoes')
      .select('*')
      .is('fechamento', null)
      .order('abertura', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!caixa) return reply.send({ aberto: false })

    const { data: pagamentos } = await supabase
      .from('pagamentos')
      .select('forma, valor')
      .gte('criado_em', caixa.abertura)

    const totais = (pagamentos ?? []).reduce(
      (acc, p) => {
        acc.total    += Number(p.valor)
        if (p.forma === 'dinheiro') acc.dinheiro += Number(p.valor)
        else if (p.forma === 'pix')     acc.pix     += Number(p.valor)
        else if (p.forma === 'debito')  acc.debito  += Number(p.valor)
        else if (p.forma === 'credito') acc.credito += Number(p.valor)
        return acc
      },
      { total: 0, dinheiro: 0, pix: 0, debito: 0, credito: 0 }
    )

    return reply.send({
      aberto: true,
      caixaId:       caixa.id,
      abertoEm:      caixa.abertura,
      totalVendas:   totais.total,
      totalDinheiro: totais.dinheiro,
      totalPix:      totais.pix,
      totalDebito:   totais.debito,
      totalCredito:  totais.credito,
    })
  })

  app.post('/caixa/abrir', async (req, reply) => {
    const operadorId = (req as any).usuario?.id
    const { saldoInicial = 0 } = req.body as any

    const { data: existente } = await supabase
      .from('caixa_sessoes')
      .select('id')
      .is('fechamento', null)
      .maybeSingle()

    if (existente) return reply.code(409).send({ error: 'Já existe um caixa aberto' })

    const { data, error } = await supabase
      .from('caixa_sessoes')
      .insert({ operador_id: operadorId, saldo_inicial: saldoInicial })
      .select()
      .single()

    if (error) return reply.code(500).send({ error: error.message })
    return reply.code(201).send(data)
  })

  app.post('/caixa/fechar', async (req, reply) => {
    const { saldoFinal } = req.body as any

    const { data: caixa } = await supabase
      .from('caixa_sessoes')
      .select('id')
      .is('fechamento', null)
      .maybeSingle()

    if (!caixa) return reply.code(404).send({ error: 'Nenhum caixa aberto' })

    const { error } = await supabase
      .from('caixa_sessoes')
      .update({
        fechamento:  new Date().toISOString(),
        saldo_final: saldoFinal ?? null,
      })
      .eq('id', caixa.id)

    if (error) return reply.code(500).send({ error: error.message })
    return reply.send({ ok: true })
  })
}
