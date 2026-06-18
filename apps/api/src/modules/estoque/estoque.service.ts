import { supabase } from '../../lib/supabase'
import type { Ingrediente, FichaTecnicaItem } from '@lanchonete/types'

export async function listarIngredientes() {
  const { data, error } = await supabase
    .from('v_estoque_alerta')
    .select('*')

  if (error) throw new Error(error.message)

  return (data ?? []).map((i: any) => ({
    id:             i.id,
    nome:           i.nome,
    unidade:        i.unidade,
    quantidadeAtual: Number(i.estoque_atual),
    estoqueMinimo:  Number(i.estoque_minimo),
    custoMedio:     Number(i.custo_medio ?? 0),
    situacao:       i.situacao,
  }))
}

export async function registrarEntrada(
  ingredienteId: string,
  quantidade: number,
  custoTotal: number,
  notaXml?: string
) {
  // Registrar entrada
  const { error: erroEntrada } = await supabase.from('entradas_estoque').insert({
    ingrediente_id: ingredienteId,
    quantidade,
    custo_total: custoTotal,
    nota_xml: notaXml,
  })
  if (erroEntrada) throw new Error(erroEntrada.message)

  // Atualizar estoque e custo médio ponderado
  const { data: atual } = await supabase
    .from('ingredientes')
    .select('estoque_atual, custo_unit')
    .eq('id', ingredienteId)
    .single()

  if (atual) {
    const custoUnit = custoTotal / quantidade
    const estoqueNovo = atual.estoque_atual + quantidade
    const custoMedio = ((atual.estoque_atual * atual.custo_unit) + (quantidade * custoUnit)) / estoqueNovo

    await supabase
      .from('ingredientes')
      .update({ estoque_atual: estoqueNovo, custo_unit: custoMedio, atualizado_em: new Date().toISOString() })
      .eq('id', ingredienteId)
  }
}

export async function salvarFichaTecnica(produtoId: string, itens: FichaTecnicaItem[]) {
  // Remove ficha anterior e recria
  await supabase.from('ficha_tecnica').delete().eq('produto_id', produtoId)

  const registros = itens.map(i => ({
    produto_id:      produtoId,
    ingrediente_id:  i.ingredienteId,
    quantidade:      i.quantidade,
    unidade:         i.unidade,
  }))

  const { error } = await supabase.from('ficha_tecnica').insert(registros)
  if (error) throw new Error(error.message)
}

export async function calcularCMV(dataInicio: string, dataFim: string) {
  const { data, error } = await supabase
    .from('v_kpis_dia')
    .select('*')
    .gte('data', dataInicio)
    .lte('data', dataFim)

  if (error) throw new Error(error.message)

  const totalFaturamento = data?.reduce((s, d) => s + Number(d.faturamento), 0) ?? 0
  const totalCusto       = data?.reduce((s, d) => s + Number(d.custo_total), 0) ?? 0

  return {
    periodo: { inicio: dataInicio, fim: dataFim },
    faturamento: totalFaturamento,
    custoTotal:  totalCusto,
    cmvPct:      totalFaturamento > 0 ? (totalCusto / totalFaturamento) * 100 : 0,
    dias:        data,
  }
}
