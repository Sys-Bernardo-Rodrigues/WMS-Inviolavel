"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pgOperations = void 0;
exports.initializePostgres = initializePostgres;
const pg_1 = require("pg");
const crypto_1 = __importDefault(require("crypto"));
const pool = new pg_1.Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'inviolavel_user',
    password: process.env.DB_PASSWORD || 'inviolavel_password',
    database: process.env.DB_NAME || 'inviolavel_wms',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});
pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});
// Initialize database schema, triggers, and seed data
async function initializePostgres() {
    const client = await pool.connect();
    try {
        console.log('Initializing PostgreSQL database schema...');
        // Start transaction for schema creation
        await client.query('BEGIN');
        // 1. Create Enums if they do not exist
        await client.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_movimentacao_enum') THEN 
          CREATE TYPE tipo_movimentacao_enum AS ENUM ('ENTRADA', 'SAIDA'); 
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subtipo_movimentacao_enum') THEN 
          CREATE TYPE subtipo_movimentacao_enum AS ENUM (
            'NEGOCIACAO_LOCADA', 
            'NEGOCIACAO_VENDA', 
            'BONIFICACAO', 
            'DEVOLUCAO', 
            'DESATIVACAO', 
            'TRANSFERENCIA', 
            'AJUSTE_INVENTARIO'
          ); 
        END IF;
      END $$;
    `);
        // 2. Create Fornecedores table
        await client.query(`
      CREATE TABLE IF NOT EXISTS fornecedores (
        id_fornecedor UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nome_fornecedor VARCHAR(255) NOT NULL,
        contato VARCHAR(255),
        criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
        // 3. Create Produtos Estoque table
        await client.query(`
      CREATE TABLE IF NOT EXISTS produtos_estoque (
        id_produto UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        sku VARCHAR(255) UNIQUE NOT NULL,
        category VARCHAR(100) NOT NULL,
        estoque_atual DECIMAL(12, 4) NOT NULL DEFAULT 0.0000,
        price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        estoque_minimo DECIMAL(12, 4) NOT NULL DEFAULT 0.0000,
        ultima_entrada TIMESTAMP WITH TIME ZONE,
        ultima_saida TIMESTAMP WITH TIME ZONE,
        dias_sem_venda INTEGER NOT NULL DEFAULT 0,
        saldo_negativo BOOLEAN NOT NULL DEFAULT FALSE,
        quantidade_negativa DECIMAL(12, 4) NOT NULL DEFAULT 0.0000,
        venda_bloqueada BOOLEAN NOT NULL DEFAULT FALSE,
        permitir_backorder BOOLEAN NOT NULL DEFAULT FALSE,
        item_critico BOOLEAN NOT NULL DEFAULT FALSE,
        location VARCHAR(255),
        criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
        // 3.5 Create Lixeira Estoque table
        await client.query(`
      CREATE TABLE IF NOT EXISTS lixeira_estoque (
        id_produto UUID PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        sku VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        estoque_atual DECIMAL(12, 4) NOT NULL DEFAULT 0.0000,
        price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        estoque_minimo DECIMAL(12, 4) NOT NULL DEFAULT 0.0000,
        location VARCHAR(255),
        deletado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
        // 4. Create Movimentacoes table
        await client.query(`
      CREATE TABLE IF NOT EXISTS movimentacoes (
        id_movimentacao UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        id_produto UUID NOT NULL REFERENCES produtos_estoque(id_produto) ON DELETE CASCADE,
        tipo_movimentacao tipo_movimentacao_enum NOT NULL,
        subtipo_movimentacao subtipo_movimentacao_enum NOT NULL,
        quantidade DECIMAL(12, 4) NOT NULL CHECK (quantidade > 0),
        estoque_origem VARCHAR(100),
        estoque_destino VARCHAR(100),
        data_movimentacao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        numero_os VARCHAR(50)
      )
    `);
        // 5. Create Planejamento Compras table
        await client.query(`
      CREATE TABLE IF NOT EXISTS planejamento_compras (
        id_planejamento_compra UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        id_produto UUID NOT NULL UNIQUE REFERENCES produtos_estoque(id_produto) ON DELETE CASCADE,
        quantidade_a_comprar DECIMAL(12, 4) NOT NULL DEFAULT 0.0000,
        fornecedor_principal_id UUID REFERENCES fornecedores(id_fornecedor) ON DELETE SET NULL,
        prazo_entrega_estimado_dias INTEGER NOT NULL DEFAULT 0,
        data_ultima_compra TIMESTAMP WITH TIME ZONE,
        consumo_medio_mensal DECIMAL(12, 4) NOT NULL DEFAULT 0.0000
      )
    `);
        // Migration: ensure price column exists
        await client.query(`
      ALTER TABLE produtos_estoque 
      ADD COLUMN IF NOT EXISTS price DECIMAL(12, 2) NOT NULL DEFAULT 0.00;
    `);
        // Migration: ensure OS number column exists on movements
        await client.query(`
      ALTER TABLE movimentacoes 
      ADD COLUMN IF NOT EXISTS numero_os VARCHAR(50);
    `);
        // Migration: ensure tarefas_conferencia table exists
        await client.query(`
      CREATE TABLE IF NOT EXISTS tarefas_conferencia (
        id_tarefa UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        id_produto UUID NOT NULL REFERENCES produtos_estoque(id_produto) ON DELETE CASCADE,
        tipo_tarefa VARCHAR(50) NOT NULL,
        data_geracao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
        quantidade_esperada DECIMAL(12, 4) NOT NULL,
        quantidade_conferida DECIMAL(12, 4),
        data_conclusao TIMESTAMP WITH TIME ZONE,
        observacao TEXT
      )
    `);
        // Migration: ensure usuarios table exists
        await client.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id_usuario UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        nome VARCHAR(255) NOT NULL,
        perfil VARCHAR(50) NOT NULL,
        criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
        // Seed default users if usuarios is empty
        const userCheck = await client.query('SELECT COUNT(*) FROM usuarios');
        if (Number(userCheck.rows[0].count) === 0) {
            console.log('Seeding default users: admin, operador, auditor...');
            const adminHash = crypto_1.default.createHash('sha256').update('admin').digest('hex');
            const operatorHash = crypto_1.default.createHash('sha256').update('operador').digest('hex');
            const auditorHash = crypto_1.default.createHash('sha256').update('auditor').digest('hex');
            await client.query(`
        INSERT INTO usuarios (username, password_hash, nome, perfil) VALUES
        ('admin', $1, 'Administrador Inviolável', 'admin'),
        ('operador', $2, 'Operador WMS', 'operador'),
        ('auditor', $3, 'Auditor WMS', 'auditor')
      `, [adminHash, operatorHash, auditorHash]);
        }
        // 6. Create Indexes
        await client.query('CREATE INDEX IF NOT EXISTS idx_produtos_estoque_saldo ON produtos_estoque (estoque_atual)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_produtos_estoque_critico ON produtos_estoque (item_critico) WHERE item_critico = TRUE');
        await client.query('CREATE INDEX IF NOT EXISTS idx_produtos_estoque_ocioso ON produtos_estoque (dias_sem_venda)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_movimentacoes_abc_giro ON movimentacoes (tipo_movimentacao, subtipo_movimentacao, data_movimentacao)');
        // 7. Create Concurrency & Stock Update Trigger Function
        await client.query(`
      CREATE OR REPLACE FUNCTION fn_processar_movimentacao_estoque()
      RETURNS TRIGGER AS $$
      DECLARE
          v_estoque_atual DECIMAL(12, 4);
          v_estoque_minimo DECIMAL(12, 4);
          v_permitir_backorder BOOLEAN;
          v_novo_estoque DECIMAL(12, 4);
          v_item_critico BOOLEAN;
          v_venda_bloqueada BOOLEAN;
          v_quantidade_negativa DECIMAL(12, 4) := 0.0000;
          v_saldo_negativo BOOLEAN := FALSE;
      BEGIN
          -- ADQUIRIR LOCK DE REGISTRO PARA EVITAR CONCORRÊNCIA E RACE CONDITIONS
          SELECT estoque_atual, estoque_minimo, permitir_backorder
          INTO v_estoque_atual, v_estoque_minimo, v_permitir_backorder
          FROM produtos_estoque
          WHERE id_produto = NEW.id_produto
          FOR UPDATE;

          IF NOT FOUND THEN
              RAISE EXCEPTION 'Produto ID % não encontrado na base de dados.', NEW.id_produto;
          END IF;

          -- Calcular Novo Saldo
          IF NEW.tipo_movimentacao = 'ENTRADA' THEN
              v_novo_estoque := v_estoque_atual + NEW.quantidade;
          ELSE -- SAIDA
              v_novo_estoque := v_estoque_atual - NEW.quantidade;
          END IF;

          -- Validação de Saldo Negativo e Backorder
          IF v_novo_estoque < 0 THEN
              IF v_permitir_backorder = FALSE THEN
                  RAISE EXCEPTION 'Operação negada: Saldo de estoque insuficiente para o produto %.', NEW.id_produto;
              ELSE
                  v_saldo_negativo := TRUE;
                  v_quantidade_negativa := ABS(v_novo_estoque);
              END IF;
          END IF;

          -- Cálculo de Item Crítico
          IF v_novo_estoque <= v_estoque_minimo THEN
              v_item_critico := TRUE;
          ELSE
              v_item_critico := FALSE;
          END IF;

          -- Bloqueio Automático de Vendas
          IF v_novo_estoque <= 0 AND v_permitir_backorder = FALSE THEN
              v_venda_bloqueada := TRUE;
          ELSE
              v_venda_bloqueada := FALSE;
          END IF;

          -- Atualizar Tabela de Estoque Atual
          UPDATE produtos_estoque
          SET 
              estoque_atual = v_novo_estoque,
              item_critico = v_item_critico,
              venda_bloqueada = v_venda_bloqueada,
              saldo_negativo = v_saldo_negativo,
              quantidade_negativa = v_quantidade_negativa,
              ultima_entrada = CASE WHEN NEW.tipo_movimentacao = 'ENTRADA' THEN NEW.data_movimentacao ELSE ultima_entrada END,
              ultima_saida = CASE WHEN NEW.tipo_movimentacao = 'SAIDA' THEN NEW.data_movimentacao ELSE ultima_saida END,
              atualizado_em = CURRENT_TIMESTAMP
          WHERE id_produto = NEW.id_produto;

          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
        // Attach Process movement trigger
        await client.query('DROP TRIGGER IF EXISTS tg_processar_movimentacao ON movimentacoes');
        await client.query(`
      CREATE TRIGGER tg_processar_movimentacao
      AFTER INSERT ON movimentacoes
      FOR EACH ROW
      EXECUTE FUNCTION fn_processar_movimentacao_estoque();
    `);
        // 8. Create Purchase Planning Trigger Function
        await client.query(`
      CREATE OR REPLACE FUNCTION fn_calcular_planejamento_compra()
      RETURNS TRIGGER AS $$
      DECLARE
          v_consumo_mensal DECIMAL(12, 4);
          v_margem_seguranca DECIMAL(12, 4);
          v_quantidade_a_comprar DECIMAL(12, 4);
      BEGIN
          -- Calcular consumo médio mensal (últimos 3 meses do subtipo NEGOCIACAO_VENDA)
          SELECT COALESCE(SUM(quantidade) / 3.0, 0.0000)
          INTO v_consumo_mensal
          FROM movimentacoes
          WHERE id_produto = NEW.id_produto
            AND tipo_movimentacao = 'SAIDA'
            AND subtipo_movimentacao = 'NEGOCIACAO_VENDA'
            AND data_movimentacao >= CURRENT_TIMESTAMP - INTERVAL '3 months';

          v_margem_seguranca := GREATEST(v_consumo_mensal * 0.5, NEW.estoque_minimo);

          IF NEW.estoque_atual < NEW.estoque_minimo THEN
              v_quantidade_a_comprar := (NEW.estoque_minimo - NEW.estoque_atual) + v_margem_seguranca;
          ELSE
              v_quantidade_a_comprar := 0.0000;
          END IF;

          INSERT INTO planejamento_compras (id_produto, quantidade_a_comprar, consumo_medio_mensal)
          VALUES (NEW.id_produto, v_quantidade_a_comprar, v_consumo_mensal)
          ON CONFLICT (id_produto) DO UPDATE
          SET 
              quantidade_a_comprar = EXCLUDED.quantidade_a_comprar,
              consumo_medio_mensal = EXCLUDED.consumo_medio_mensal;

          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
        // Attach purchase planning trigger
        await client.query('DROP TRIGGER IF EXISTS tg_recalcular_planejamento ON produtos_estoque');
        await client.query(`
      CREATE TRIGGER tg_recalcular_planejamento
      AFTER UPDATE OF estoque_atual, estoque_minimo ON produtos_estoque
      FOR EACH ROW
      EXECUTE FUNCTION fn_calcular_planejamento_compra();
    `);
        // Commit transaction for schema creation
        await client.query('COMMIT');
        console.log('PostgreSQL schema, triggers, and indices initialized successfully.');
        // 9. Prepopulate seed data if database is empty (DISABLED for manual clean testing)
        /*
        const checkRes = await client.query('SELECT COUNT(*) FROM produtos_estoque');
        if (Number(checkRes.rows[0].count) === 0) {
          console.log('Prepopulating PostgreSQL with seed inventory items...');
          for (const item of initialInventory) {
            await client.query(`
              INSERT INTO produtos_estoque (id_produto, name, sku, category, estoque_atual, estoque_minimo, location, permitir_backorder, ultima_entrada)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [
              genRandomUuid(), // Generate a UUID to map from mockup if needed, or parse the existing string uuid
              item.name,
              item.sku,
              item.category,
              item.quantity,
              item.minStockLevel, // Seed min level
              item.location,
              item.category === 'Accessories', // Allow backorder for Accessories category by default
              new Date(item.lastUpdated)
            ]);
          }
          console.log('Prepopulation finished.');
        }
        */
    }
    catch (err) {
        await client.query('ROLLBACK');
        console.error('Error during PostgreSQL database initialization:', err);
    }
    finally {
        client.release();
    }
}
// Generate valid UUIDs
function genRandomUuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
// Database CRUD operations mapped to pg query pools
exports.pgOperations = {
    getAll: async (search, category, lowStock) => {
        let query = 'SELECT id_produto as id, name, sku, category, estoque_atual::float as quantity, price::float, estoque_minimo::float as "minStockLevel", location, ultima_saida, ultima_entrada, dias_sem_venda, saldo_negativo, quantidade_negativa::float, venda_bloqueada, permitir_backorder, item_critico FROM produtos_estoque WHERE 1=1';
        const params = [];
        if (search) {
            params.push(`%${search}%`);
            query += ` AND (name ILIKE $${params.length} OR sku ILIKE $${params.length})`;
        }
        if (category) {
            params.push(category);
            query += ` AND category = $${params.length}`;
        }
        if (lowStock) {
            query += ' AND estoque_atual <= estoque_minimo';
        }
        query += ' ORDER BY atualizado_em DESC';
        const res = await pool.query(query, params);
        // Map database fields to application model
        return res.rows.map(row => ({
            id: row.id,
            name: row.name,
            sku: row.sku,
            category: row.category,
            quantity: Number(row.quantity) || 0,
            price: Number(row.price) || 0,
            minStockLevel: Number(row.minstocklevel) || 0,
            location: row.location || '',
            lastUpdated: (row.ultima_saida || row.ultima_entrada || new Date()).toISOString()
        }));
    },
    getById: async (id) => {
        const res = await pool.query(`
      SELECT id_produto as id, name, sku, category, estoque_atual::float as quantity, price::float, estoque_minimo::float as "minStockLevel", location, ultima_saida, ultima_entrada, dias_sem_venda, saldo_negativo, quantidade_negativa::float, venda_bloqueada, permitir_backorder, item_critico 
      FROM produtos_estoque 
      WHERE id_produto = $1
    `, [id]);
        if (res.rows.length === 0)
            return null;
        const row = res.rows[0];
        return {
            id: row.id,
            name: row.name,
            sku: row.sku,
            category: row.category,
            quantity: Number(row.quantity) || 0,
            price: Number(row.price) || 0,
            minStockLevel: Number(row.minstocklevel) || 0,
            location: row.location || '',
            lastUpdated: (row.ultima_saida || row.ultima_entrada || new Date()).toISOString()
        };
    },
    getBySku: async (sku) => {
        const res = await pool.query(`
      SELECT id_produto as id, name, sku, category, estoque_atual::float as quantity, price::float, estoque_minimo::float as "minStockLevel", location 
      FROM produtos_estoque 
      WHERE LOWER(sku) = LOWER($1)
    `, [sku]);
        if (res.rows.length === 0)
            return null;
        const row = res.rows[0];
        return {
            id: row.id,
            name: row.name,
            sku: row.sku,
            category: row.category,
            quantity: Number(row.quantity) || 0,
            price: Number(row.price) || 0,
            minStockLevel: Number(row.minstocklevel) || 0,
            location: row.location || '',
            lastUpdated: new Date().toISOString()
        };
    },
    create: async (item) => {
        const res = await pool.query(`
      INSERT INTO produtos_estoque (name, sku, category, estoque_atual, price, estoque_minimo, location, permitir_backorder, item_critico)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id_produto as id, criado_em
    `, [
            item.name,
            item.sku,
            item.category,
            Number(item.quantity),
            Number(item.price),
            Number(item.minStockLevel),
            item.location,
            item.permitir_backorder !== undefined ? item.permitir_backorder : (item.category === 'Accessories'),
            Number(item.quantity) <= Number(item.minStockLevel)
        ]);
        const created = res.rows[0];
        return {
            id: created.id,
            ...item,
            lastUpdated: created.criado_em.toISOString()
        };
    },
    update: async (id, item) => {
        const fields = [];
        const params = [id];
        if (item.name !== undefined) {
            params.push(item.name);
            fields.push(`name = $${params.length}`);
        }
        if (item.sku !== undefined) {
            params.push(item.sku);
            fields.push(`sku = $${params.length}`);
        }
        if (item.category !== undefined) {
            params.push(item.category);
            fields.push(`category = $${params.length}`);
        }
        if (item.quantity !== undefined) {
            params.push(Number(item.quantity));
            fields.push(`estoque_atual = $${params.length}`);
        }
        if (item.price !== undefined) {
            params.push(Number(item.price));
            fields.push(`price = $${params.length}`);
        }
        if (item.minStockLevel !== undefined) {
            params.push(Number(item.minStockLevel));
            fields.push(`estoque_minimo = $${params.length}`);
        }
        if (item.location !== undefined) {
            params.push(item.location);
            fields.push(`location = $${params.length}`);
        }
        if (item.permitir_backorder !== undefined) {
            params.push(item.permitir_backorder);
            fields.push(`permitir_backorder = $${params.length}`);
        }
        params.push(new Date());
        fields.push(`atualizado_em = $${params.length}`);
        if (fields.length === 0) {
            const existing = await exports.pgOperations.getById(id);
            if (!existing)
                throw new Error('Item not found');
            return existing;
        }
        const query = `
      UPDATE produtos_estoque 
      SET ${fields.join(', ')} 
      WHERE id_produto = $1 
      RETURNING id_produto as id, name, sku, category, estoque_atual::float as quantity, price::float, estoque_minimo::float as "minStockLevel", location, atualizado_em
    `;
        const res = await pool.query(query, params);
        const row = res.rows[0];
        return {
            id: row.id,
            name: row.name,
            sku: row.sku,
            category: row.category,
            quantity: Number(row.quantity) || 0,
            price: Number(row.price) || 0,
            minStockLevel: Number(row.minstocklevel) || 0,
            location: row.location || '',
            lastUpdated: row.atualizado_em.toISOString()
        };
    },
    delete: async (id) => {
        const existing = await exports.pgOperations.getById(id);
        if (!existing)
            throw new Error('Item not found');
        // Copy item to lixeira_estoque before deletion
        await pool.query(`
      INSERT INTO lixeira_estoque (id_produto, name, sku, category, estoque_atual, price, estoque_minimo, location)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id_produto) DO UPDATE SET 
        name = EXCLUDED.name,
        sku = EXCLUDED.sku,
        category = EXCLUDED.category,
        estoque_atual = EXCLUDED.estoque_atual,
        price = EXCLUDED.price,
        estoque_minimo = EXCLUDED.estoque_minimo,
        location = EXCLUDED.location,
        deletado_em = CURRENT_TIMESTAMP
    `, [existing.id, existing.name, existing.sku, existing.category, existing.quantity, existing.price, existing.minStockLevel, existing.location]);
        await pool.query('DELETE FROM produtos_estoque WHERE id_produto = $1', [id]);
        return existing;
    },
    getTrash: async () => {
        const res = await pool.query('SELECT * FROM lixeira_estoque ORDER BY deletado_em DESC');
        return res.rows.map(row => ({
            id: row.id_produto,
            name: row.name,
            sku: row.sku,
            category: row.category,
            quantity: Number(row.estoque_atual) || 0,
            price: Number(row.price) || 0,
            minStockLevel: Number(row.estoque_minimo) || 0,
            location: row.location || '',
            deletedAt: row.deletado_em.toISOString()
        }));
    },
    restore: async (id) => {
        const res = await pool.query('SELECT * FROM lixeira_estoque WHERE id_produto = $1', [id]);
        if (res.rows.length === 0)
            throw new Error('Item not found in recycle bin');
        const row = res.rows[0];
        // Insert back into produtos_estoque
        await pool.query(`
      INSERT INTO produtos_estoque (id_produto, name, sku, category, estoque_atual, price, estoque_minimo, location)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [row.id_produto, row.name, row.sku, row.category, row.estoque_atual, row.price, row.estoque_minimo, row.location]);
        // Delete from lixeira_estoque
        await pool.query('DELETE FROM lixeira_estoque WHERE id_produto = $1', [id]);
        return {
            id: row.id_produto,
            name: row.name,
            sku: row.sku,
            category: row.category,
            quantity: Number(row.estoque_atual) || 0,
            price: Number(row.price) || 0,
            minStockLevel: Number(row.estoque_minimo) || 0,
            location: row.location || ''
        };
    },
    deletePermanently: async (id) => {
        await pool.query('DELETE FROM lixeira_estoque WHERE id_produto = $1', [id]);
    },
    restoreAll: async () => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const res = await client.query('SELECT * FROM lixeira_estoque');
            for (const row of res.rows) {
                await client.query(`
          INSERT INTO produtos_estoque (id_produto, name, sku, category, estoque_atual, price, estoque_minimo, location)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (sku) DO NOTHING
        `, [row.id_produto, row.name, row.sku, row.category, row.estoque_atual, row.price, row.estoque_minimo, row.location]);
            }
            await client.query('DELETE FROM lixeira_estoque');
            await client.query('COMMIT');
        }
        catch (e) {
            await client.query('ROLLBACK');
            throw e;
        }
        finally {
            client.release();
        }
    },
    emptyTrash: async () => {
        await pool.query('DELETE FROM lixeira_estoque');
    },
    recordMovement: async (movement) => {
        const res = await pool.query(`
      INSERT INTO movimentacoes (id_produto, tipo_movimentacao, subtipo_movimentacao, quantidade, estoque_origem, estoque_destino, numero_os)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id_movimentacao, data_movimentacao
    `, [
            movement.id_produto,
            movement.tipo_movimentacao,
            movement.subtipo_movimentacao,
            Number(movement.quantidade),
            movement.estoque_origem || null,
            movement.estoque_destino || null,
            movement.numero_os || null
        ]);
        return res.rows[0];
    },
    getStats: async () => {
        const totalsRes = await pool.query(`
      SELECT 
        COALESCE(SUM(estoque_atual), 0)::float as total_units,
        COUNT(id_produto)::int as unique_skus,
        COALESCE(SUM(estoque_atual * price), 0)::float as total_val,
        COUNT(id_produto) FILTER (WHERE item_critico = TRUE)::int as low_stock_count
      FROM produtos_estoque
    `);
        const categoriesRes = await pool.query(`
      SELECT category, COALESCE(SUM(estoque_atual), 0)::float as total_units
      FROM produtos_estoque
      GROUP BY category
    `);
        const categoriesMap = {};
        categoriesRes.rows.forEach(row => {
            categoriesMap[row.category] = Number(row.total_units) || 0;
        });
        const stats = totalsRes.rows[0];
        return {
            totalItemsCount: Number(stats.total_units) || 0,
            uniqueItemsCount: Number(stats.unique_skus) || 0,
            totalValue: Number(Number(stats.total_val).toFixed(2)) || 0,
            lowStockCount: Number(stats.low_stock_count) || 0,
            categories: categoriesMap
        };
    },
    getMovements: async (id_produto) => {
        let query = `
      SELECT m.id_movimentacao, m.id_produto, p.name, p.sku, m.tipo_movimentacao, m.subtipo_movimentacao, m.quantidade::float, m.data_movimentacao, m.numero_os
      FROM movimentacoes m
      JOIN produtos_estoque p ON m.id_produto = p.id_produto
    `;
        const params = [];
        if (id_produto) {
            params.push(id_produto);
            query += ' WHERE m.id_produto = $1';
        }
        query += ' ORDER BY m.data_movimentacao DESC LIMIT 50';
        const res = await pool.query(query, params);
        return res.rows;
    },
    getTasks: async () => {
        const res = await pool.query(`
      SELECT t.id_tarefa, t.id_produto, p.name as name_produto, p.sku as sku_produto,
             t.tipo_tarefa, t.data_geracao, t.status, t.quantidade_esperada::float,
             t.quantidade_conferida::float, t.data_conclusao, t.observacao
      FROM tarefas_conferencia t
      JOIN produtos_estoque p ON t.id_produto = p.id_produto
      ORDER BY t.data_geracao DESC
    `);
        return res.rows;
    },
    generateDailyTasks: async () => {
        // Check if daily tasks have already been generated today
        const check = await pool.query(`
      SELECT COUNT(*) FROM tarefas_conferencia 
      WHERE CAST(data_geracao AS DATE) = CURRENT_DATE
    `);
        if (Number(check.rows[0].count) === 0) {
            // Pick up to 3 random products
            const products = await pool.query(`
        SELECT id_produto, name, sku, estoque_atual::float 
        FROM produtos_estoque 
        ORDER BY RANDOM() 
        LIMIT 3
      `);
            for (const p of products.rows) {
                await pool.query(`
          INSERT INTO tarefas_conferencia (id_produto, tipo_tarefa, quantidade_esperada, status)
          VALUES ($1, $2, $3, $4)
        `, [
                    p.id_produto,
                    Math.random() > 0.5 ? 'CONFERENCIA_SALDO' : 'CONFERENCIA_ROTATIVA',
                    p.estoque_atual,
                    'PENDENTE'
                ]);
            }
            console.log(`[TASKS] Generated ${products.rows.length} new random conference tasks for today.`);
        }
        // Return all tasks
        return exports.pgOperations.getTasks();
    },
    completeTask: async (id_tarefa, data) => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const taskRes = await client.query(`
        SELECT id_produto, quantidade_esperada::float, status 
        FROM tarefas_conferencia 
        WHERE id_tarefa = $1 FOR UPDATE
      `, [id_tarefa]);
            if (taskRes.rows.length === 0)
                throw new Error('Tarefa de conferência não encontrada.');
            const task = taskRes.rows[0];
            if (task.status === 'CONCLUIDO')
                throw new Error('Esta tarefa já foi concluída.');
            // Update task record
            await client.query(`
        UPDATE tarefas_conferencia
        SET status = 'CONCLUIDO', quantidade_conferida = $1, observacao = $2, data_conclusao = CURRENT_TIMESTAMP
        WHERE id_tarefa = $3
      `, [Number(data.quantidade_conferida), data.observacao || null, id_tarefa]);
            // If discrepancy exists, record stock adjustment movement
            const diff = Number(data.quantidade_conferida) - task.quantidade_esperada;
            if (diff !== 0) {
                const tipo = diff > 0 ? 'ENTRADA' : 'SAIDA';
                const absQty = Math.abs(diff);
                await client.query(`
          INSERT INTO movimentacoes (id_produto, tipo_movimentacao, subtipo_movimentacao, quantidade, estoque_origem, estoque_destino, numero_os)
          VALUES ($1, $2, 'AJUSTE_INVENTARIO', $3, 'AUDITORIA_SISTEMA', 'CONFERENCIA_FISICA', $4)
        `, [
                    task.id_produto,
                    tipo,
                    absQty,
                    `AUDIT-${id_tarefa.substring(0, 8).toUpperCase()}`
                ]);
            }
            await client.query('COMMIT');
            return { success: true, adjustmentMade: diff !== 0, discrepancy: diff };
        }
        catch (err) {
            await client.query('ROLLBACK');
            throw err;
        }
        finally {
            client.release();
        }
    },
    createTask: async (data) => {
        const res = await pool.query(`
      INSERT INTO tarefas_conferencia (id_produto, tipo_tarefa, quantidade_esperada, status)
      VALUES ($1, $2, $3, 'PENDENTE')
      RETURNING *
    `, [data.id_produto, data.tipo_tarefa, Number(data.quantidade_esperada)]);
        const taskDetails = await pool.query(`
      SELECT t.id_tarefa, t.id_produto, p.name as name_produto, p.sku as sku_produto,
             t.tipo_tarefa, t.data_geracao, t.status, t.quantidade_esperada::float,
             t.quantidade_conferida::float, t.data_conclusao, t.observacao
      FROM tarefas_conferencia t
      JOIN produtos_estoque p ON t.id_produto = p.id_produto
      WHERE t.id_tarefa = $1
    `, [res.rows[0].id_tarefa]);
        return taskDetails.rows[0];
    },
    getUsers: async () => {
        const res = await pool.query('SELECT id_usuario as id, username, nome, perfil, criado_em FROM usuarios ORDER BY criado_em DESC');
        return res.rows;
    },
    createUser: async (data) => {
        const password_hash = crypto_1.default.createHash('sha256').update(data.password_cleartext).digest('hex');
        const res = await pool.query(`
      INSERT INTO usuarios (username, password_hash, nome, perfil)
      VALUES ($1, $2, $3, $4)
      RETURNING id_usuario as id, username, nome, perfil, criado_em
    `, [data.username.toLowerCase().trim(), password_hash, data.nome.trim(), data.perfil]);
        return res.rows[0];
    },
    deleteUser: async (id) => {
        const res = await pool.query('DELETE FROM usuarios WHERE id_usuario = $1', [id]);
        return (res.rowCount ?? 0) > 0;
    },
    authenticateUser: async (username, password_cleartext) => {
        const password_hash = crypto_1.default.createHash('sha256').update(password_cleartext).digest('hex');
        const res = await pool.query(`
      SELECT id_usuario as id, username, nome, perfil 
      FROM usuarios 
      WHERE LOWER(username) = LOWER($1) AND password_hash = $2
    `, [username.trim(), password_hash]);
        if (res.rows.length === 0)
            return null;
        return res.rows[0];
    },
    exportDatabase: async () => {
        const data = {};
        const tables = ['fornecedores', 'produtos_estoque', 'lixeira_estoque', 'movimentacoes', 'planejamento_compras', 'tarefas_conferencia', 'usuarios'];
        for (const table of tables) {
            const res = await pool.query(`SELECT * FROM ${table}`);
            data[table] = res.rows;
        }
        return data;
    },
    importDatabase: async (data) => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const tables = ['fornecedores', 'produtos_estoque', 'lixeira_estoque', 'movimentacoes', 'planejamento_compras', 'tarefas_conferencia', 'usuarios'];
            await client.query(`TRUNCATE TABLE ${tables.join(', ')} CASCADE`);
            for (const table of tables) {
                const rows = data[table];
                if (!rows || rows.length === 0)
                    continue;
                const keys = Object.keys(rows[0]);
                const cols = keys.map(k => `"${k}"`).join(', ');
                for (const row of rows) {
                    const values = keys.map(k => row[k]);
                    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
                    const queryText = `INSERT INTO ${table} (${cols}) VALUES (${placeholders})`;
                    await client.query(queryText, values);
                }
            }
            await client.query('COMMIT');
        }
        catch (err) {
            await client.query('ROLLBACK');
            throw err;
        }
        finally {
            client.release();
        }
    }
};
