import type { FastifyInstance } from 'fastify'
import { emitirNFCe, consultarNFCe, cancelarNFCe } from './fiscal.service'
import { supabase } from '../../lib/supabase'
import { caixaOuMais, gerenteOuMais } from '../../lib/guard'

export async function fiscalRoutes(app: FastifyInstance) {
  // POST /fiscal/nfce/:pedidoId — emitir NFC-e
  app.post<{ Params: { pedidoId: string }; Body: { cpfConsumidor?: string } }>(
    '/fiscal/nfce/:pedidoId',
    { preHandler: caixaOuMais },
    async (req, reply) => {
      try {
        const resultado = await emitirNFCe(req.params.pedidoId, req.body.cpfConsumidor)
        return reply.send(resultado)
      } catch (err: any) {
        return reply.code(500).send({ error: err.message })
      }
    }
  )

  // GET /fiscal/nfce/:pedidoId — consultar status
  app.get<{ Params: { pedidoId: string } }>(
    '/fiscal/nfce/:pedidoId',
    { preHandler: caixaOuMais },
    async (req, reply) => {
      const { data, error } = await supabase
        .from('notas_fiscais')
        .select('*')
        .eq('pedido_id', req.params.pedidoId)
        .maybeSingle()
      if (error) return reply.code(500).send({ error: error.message })
      return reply.send(data ?? { status: 'nao_emitida' })
    }
  )

  // POST /fiscal/nfce/:pedidoId/cancelar — cancelar NFC-e
  app.post<{ Params: { pedidoId: string }; Body: { justificativa: string } }>(
    '/fiscal/nfce/:pedidoId/cancelar',
    { preHandler: gerenteOuMais },
    async (req, reply) => {
      try {
        const resultado = await cancelarNFCe(req.params.pedidoId, req.body.justificativa)
        return reply.send(resultado)
      } catch (err: any) {
        return reply.code(500).send({ error: err.message })
      }
    }
  )

  // GET /fiscal/notas — listar últimas notas (gerente+)
  app.get<{ Querystring: { ini?: string; fim?: string } }>(
    '/fiscal/notas',
    { preHandler: gerenteOuMais },
    async (req, reply) => {
      const hoje = new Date().toISOString().split('T')[0]
      const ini = req.query.ini ?? hoje
      const fim = req.query.fim ?? hoje

      const { data, error } = await supabase
        .from('notas_fiscais')
        .select('*, pedidos(tipo, total)')
        .gte('emitida_em', `${ini}T00:00:00`)
        .lte('emitida_em', `${fim}T23:59:59`)
        .order('emitida_em', { ascending: false })
      if (error) return reply.code(500).send({ error: error.message })
      return data
    }
  )
}
