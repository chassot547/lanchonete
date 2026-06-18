interface ItemComanda {
  produto_nome: string
  quantidade: number
  observacao?: string
  status_kds: string
  estacao: string
}

interface PedidoComanda {
  id: string
  tipo: string
  mesa_numero?: number
  itens: ItemComanda[]
  criado_em: string
  minutos: number
}

export function imprimirComanda(pedido: PedidoComanda) {
  const hora = new Date(pedido.criado_em).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const local =
    pedido.tipo === 'mesa'     ? `Mesa ${pedido.mesa_numero}` :
    pedido.tipo === 'delivery' ? 'Delivery' : 'Balcão'

  const linhasItens = pedido.itens.map(i => {
    const obs = i.observacao ? `\n        <div class="obs">Obs: ${i.observacao}</div>` : ''
    return `
      <div class="item">
        <span class="qtd">${i.quantidade}x</span>
        <span class="nome">${i.produto_nome}</span>
        ${obs}
      </div>`
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Comanda #${pedido.id.slice(-6).toUpperCase()}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 12px;
    width: 80mm;
    padding: 4mm;
    color: #000;
  }
  .header { text-align: center; margin-bottom: 6px; }
  .header h1 { font-size: 16px; font-weight: bold; }
  .header h2 { font-size: 13px; font-weight: bold; margin-top: 2px; }
  .divider { border-top: 1px dashed #000; margin: 6px 0; }
  .info { font-size: 11px; margin-bottom: 2px; }
  .item { display: flex; gap: 4px; margin: 4px 0; align-items: baseline; flex-wrap: wrap; }
  .qtd { font-weight: bold; min-width: 22px; }
  .nome { flex: 1; }
  .obs { font-size: 10px; color: #444; padding-left: 26px; width: 100%; font-style: italic; }
  .footer { text-align: center; font-size: 10px; margin-top: 8px; }
  @media print {
    body { width: 80mm; }
    @page { size: 80mm auto; margin: 0; }
  }
</style>
</head>
<body>
  <div class="header">
    <h1>LANCHONETE</h1>
    <h2>— COMANDA —</h2>
  </div>
  <div class="divider"></div>
  <div class="info"><b>Pedido:</b> #${pedido.id.slice(-6).toUpperCase()}</div>
  <div class="info"><b>Local:</b> ${local}</div>
  <div class="info"><b>Hora:</b> ${hora}</div>
  <div class="divider"></div>
  <div class="info" style="font-weight:bold; margin-bottom:4px;">ITENS</div>
  ${linhasItens}
  <div class="divider"></div>
  <div class="footer">
    <div>Toque no item no KDS para avançar</div>
    <div style="margin-top:4px; font-weight:bold;">★ Bom apetite! ★</div>
  </div>
</body>
</html>`

  const win = window.open('', '_blank', 'width=340,height=600')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => {
    win.print()
    win.close()
  }, 300)
}
