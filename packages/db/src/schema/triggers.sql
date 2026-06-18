-- ── Trigger: baixa automática de estoque ao inserir item no pedido ────────────
CREATE OR REPLACE FUNCTION fn_baixa_estoque()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE ingredientes i
  SET
    estoque_atual = estoque_atual - (ft.quantidade * NEW.quantidade),
    atualizado_em = now()
  FROM ficha_tecnica ft
  WHERE ft.produto_id    = NEW.produto_id
    AND ft.ingrediente_id = i.id;

  -- Notifica o backend se algum ingrediente ficou abaixo do mínimo
  PERFORM pg_notify(
    'estoque_minimo',
    json_build_object(
      'ingrediente_id', i.id,
      'nome',           i.nome,
      'estoque_atual',  i.estoque_atual,
      'estoque_minimo', i.estoque_minimo
    )::text
  )
  FROM ingredientes i
  JOIN ficha_tecnica ft ON ft.ingrediente_id = i.id
  WHERE ft.produto_id = NEW.produto_id
    AND i.estoque_atual < i.estoque_minimo;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_baixa_estoque
AFTER INSERT ON itens_pedido
FOR EACH ROW EXECUTE FUNCTION fn_baixa_estoque();

-- ── Trigger: atualiza subtotal do pedido quando item é inserido/removido ──────
CREATE OR REPLACE FUNCTION fn_atualiza_subtotal_pedido()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE pedidos
  SET subtotal = (
    SELECT COALESCE(SUM(quantidade * preco_unit), 0)
    FROM itens_pedido
    WHERE pedido_id = COALESCE(NEW.pedido_id, OLD.pedido_id)
  )
  WHERE id = COALESCE(NEW.pedido_id, OLD.pedido_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_atualiza_subtotal_insert
AFTER INSERT ON itens_pedido
FOR EACH ROW EXECUTE FUNCTION fn_atualiza_subtotal_pedido();

CREATE TRIGGER trg_atualiza_subtotal_delete
AFTER DELETE ON itens_pedido
FOR EACH ROW EXECUTE FUNCTION fn_atualiza_subtotal_pedido();

-- ── Trigger: atualiza status da mesa ao abrir/fechar pedido ──────────────────
CREATE OR REPLACE FUNCTION fn_status_mesa()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.mesa_id IS NOT NULL THEN
    IF NEW.status = 'aberto' OR NEW.status = 'em_producao' THEN
      UPDATE mesas SET status = 'ocupada' WHERE id = NEW.mesa_id;
    ELSIF NEW.status IN ('pago', 'cancelado') THEN
      -- só libera se não houver outro pedido aberto na mesa
      UPDATE mesas SET status = 'livre'
      WHERE id = NEW.mesa_id
        AND NOT EXISTS (
          SELECT 1 FROM pedidos
          WHERE mesa_id = NEW.mesa_id
            AND status NOT IN ('pago','cancelado')
            AND id <> NEW.id
        );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_status_mesa
AFTER INSERT OR UPDATE OF status ON pedidos
FOR EACH ROW EXECUTE FUNCTION fn_status_mesa();
