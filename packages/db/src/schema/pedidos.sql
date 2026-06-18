-- ── Schema: lanchonete ───────────────────────────────────────────────────────
-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Usuários / Operadores ─────────────────────────────────────────────────────
CREATE TABLE usuarios (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          VARCHAR(120)  NOT NULL,
  email         VARCHAR(200)  NOT NULL UNIQUE,
  senha_hash    VARCHAR(255)  NOT NULL,
  perfil        VARCHAR(20)   NOT NULL CHECK (perfil IN ('admin','gerente','caixa','cozinha','entregador')),
  ativo         BOOLEAN       NOT NULL DEFAULT true,
  criado_em     TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ── Categorias de Produto ─────────────────────────────────────────────────────
CREATE TABLE categorias (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome    VARCHAR(80) NOT NULL,
  ordem   INT         NOT NULL DEFAULT 0,
  ativo   BOOLEAN     NOT NULL DEFAULT true
);

-- ── Ingredientes / Insumos ────────────────────────────────────────────────────
CREATE TABLE ingredientes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome             VARCHAR(120)   NOT NULL,
  unidade          VARCHAR(10)    NOT NULL CHECK (unidade IN ('g','kg','ml','L','un','cx')),
  estoque_atual    NUMERIC(12,4)  NOT NULL DEFAULT 0,
  estoque_minimo   NUMERIC(12,4)  NOT NULL DEFAULT 0,
  custo_unit       NUMERIC(10,4)  NOT NULL DEFAULT 0,
  atualizado_em    TIMESTAMPTZ    NOT NULL DEFAULT now()
);

-- ── Produtos ──────────────────────────────────────────────────────────────────
CREATE TABLE produtos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id  UUID          NOT NULL REFERENCES categorias(id),
  nome          VARCHAR(120)  NOT NULL,
  descricao     TEXT,
  preco_venda   NUMERIC(10,2) NOT NULL CHECK (preco_venda >= 0),
  tipo          VARCHAR(20)   NOT NULL DEFAULT 'simples' CHECK (tipo IN ('simples','combo','variante')),
  imagem_url    TEXT,
  ativo         BOOLEAN       NOT NULL DEFAULT true,
  criado_em     TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ── Ficha Técnica ─────────────────────────────────────────────────────────────
CREATE TABLE ficha_tecnica (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id      UUID           NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  ingrediente_id  UUID           NOT NULL REFERENCES ingredientes(id),
  quantidade      NUMERIC(12,4)  NOT NULL CHECK (quantidade > 0),
  unidade         VARCHAR(10)    NOT NULL,
  UNIQUE (produto_id, ingrediente_id)
);

-- ── Mesas ─────────────────────────────────────────────────────────────────────
CREATE TABLE mesas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero      INT         NOT NULL UNIQUE,
  status      VARCHAR(20) NOT NULL DEFAULT 'livre' CHECK (status IN ('livre','ocupada','reservada')),
  capacidade  INT         NOT NULL DEFAULT 4,
  qr_code     TEXT        NOT NULL
);

-- ── Clientes ─────────────────────────────────────────────────────────────────
CREATE TABLE clientes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        VARCHAR(120) NOT NULL,
  telefone    VARCHAR(20)  NOT NULL UNIQUE,
  cpf         VARCHAR(14),
  pontos      INT          NOT NULL DEFAULT 0,
  endereco    JSONB,
  criado_em   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ── Pedidos ───────────────────────────────────────────────────────────────────
CREATE TABLE pedidos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id    UUID           REFERENCES clientes(id),
  mesa_id       UUID           REFERENCES mesas(id),
  operador_id   UUID           NOT NULL REFERENCES usuarios(id),
  tipo          VARCHAR(20)    NOT NULL CHECK (tipo IN ('balcao','mesa','delivery')),
  status        VARCHAR(20)    NOT NULL DEFAULT 'aberto'
                  CHECK (status IN ('aberto','em_producao','pronto','pago','cancelado')),
  subtotal      NUMERIC(10,2)  NOT NULL DEFAULT 0,
  desconto      NUMERIC(10,2)  NOT NULL DEFAULT 0,
  total         NUMERIC(10,2)  GENERATED ALWAYS AS (subtotal - desconto) STORED,
  criado_em     TIMESTAMPTZ    NOT NULL DEFAULT now(),
  fechado_em    TIMESTAMPTZ
);

CREATE INDEX idx_pedidos_status    ON pedidos(status);
CREATE INDEX idx_pedidos_criado_em ON pedidos(criado_em);
CREATE INDEX idx_pedidos_mesa_id   ON pedidos(mesa_id) WHERE mesa_id IS NOT NULL;

-- ── Itens do Pedido ───────────────────────────────────────────────────────────
CREATE TABLE itens_pedido (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id    UUID           NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  produto_id   UUID           NOT NULL REFERENCES produtos(id),
  quantidade   INT            NOT NULL CHECK (quantidade > 0),
  preco_unit   NUMERIC(10,2)  NOT NULL,
  subtotal     NUMERIC(10,2)  GENERATED ALWAYS AS (quantidade * preco_unit) STORED,
  observacao   TEXT,
  status_kds   VARCHAR(20)    NOT NULL DEFAULT 'aguardando'
                 CHECK (status_kds IN ('aguardando','em_producao','pronto'))
);

CREATE INDEX idx_itens_pedido_id ON itens_pedido(pedido_id);

-- ── Pagamentos ────────────────────────────────────────────────────────────────
CREATE TABLE pagamentos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id    UUID           NOT NULL REFERENCES pedidos(id),
  forma        VARCHAR(20)    NOT NULL CHECK (forma IN ('dinheiro','pix','debito','credito','assinatura','vale')),
  valor        NUMERIC(10,2)  NOT NULL CHECK (valor > 0),
  troco        NUMERIC(10,2)  DEFAULT 0,
  nfce_chave   VARCHAR(44),
  criado_em    TIMESTAMPTZ    NOT NULL DEFAULT now()
);

-- ── NFC-e / NF-e ─────────────────────────────────────────────────────────────
CREATE TABLE notas_fiscais (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id      UUID         NOT NULL REFERENCES pedidos(id),
  tipo           VARCHAR(10)  NOT NULL CHECK (tipo IN ('NFC-e','NF-e')),
  chave_acesso   VARCHAR(44)  UNIQUE,
  status_sefaz   VARCHAR(20)  NOT NULL DEFAULT 'pendente'
                   CHECK (status_sefaz IN ('pendente','autorizada','cancelada','rejeitada')),
  xml            TEXT,
  danfe_url      TEXT,
  emitida_em     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ── Caixa ─────────────────────────────────────────────────────────────────────
CREATE TABLE caixa_sessoes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operador_id    UUID           NOT NULL REFERENCES usuarios(id),
  abertura       TIMESTAMPTZ    NOT NULL DEFAULT now(),
  fechamento     TIMESTAMPTZ,
  saldo_inicial  NUMERIC(10,2)  NOT NULL DEFAULT 0,
  saldo_final    NUMERIC(10,2),
  diferenca      NUMERIC(10,2)  GENERATED ALWAYS AS (saldo_final - saldo_inicial) STORED
);

-- ── Movimentações Financeiras ─────────────────────────────────────────────────
CREATE TABLE movimentacoes_financeiras (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caixa_id    UUID           NOT NULL REFERENCES caixa_sessoes(id),
  tipo        VARCHAR(20)    NOT NULL CHECK (tipo IN ('receita','despesa','sangria','suprimento')),
  valor       NUMERIC(10,2)  NOT NULL CHECK (valor > 0),
  descricao   VARCHAR(255)   NOT NULL,
  data        TIMESTAMPTZ    NOT NULL DEFAULT now()
);

-- ── Entradas de Estoque ───────────────────────────────────────────────────────
CREATE TABLE entradas_estoque (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingrediente_id  UUID           NOT NULL REFERENCES ingredientes(id),
  quantidade      NUMERIC(12,4)  NOT NULL CHECK (quantidade > 0),
  custo_total     NUMERIC(10,2)  NOT NULL,
  nota_xml        TEXT,
  data_entrada    DATE           NOT NULL DEFAULT CURRENT_DATE
);

-- ── Planos de Assinatura ──────────────────────────────────────────────────────
CREATE TABLE planos_assinatura (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            VARCHAR(120)   NOT NULL,
  descricao       TEXT,
  valor_mensal    NUMERIC(10,2)  NOT NULL CHECK (valor_mensal > 0),
  itens           JSONB          NOT NULL DEFAULT '[]',
  ativo           BOOLEAN        NOT NULL DEFAULT true
);

-- ── Assinaturas ───────────────────────────────────────────────────────────────
CREATE TABLE assinaturas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id      UUID        NOT NULL REFERENCES clientes(id),
  plano_id        UUID        NOT NULL REFERENCES planos_assinatura(id),
  status          VARCHAR(20) NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','suspensa','cancelada')),
  saldo_itens     JSONB       NOT NULL DEFAULT '{}',
  vencimento      DATE        NOT NULL,
  renovacao_auto  BOOLEAN     NOT NULL DEFAULT true,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Promoções ─────────────────────────────────────────────────────────────────
CREATE TABLE promocoes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome             VARCHAR(120)   NOT NULL,
  tipo             VARCHAR(20)    NOT NULL CHECK (tipo IN ('desconto_fixo','desconto_pct','combo')),
  valor            NUMERIC(10,2)  NOT NULL,
  horario_inicio   TIME,
  horario_fim      TIME,
  dias_semana      INT[]          DEFAULT '{0,1,2,3,4,5,6}',
  ativo            BOOLEAN        NOT NULL DEFAULT true
);

-- ── Delivery ──────────────────────────────────────────────────────────────────
CREATE TABLE deliveries (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id          UUID         NOT NULL REFERENCES pedidos(id),
  cliente_id         UUID         NOT NULL REFERENCES clientes(id),
  endereco_entrega   JSONB        NOT NULL,
  taxa_entrega       NUMERIC(10,2) NOT NULL DEFAULT 0,
  status             VARCHAR(20)  NOT NULL DEFAULT 'confirmado'
                       CHECK (status IN ('confirmado','em_preparo','saiu','entregue','cancelado')),
  origem             VARCHAR(20)  NOT NULL DEFAULT 'proprio'
                       CHECK (origem IN ('proprio','ifood','rappi','ubereats','whatsapp')),
  estimativa_min     INT
);
