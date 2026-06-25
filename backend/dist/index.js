"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const postgresDb_1 = require("./postgresDb");
const generative_ai_1 = require("@google/generative-ai");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const BACKUP_DIR = path_1.default.join(__dirname, '../backups');
// Ensure backup folder exists
if (!fs_1.default.existsSync(BACKUP_DIR)) {
    fs_1.default.mkdirSync(BACKUP_DIR, { recursive: true });
}
// Function to delete backups older than 7 days
async function pruneOldBackups() {
    if (!fs_1.default.existsSync(BACKUP_DIR))
        return 0;
    const files = fs_1.default.readdirSync(BACKUP_DIR);
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    let deletedCount = 0;
    for (const file of files) {
        if (!file.startsWith('wms-backup-') || !file.endsWith('.json'))
            continue;
        const filepath = path_1.default.join(BACKUP_DIR, file);
        try {
            const stats = fs_1.default.statSync(filepath);
            const ageMs = now - stats.mtime.getTime();
            if (ageMs > sevenDaysMs) {
                fs_1.default.unlinkSync(filepath);
                deletedCount++;
            }
        }
        catch (err) {
            console.error(`Failed to check/delete backup file ${file}:`, err);
        }
    }
    return deletedCount;
}
// Function to create database backup file
async function createBackupFile() {
    const data = await postgresDb_1.pgOperations.exportDatabase();
    const now = new Date();
    // Format local date/time: YYYY-MM-DD_HH-mm-ss
    const pad = (n) => n.toString().padStart(2, '0');
    const year = now.getFullYear();
    const month = pad(now.getMonth() + 1);
    const day = pad(now.getDate());
    const hours = pad(now.getHours());
    const minutes = pad(now.getMinutes());
    const seconds = pad(now.getSeconds());
    const timestamp = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
    const filename = `wms-backup-${timestamp}.json`;
    const filepath = path_1.default.join(BACKUP_DIR, filename);
    fs_1.default.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
    // Prune old backups
    await pruneOldBackups();
    return filename;
}
// Auto Daily Backup Checker
async function runAutoDailyBackup() {
    try {
        const now = new Date();
        const pad = (n) => n.toString().padStart(2, '0');
        const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`; // YYYY-MM-DD
        if (!fs_1.default.existsSync(BACKUP_DIR)) {
            fs_1.default.mkdirSync(BACKUP_DIR, { recursive: true });
        }
        const files = fs_1.default.readdirSync(BACKUP_DIR);
        const todayBackupExists = files.some(file => file.startsWith(`wms-backup-${todayStr}`));
        if (!todayBackupExists) {
            console.log(`Auto Daily Backup: No backup found for ${todayStr}. Generating daily backup...`);
            const filename = await createBackupFile();
            console.log(`Auto Daily Backup: Created ${filename}.`);
        }
        else {
            console.log(`Auto Daily Backup: Backup for ${todayStr} already exists.`);
        }
        await pruneOldBackups();
    }
    catch (err) {
        console.error('Error running auto daily backup:', err);
    }
}
// Initialize Google Generative AI
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
let genAI = null;
if (GEMINI_API_KEY) {
    genAI = new generative_ai_1.GoogleGenerativeAI(GEMINI_API_KEY);
}
// Bootstrapping: initialize Postgres database
(0, postgresDb_1.initializePostgres)().then(async () => {
    console.log('Database system initialized.');
    // Execute auto daily check on bootstrap
    await runAutoDailyBackup();
    // Check every hour for backup compliance
    setInterval(runAutoDailyBackup, 60 * 60 * 1000);
}).catch((err) => {
    console.error('Failed to initialize database system:', err);
});
// GET /api/inventory - Retrieve items from PostgreSQL
app.get('/api/inventory', async (req, res) => {
    const { search, category, lowStock } = req.query;
    try {
        const items = await postgresDb_1.pgOperations.getAll(search, category, lowStock === 'true');
        res.json(items);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Database error' });
    }
});
// GET /api/inventory/stats - Get WMS metrics
app.get('/api/inventory/stats', async (req, res) => {
    try {
        const stats = await postgresDb_1.pgOperations.getStats();
        res.json(stats);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Database error' });
    }
});
// GET /api/inventory/movements - Get WMS history logs
app.get('/api/inventory/movements', async (req, res) => {
    const { id_produto } = req.query;
    try {
        const logs = await postgresDb_1.pgOperations.getMovements(id_produto);
        res.json(logs);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Database error' });
    }
});
// POST /api/inventory/movements - Record new movement (triggers safe updates)
app.post('/api/inventory/movements', async (req, res) => {
    const { id_produto, tipo_movimentacao, subtipo_movimentacao, quantidade, estoque_origem, estoque_destino, numero_os } = req.body;
    if (!id_produto || !tipo_movimentacao || !subtipo_movimentacao || !quantidade) {
        res.status(400).json({ error: 'Missing parameters (id_produto, tipo_movimentacao, subtipo_movimentacao, quantidade)' });
        return;
    }
    try {
        const result = await postgresDb_1.pgOperations.recordMovement({
            id_produto,
            tipo_movimentacao,
            subtipo_movimentacao,
            quantidade: Number(quantidade),
            estoque_origem,
            estoque_destino,
            numero_os
        });
        res.status(201).json({
            message: 'Movement recorded and processed successfully',
            movementId: result.id_movimentacao,
            timestamp: result.data_movimentacao
        });
    }
    catch (error) {
        // Catch database trigger exceptions (like insufficient stock error) and return them as bad requests
        console.error('Movement operation failed:', error.message);
        res.status(400).json({ error: error.message || 'Transaction failed' });
    }
});
// GET /api/inventory/tasks - Get tasks (generates automatically for today if empty)
app.get('/api/inventory/tasks', async (req, res) => {
    try {
        const tasks = await postgresDb_1.pgOperations.generateDailyTasks();
        res.json(tasks);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Database error' });
    }
});
// POST /api/inventory/tasks - Create custom conference task
app.post('/api/inventory/tasks', async (req, res) => {
    const { id_produto, tipo_tarefa, quantidade_esperada } = req.body;
    if (!id_produto || !tipo_tarefa || quantidade_esperada === undefined) {
        res.status(400).json({ error: 'Faltam campos obrigatórios: id_produto, tipo_tarefa, quantidade_esperada' });
        return;
    }
    try {
        const task = await postgresDb_1.pgOperations.createTask({
            id_produto,
            tipo_tarefa,
            quantidade_esperada: Number(quantidade_esperada)
        });
        res.status(201).json(task);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Database error' });
    }
});
// POST /api/inventory/tasks/:id/complete - Complete counting task
app.post('/api/inventory/tasks/:id/complete', async (req, res) => {
    const { quantidade_conferida, observacao } = req.body;
    if (quantidade_conferida === undefined || quantidade_conferida === null) {
        res.status(400).json({ error: 'Falta o parâmetro quantidade_conferida' });
        return;
    }
    try {
        const result = await postgresDb_1.pgOperations.completeTask(req.params.id, {
            quantidade_conferida: Number(quantidade_conferida),
            observacao
        });
        res.json({
            message: 'Tarefa de conferência concluída com sucesso',
            ...result
        });
    }
    catch (error) {
        console.error('Task completion failed:', error.message);
        res.status(400).json({ error: error.message || 'Falha na conclusão da tarefa' });
    }
});
// GET /api/inventory/ai-suggestions - Gemini suggestions
app.get('/api/inventory/ai-suggestions', async (req, res) => {
    try {
        const items = await postgresDb_1.pgOperations.getAll();
        const stats = await postgresDb_1.pgOperations.getStats();
        const promptText = `
      Você é um especialista em logística e gestão de estoque da Inviolável.
      Analise o seguinte estado do nosso inventário e forneça recomendações práticas e curtas em português:
      
      Estatísticas Gerais:
      - Total de itens físicos no estoque: ${stats.totalItemsCount}
      - Variedade de SKUs: ${stats.uniqueItemsCount}
      - Valor financeiro total acumulado: $${stats.totalValue}
      - Produtos abaixo do nível mínimo de estoque (alertas): ${stats.lowStockCount}
      
      Itens no Inventário:
      ${items.map(i => `- ${i.name} (SKU: ${i.sku}): Quantidade atual: ${i.quantity}, Nível Mínimo: ${i.minStockLevel}, Preço Unitário: $${i.price}, Categoria: ${i.category}`).join('\n')}
      
      Por favor, formule sua resposta em formato JSON com o seguinte esquema:
      {
        "summary": "Resumo executivo em um parágrafo da saúde geral do estoque",
        "actionItems": [
          "Lista de 3 a 4 ações prioritárias (ex: comprar mais unidades do item X, otimizar espaço da categoria Y)"
        ],
        "valuationInsight": "Análise rápida de onde o capital da empresa está mais concentrado ou riscos financeiros envolvidos"
      }
      Retorne APENAS o JSON puro, sem blocos de código markdown ou explicações externas.
    `;
        const customKey = req.headers['x-gemini-key'];
        const activeGenAI = customKey ? new generative_ai_1.GoogleGenerativeAI(customKey) : genAI;
        if (activeGenAI) {
            try {
                const model = activeGenAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
                const result = await model.generateContent(promptText);
                const text = result.response.text().trim();
                const jsonString = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
                const aiResponse = JSON.parse(jsonString);
                res.json({ source: 'gemini', ...aiResponse });
                return;
            }
            catch (geminiError) {
                console.error('Gemini API call failed, falling back to local simulation:', geminiError);
            }
        }
        // Fallback simulation if key is missing or API errors
        const lowStockProducts = items.filter(i => i.quantity <= i.minStockLevel);
        const mockActionItems = lowStockProducts.map(p => `Comprar aproximadamente ${p.minStockLevel * 2 - p.quantity} unidades de "${p.name}" (SKU: ${p.sku}) para reestabelecer margem segura.`);
        if (mockActionItems.length === 0) {
            mockActionItems.push("Monitoramento contínuo: todos os produtos encontram-se acima da margem de alerta mínima.");
        }
        mockActionItems.push("Otimizar a alocação de espaço no armazém da categoria de Eletrônicos (maior volume de estoque).");
        const mockResponse = {
            source: 'local-simulation',
            summary: `A saúde geral do estoque apresenta ${stats.lowStockCount} alertas críticos de produtos abaixo da margem mínima estabelecida. O volume total do ativo é de ${stats.totalItemsCount} unidades com avaliação total de $${stats.totalValue.toLocaleString('en-US')}.`,
            actionItems: mockActionItems.slice(0, 4),
            valuationInsight: `O capital está significativamente concentrado na categoria de eletrônicos. Recomenda-se realizar uma auditoria de liquidez rápida para evitar custos de manutenção elevados em produtos de alta obsolescência.`
        };
        res.json(mockResponse);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Error generating insights' });
    }
});
// GET /api/inventory/:id - Get a single item
app.get('/api/inventory/:id', async (req, res) => {
    try {
        const item = await postgresDb_1.pgOperations.getById(req.params.id);
        if (!item) {
            res.status(404).json({ error: 'Item not found' });
            return;
        }
        res.json(item);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Database error' });
    }
});
// POST /api/inventory - Add a new item
app.post('/api/inventory', async (req, res) => {
    const { name, sku, category, quantity, price, minStockLevel, location, permitir_backorder } = req.body;
    if (!name || !sku || !category || quantity === undefined || price === undefined) {
        res.status(400).json({ error: 'Missing required fields (name, sku, category, quantity, price)' });
        return;
    }
    try {
        const existing = await postgresDb_1.pgOperations.getBySku(sku);
        if (existing) {
            res.status(400).json({ error: 'SKU already exists' });
            return;
        }
        const newItem = await postgresDb_1.pgOperations.create({
            name,
            sku,
            category,
            quantity: Number(quantity),
            price: Number(price),
            minStockLevel: minStockLevel !== undefined ? Number(minStockLevel) : 5,
            location: location || 'Not specified',
            permitir_backorder: permitir_backorder !== undefined ? Boolean(permitir_backorder) : undefined
        });
        res.status(201).json(newItem);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Database error' });
    }
});
// PUT /api/inventory/:id - Update an existing item
app.put('/api/inventory/:id', async (req, res) => {
    const { name, sku, category, quantity, price, minStockLevel, location, permitir_backorder } = req.body;
    try {
        const existing = await postgresDb_1.pgOperations.getById(req.params.id);
        if (!existing) {
            res.status(404).json({ error: 'Item not found' });
            return;
        }
        if (sku && sku !== existing.sku) {
            const skuCheck = await postgresDb_1.pgOperations.getBySku(sku);
            if (skuCheck) {
                res.status(400).json({ error: 'SKU already exists' });
                return;
            }
        }
        const updatedItem = await postgresDb_1.pgOperations.update(req.params.id, {
            name,
            sku,
            category,
            quantity: quantity !== undefined ? Number(quantity) : undefined,
            price: price !== undefined ? Number(price) : undefined,
            minStockLevel: minStockLevel !== undefined ? Number(minStockLevel) : undefined,
            location,
            permitir_backorder: permitir_backorder !== undefined ? Boolean(permitir_backorder) : undefined
        });
        res.json(updatedItem);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Database error' });
    }
});
// POST /api/inventory/trash/restore-all - Restore all items from trash
app.post('/api/inventory/trash/restore-all', async (req, res) => {
    try {
        await postgresDb_1.pgOperations.restoreAll();
        res.json({ message: 'All items restored successfully' });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Database error' });
    }
});
// DELETE /api/inventory/trash/empty - Empty the trash bin
app.delete('/api/inventory/trash/empty', async (req, res) => {
    try {
        await postgresDb_1.pgOperations.emptyTrash();
        res.json({ message: 'Recycle bin emptied successfully' });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Database error' });
    }
});
// GET /api/inventory/trash - Get all deleted items
app.get('/api/inventory/trash', async (req, res) => {
    try {
        const trash = await postgresDb_1.pgOperations.getTrash();
        res.json(trash);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Database error' });
    }
});
// POST /api/inventory/trash/:id/restore - Restore an item
app.post('/api/inventory/trash/:id/restore', async (req, res) => {
    try {
        const restored = await postgresDb_1.pgOperations.restore(req.params.id);
        res.json({ message: 'Item restored successfully', item: restored });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Database error' });
    }
});
// DELETE /api/inventory/trash/:id - Delete an item permanently
app.delete('/api/inventory/trash/:id', async (req, res) => {
    try {
        await postgresDb_1.pgOperations.deletePermanently(req.params.id);
        res.json({ message: 'Item deleted permanently from trash' });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Database error' });
    }
});
// DELETE /api/inventory/:id - Delete an item
app.delete('/api/inventory/:id', async (req, res) => {
    try {
        const deleted = await postgresDb_1.pgOperations.delete(req.params.id);
        res.json({ message: 'Item deleted successfully', item: deleted });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Database error' });
    }
});
// GET /api/status - Server status
app.get('/api/status', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Backend is running!',
        timestamp: new Date().toISOString()
    });
});
// POST /api/auth/login - Log in a user
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        res.status(400).json({ error: 'Faltam campos: username, password' });
        return;
    }
    try {
        const user = await postgresDb_1.pgOperations.authenticateUser(username, password);
        if (!user) {
            res.status(401).json({ error: 'Usuário ou senha incorretos' });
            return;
        }
        res.json(user);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Database error' });
    }
});
// GET /api/users - List users
app.get('/api/users', async (req, res) => {
    try {
        const users = await postgresDb_1.pgOperations.getUsers();
        res.json(users);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Database error' });
    }
});
// POST /api/users - Create new user
app.post('/api/users', async (req, res) => {
    const { username, password, nome, perfil } = req.body;
    if (!username || !password || !nome || !perfil) {
        res.status(400).json({ error: 'Faltam campos: username, password, nome, perfil' });
        return;
    }
    try {
        const user = await postgresDb_1.pgOperations.createUser({
            username,
            password_cleartext: password,
            nome,
            perfil
        });
        res.status(201).json(user);
    }
    catch (error) {
        if (error.code === '23505') {
            res.status(400).json({ error: 'Este nome de usuário já está cadastrado' });
            return;
        }
        res.status(500).json({ error: error.message || 'Database error' });
    }
});
// DELETE /api/users/:id - Delete a user
app.delete('/api/users/:id', async (req, res) => {
    try {
        const success = await postgresDb_1.pgOperations.deleteUser(req.params.id);
        if (!success) {
            res.status(404).json({ error: 'Usuário não encontrado' });
            return;
        }
        res.json({ message: 'Usuário removido com sucesso' });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Database error' });
    }
});
// GET /api/backups - List all backups
app.get('/api/backups', async (req, res) => {
    try {
        if (!fs_1.default.existsSync(BACKUP_DIR)) {
            res.json([]);
            return;
        }
        const files = fs_1.default.readdirSync(BACKUP_DIR);
        const backupList = files
            .filter(file => file.startsWith('wms-backup-') && file.endsWith('.json'))
            .map(file => {
            const filepath = path_1.default.join(BACKUP_DIR, file);
            const stats = fs_1.default.statSync(filepath);
            return {
                filename: file,
                sizeBytes: stats.size,
                createdAt: stats.mtime.toISOString()
            };
        })
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        res.json(backupList);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Error listing backups' });
    }
});
// POST /api/backups - Trigger manual backup
app.post('/api/backups', async (req, res) => {
    try {
        const filename = await createBackupFile();
        res.status(201).json({ message: 'Backup criado com sucesso', filename });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Error creating backup' });
    }
});
// POST /api/backups/restore - Restore backup file
app.post('/api/backups/restore', async (req, res) => {
    const { filename } = req.body;
    if (!filename) {
        res.status(400).json({ error: 'Falta o parâmetro filename' });
        return;
    }
    const filepath = path_1.default.join(BACKUP_DIR, filename);
    if (!fs_1.default.existsSync(filepath)) {
        res.status(404).json({ error: 'Arquivo de backup não encontrado' });
        return;
    }
    try {
        const rawData = fs_1.default.readFileSync(filepath, 'utf-8');
        const backupData = JSON.parse(rawData);
        await postgresDb_1.pgOperations.importDatabase(backupData);
        res.json({ message: 'Banco de dados restaurado com sucesso a partir do backup' });
    }
    catch (error) {
        console.error('Restore operation failed:', error);
        res.status(500).json({ error: error.message || 'Error restoring backup' });
    }
});
// DELETE /api/backups/:filename - Delete a specific backup file
app.delete('/api/backups/:filename', async (req, res) => {
    const filename = req.params.filename;
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        res.status(400).json({ error: 'Nome de arquivo inválido' });
        return;
    }
    const filepath = path_1.default.join(BACKUP_DIR, filename);
    if (!fs_1.default.existsSync(filepath)) {
        res.status(404).json({ error: 'Arquivo de backup não encontrado' });
        return;
    }
    try {
        fs_1.default.unlinkSync(filepath);
        res.json({ message: 'Backup excluído com sucesso' });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Error deleting backup file' });
    }
});
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
