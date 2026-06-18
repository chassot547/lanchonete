import { FastifyInstance } from 'fastify'
import { supabase } from '../../lib/supabase'
import { soAdmin, gerenteOuMais } from '../../lib/guard'

export async function usuariosRoutes(app: FastifyInstance) {
  // Login público
  app.post('/auth/login', async (req, reply) => {
    const { email, senha } = req.body as { email: string; senha: string }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) return reply.status(401).send({ message: error.message })

    // Busca perfil
    const { data: u } = await supabase
      .from('usuarios')
      .select('perfil, nome, ativo')
      .eq('id', data.user.id)
      .maybeSingle()

    if (u?.ativo === false) return reply.status(403).send({ message: 'Usuário inativo' })

    return {
      token:   data.session?.access_token,
      usuario: { ...data.user, perfil: u?.perfil ?? 'caixa', nome: u?.nome },
    }
  })

  // Meu perfil
  app.get('/usuarios/me', async (req, reply) => {
    return (req as any).usuario
  })

  // Listar — gerente+
  app.get('/usuarios', { preHandler: gerenteOuMais }, async (_req, reply) => {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nome, email, perfil, ativo, criado_em')
      .order('nome')
    if (error) return reply.status(500).send(error)
    return data
  })

  // Criar — admin apenas (cria no Supabase Auth + insere em public.usuarios)
  app.post('/usuarios', { preHandler: soAdmin }, async (req, reply) => {
    const { nome, email, senha, perfil } = req.body as any

    // Cria no Supabase Auth
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
    })
    if (authErr) return reply.code(400).send({ error: authErr.message })

    // Insere em public.usuarios com o mesmo ID
    const { data, error } = await supabase
      .from('usuarios')
      .insert({ id: authData.user.id, nome, email, perfil, senha_hash: '(supabase-auth)' })
      .select()
      .single()
    if (error) return reply.code(500).send({ error: error.message })

    return reply.code(201).send(data)
  })

  // Atualizar perfil/ativo — admin apenas
  app.patch<{ Params: { id: string } }>('/usuarios/:id', { preHandler: soAdmin }, async (req, reply) => {
    const { nome, perfil, ativo } = req.body as any
    const { data, error } = await supabase
      .from('usuarios')
      .update({ nome, perfil, ativo })
      .eq('id', req.params.id)
      .select()
      .single()
    if (error) return reply.code(500).send({ error: error.message })
    return data
  })

  // Desativar — admin apenas (não exclui, apenas inativa)
  app.delete<{ Params: { id: string } }>('/usuarios/:id', { preHandler: soAdmin }, async (req, reply) => {
    const { error } = await supabase
      .from('usuarios')
      .update({ ativo: false })
      .eq('id', req.params.id)
    if (error) return reply.code(500).send({ error: error.message })
    return reply.code(204).send()
  })
}
