-- ── View: custo total de cada produto via ficha técnica ──────────────────────
CREATE OR REPLACE VIEW v_custo_produto AS
SELECT
  p.id,
  p.nome,
  p.preco_venda,
  COALESCE(SUM(ft.quantidade * i.custo_unit), 0)                       AS custo_total,
  ROUND(COALESCE(SUM(ft.quantidade * i.custo_unit), 0) / NULLIF(p.preco_venda, 0) * 100, 2) AS cmv_pct
FROM produtos p
LEFT JOIN ficha_tecnica ft ON ft.produto_id = p.id
LEFT JOIN ingredientes   i  ON i.id = ft.ingrediente_id
GROUP BY p.id, p.nome, p.preco_venda;

-- ── View: KPIs do dia ─────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_kpis_dia AS
SELECT
  DATE(p.criado_em)                                   AS data,
  COUNT(*)                                            AS total_pedidos,
  COALESCE(SUM(p.total), 0)                           AS faturamento,
  ROUND(AVG(p.total), 2)                              AS ticket_medio,
  COALESCE(SUM(
    (SELECT SUM(ft.quantidade * i.custo_unit * ip.quantidade)
     FROM itens_pedido ip
     JOIN ficha_tecnica ft ON ft.produto_id = ip.produto_id
     JOIN ingredientes i ON i.id = ft.ingrediente_id
     WHERE ip.pedido_id = p.id)
  ), 0)                                               AS custo_total,
  ROUND(
    COALESCE(SUM(
      (SELECT SUM(ft.quantidade * i.custo_unit * ip.quantidade)
       FROM itens_pedido ip
       JOIN ficha_tecnica ft ON ft.produto_id = ip.produto_id
       JOIN ingredientes i ON i.id = ft.ingrediente_id
       WHERE ip.pedido_id = p.id)
    ), 0) / NULLIF(SUM(p.total), 0) * 100, 2
  )                                                   AS cmv_pct
FROM pedidos p
WHERE p.status = 'pago'
GROUP BY DATE(p.criado_em)
ORDER BY data DESC;

-- ── View: ranking de produtos por receita ─────────────────────────────────────
CREATE OR REPLACE VIEW v_ranking_produtos AS
SELECT
  pr.id,
  pr.nome,
  SUM(ip.quantidade)           AS total_vendido,
  SUM(ip.subtotal)             AS receita_total,
  ROUND(AVG(ip.preco_unit), 2) AS preco_medio
FROM itens_pedido ip
JOIN pedidos p ON p.id = ip.pedido_id AND p.status = 'pago'
JOIN produtos pr ON pr.id = ip.produto_id
GROUP BY pr.id, pr.nome
ORDER BY receita_total DESC;

-- ── View: estoque com alerta ──────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_estoque_alerta AS
SELECT
  id,
  nome,
  unidade,
  estoque_atual,
  estoque_minimo,
  CASE
    WHEN estoque_atual <= 0              THEN 'zerado'
    WHEN estoque_atual <= estoque_minimo THEN 'critico'
    WHEN estoque_atual <= estoque_minimo * 1.5 THEN 'baixo'
    ELSE 'ok'
  END AS situacao
FROM ingredientes
ORDER BY situacao, nome;
