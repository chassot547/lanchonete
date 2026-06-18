import type { FastifyInstance } from 'fastify'
import type { WebSocket } from 'ws'

type Canal = 'kds' | 'pdv' | 'painel'

const conexoes = new Map<Canal, Set<WebSocket>>()

export function registrarWS(canal: Canal, ws: WebSocket) {
  if (!conexoes.has(canal)) conexoes.set(canal, new Set())
  conexoes.get(canal)!.add(ws)
  ws.on('close', () => conexoes.get(canal)?.delete(ws))
}

export function broadcast(canal: Canal, payload: unknown) {
  const sockets = conexoes.get(canal)
  if (!sockets) return
  const msg = JSON.stringify(payload)
  for (const ws of sockets) {
    if (ws.readyState === ws.OPEN) ws.send(msg)
  }
}

export function setupSupabaseRealtime(app: FastifyInstance) {
  const { supabase } = require('./supabase')

  supabase
    .channel('itens_pedido')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'itens_pedido' }, (payload: unknown) => {
      broadcast('kds', { evento: 'novo_item', dados: payload })
      app.log.info('KDS: novo item recebido')
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'itens_pedido' }, (payload: unknown) => {
      broadcast('kds', { evento: 'item_atualizado', dados: payload })
      broadcast('pdv', { evento: 'item_atualizado', dados: payload })
    })
    .subscribe()

  supabase
    .channel('estoque_minimo')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ingredientes' }, (payload: any) => {
      const { new: ingrediente } = payload
      if (ingrediente.estoque_atual < ingrediente.estoque_minimo) {
        broadcast('painel', { evento: 'alerta_estoque', dados: ingrediente })
      }
    })
    .subscribe()
}
