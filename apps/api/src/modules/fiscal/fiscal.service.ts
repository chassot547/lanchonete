import { supabase } from '../../lib/supabase'

const TOKEN    = process.env.FOCUSNFE_TOKEN!
const ENV      = process.env.FOCUSNFE_ENV ?? 'homologacao'
const BASE_URL = ENV === 'producao'
  ? 'https://api.focusnfe.com.br'
  : 'https://homologacao.focusnfe.com.br'

// Dados da empresa — configurados no .env
const EMPRESA = {
  cnpj:               process.env.EMPRESA_CNPJ ?? '',
  inscricao_estadual: process.env.EMPRESA_IE ?? '',
  nome:               process.env.EMPRESA_NOME ?? 'LANCHONETE',
  nome_fantasia:      process.env.EMPRESA_FANTASIA ?? 'LANCHONETE',
  regime_tributario:  process.env.EMPRESA_REGIME ?? '1', // 1=Simples
  logradouro:         process.env.EMPRESA_LOGRADOURO ?? '',
  numero:             process.env.EMPRESA_NUMERO ?? 'S/N',
  bairro:             process.env.EMPRESA_BAIRRO ?? '',
  municipio:          process.env.EMPRESA_MUNICIPIO ?? '',
  uf:                 process.env.EMPRESA_UF ?? 'SP',
  cep:                process.env.EMPRESA_CEP ?? '',
  codigo_municipio:   process.env.EMPRESA_COD_MUNICIPIO ?? '',
}

function authHeader() {
  return `Basic ${Buffer.from(`${TOKEN}:`).toString('base64')}`
}

export async function emitirNFCe(pedidoId: string, cpfConsumidor?: string) {
  if (!TOKEN) throw new Error('FOCUSNFE_TOKEN não configurado — configure no .env para emitir NFC-e')

  const { data: pedido } = await supabase
    .from('pedidos')
    .select(`*, itens_pedido(*, produtos(nome, preco_venda)), pagamentos(forma, valor)`)
    .eq('id', pedidoId)
    .single()

  if (!pedido) throw new Error('Pedido não encontrado')

  const referencia = `NFC-${pedidoId.replace(/-/g, '').slice(0, 20)}`

  const payload: any = {
    ...EMPRESA,
    natureza_operacao:  'VENDA AO CONSUMIDOR',
    forma_pagamento:    '0',
    tipo_documento:     '1',
    finalidade_emissao: '1',
    consumidor_final:   '1',
    presenca_comprador: '1',
    itens: (pedido.itens_pedido ?? []).map((item: any, idx: number) => ({
      numero_item:              String(idx + 1),
      codigo_produto:           item.produto_id.replace(/-/g, '').slice(0, 15),
      descricao:                item.produtos?.nome ?? 'Produto',
      codigo_ncm:               '21069090',
      cfop:                     '5102',
      unidade_comercial:        'UN',
      quantidade_comercial:     String(item.quantidade),
      valor_unitario_comercial: String(Number(item.preco_unit).toFixed(2)),
      valor_bruto:              String(Number(item.subtotal).toFixed(2)),
      icms_origem:              '0',
      icms_modalidade:          '102', // CSOSN 102 — Simples Nacional sem crédito
    })),
    formas_pagamento: (pedido.pagamentos ?? []).map((pg: any) => ({
      forma_pagamento: mapearForma(pg.forma),
      valor:           String(Number(pg.valor).toFixed(2)),
    })),
  }

  if (cpfConsumidor) payload.cpf_cnpj_consumidor = cpfConsumidor.replace(/\D/g, '')

  const res = await fetch(`${BASE_URL}/v2/nfce?ref=${referencia}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
    body:    JSON.stringify(payload),
  })

  const resultado = await res.json() as any

  await supabase.from('notas_fiscais').upsert({
    pedido_id:    pedidoId,
    tipo:         'NFC-e',
    chave_acesso: resultado.chave_nfe ?? null,
    status_sefaz: resultado.status === 'autorizado' ? 'autorizada' : 'pendente',
    xml:          JSON.stringify(resultado),
    danfe_url:    resultado.caminho_danfe_nfce ?? null,
  }, { onConflict: 'pedido_id' })

  return resultado
}

export async function consultarNFCe(pedidoId: string) {
  if (!TOKEN) throw new Error('FOCUSNFE_TOKEN não configurado')

  const referencia = `NFC-${pedidoId.replace(/-/g, '').slice(0, 20)}`
  const res = await fetch(`${BASE_URL}/v2/nfce/${referencia}`, {
    headers: { Authorization: authHeader() },
  })
  return res.json()
}

export async function cancelarNFCe(pedidoId: string, justificativa: string) {
  if (!TOKEN) throw new Error('FOCUSNFE_TOKEN não configurado')

  const referencia = `NFC-${pedidoId.replace(/-/g, '').slice(0, 20)}`
  const res = await fetch(`${BASE_URL}/v2/nfce/${referencia}`, {
    method:  'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
    body:    JSON.stringify({ justificativa }),
  })
  const resultado = await res.json() as any

  await supabase
    .from('notas_fiscais')
    .update({ status_sefaz: 'cancelada' })
    .eq('pedido_id', pedidoId)

  return resultado
}

function mapearForma(forma: string): string {
  const mapa: Record<string, string> = {
    dinheiro: '01', credito: '03', debito: '04', pix: '17',
    assinatura: '99', vale: '99',
  }
  return mapa[forma] ?? '99'
}
