import type { FastifyRequest, FastifyReply } from 'fastify'

export type Perfil = 'admin' | 'gerente' | 'caixa' | 'cozinha' | 'entregador'

const HIERARQUIA: Perfil[] = ['entregador', 'cozinha', 'caixa', 'gerente', 'admin']

function nivel(p: Perfil) {
  return HIERARQUIA.indexOf(p)
}

export function requirePerfil(...perfisPermitidos: Perfil[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const perfil = (req as any).usuario?.perfil as Perfil | undefined
    if (!perfil) return reply.code(403).send({ error: 'Sem perfil definido' })

    const minNivel = Math.min(...perfisPermitidos.map(nivel))
    if (nivel(perfil) < minNivel && !perfisPermitidos.includes(perfil)) {
      return reply.code(403).send({ error: `Acesso restrito. Perfil necessário: ${perfisPermitidos.join(' ou ')}` })
    }
  }
}

// Shorthand guards
export const soAdmin     = requirePerfil('admin')
export const gerenteOuMais = requirePerfil('gerente', 'admin')
export const caixaOuMais   = requirePerfil('caixa', 'gerente', 'admin')
