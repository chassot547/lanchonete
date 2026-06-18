import { FastifyInstance } from 'fastify'
import { supabase } from '../../lib/supabase'
import { caixaOuMais, gerenteOuMais } from '../../lib/guard'

export async function financeiroRoutes(app: FastifyInstance) {
  // KPIs do dia
  app.get('/financeiro/kpis', async (req, reply) => {
    const { data: d } = req.query as { data?: string }
    const dia = d ?? new Date().toISOString().split('T')[0]

    const [pedidosRes, pagRes] = await Promise.all([
      supabase
        .from('pedidos')
        .select('total, status')
        .gte('criado_em', `${dia}T00:00:00`)
        .lte('criado_em', `${dia}T23:59:59`),
      supabase
        .from('pagamentos')
        .select('valor')
        .gte('criado_em', `${dia}T00:00:00`)
        .lte('criado_em', `${dia}T23:59:59`),
    ])

    const pagos      = (pedidosRes.data ?? []).filter(p => p.status === 'pago')
    const faturamento = pagos.reduce((s, p) => s + Number(p.total), 0)
    const totalPedidos = pagos.length
    const ticketMedio  = totalPedidos > 0 ? faturamento / totalPedidos : 0
    const pendentes    = (pedidosRes.data ?? []).filter(p => !['pago', 'cancelado'].includes(p.status)).length

    return {
      faturamentoDia:   faturamento,
      ticketMedio,
      totalPedidos,
      cmvPercent:       0, // calculado separado via estoque
      lucroLiquidoDia:  faturamento,
      pedidosPendentes: pendentes,
    }
  })

  // Movimentações (sangria/suprimento/receita/despesa)
  app.get('/financeiro/movimentacoes', { preHandler: caixaOuMais }, async (req, reply) => {
    const { ini, fim } = req.query as { ini: string; fim: string }
    const { data, error } = await supabase
      .from('movimentacoes_financeiras')
      .select('*')
      .gte('data', `${ini}T00:00:00`)
      .lte('data', `${fim}T23:59:59`)
      .order('data', { ascending: false })
    if (error) return reply.status(500).send(error)
    return data
  })

  // Sangria
  app.post('/financeiro/sangria', { preHandler: caixaOuMais }, async (req, reply) => {
    const { valor, descricao } = req.body as any

    const { data: caixa } = await supabase
      .from('caixa_sessoes')
      .select('id')
      .is('fechamento', null)
      .maybeSingle()

    if (!caixa) return reply.code(400).send({ error: 'Nenhum caixa aberto' })

    const { data, error } = await supabase
      .from('movimentacoes_financeiras')
      .insert({ caixa_id: caixa.id, tipo: 'sangria', valor, descricao: descricao || 'Sangria de caixa' })
      .select()
      .single()
    if (error) return reply.code(500).send({ error: error.message })
    return reply.code(201).send(data)
  })

  // Suprimento
  app.post('/financeiro/suprimento', { preHandler: caixaOuMais }, async (req, reply) => {
    const { valor, descricao } = req.body as any

    const { data: caixa } = await supabase
      .from('caixa_sessoes')
      .select('id')
      .is('fechamento', null)
      .maybeSingle()

    if (!caixa) return reply.code(400).send({ error: 'Nenhum caixa aberto' })

    const { data, error } = await supabase
      .from('movimentacoes_financeiras')
      .insert({ caixa_id: caixa.id, tipo: 'suprimento', valor, descricao: descricao || 'Suprimento de caixa' })
      .select()
      .single()
    if (error) return reply.code(500).send({ error: error.message })
    return reply.code(201).send(data)
  })

  // Relatório de vendas por período
  app.get('/relatorios/vendas', { preHandler: gerenteOuMais }, async (req, reply) => {
    const { ini, fim } = req.query as { ini: string; fim: string }

    const { data: pedidos, error } = await supabase
      .from('pedidos')
      .select('id, tipo, total, status, criado_em, pagamentos(forma, valor)')
      .eq('status', 'pago')
      .gte('criado_em', `${ini}T00:00:00`)
      .lte('criado_em', `${fim}T23:59:59`)
      .order('criado_em', { ascending: false })

    if (error) return reply.code(500).send({ error: error.message })

    const total   = (pedidos ?? []).reduce((s, p) => s + Number(p.total), 0)
    const ticket  = pedidos?.length ? total / pedidos.length : 0

    // Agrupamento por forma de pagamento
    const porForma: Record<string, number> = {}
    ;(pedidos ?? []).forEach(p => {
      const forma = (p.pagamentos as any)?.[0]?.forma ?? 'outro'
      porForma[forma] = (porForma[forma] ?? 0) + Number(p.total)
    })

    // Agrupamento por tipo
    const porTipo: Record<string, number> = {}
    ;(pedidos ?? []).forEach(p => {
      porTipo[p.tipo] = (porTipo[p.tipo] ?? 0) + Number(p.total)
    })

    return {
      totalVendas:   total,
      totalPedidos:  pedidos?.length ?? 0,
      ticketMedio:   ticket,
      porForma,
      porTipo,
      pedidos: pedidos ?? [],
    }
  })

  // DRE mensal
  app.get('/relatorios/dre', { preHandler: gerenteOuMais }, async (req, reply) => {
    const { mes, ano } = req.query as { mes: string; ano: string }
    const m   = String(mes).padStart(2, '0')
    const ini = `${ano}-${m}-01`
    const fim = new Date(Number(ano), Number(mes), 0).toISOString().split('T')[0] // último dia do mês

    // Receita bruta (pedidos pagos)
    const { data: pedidos } = await supabase
      .from('pedidos')
      .select('total, desconto, tipo')
      .eq('status', 'pago')
      .gte('criado_em', `${ini}T00:00:00`)
      .lte('criado_em', `${fim}T23:59:59`)

    const receitaBruta = (pedidos ?? []).reduce((s, p) => s + Number(p.total), 0)
    const descontos    = (pedidos ?? []).reduce((s, p) => s + Number(p.desconto ?? 0), 0)
    const receitaLiquida = receitaBruta

    // CMV: custo das compras de insumos no período (entradas_estoque)
    const { data: baixas } = await supabase
      .from('entradas_estoque')
      .select('custo_total')
      .gte('data_entrada', ini)
      .lte('data_entrada', fim)

    const cmv = (baixas ?? []).reduce((s: number, b: any) => s + Number(b.custo_total ?? 0), 0)
    const lucroBruto = receitaLiquida - cmv

    // Despesas operacionais (movimentações do tipo 'sangria' = saídas)
    const { data: movs } = await supabase
      .from('movimentacoes_financeiras')
      .select('tipo, valor')
      .gte('data', `${ini}T00:00:00`)
      .lte('data', `${fim}T23:59:59`)

    const sangrias     = (movs ?? []).filter(m => m.tipo === 'sangria').reduce((s, m) => s + Number(m.valor), 0)
    const suprimentos  = (movs ?? []).filter(m => m.tipo === 'suprimento').reduce((s, m) => s + Number(m.valor), 0)
    const lucroLiquido = lucroBruto - sangrias

    // Faturamento por tipo
    const porTipo: Record<string, number> = {}
    ;(pedidos ?? []).forEach(p => { porTipo[p.tipo] = (porTipo[p.tipo] ?? 0) + Number(p.total) })

    return {
      periodo: `${m}/${ano}`,
      receitaBruta,
      descontos,
      receitaLiquida,
      cmv,
      margemBruta: receitaLiquida > 0 ? ((lucroBruto / receitaLiquida) * 100).toFixed(1) : '0',
      lucroBruto,
      sangrias,
      suprimentos,
      lucroLiquido,
      margemLiquida: receitaLiquida > 0 ? ((lucroLiquido / receitaLiquida) * 100).toFixed(1) : '0',
      totalPedidos: pedidos?.length ?? 0,
      ticketMedio: (pedidos?.length ?? 0) > 0 ? receitaBruta / (pedidos?.length ?? 1) : 0,
      porTipo,
    }
  })

  // Relatório produtos mais vendidos (curva ABC)
  app.get('/relatorios/produtos', { preHandler: gerenteOuMais }, async (req, reply) => {
    const { ini, fim } = req.query as { ini: string; fim: string }

    const { data, error } = await supabase
      .from('itens_pedido')
      .select('quantidade, preco_unit, subtotal, produtos(nome, tipo), pedidos!inner(status, criado_em)')
      .eq('pedidos.status', 'pago')
      .gte('pedidos.criado_em', `${ini}T00:00:00`)
      .lte('pedidos.criado_em', `${fim}T23:59:59`)

    if (error) return reply.code(500).send({ error: error.message })

    // Agrupa por produto
    const mapa: Record<string, { nome: string; tipo: string; quantidade: number; total: number }> = {}
    ;(data ?? []).forEach((i: any) => {
      const nome = i.produtos?.nome ?? '—'
      if (!mapa[nome]) mapa[nome] = { nome, tipo: i.produtos?.tipo ?? '', quantidade: 0, total: 0 }
      mapa[nome].quantidade += Number(i.quantidade)
      mapa[nome].total      += Number(i.subtotal)
    })

    const lista = Object.values(mapa).sort((a, b) => b.total - a.total)
    const totalGeral = lista.reduce((s, p) => s + p.total, 0)

    // Curva ABC
    let acum = 0
    return lista.map(p => {
      acum += p.total
      const pct    = totalGeral > 0 ? (p.total / totalGeral) * 100 : 0
      const acumPct = totalGeral > 0 ? (acum / totalGeral) * 100 : 0
      return { ...p, pct: Number(pct.toFixed(1)), acumPct: Number(acumPct.toFixed(1)), curva: acumPct <= 80 ? 'A' : acumPct <= 95 ? 'B' : 'C' }
    })
  })
}
