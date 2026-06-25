export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  quantity: number;
  price: number;
  minStockLevel: number;
  location: string;
  lastUpdated: string;
}

export const initialInventory: InventoryItem[] = [
  {
    id: "item-1",
    name: "MacBook Pro M3 Max",
    sku: "MBP-M3MX-16",
    category: "Electronics",
    quantity: 12,
    price: 3499.00,
    minStockLevel: 5,
    location: "Aisle A, Shelf 3",
    lastUpdated: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "item-2",
    name: "iPhone 15 Pro Max 256GB",
    sku: "IPH-15PM-256",
    category: "Electronics",
    quantity: 25,
    price: 1199.00,
    minStockLevel: 8,
    location: "Aisle A, Shelf 1",
    lastUpdated: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "item-3",
    name: "Ergonomic Office Chair",
    sku: "CHR-ERG-01",
    category: "Furniture",
    quantity: 4,
    price: 450.00,
    minStockLevel: 5, // Under min level!
    location: "Aisle C, Shelf 2",
    lastUpdated: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "item-4",
    name: "Dell UltraSharp 27\" 4K Monitor",
    sku: "MON-DEL-274K",
    category: "Electronics",
    quantity: 8,
    price: 549.99,
    minStockLevel: 3,
    location: "Aisle B, Shelf 4",
    lastUpdated: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "item-5",
    name: "Mechanical Keyboard (Blue Switches)",
    sku: "KEY-MCH-BLU",
    category: "Electronics",
    quantity: 18,
    price: 89.90,
    minStockLevel: 6,
    location: "Aisle B, Shelf 1",
    lastUpdated: new Date().toISOString()
  },
  {
    id: "item-6",
    name: "Height Adjustable Standing Desk",
    sku: "DSK-STN-ADJ",
    category: "Furniture",
    quantity: 2,
    price: 699.00,
    minStockLevel: 3, // Under min level!
    location: "Aisle C, Shelf 1",
    lastUpdated: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "item-7",
    name: "USB-C Multi-port Adapter",
    sku: "ADP-USBC-HUB",
    category: "Accessories",
    quantity: 40,
    price: 49.99,
    minStockLevel: 10,
    location: "Aisle D, Shelf 2",
    lastUpdated: new Date().toISOString()
  },
  {
    id: "item-8",
    name: "Noise Cancelling Headphones",
    sku: "HDP-ANC-NC700",
    category: "Electronics",
    quantity: 15,
    price: 299.99,
    minStockLevel: 4,
    location: "Aisle B, Shelf 3",
    lastUpdated: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
  }
];
