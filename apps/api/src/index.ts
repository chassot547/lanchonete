import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import websocket from '@fastify/websocket'
import { pedidosRoutes } from './modules/pedidos/pedidos.routes'
import { produtosRoutes } from './modules/produtos/produtos.routes'
import { mesasRoutes } from './modules/mesas/mesas.routes'
import { estoqueRoutes } from './modules/estoque/estoque.routes'
import { financeiroRoutes } from './modules/financeiro/financeiro.routes'
import { usuariosRoutes } from './modules/usuarios/usuarios.routes'
import { clientesRoutes } from './modules/clientes/clientes.routes'
import { caixaRoutes } from './modules/caixa/caixa.routes'
import { fiscalRoutes } from './modules/fiscal/fiscal.routes'
import { fornecedoresRoutes } from './modules/fornecedores/fornecedores.routes'
import { setupSupabaseRealtime, registrarWS } from './lib/websocket'

const app = Fastify({ logger: true })

async function bootstrap() {
  // Plugins
  await app.register(cors, { origin: true })
  await app.register(jwt, { secret: process.env.JWT_SECRET! })
  await app.register(websocket)

  // Auth hook — valida tokens do Supabase Auth e anexa perfil
  app.addHook('preHandler', async (req, reply) => {
    // Rotas públicas: saúde, login e leitura do cardápio (sem auth)
    const publicas = ['/health', '/auth/login', '/produtos', '/categorias', '/mesas', '/ws/']
    if (publicas.some(p => req.url.startsWith(p))) return
    const bearer = req.headers.authorization?.replace('Bearer ', '')
    if (!bearer) return reply.code(401).send({ error: 'Não autorizado' })
    const { supabase } = await import('./lib/supabase')
    const { data, error } = await supabase.auth.getUser(bearer)
    if (error || !data.user) return reply.code(401).send({ error: 'Não autorizado' })

    // Busca perfil na tabela public.usuarios
    const { data: usuarioDB } = await supabase
      .from('usuarios')
      .select('perfil, nome, ativo')
      .eq('id', data.user.id)
      .maybeSingle()

    if (usuarioDB?.ativo === false) return reply.code(403).send({ error: 'Usuário inativo' })

    ;(req as any).usuario = {
      ...data.user,
      perfil: usuarioDB?.perfil ?? 'caixa',
      nome:   usuarioDB?.nome ?? data.user.email,
    }
  })

  // Rotas REST
  await app.register(usuariosRoutes)
  await app.register(pedidosRoutes)
  await app.register(produtosRoutes)
  await app.register(mesasRoutes)
  await app.register(estoqueRoutes)
  await app.register(financeiroRoutes)
  await app.register(clientesRoutes)
  await app.register(caixaRoutes)
  await app.register(fiscalRoutes)
  await app.register(fornecedoresRoutes)

  // WebSocket — KDS
  app.get('/ws/kds', { websocket: true }, (socket) => {
    registrarWS('kds', socket as any)
  })

  // WebSocket — PDV (notificações de pedido pronto)
  app.get('/ws/pdv', { websocket: true }, (socket) => {
    registrarWS('pdv', socket as any)
  })

  // WebSocket — Painel (alertas de estoque, vendas em tempo real)
  app.get('/ws/painel', { websocket: true }, (socket) => {
    registrarWS('painel', socket as any)
  })

  // Health check
  app.get('/health', async () => ({ ok: true, ts: new Date().toISOString() }))

  // Supabase Realtime → WebSocket broadcast
  setupSupabaseRealtime(app)

  await app.listen({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' })
  app.log.info(`API rodando na porta ${process.env.PORT ?? 3000}`)
}

bootstrap().catch(err => {
  console.error(err)
  process.exit(1)
})
