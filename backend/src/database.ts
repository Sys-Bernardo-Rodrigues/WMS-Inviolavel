import sqlite3 from 'sqlite3';
import { initialInventory, InventoryItem } from './mockData';

const DB_FILE = 'inventory.db';

// Initialize connection
const db = new sqlite3.Database(DB_FILE, (err) => {
  if (err) {
    console.error('Error opening SQLite database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    initializeDatabase();
  }
});

// Initialize schema and mock data
function initializeDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS inventory (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sku TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      minStockLevel INTEGER NOT NULL,
      location TEXT,
      lastUpdated TEXT NOT NULL
    )
  `, (err) => {
    if (err) {
      console.error('Error creating table:', err.message);
      return;
    }

    // Prepopulate if table is empty
    db.get('SELECT COUNT(*) as count FROM inventory', [], (countErr, row: any) => {
      if (countErr) {
        console.error('Error counting items:', countErr.message);
        return;
      }

      if (row.count === 0) {
        console.log('Database empty. Prepopulating with initial inventory...');
        const stmt = db.prepare(`
          INSERT INTO inventory (id, name, sku, category, quantity, price, minStockLevel, location, lastUpdated)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        initialInventory.forEach(item => {
          stmt.run([
            item.id,
            item.name,
            item.sku,
            item.category,
            item.quantity,
            item.price,
            item.minStockLevel,
            item.location,
            item.lastUpdated
          ]);
        });
        stmt.finalize();
        console.log('Prepopulation finished.');
      }
    });
  });
}

// Database helper functions wrapped in Promises
export const dbOperations = {
  getAll: (search?: string, category?: string, lowStock?: boolean): Promise<InventoryItem[]> => {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM inventory WHERE 1=1';
      const params: any[] = [];

      if (search) {
        query += ' AND (name LIKE ? OR sku LIKE ?)';
        const searchParam = `%${search}%`;
        params.push(searchParam, searchParam);
      }

      if (category) {
        query += ' AND LOWER(category) = LOWER(?)';
        params.push(category);
      }

      if (lowStock) {
        query += ' AND quantity <= minStockLevel';
      }

      // Default sorting by lastUpdated descending
      query += ' ORDER BY lastUpdated DESC';

      db.all(query, params, (err, rows: InventoryItem[]) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  getById: (id: string): Promise<InventoryItem | null> => {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM inventory WHERE id = ?', [id], (err, row: InventoryItem) => {
        if (err) reject(err);
        else resolve(row || null);
      });
    });
  },

  getBySku: (sku: string): Promise<InventoryItem | null> => {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM inventory WHERE LOWER(sku) = LOWER(?)', [sku], (err, row: InventoryItem) => {
        if (err) reject(err);
        else resolve(row || null);
      });
    });
  },

  create: (item: Omit<InventoryItem, 'id' | 'lastUpdated'>): Promise<InventoryItem> => {
    return new Promise((resolve, reject) => {
      const id = `item-${Math.random().toString(36).substr(2, 9)}`;
      const lastUpdated = new Date().toISOString();
      const newItem: InventoryItem = { id, ...item, lastUpdated };

      db.run(`
        INSERT INTO inventory (id, name, sku, category, quantity, price, minStockLevel, location, lastUpdated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        newItem.id,
        newItem.name,
        newItem.sku,
        newItem.category,
        newItem.quantity,
        newItem.price,
        newItem.minStockLevel,
        newItem.location,
        newItem.lastUpdated
      ], function(err) {
        if (err) reject(err);
        else resolve(newItem);
      });
    });
  },

  update: (id: string, item: Partial<Omit<InventoryItem, 'id' | 'lastUpdated'>>): Promise<InventoryItem> => {
    return new Promise(async (resolve, reject) => {
      try {
        const existing = await dbOperations.getById(id);
        if (!existing) {
          reject(new Error('Item not found'));
          return;
        }

        const lastUpdated = new Date().toISOString();
        const updatedItem = {
          name: item.name !== undefined ? item.name : existing.name,
          sku: item.sku !== undefined ? item.sku : existing.sku,
          category: item.category !== undefined ? item.category : existing.category,
          quantity: item.quantity !== undefined ? item.quantity : existing.quantity,
          price: item.price !== undefined ? item.price : existing.price,
          minStockLevel: item.minStockLevel !== undefined ? item.minStockLevel : existing.minStockLevel,
          location: item.location !== undefined ? item.location : existing.location,
          lastUpdated
        };

        db.run(`
          UPDATE inventory
          SET name = ?, sku = ?, category = ?, quantity = ?, price = ?, minStockLevel = ?, location = ?, lastUpdated = ?
          WHERE id = ?
        `, [
          updatedItem.name,
          updatedItem.sku,
          updatedItem.category,
          updatedItem.quantity,
          updatedItem.price,
          updatedItem.minStockLevel,
          updatedItem.location,
          updatedItem.lastUpdated,
          id
        ], function(err) {
          if (err) reject(err);
          else resolve({ id, ...updatedItem });
        });
      } catch (err) {
        reject(err);
      }
    });
  },

  delete: (id: string): Promise<InventoryItem> => {
    return new Promise(async (resolve, reject) => {
      try {
        const existing = await dbOperations.getById(id);
        if (!existing) {
          reject(new Error('Item not found'));
          return;
        }

        db.run('DELETE FROM inventory WHERE id = ?', [id], (err) => {
          if (err) reject(err);
          else resolve(existing);
        });
      } catch (err) {
        reject(err);
      }
    });
  },

  getStats: (): Promise<any> => {
    return new Promise((resolve, reject) => {
      db.all('SELECT category, quantity, price, minStockLevel FROM inventory', [], (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        const totalItemsCount = rows.reduce((acc, row) => acc + row.quantity, 0);
        const uniqueItemsCount = rows.length;
        const totalValue = rows.reduce((acc, row) => acc + (row.price * row.quantity), 0);
        const lowStockCount = rows.filter(row => row.quantity <= row.minStockLevel).length;

        const categoriesMap: Record<string, number> = {};
        rows.forEach(row => {
          categoriesMap[row.category] = (categoriesMap[row.category] || 0) + row.quantity;
        });

        resolve({
          totalItemsCount,
          uniqueItemsCount,
          totalValue: Number(totalValue.toFixed(2)),
          lowStockCount,
          categories: categoriesMap
        });
      });
    });
  }
};
