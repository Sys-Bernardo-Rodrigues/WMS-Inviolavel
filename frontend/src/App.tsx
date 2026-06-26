import { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  Trash,
  PencilSimple,
  MagnifyingGlass,
  ArrowClockwise,
  Warning,
  Coins,
  Stack,
  X,
  CheckCircle,
  WarningCircle,
  ListBullets,
  Sparkle,
  ChartPieSlice,
  MapPin,
  Barcode,
  ArrowUpRight,
  ArrowDownLeft,
  ClockCounterClockwise,
  SignOut,
  Gear,
  MapTrifold,
  FilePdf,
  Hourglass,
  Bell,
  Notebook,
  User,
  UserPlus,
  LockKey
} from '@phosphor-icons/react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
  AreaChart,
  Area,
  CartesianGrid
} from 'recharts';

const SUBTYPE_TRANSLATIONS: Record<string, string> = {
  'NEGOCIACAO_VENDA': 'Negociação Venda',
  'NEGOCIACAO_LOCADA': 'Negociação Locada',
  'BONIFICACAO': 'Bonificação',
  'DEVOLUCAO': 'Devolução',
  'DESATIVACAO': 'Desativação / Sucata',
  'TRANSFERENCIA': 'Transferência',
  'AJUSTE_INVENTARIO': 'Ajuste de Inventário'
};

interface InventoryItem {
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

interface WMSMovement {
  id_movimentacao: string;
  id_produto: string;
  name: string;
  sku: string;
  tipo_movimentacao: 'ENTRADA' | 'SAIDA';
  subtipo_movimentacao: string;
  quantidade: number;
  data_movimentacao: string;
  numero_os?: string;
}

interface WMSTask {
  id_tarefa: string;
  id_produto: string;
  name_produto: string;
  sku_produto: string;
  tipo_tarefa: 'CONFERENCIA_SALDO' | 'CONFERENCIA_ROTATIVA';
  data_geracao: string;
  status: 'PENDENTE' | 'CONCLUIDO';
  quantidade_esperada: number;
  quantidade_conferida?: number;
  data_conclusao?: string;
  observacao?: string;
}

interface Stats {
  totalItemsCount: number;
  uniqueItemsCount: number;
  totalValue: number;
  lowStockCount: number;
}

interface AISuggestions {
  summary: string;
  actionItems: string[];
  valuationInsight: string;
  source: string;
}

interface Toast {
  id: string;
  type: 'success' | 'error';
  message: string;
}

interface WMSNotification {
  id: string;
  title: string;
  description: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
  read: boolean;
}

interface User {
  id: string;
  username: string;
  nome: string;
  perfil: 'admin' | 'operador' | 'auditor';
  password?: string;
}

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Fallback initial data
const fallbackItems: InventoryItem[] = [
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
    minStockLevel: 5,
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
  }
];

const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6'];

function App() {
  // Application State
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<WMSMovement[]>([]);
  const [tasks, setTasks] = useState<WMSTask[]>([]);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<WMSTask | null>(null);
  const [taskFormData, setTaskFormData] = useState({ quantidade_conferida: 0, observacao: '' });
  const [taskErrors, setTaskErrors] = useState<Record<string, string>>({});
  const [stats, setStats] = useState<Stats>({
    totalItemsCount: 0,
    uniqueItemsCount: 0,
    totalValue: 0,
    lowStockCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);

  // Filters State
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [lowStockFilter, setLowStockFilter] = useState(false);
  const [idleDaysFilter, setIdleDaysFilter] = useState(30);
  const [tasksSubTab, setTasksSubTab] = useState<'pending' | 'history'>('pending');
  const [activeTab, setActiveTab] = useState('all');

  // Pagination State
  const [inventoryPage, setInventoryPage] = useState(1);
  const [inventoryPerPage] = useState(10);
  const [movementsPage, setMovementsPage] = useState(1);
  const [movementsPerPage] = useState(10);

  // Auto-reset page on search, filter, or tab switch
  useEffect(() => {
    setInventoryPage(1);
  }, [search, categoryFilter, lowStockFilter, activeTab]);

  useEffect(() => {
    setMovementsPage(1);
  }, [movements]);

  const [corridors, setCorridors] = useState<string[]>(() => {
    const saved = localStorage.getItem('wms-corridors');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return ['A', 'B', 'C', 'D'];
  });
  const [selectedCorridor, setSelectedCorridor] = useState(() => {
    const saved = localStorage.getItem('wms-corridors');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.length > 0) return parsed[0];
      } catch (e) {}
    }
    return 'A';
  });
  const [newCorridorName, setNewCorridorName] = useState('');
  const [levels, setLevels] = useState<number[]>(() => {
    const saved = localStorage.getItem('wms-levels');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return [1, 2, 3];
  });

  // Configuration State
  const [categoryTranslations, setCategoryTranslations] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('wms-category-translations');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return {
      'Electronics': 'Eletrônicos',
      'Furniture': 'Móveis',
      'Accessories': 'Acessórios',
      'Appliances': 'Eletrodomésticos',
      'Other': 'Outros'
    };
  });

  const [backorderCategories, setBackorderCategories] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('wms-backorder-categories');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return {
      'Accessories': true
    };
  });

  const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem('wms-gemini-api-key') || '');
  const [defaultMinStock, setDefaultMinStock] = useState(() => Number(localStorage.getItem('wms-default-min-stock')) || 5);

  const [newCategoryKey, setNewCategoryKey] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryBackorder, setNewCategoryBackorder] = useState(false);

  // AI Suggestions State
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestions | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);

  // Modals & Selection State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  // Form Field States (Add / Edit)
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: 'Electronics',
    quantity: 0,
    price: 0,
    minStockLevel: defaultMinStock,
    location: ''
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Movement Form States
  const [movementData, setMovementData] = useState({
    tipo_movimentacao: 'ENTRADA' as 'ENTRADA' | 'SAIDA',
    subtipo_movimentacao: 'NEGOCIACAO_VENDA',
    quantidade: 1,
    estoque_origem: '',
    estoque_destino: '',
    numero_os: ''
  });
  const [movementErrors, setMovementErrors] = useState<Record<string, string>>({});

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [itemSuppliers, setItemSuppliers] = useState<Record<string, string>>({});

  // Notifications State
  const [notifications, setNotifications] = useState<WMSNotification[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [trashItems, setTrashItems] = useState<InventoryItem[]>([]);

  // Auth & User Management States
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('wms-current-user');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return null;
  });
  const [users, setUsers] = useState<User[]>([]);
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPerfil, setNewUserPerfil] = useState<'admin' | 'operador' | 'auditor'>('operador');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loadingLogin, setLoadingLogin] = useState(false);

  // Backup & Restore States
  interface BackupInfo {
    filename: string;
    sizeBytes: number;
    createdAt: string;
  }
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [backupToRestore, setBackupToRestore] = useState<string | null>(null);

  const addNotification = (title: string, description: string, type: WMSNotification['type'] = 'info') => {
    const newNotif: WMSNotification = {
      id: Math.random().toString(36).substring(2, 9),
      title,
      description,
      type,
      timestamp: new Date().toISOString(),
      read: false
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  const addToast = (type: 'success' | 'error', message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  // Category & System Config Handlers
  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryKey.trim() || !newCategoryName.trim()) {
      addToast('error', 'Chave e nome da categoria são obrigatórios.');
      return;
    }
    
    // Normalize key to be alphanumeric/underscore only
    const normalizedKey = newCategoryKey.trim().replace(/[^a-zA-Z0-9_-]/g, '');
    if (!normalizedKey) {
      addToast('error', 'A chave da categoria deve conter apenas caracteres alfanuméricos.');
      return;
    }

    if (categoryTranslations[normalizedKey]) {
      addToast('error', `A categoria "${normalizedKey}" já existe.`);
      return;
    }

    const updatedTranslations = {
      ...categoryTranslations,
      [normalizedKey]: newCategoryName.trim()
    };
    
    const updatedBackorders = {
      ...backorderCategories,
      [normalizedKey]: newCategoryBackorder
    };

    setCategoryTranslations(updatedTranslations);
    setBackorderCategories(updatedBackorders);

    localStorage.setItem('wms-category-translations', JSON.stringify(updatedTranslations));
    localStorage.setItem('wms-backorder-categories', JSON.stringify(updatedBackorders));

    setNewCategoryKey('');
    setNewCategoryName('');
    setNewCategoryBackorder(false);

    addToast('success', `Categoria "${newCategoryName}" cadastrada com sucesso!`);
    addNotification("Configuração do Sistema", `Categoria "${newCategoryName}" cadastrada no sistema.`, "info");
  };

  const handleDeleteCategory = (key: string) => {
    // Check if category is used by any item
    const isUsed = items.some(item => item.category === key);
    if (isUsed) {
      addToast('error', `Não é possível deletar a categoria "${categoryTranslations[key] || key}" pois existem produtos vinculados a ela.`);
      return;
    }

    if (key === 'Other') {
      addToast('error', 'A categoria padrão "Outros" não pode ser excluída.');
      return;
    }

    const updatedTranslations = { ...categoryTranslations };
    delete updatedTranslations[key];

    const updatedBackorders = { ...backorderCategories };
    delete updatedBackorders[key];

    setCategoryTranslations(updatedTranslations);
    setBackorderCategories(updatedBackorders);

    localStorage.setItem('wms-category-translations', JSON.stringify(updatedTranslations));
    localStorage.setItem('wms-backorder-categories', JSON.stringify(updatedBackorders));

    addToast('success', 'Categoria removida com sucesso!');
    addNotification("Configuração do Sistema", `Categoria "${categoryTranslations[key] || key}" removida do sistema.`, "warning");
  };

  const handleToggleBackorder = (key: string) => {
    const updatedBackorders = {
      ...backorderCategories,
      [key]: !backorderCategories[key]
    };
    setBackorderCategories(updatedBackorders);
    localStorage.setItem('wms-backorder-categories', JSON.stringify(updatedBackorders));
    addToast('success', `Política de Backorder para "${categoryTranslations[key] || key}" atualizada.`);
    addNotification("Configuração do Sistema", `Política de Backorder da categoria "${categoryTranslations[key] || key}" foi ${!backorderCategories[key] ? 'ativada' : 'desativada'}.`, "info");
  };

  const handleSaveSystemConfigs = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('wms-gemini-api-key', geminiApiKey);
    localStorage.setItem('wms-default-min-stock', defaultMinStock.toString());
    addToast('success', 'Configurações do sistema salvas com sucesso!');
    addNotification("Configuração do Sistema", "Parâmetros globais de estoque e integrações atualizados.", "info");
  };

  const handleClearGeminiKey = () => {
    setGeminiApiKey('');
    localStorage.removeItem('wms-gemini-api-key');
    addToast('success', 'Chave Gemini API removida.');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoadingLogin(true);

    if (!loginUsername.trim() || !loginPassword) {
      setLoginError('Preencha todos os campos.');
      setLoadingLogin(false);
      return;
    }

    const username = loginUsername.toLowerCase().trim();

    if (!isOffline) {
      try {
        const res = await fetch(`${BACKEND_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password: loginPassword })
        });
        
        if (res.ok) {
          const user = await res.json();
          setCurrentUser(user);
          localStorage.setItem('wms-current-user', JSON.stringify(user));
          addToast('success', `Bem-vindo, ${user.nome}!`);
          addNotification("Segurança do Sistema", `Usuário "${user.username}" realizou login no sistema.`, "info");
          setLoginUsername('');
          setLoginPassword('');
          if (user.perfil === 'operador' && (activeTab === 'settings' || activeTab === 'system-audit' || activeTab === 'trash' || activeTab === 'backup')) {
            setActiveTab('all');
          }
          fetchData();
          setLoadingLogin(false);
          return;
        } else {
          const errData = await res.json();
          setLoginError(errData.error || 'Usuário ou senha inválidos.');
          setLoadingLogin(false);
          return;
        }
      } catch (err) {
        console.log('Online login failed, trying offline contingency authentication...');
      }
    }

    const localUsersStr = localStorage.getItem('wms-users');
    let localUsers: User[] = [
      { id: 'u1', username: 'admin', nome: 'Administrador Inviolável', perfil: 'admin' },
      { id: 'u2', username: 'operador', nome: 'Operador WMS', perfil: 'operador' },
      { id: 'u3', username: 'auditor', nome: 'Auditor WMS', perfil: 'auditor' }
    ];
    if (localUsersStr) {
      try { localUsers = JSON.parse(localUsersStr); } catch (e) {}
    }

    const user = localUsers.find(u => u.username.toLowerCase() === username);
    if (user) {
      const correctPass = user.password || user.username;
      if (loginPassword === correctPass) {
        setCurrentUser(user);
        localStorage.setItem('wms-current-user', JSON.stringify(user));
        addToast('success', `Conectado em Modo Contingência: ${user.nome}`);
        addNotification("Segurança do Sistema", `Usuário "${user.username}" logou offline (Contingência).`, "warning");
        setLoginUsername('');
        setLoginPassword('');
        if (user.perfil === 'operador' && (activeTab === 'settings' || activeTab === 'system-audit' || activeTab === 'trash' || activeTab === 'backup')) {
          setActiveTab('all');
        }
        fetchData();
        setLoadingLogin(false);
        return;
      }
    }

    setLoginError('Usuário ou senha incorretos (Offline/Contingência).');
    setLoadingLogin(false);
  };

  const handleLogout = () => {
    if (currentUser) {
      addNotification("Segurança do Sistema", `Usuário "${currentUser.username}" desconectou do sistema.`, "info");
    }
    setCurrentUser(null);
    localStorage.removeItem('wms-current-user');
    addToast('success', 'Sessão encerrada com sucesso.');
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserUsername.trim() || !newUserPassword) {
      addToast('error', 'Preencha todos os campos para cadastrar o usuário.');
      return;
    }

    const username = newUserUsername.toLowerCase().trim();

    if (!isOffline) {
      try {
        const res = await fetch(`${BACKEND_URL}/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username,
            password: newUserPassword,
            nome: newUserName,
            perfil: newUserPerfil
          })
        });

        if (res.ok) {
          const createdUser = await res.json();
          setUsers(prev => [createdUser, ...prev]);
          
          const localUsersStr = localStorage.getItem('wms-users');
          let localUsers: User[] = [];
          if (localUsersStr) {
            try { localUsers = JSON.parse(localUsersStr); } catch (ex) {}
          }
          const offlineUser: User = { ...createdUser, password: newUserPassword };
          localStorage.setItem('wms-users', JSON.stringify([offlineUser, ...localUsers]));

          addToast('success', `Usuário "${newUserUsername}" cadastrado com sucesso!`);
          addNotification("Segurança do Sistema", `Novo usuário "${username}" (${newUserPerfil}) registrado por administrador.`, "success");
          
          setNewUserName('');
          setNewUserUsername('');
          setNewUserPassword('');
          setNewUserPerfil('operador');
          return;
        } else {
          const errData = await res.json();
          addToast('error', errData.error || 'Erro ao cadastrar usuário.');
          return;
        }
      } catch (err) {
        console.log('Online user creation failed, falling back to local registry...');
      }
    }

    const localUsersStr = localStorage.getItem('wms-users');
    let localUsers: User[] = [];
    if (localUsersStr) {
      try { localUsers = JSON.parse(localUsersStr); } catch (e) {}
    }

    if (localUsers.some(u => u.username.toLowerCase() === username)) {
      addToast('error', 'Este nome de usuário já existe localmente.');
      return;
    }

    const offlineUser: User = {
      id: `u-${Math.random().toString(36).substring(2, 9)}`,
      username,
      nome: newUserName.trim(),
      perfil: newUserPerfil,
      password: newUserPassword
    };

    const updatedUsers = [offlineUser, ...localUsers];
    setUsers(updatedUsers);
    localStorage.setItem('wms-users', JSON.stringify(updatedUsers));

    addToast('success', `Usuário "${username}" cadastrado localmente (Contingência)!`);
    addNotification("Segurança do Sistema", `Novo usuário "${username}" cadastrado offline por administrador.`, "warning");
    
    setNewUserName('');
    setNewUserUsername('');
    setNewUserPassword('');
    setNewUserPerfil('operador');
  };

  const handleDeleteUser = async (userToDelete: User) => {
    if (currentUser && userToDelete.id === currentUser.id) {
      addToast('error', 'Você não pode excluir o seu próprio usuário.');
      return;
    }

    if (userToDelete.username === 'admin') {
      addToast('error', 'O usuário administrador padrão não pode ser excluído.');
      return;
    }

    if (!isOffline) {
      try {
        const res = await fetch(`${BACKEND_URL}/users/${userToDelete.id}`, {
          method: 'DELETE'
        });

        if (res.ok) {
          setUsers(prev => prev.filter(u => u.id !== userToDelete.id));
          
          const localUsersStr = localStorage.getItem('wms-users');
          if (localUsersStr) {
            try {
              const localUsers: User[] = JSON.parse(localUsersStr);
              localStorage.setItem('wms-users', JSON.stringify(localUsers.filter(u => u.id !== userToDelete.id)));
            } catch (ex) {}
          }

          addToast('success', `Usuário "${userToDelete.username}" excluído.`);
          addNotification("Segurança do Sistema", `Usuário "${userToDelete.username}" removido por administrador.`, "success");
          return;
        } else {
          const errData = await res.json();
          addToast('error', errData.error || 'Erro ao excluir usuário.');
          return;
        }
      } catch (err) {
        console.log('Online user deletion failed, falling back to local deletion...');
      }
    }

    const localUsersStr = localStorage.getItem('wms-users');
    if (localUsersStr) {
      try {
        const localUsers: User[] = JSON.parse(localUsersStr);
        const updated = localUsers.filter(u => u.id !== userToDelete.id);
        setUsers(updated);
        localStorage.setItem('wms-users', JSON.stringify(updated));
        addToast('success', `Usuário "${userToDelete.username}" excluído localmente.`);
        addNotification("Segurança do Sistema", `Usuário "${userToDelete.username}" removido offline.`, "warning");
      } catch (e) {
        addToast('error', 'Erro ao ler dados locais.');
      }
    }
  };

  // Backup & Restore Handlers
  const fetchBackups = async () => {
    if (isOffline) return;
    setLoadingBackups(true);
    try {
      const res = await fetch(`${BACKEND_URL}/backups`);
      if (res.ok) {
        const data = await res.json();
        setBackups(data);
      }
    } catch (err) {
      console.error('Error fetching backups:', err);
    } finally {
      setLoadingBackups(false);
    }
  };

  const handleCreateBackup = async () => {
    if (isOffline) {
      addToast('error', 'Não é possível criar backups em modo de contingência local.');
      return;
    }
    setIsBackingUp(true);
    try {
      const res = await fetch(`${BACKEND_URL}/backups`, { method: 'POST' });
      if (res.ok) {
        const result = await res.json();
        addToast('success', 'Backup gerado com sucesso!');
        addNotification("Backup do WMS", `Novo backup "${result.filename}" gerado manualmente por administrador.`, "success");
        fetchBackups();
      } else {
        const errData = await res.json();
        addToast('error', errData.error || 'Erro ao gerar backup.');
      }
    } catch (err) {
      addToast('error', 'Falha de rede ao tentar gerar backup.');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreBackup = async () => {
    if (!backupToRestore) return;
    if (isOffline) {
      addToast('error', 'Não é possível restaurar backups em modo de contingência local.');
      return;
    }
    try {
      const res = await fetch(`${BACKEND_URL}/backups/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: backupToRestore })
      });
      if (res.ok) {
        addToast('success', 'Banco de dados restaurado com sucesso!');
        addNotification("Backup do WMS", `Banco de dados restaurado para o estado do backup "${backupToRestore}".`, "warning");
        setIsRestoreModalOpen(false);
        setBackupToRestore(null);
        fetchData();
      } else {
        const errData = await res.json();
        addToast('error', errData.error || 'Erro ao restaurar backup.');
      }
    } catch (err) {
      addToast('error', 'Falha de rede ao tentar restaurar backup.');
    }
  };

  const handleDeleteBackupFile = async (filename: string) => {
    if (isOffline) {
      addToast('error', 'Ação indisponível em modo de contingência local.');
      return;
    }
    try {
      const res = await fetch(`${BACKEND_URL}/backups/${filename}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        addToast('success', 'Arquivo de backup excluído.');
        addNotification("Backup do WMS", `Arquivo de backup "${filename}" excluído do servidor por administrador.`, "info");
        fetchBackups();
      } else {
        const errData = await res.json();
        addToast('error', errData.error || 'Erro ao excluir backup.');
      }
    } catch (err) {
      addToast('error', 'Falha de rede ao tentar excluir backup.');
    }
  };

  // Export inventory items to CSV
  const exportInventoryCSV = () => {
    try {
      const headers = ['ID', 'Produto', 'SKU', 'Categoria', 'Quantidade', 'Estoque Minimo', 'Preco Unitario', 'Valor Total', 'Localizacao', 'Ultima Atualizacao'];
      const rows = items.map(item => [
        item.id,
        `"${item.name.replace(/"/g, '""')}"`,
        item.sku,
        item.category,
        item.quantity,
        item.minStockLevel,
        item.price.toFixed(2),
        (item.price * item.quantity).toFixed(2),
        `"${(item.location || '').replace(/"/g, '""')}"`,
        item.lastUpdated || ''
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');

      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `inventario_inviolavel_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      addToast('success', 'Relatório de inventário CSV exportado!');
      addNotification("Exportação de Dados", "Relatório de inventário em CSV gerado e baixado.", "success");
    } catch (err) {
      console.error(err);
      addToast('error', 'Falha ao exportar relatório.');
    }
  };

  // Export movement logs to CSV
  const exportMovementsCSV = () => {
    try {
      const headers = ['ID Movimentacao', 'Data/Hora', 'Produto', 'SKU', 'Tipo', 'Subtipo', 'Nº OS', 'Quantidade'];
      const rows = movements.map(move => [
        move.id_movimentacao,
        new Date(move.data_movimentacao).toISOString(),
        `"${move.name.replace(/"/g, '""')}"`,
        move.sku,
        move.tipo_movimentacao,
        SUBTYPE_TRANSLATIONS[move.subtipo_movimentacao] || move.subtipo_movimentacao,
        move.numero_os || '',
        move.quantidade
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');

      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `movimentacoes_inviolavel_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      addToast('success', 'Relatório de movimentações CSV exportado!');
      addNotification("Exportação de Dados", "Relatório de movimentações em CSV gerado e baixado.", "success");
    } catch (err) {
      console.error(err);
      addToast('error', 'Falha ao exportar relatório.');
    }
  };

  // Export inventory items to PDF using browser print
  const exportInventoryPDF = () => {
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        addToast('error', 'Por favor, permita pop-ups para exportar em PDF.');
        return;
      }

      const totalVal = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
      const lowStockCount = items.filter(item => item.quantity <= item.minStockLevel).length;

      const htmlContent = `
        <html>
          <head>
            <title>Relatório de Inventário - Inviolável WMS</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
              body {
                font-family: 'Outfit', sans-serif;
                color: #111827;
                margin: 25px;
                padding: 0;
                background-color: #ffffff;
              }
              .header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 2px solid #111827;
                padding-bottom: 15px;
                margin-bottom: 25px;
              }
              .brand-title {
                font-size: 20px;
                font-weight: 700;
                letter-spacing: 0.05em;
                color: #111827;
                text-transform: uppercase;
              }
              .report-title {
                font-size: 13px;
                color: #4b5563;
                text-align: right;
                line-height: 1.4;
              }
              .meta-cards {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 15px;
                margin-bottom: 25px;
              }
              .card {
                border: 1px solid #e5e7eb;
                padding: 12px;
                border-radius: 6px;
                background-color: #f9fafb;
              }
              .card-label {
                font-size: 10px;
                color: #6b7280;
                text-transform: uppercase;
                margin-bottom: 4px;
                font-weight: 600;
              }
              .card-value {
                font-size: 18px;
                font-weight: 700;
                color: #111827;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 40px;
                font-size: 11px;
              }
              th {
                background-color: #111827;
                color: #ffffff;
                text-align: left;
                padding: 10px;
                font-weight: 600;
                text-transform: uppercase;
                font-size: 9px;
                letter-spacing: 0.05em;
              }
              td {
                padding: 9px 10px;
                border-bottom: 1px solid #e5e7eb;
              }
              tr:nth-child(even) td {
                background-color: #f9fafb;
              }
              .text-right {
                text-align: right;
              }
              .badge {
                display: inline-block;
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 9px;
                font-weight: 600;
              }
              .badge-alert {
                background-color: #fee2e2;
                color: #991b1b;
                border: 1px solid #fca5a5;
              }
              .footer {
                margin-top: 50px;
                border-top: 1px dashed #d1d5db;
                padding-top: 20px;
                display: flex;
                justify-content: space-between;
                font-size: 10px;
                color: #6b7280;
              }
              .signature-wrapper {
                display: flex;
                flex-direction: column;
                align-items: center;
              }
              .signature-line {
                width: 220px;
                border-bottom: 1px solid #374151;
                margin-top: 25px;
                text-align: center;
                padding-bottom: 5px;
                font-weight: 500;
              }
              @media print {
                body { margin: 15px; }
                .no-print { display: none; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <div>
                <div class="brand-title">INVIOLÁVEL WMS</div>
                <div style="font-size: 11px; color: #4b5563;">Sistema de Gestão de Armazém</div>
              </div>
              <div class="report-title">
                <strong>RELATÓRIO DE INVENTÁRIO</strong><br/>
                Gerado em: ${new Date().toLocaleString('pt-BR')}
              </div>
            </div>

            <div class="meta-cards">
              <div class="card">
                <div class="card-label">Total de Unidades</div>
                <div class="card-value">${items.reduce((acc, item) => acc + item.quantity, 0)}</div>
              </div>
              <div class="card">
                <div class="card-label">Variedade (SKUs)</div>
                <div class="card-value">${items.length}</div>
              </div>
              <div class="card">
                <div class="card-label">Valor do Ativo</div>
                <div class="card-value">R$ ${totalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
              <div class="card">
                <div class="card-label">Itens Críticos</div>
                <div class="card-value" style="color: ${lowStockCount > 0 ? '#b91c1c' : 'inherit'}">${lowStockCount}</div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Produto</th>
                  <th>Categoria</th>
                  <th>Localização</th>
                  <th class="text-right">Quantidade</th>
                  <th class="text-right">Preço Unitário</th>
                  <th class="text-right">Valor Total</th>
                </tr>
              </thead>
              <tbody>
                ${items.map(item => `
                  <tr>
                    <td style="font-family: monospace; font-weight: bold;">${item.sku}</td>
                    <td>
                      ${item.name}
                      ${item.quantity <= item.minStockLevel ? ' <span class="badge badge-alert">Estoque Baixo</span>' : ''}
                    </td>
                    <td>${categoryTranslations[item.category] || item.category}</td>
                    <td>${item.location || '-'}</td>
                    <td class="text-right" style="font-weight: 500;">${item.quantity}</td>
                    <td class="text-right">R$ ${item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td class="text-right" style="font-weight: 600;">R$ ${(item.price * item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="footer">
              <div>Inviolável WMS Dashboard - Relatório Oficial de Inventário</div>
              <div class="signature-wrapper">
                <div class="signature-line">Responsável pelo Inventário</div>
              </div>
            </div>

            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                }, 500);
              };
            </script>
          </body>
        </html>
      `;

      printWindow.document.write(htmlContent);
      printWindow.document.close();
      addToast('success', 'Relatório PDF aberto na janela de impressão!');
      addNotification("Exportação de Dados", "Relatório de inventário em PDF gerado.", "success");
    } catch (err) {
      console.error(err);
      addToast('error', 'Falha ao gerar relatório PDF.');
    }
  };

  // Export movement logs to PDF using browser print
  const exportMovementsPDF = () => {
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        addToast('error', 'Por favor, permita pop-ups para exportar em PDF.');
        return;
      }

      const totalMovements = movements.length;
      const totalEntradas = movements.filter(m => m.tipo_movimentacao === 'ENTRADA').length;
      const totalSaidas = movements.filter(m => m.tipo_movimentacao === 'SAIDA').length;

      const htmlContent = `
        <html>
          <head>
            <title>Histórico de Movimentações - Inviolável WMS</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
              body {
                font-family: 'Outfit', sans-serif;
                color: #111827;
                margin: 25px;
                padding: 0;
                background-color: #ffffff;
              }
              .header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 2px solid #111827;
                padding-bottom: 15px;
                margin-bottom: 25px;
              }
              .brand-title {
                font-size: 20px;
                font-weight: 700;
                letter-spacing: 0.05em;
                color: #111827;
                text-transform: uppercase;
              }
              .report-title {
                font-size: 13px;
                color: #4b5563;
                text-align: right;
                line-height: 1.4;
              }
              .meta-cards {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 15px;
                margin-bottom: 25px;
              }
              .card {
                border: 1px solid #e5e7eb;
                padding: 12px;
                border-radius: 6px;
                background-color: #f9fafb;
              }
              .card-label {
                font-size: 10px;
                color: #6b7280;
                text-transform: uppercase;
                margin-bottom: 4px;
                font-weight: 600;
              }
              .card-value {
                font-size: 18px;
                font-weight: 700;
                color: #111827;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 40px;
                font-size: 11px;
              }
              th {
                background-color: #111827;
                color: #ffffff;
                text-align: left;
                padding: 10px;
                font-weight: 600;
                text-transform: uppercase;
                font-size: 9px;
                letter-spacing: 0.05em;
              }
              td {
                padding: 9px 10px;
                border-bottom: 1px solid #e5e7eb;
              }
              tr:nth-child(even) td {
                background-color: #f9fafb;
              }
              .text-right {
                text-align: right;
              }
              .badge {
                display: inline-block;
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 9px;
                font-weight: 600;
              }
              .badge-success {
                background-color: #d1fae5;
                color: #065f46;
                border: 1px solid #6ee7b7;
              }
              .badge-danger {
                background-color: #fee2e2;
                color: #991b1b;
                border: 1px solid #fca5a5;
              }
              .badge-os {
                background-color: #dbeafe;
                color: #1e40af;
                border: 1px solid #bfdbfe;
              }
              .footer {
                margin-top: 50px;
                border-top: 1px dashed #d1d5db;
                padding-top: 20px;
                display: flex;
                justify-content: space-between;
                font-size: 10px;
                color: #6b7280;
              }
              .signature-wrapper {
                display: flex;
                flex-direction: column;
                align-items: center;
              }
              .signature-line {
                width: 220px;
                border-bottom: 1px solid #374151;
                margin-top: 25px;
                text-align: center;
                padding-bottom: 5px;
                font-weight: 500;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <div>
                <div class="brand-title">INVIOLÁVEL WMS</div>
                <div style="font-size: 11px; color: #4b5563;">Sistema de Gestão de Armazém</div>
              </div>
              <div class="report-title">
                <strong>HISTÓRICO DE MOVIMENTAÇÕES</strong><br/>
                Gerado em: ${new Date().toLocaleString('pt-BR')}
              </div>
            </div>

            <div class="meta-cards">
              <div class="card">
                <div class="card-label">Total de Movimentações</div>
                <div class="card-value">${totalMovements}</div>
              </div>
              <div class="card">
                <div class="card-label">Entradas (+)</div>
                <div class="card-value" style="color: #047857;">${totalEntradas}</div>
              </div>
              <div class="card">
                <div class="card-label">Saídas (-)</div>
                <div class="card-value" style="color: #b91c1c;">${totalSaidas}</div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Data/Hora</th>
                  <th>Produto</th>
                  <th>SKU</th>
                  <th>Tipo</th>
                  <th>Subtipo</th>
                  <th>Nº OS</th>
                  <th class="text-right">Quantidade</th>
                </tr>
              </thead>
              <tbody>
                ${movements.map(move => `
                  <tr>
                    <td>${new Date(move.data_movimentacao).toLocaleString('pt-BR')}</td>
                    <td style="font-weight: 500;">${move.name}</td>
                    <td style="font-family: monospace; font-weight: bold;">${move.sku}</td>
                    <td>
                      <span class="badge ${move.tipo_movimentacao === 'ENTRADA' ? 'badge-success' : 'badge-danger'}">
                        ${move.tipo_movimentacao}
                      </span>
                    </td>
                    <td>${SUBTYPE_TRANSLATIONS[move.subtipo_movimentacao] || move.subtipo_movimentacao}</td>
                    <td>
                      ${move.numero_os ? `<span class="badge badge-os">${move.numero_os}</span>` : '-'}
                    </td>
                    <td class="text-right" style="font-weight: 600;">${move.quantidade}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="footer">
              <div>Inviolável WMS Dashboard - Histórico de Movimentações</div>
              <div class="signature-wrapper">
                <div class="signature-line">Responsável pelo Armazém</div>
              </div>
            </div>

            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                }, 500);
              };
            </script>
          </body>
        </html>
      `;

      printWindow.document.write(htmlContent);
      printWindow.document.close();
      addToast('success', 'Relatório de movimentações PDF aberto na janela de impressão!');
      addNotification("Exportação de Dados", "Relatório de movimentações em PDF gerado.", "success");
    } catch (err) {
      console.error(err);
      addToast('error', 'Falha ao gerar relatório PDF.');
    }
  };

  // Corridor Management Handlers
  const handleAddCorridor = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCorridorName.trim().toUpperCase();
    if (!name) {
      addToast('error', 'O identificador do corredor não pode estar vazio.');
      return;
    }
    
    // Alphanumeric check, max 3 characters (e.g. 'A', 'B', 'A1', 'B2')
    if (!/^[A-Z0-9]{1,3}$/.test(name)) {
      addToast('error', 'O identificador deve conter de 1 a 3 caracteres alfanuméricos.');
      return;
    }

    if (corridors.includes(name)) {
      addToast('error', `O corredor "${name}" já existe.`);
      return;
    }

    const updated = [...corridors, name].sort();
    setCorridors(updated);
    localStorage.setItem('wms-corridors', JSON.stringify(updated));
    setSelectedCorridor(name);
    setNewCorridorName('');
    addToast('success', `Corredor "${name}" criado com sucesso!`);
    addNotification("Configuração do Armazém", `Corredor ${name} criado no mapa de endereçamento.`, "info");
  };

  const handleDeleteCorridor = (name: string) => {
    // Check if there are any products linked to this corridor
    const hasItems = items.some(item => {
      const loc = (item.location || '').trim().toUpperCase();
      return loc.startsWith(`${name}-`) || loc === name;
    });

    if (hasItems) {
      addToast('error', `Não é possível remover o corredor "${name}" pois existem produtos endereçados nele.`);
      return;
    }

    if (corridors.length <= 1) {
      addToast('error', 'O armazém precisa ter pelo menos um corredor ativo.');
      return;
    }

    const updated = corridors.filter(c => c !== name);
    setCorridors(updated);
    localStorage.setItem('wms-corridors', JSON.stringify(updated));
    
    // Switch selection if we deleted the currently selected one
    if (selectedCorridor === name) {
      setSelectedCorridor(updated[0]);
    }
    addToast('success', `Corredor "${name}" excluído.`);
    addNotification("Configuração do Armazém", `Corredor ${name} removido do mapa de endereçamento.`, "warning");
  };

  const handleAddLevel = () => {
    const nextLvl = levels.length > 0 ? Math.max(...levels) + 1 : 1;
    if (nextLvl > 10) {
      addToast('error', 'O limite máximo recomendado é de 10 níveis de prateleiras.');
      return;
    }
    const updated = [...levels, nextLvl].sort((a, b) => a - b);
    setLevels(updated);
    localStorage.setItem('wms-levels', JSON.stringify(updated));
    addToast('success', `Nível ${nextLvl} criado com sucesso!`);
    addNotification("Configuração do Armazém", `Nível ${nextLvl} adicionado ao mapa de endereçamento.`, "info");
  };

  const handleDeleteLevel = (lvl: number) => {
    const hasItems = items.some(item => {
      const loc = (item.location || '').trim().toUpperCase();
      const suffix1 = `-${lvl}`;
      const suffix2 = `-0${lvl}`;
      return loc.endsWith(suffix1) || loc.endsWith(suffix2);
    });

    if (hasItems) {
      addToast('error', `Não é possível remover o Nível ${lvl} pois existem produtos endereçados nele.`);
      return;
    }

    if (levels.length <= 1) {
      addToast('error', 'O armazém precisa ter pelo menos um nível ativo.');
      return;
    }

    const updated = levels.filter(l => l !== lvl);
    setLevels(updated);
    localStorage.setItem('wms-levels', JSON.stringify(updated));
    addToast('success', `Nível ${lvl} excluído.`);
    addNotification("Configuração do Armazém", `Nível ${lvl} removido do mapa de endereçamento.`, "warning");
  };

  // Reordering & Purchase Orders Handlers
  const handleSupplierChange = (itemId: string, supplier: string) => {
    setItemSuppliers(prev => ({
      ...prev,
      [itemId]: supplier
    }));
  };

  const emitPurchaseOrder = () => {
    const lowStockItems = items.filter(item => item.quantity <= item.minStockLevel);
    if (lowStockItems.length === 0) {
      addToast('error', 'Não há itens críticos para reabastecimento.');
      return;
    }

    try {
      const headers = ['Fornecedor', 'Produto', 'SKU', 'Quantidade Sugerida', 'Preco Unitario', 'Custo Estimado'];
      const rows = lowStockItems.map(item => {
        const qtyNeeded = Math.max(1, (item.minStockLevel * 2) - item.quantity);
        const supplier = itemSuppliers[item.id] || 'Inviolável Distribuição Ltda';
        return [
          `"${supplier.replace(/"/g, '""')}"`,
          `"${item.name.replace(/"/g, '""')}"`,
          item.sku,
          qtyNeeded,
          item.price.toFixed(2),
          (item.price * qtyNeeded).toFixed(2)
        ];
      });

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');

      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `ordem_reabastecimento_inviolavel_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      addToast('success', 'Ordem de compra emitida e baixada com sucesso!');
      addNotification("Ordem de Compra Emitida", "Ordem de reabastecimento gerada para os itens com estoque crítico.", "success");
    } catch (e) {
      console.error(e);
      addToast('error', 'Erro ao emitir ordem de reabastecimento.');
    }
  };

  // Generate historical notifications based on current data
  const generateHistoricalNotifications = (
    currentItems: InventoryItem[],
    currentMovements: any[],
    currentTasks: any[]
  ) => {
    const historical: WMSNotification[] = [];

    // 1. Low stock notifications
    currentItems.forEach(item => {
      if (item.quantity <= item.minStockLevel) {
        historical.push({
          id: `lowstock-${item.id}`,
          title: 'Estoque Crítico',
          description: `O item ${item.name} (${item.sku}) está com saldo de ${item.quantity} un. (mínimo: ${item.minStockLevel}).`,
          type: 'warning',
          timestamp: item.lastUpdated || new Date().toISOString(),
          read: true
        });
      }
    });

    // 2. Discrepancy tasks
    currentTasks.forEach(task => {
      if (task.status === 'CONCLUIDO') {
        const diff = task.quantidade_conferida - task.quantidade_esperada;
        if (diff !== 0) {
          historical.push({
            id: `taskdiff-${task.id_tarefa}`,
            title: 'Divergência de Inventário',
            description: `Divergência de ${diff > 0 ? '+' : ''}${diff} un. no produto ${task.name_produto || task.name} (${task.sku_produto || task.sku}).`,
            type: 'error',
            timestamp: task.data_conclusao || new Date().toISOString(),
            read: true
          });
        }
      }
    });

    // 3. Recent movements (max 5)
    currentMovements.slice(0, 5).forEach(move => {
      historical.push({
        id: `move-${move.id_movimentacao}`,
        title: move.tipo_movimentacao === 'ENTRADA' ? 'Entrada de Estoque' : 'Saída de Estoque',
        description: `${move.tipo_movimentacao === 'ENTRADA' ? 'Recebido' : 'Retirado'} ${move.quantidade} un. do produto ${move.name} (${SUBTYPE_TRANSLATIONS[move.subtipo_movimentacao] || move.subtipo_movimentacao}).`,
        type: 'info',
        timestamp: move.data_movimentacao,
        read: true
      });
    });

    // 4. Pending daily tasks
    currentTasks.forEach(task => {
      if (task.status === 'PENDENTE') {
        historical.push({
          id: `taskpend-${task.id_tarefa}`,
          title: 'Tarefa de Conferência Pendente',
          description: `Conferência de saldo pendente para o produto ${task.name_produto || task.name} (${task.sku_produto || task.sku}).`,
          type: 'info',
          timestamp: task.data_geracao || new Date().toISOString(),
          read: true
        });
      }
    });

    // Load from localStorage to preserve read states & dynamic session notifications
    const savedStr = localStorage.getItem('wms-notifications');
    let saved: WMSNotification[] = [];
    if (savedStr) {
      try {
        saved = JSON.parse(savedStr);
      } catch (e) {
        console.error(e);
      }
    }

    const merged: WMSNotification[] = [...historical];
    saved.forEach(s => {
      const isSystem = s.id.startsWith('lowstock-') || s.id.startsWith('taskdiff-') || s.id.startsWith('move-') || s.id.startsWith('taskpend-');
      if (!isSystem) {
        if (!merged.some(m => m.id === s.id)) {
          merged.push(s);
        }
      } else {
        const existing = merged.find(m => m.id === s.id);
        if (existing) {
          existing.read = s.read;
        }
      }
    });

    merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setNotifications(merged);
  };

  // Save notifications on state change
  useEffect(() => {
    localStorage.setItem('wms-notifications', JSON.stringify(notifications));
  }, [notifications]);

  // Connection listening useEffect
  const [firstLoad, setFirstLoad] = useState(true);
  useEffect(() => {
    if (firstLoad) {
      setFirstLoad(false);
      return;
    }
    if (isOffline) {
      addNotification("Conexão Offline", "O sistema está operando localmente no navegador.", "warning");
    } else {
      addNotification("Conexão Online", "Conexão restaurada com o banco de dados SQL.", "success");
    }
  }, [isOffline]);

  // Critical stock listening useEffect
  useEffect(() => {
    if (items.length === 0) return;
    items.forEach(item => {
      if (item.quantity <= item.minStockLevel) {
        setNotifications(prev => {
          const exists = prev.some(n => n.id === `lowstock-${item.id}` || (n.title === 'Alerta de Estoque Crítico' && n.description.includes(item.name)));
          if (exists) return prev;
          
          const newNotif: WMSNotification = {
            id: `lowstock-${item.id}`,
            title: 'Alerta de Estoque Crítico',
            description: `O produto ${item.name} (${item.sku}) está abaixo do limite de segurança (Saldo: ${item.quantity} un., Mínimo: ${item.minStockLevel} un.).`,
            type: 'warning',
            timestamp: new Date().toISOString(),
            read: false
          };
          return [newNotif, ...prev];
        });
      }
    });
  }, [items]);

  // Fetch Data
  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/inventory`);
      if (!response.ok) throw new Error('Failed to fetch from server');
      
      const data = await response.json();
      setItems(data);
      
      const statsRes = await fetch(`${BACKEND_URL}/inventory/stats`);
      let statsData = null;
      if (statsRes.ok) {
        statsData = await statsRes.json();
        setStats(statsData);
      }

      const moveRes = await fetch(`${BACKEND_URL}/inventory/movements`);
      let moveData = [];
      if (moveRes.ok) {
        moveData = await moveRes.json();
        setMovements(moveData);
      }

      const taskRes = await fetch(`${BACKEND_URL}/inventory/tasks`);
      let taskData = [];
      if (taskRes.ok) {
        taskData = await taskRes.json();
        setTasks(taskData);
      }

      const trashRes = await fetch(`${BACKEND_URL}/inventory/trash`);
      if (trashRes.ok) {
        const trashData = await trashRes.json();
        setTrashItems(trashData);
      }

      const usersRes = await fetch(`${BACKEND_URL}/users`);
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData);
      }

      setIsOffline(false);
      fetchAISuggestions(data, false);
      generateHistoricalNotifications(data, moveData, taskData);
    } catch (error) {
      console.log('Using local storage fallback mode due to:', error);
      setIsOffline(true);
      
      const localItems = localStorage.getItem('inventory-vis-items');
      let loadedItems = fallbackItems;
      if (localItems) {
        try {
          loadedItems = JSON.parse(localItems);
        } catch (e) {
          loadedItems = fallbackItems;
        }
      } else {
        localStorage.setItem('inventory-vis-items', JSON.stringify(fallbackItems));
      }
      setItems(loadedItems);
      calculateLocalStats(loadedItems);

      const localMoves = localStorage.getItem('inventory-vis-movements');
      let localMovesParsed = [];
      if (localMoves) {
        try {
          localMovesParsed = JSON.parse(localMoves);
          setMovements(localMovesParsed);
        } catch (e) {
          setMovements([]);
        }
      }

      const localTasks = localStorage.getItem('inventory-vis-tasks');
      let localTasksParsed = [];
      if (localTasks) {
        try {
          localTasksParsed = JSON.parse(localTasks);
          setTasks(localTasksParsed);
        } catch (e) {
          setTasks([]);
        }
      } else {
        const mockTasks: WMSTask[] = loadedItems.slice(0, 3).map((item, idx) => ({
          id_tarefa: `task-${idx}-${Math.random().toString(36).substr(2, 5)}`,
          id_produto: item.id,
          name_produto: item.name,
          sku_produto: item.sku,
          tipo_tarefa: idx % 2 === 0 ? 'CONFERENCIA_SALDO' : 'CONFERENCIA_ROTATIVA',
          data_geracao: new Date().toISOString(),
          status: 'PENDENTE',
          quantidade_esperada: item.quantity
        }));
        setTasks(mockTasks);
        localTasksParsed = mockTasks;
        localStorage.setItem('inventory-vis-tasks', JSON.stringify(mockTasks));
      }

      const localTrash = localStorage.getItem('inventory-vis-trash');
      if (localTrash) {
        try {
          setTrashItems(JSON.parse(localTrash));
        } catch (e) {
          setTrashItems([]);
        }
      } else {
        setTrashItems([]);
      }
      
      const localUsers = localStorage.getItem('wms-users');
      if (localUsers) {
        try {
          setUsers(JSON.parse(localUsers));
        } catch (e) {
          setUsers([]);
        }
      } else {
        const defaultUsers: User[] = [
          { id: 'u1', username: 'admin', nome: 'Administrador Inviolável', perfil: 'admin' },
          { id: 'u2', username: 'operador', nome: 'Operador WMS', perfil: 'operador' },
          { id: 'u3', username: 'auditor', nome: 'Auditor WMS', perfil: 'auditor' }
        ];
        setUsers(defaultUsers);
        localStorage.setItem('wms-users', JSON.stringify(defaultUsers));
      }
      
      generateLocalAISuggestions(loadedItems);
      generateHistoricalNotifications(loadedItems, localMovesParsed, localTasksParsed);
    } finally {
      setLoading(false);
    }
  };

  const calculateLocalStats = (currentItems: InventoryItem[]) => {
    const totalItemsCount = currentItems.reduce((acc, item) => acc + item.quantity, 0);
    const uniqueItemsCount = currentItems.length;
    const totalValue = currentItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const lowStockCount = currentItems.filter(item => item.quantity <= item.minStockLevel).length;
    setStats({
      totalItemsCount,
      uniqueItemsCount,
      totalValue: Number(totalValue.toFixed(2)),
      lowStockCount
    });
  };

  // Fetch AI Insights
  const fetchAISuggestions = async (currentItems: InventoryItem[], showNotice: boolean = true) => {
    setLoadingAI(true);
    try {
      const headers: Record<string, string> = {};
      if (geminiApiKey) {
        headers['x-gemini-key'] = geminiApiKey;
      }
      const response = await fetch(`${BACKEND_URL}/inventory/ai-suggestions`, { headers });
      if (!response.ok) throw new Error('Failed to fetch AI insights');
      const data = await response.json();
      setAiSuggestions(data);
      if (showNotice) addToast('success', 'Gemini AI insights atualizados!');
    } catch (error) {
      console.log('AI fetch failed, falling back to local simulation:', error);
      generateLocalAISuggestions(currentItems);
    } finally {
      setLoadingAI(false);
    }
  };

  const generateLocalAISuggestions = (currentItems: InventoryItem[]) => {
    const lowStockProducts = currentItems.filter(i => i.quantity <= i.minStockLevel);
    const mockActionItems = lowStockProducts.map(p => 
      `Comprar aproximadamente ${p.minStockLevel * 2 - p.quantity} unidades de "${p.name}" para restabelecer nível seguro.`
    );
    
    if (mockActionItems.length === 0) {
      mockActionItems.push("Todos os itens encontram-se acima dos limites de alerta de estoque mínimo.");
    }
    mockActionItems.push("Otimizar alocação de espaço e armazenagem para itens de maior valor unitário.");
    mockActionItems.push("Revisar contratos de fornecedores devido ao valor acumulado em caixa.");

    const totalVal = currentItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);

    setAiSuggestions({
      source: 'local-simulation',
      summary: `Análise simulada local: Atualmente há ${lowStockProducts.length} itens abaixo da margem de segurança. Avaliação total de ativos de $${totalVal.toLocaleString('en-US', { maximumFractionDigits: 2 })}. Recomenda-se reposição ágil dos SKUs críticos.`,
      actionItems: mockActionItems.slice(0, 4),
      valuationInsight: "Capital concentrado em categorias tecnológicas de alta obsolescência. Recomenda-se auditoria rotativa bimestral."
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (activeTab === 'backup' && currentUser?.perfil === 'admin') {
      fetchBackups();
    }
  }, [activeTab, currentUser]);

  // Form Handlers
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'quantity' || name === 'price' || name === 'minStockLevel' 
        ? Number(value) 
        : value
    }));
    if (formErrors[name]) {
      setFormErrors(prev => {
        const copy = { ...prev };
        delete copy[name];
        return copy;
      });
    }
  };

  const handleMovementChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setMovementData(prev => ({
      ...prev,
      [name]: name === 'quantidade' ? Number(value) : value
    }));
    if (movementErrors[name]) {
      setMovementErrors(prev => {
        const copy = { ...prev };
        delete copy[name];
        return copy;
      });
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = 'Nome do produto é obrigatório';
    if (!formData.sku.trim()) errors.sku = 'SKU é obrigatório';
    if (formData.quantity < 0) errors.quantity = 'A quantidade não pode ser negativa';
    if (formData.price <= 0) errors.price = 'O preço unitário deve ser maior que zero';
    if (formData.minStockLevel < 0) errors.minStockLevel = 'Nível mínimo de segurança não pode ser negativo';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Record Stock Movement Submit (Triggers validation & concurency checks)
  const handleMovementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    if (movementData.quantidade <= 0) {
      setMovementErrors({ quantidade: 'A quantidade deve ser maior que zero' });
      return;
    }

    if (isOffline) {
      // Offline local logic (simulates triggers)
      const isNegative = selectedItem.quantity - movementData.quantidade < 0;
      
      // If Accessories (Category with backorder) allow negative, otherwise fail
      if (movementData.tipo_movimentacao === 'SAIDA' && isNegative && selectedItem.category !== 'Accessories') {
        addToast('error', `Operação negada: Saldo de estoque insuficiente para o produto ${selectedItem.name}.`);
        return;
      }

      const newQty = movementData.tipo_movimentacao === 'ENTRADA' 
        ? selectedItem.quantity + movementData.quantidade
        : selectedItem.quantity - movementData.quantidade;

      const updated = items.map(item => 
        item.id === selectedItem.id 
          ? { ...item, quantity: newQty, lastUpdated: new Date().toISOString() } 
          : item
      );

      const isOSRequired = movementData.tipo_movimentacao === 'SAIDA' && 
        ['NEGOCIACAO_VENDA', 'NEGOCIACAO_LOCADA', 'TRANSFERENCIA'].includes(movementData.subtipo_movimentacao);

      const newMovement: WMSMovement = {
        id_movimentacao: `move-${Math.random().toString(36).substr(2, 9)}`,
        id_produto: selectedItem.id,
        name: selectedItem.name,
        sku: selectedItem.sku,
        tipo_movimentacao: movementData.tipo_movimentacao,
        subtipo_movimentacao: movementData.subtipo_movimentacao,
        quantidade: movementData.quantidade,
        data_movimentacao: new Date().toISOString(),
        numero_os: isOSRequired ? (movementData.numero_os?.trim() || undefined) : undefined
      };

      const updatedMovements = [newMovement, ...movements];
      setItems(updated);
      setMovements(updatedMovements);
      localStorage.setItem('inventory-vis-items', JSON.stringify(updated));
      localStorage.setItem('inventory-vis-movements', JSON.stringify(updatedMovements));
      calculateLocalStats(updated);
      generateLocalAISuggestions(updated);
      
      addToast('success', 'Movimentação processada localmente');
      addNotification(
        movementData.tipo_movimentacao === 'ENTRADA' ? 'Entrada de Estoque (Offline)' : 'Saída de Estoque (Offline)',
        `Item: ${selectedItem.name} - Qtd: ${movementData.quantidade} un. (${SUBTYPE_TRANSLATIONS[movementData.subtipo_movimentacao] || movementData.subtipo_movimentacao})`,
        movementData.tipo_movimentacao === 'ENTRADA' ? 'success' : 'info'
      );
      setIsMovementModalOpen(false);
    } else {
      try {
        const isOSRequired = movementData.tipo_movimentacao === 'SAIDA' && 
          ['NEGOCIACAO_VENDA', 'NEGOCIACAO_LOCADA', 'TRANSFERENCIA'].includes(movementData.subtipo_movimentacao);

        const res = await fetch(`${BACKEND_URL}/inventory/movements`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_produto: selectedItem.id,
            ...movementData,
            numero_os: isOSRequired ? (movementData.numero_os?.trim() || null) : null
          })
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Falha na movimentação');
        }

        addToast('success', 'Movimentação processada e integrada no banco SQL!');
        addNotification(
          movementData.tipo_movimentacao === 'ENTRADA' ? 'Entrada de Estoque' : 'Saída de Estoque',
          `Item: ${selectedItem.name} - Qtd: ${movementData.quantidade} un. (${SUBTYPE_TRANSLATIONS[movementData.subtipo_movimentacao] || movementData.subtipo_movimentacao})`,
          movementData.tipo_movimentacao === 'ENTRADA' ? 'success' : 'info'
        );
        setIsMovementModalOpen(false);
        fetchData();
      } catch (err: any) {
        addToast('error', err.message || 'Falha de transação');
      }
    }
  };

  // Complete Conference Task Submit
  const handleTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;
    if (taskFormData.quantidade_conferida < 0) {
      setTaskErrors({ quantidade_conferida: 'A quantidade conferida não pode ser negativa' });
      return;
    }

    if (isOffline) {
      // Offline task completion simulation
      const updatedTasks = tasks.map(t => 
        t.id_tarefa === selectedTask.id_tarefa 
          ? { 
              ...t, 
              status: 'CONCLUIDO' as const, 
              quantidade_conferida: taskFormData.quantidade_conferida,
              data_conclusao: new Date().toISOString(),
              observacao: taskFormData.observacao
            } 
          : t
      );
      setTasks(updatedTasks);
      localStorage.setItem('inventory-vis-tasks', JSON.stringify(updatedTasks));

      // Discrepancy adjustment movement
      const diff = taskFormData.quantidade_conferida - selectedTask.quantidade_esperada;
      if (diff !== 0) {
        const tipo = diff > 0 ? 'ENTRADA' : 'SAIDA';
        const absQty = Math.abs(diff);

        // Update item stock level offline
        const updatedItems = items.map(item => {
          if (item.id === selectedTask.id_produto) {
            return {
              ...item,
              quantity: taskFormData.quantidade_conferida,
              lastUpdated: new Date().toISOString()
            };
          }
          return item;
        });
        setItems(updatedItems);
        localStorage.setItem('inventory-vis-items', JSON.stringify(updatedItems));
        calculateLocalStats(updatedItems);

        // Record movement log offline
        const newMovement: WMSMovement = {
          id_movimentacao: `move-${Math.random().toString(36).substr(2, 9)}`,
          id_produto: selectedTask.id_produto,
          name: selectedTask.name_produto,
          sku: selectedTask.sku_produto,
          tipo_movimentacao: tipo,
          subtipo_movimentacao: 'AJUSTE_INVENTARIO',
          quantidade: absQty,
          data_movimentacao: new Date().toISOString(),
          numero_os: `AUDIT-${selectedTask.id_tarefa.substring(0, 8).toUpperCase()}`
        };
        const updatedMovements = [newMovement, ...movements];
        setMovements(updatedMovements);
        localStorage.setItem('inventory-vis-movements', JSON.stringify(updatedMovements));
        generateLocalAISuggestions(updatedItems);
      }

      addToast('success', 'Conferência registrada e processada localmente!');
      const taskDiff = taskFormData.quantidade_conferida - selectedTask.quantidade_esperada;
      if (taskDiff === 0) {
        addNotification("Auditoria Concluída (Offline)", `O item ${selectedTask.name_produto} (${selectedTask.sku_produto}) foi auditado sem divergências (Saldo: ${taskFormData.quantidade_conferida} un).`, "success");
      } else {
        addNotification("Divergência de Inventário (Offline)", `Divergência de ${taskDiff > 0 ? '+' : ''}${taskDiff} un. no item ${selectedTask.name_produto} (${selectedTask.sku_produto}) durante auditoria.`, "error");
      }
      setIsTaskModalOpen(false);
    } else {
      try {
        const res = await fetch(`${BACKEND_URL}/inventory/tasks/${selectedTask.id_tarefa}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quantidade_conferida: Number(taskFormData.quantidade_conferida),
            observacao: taskFormData.observacao
          })
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Falha ao concluir tarefa');
        }

        addToast('success', 'Conferência integrada e saldo atualizado no banco!');
        const taskDiffOnline = Number(taskFormData.quantidade_conferida) - selectedTask.quantidade_esperada;
        if (taskDiffOnline === 0) {
          addNotification("Auditoria Concluída", `O item ${selectedTask.name_produto} (${selectedTask.sku_produto}) foi auditado sem divergências (Saldo: ${taskFormData.quantidade_conferida} un).`, "success");
        } else {
          addNotification("Divergência de Inventário", `Divergência de ${taskDiffOnline > 0 ? '+' : ''}${taskDiffOnline} un. no item ${selectedTask.name_produto} (${selectedTask.sku_produto}) durante auditoria.`, "error");
        }
        setIsTaskModalOpen(false);
        fetchData();
      } catch (err: any) {
        addToast('error', err.message || 'Falha ao processar conferência');
      }
    }
  };

  // Add Product Submit
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (isOffline) {
      if (items.some(item => item.sku.toLowerCase() === formData.sku.toLowerCase())) {
        setFormErrors({ sku: 'SKU já cadastrado no sistema' });
        return;
      }
      const newItem: InventoryItem = {
        id: `item-${Math.random().toString(36).substr(2, 9)}`,
        ...formData,
        lastUpdated: new Date().toISOString()
      };
      const updated = [newItem, ...items];
      setItems(updated);
      localStorage.setItem('inventory-vis-items', JSON.stringify(updated));
      calculateLocalStats(updated);
      generateLocalAISuggestions(updated);
      addToast('success', 'Produto registrado localmente (Offline)');
      addNotification("Produto Cadastrado (Offline)", `O produto ${newItem.name} (${newItem.sku}) foi cadastrado localmente.`, "success");
      setIsAddModalOpen(false);
      resetForm();
    } else {
      try {
        const res = await fetch(`${BACKEND_URL}/inventory`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            permitir_backorder: backorderCategories[formData.category] || false
          })
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Erro ao registrar produto');
        }
        addToast('success', 'Produto registrado com sucesso');
        addNotification("Produto Cadastrado", `O produto ${formData.name} (${formData.sku}) foi cadastrado com sucesso.`, "success");
        setIsAddModalOpen(false);
        resetForm();
        fetchData();
      } catch (err: any) {
        addToast('error', err.message || 'Erro inesperado');
      }
    }
  };

  // Edit Click
  const handleEditClick = (item: InventoryItem) => {
    setSelectedItem(item);
    setFormData({
      name: item.name,
      sku: item.sku,
      category: item.category,
      quantity: item.quantity,
      price: item.price,
      minStockLevel: item.minStockLevel,
      location: item.location
    });
    setFormErrors({});
    setIsEditModalOpen(true);
  };

  // Edit Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !validateForm()) return;

    if (isOffline) {
      if (items.some(item => item.id !== selectedItem.id && item.sku.toLowerCase() === formData.sku.toLowerCase())) {
        setFormErrors({ sku: 'SKU já cadastrado por outro produto' });
        return;
      }
      const updated = items.map(item => 
        item.id === selectedItem.id 
          ? { ...item, ...formData, lastUpdated: new Date().toISOString() } 
          : item
      );
      setItems(updated);
      localStorage.setItem('inventory-vis-items', JSON.stringify(updated));
      calculateLocalStats(updated);
      generateLocalAISuggestions(updated);
      addToast('success', 'Produto atualizado localmente');
      addNotification("Produto Atualizado (Offline)", `O produto ${formData.name} (${formData.sku}) foi editado localmente.`, "info");
      setIsEditModalOpen(false);
      resetForm();
    } else {
      try {
        const res = await fetch(`${BACKEND_URL}/inventory/${selectedItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            permitir_backorder: backorderCategories[formData.category] || false
          })
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Erro ao atualizar produto');
        }
        addToast('success', 'Produto atualizado com sucesso');
        setIsEditModalOpen(false);
        resetForm();
        fetchData();
      } catch (err: any) {
        addToast('error', err.message || 'Erro inesperado');
      }
    }
  };

  // Delete Click
  const handleDeleteClick = (item: InventoryItem) => {
    setSelectedItem(item);
    setIsDeleteModalOpen(true);
  };

  // Delete Confirm
  const handleDeleteConfirm = async () => {
    if (!selectedItem) return;

    if (isOffline) {
      const updated = items.filter(item => item.id !== selectedItem.id);
      setItems(updated);
      localStorage.setItem('inventory-vis-items', JSON.stringify(updated));

      // Add to trash list offline
      const currentTrashStr = localStorage.getItem('inventory-vis-trash');
      let currentTrash: InventoryItem[] = [];
      if (currentTrashStr) {
        try { currentTrash = JSON.parse(currentTrashStr); } catch (e) {}
      }
      if (!currentTrash.some(t => t.id === selectedItem.id)) {
        currentTrash = [selectedItem, ...currentTrash];
        localStorage.setItem('inventory-vis-trash', JSON.stringify(currentTrash));
        setTrashItems(currentTrash);
      }

      calculateLocalStats(updated);
      generateLocalAISuggestions(updated);
      addToast('success', 'Produto deletado localmente');
      addNotification("Produto Removido (Offline)", `O produto ${selectedItem.name} (${selectedItem.sku}) foi removido localmente.`, "error");
      setIsDeleteModalOpen(false);
    } else {
      try {
        const res = await fetch(`${BACKEND_URL}/inventory/${selectedItem.id}`, {
          method: 'DELETE'
        });
        if (!res.ok) throw new Error('Erro ao deletar produto');
        addToast('success', 'Produto removido com sucesso');
        addNotification("Produto Removido", `O produto ${selectedItem.name} (${selectedItem.sku}) foi removido do banco de dados.`, "error");
        setIsDeleteModalOpen(false);
        fetchData();
      } catch (err: any) {
        addToast('error', err.message || 'Erro inesperado');
      }
    }
  };

  // Restore Item from Recycle Bin
  const handleRestoreItem = async (item: InventoryItem) => {
    if (isOffline) {
      const currentTrashStr = localStorage.getItem('inventory-vis-trash');
      let currentTrash: InventoryItem[] = [];
      if (currentTrashStr) {
        try { currentTrash = JSON.parse(currentTrashStr); } catch (e) {}
      }
      
      const updatedTrash = currentTrash.filter(t => t.id !== item.id);
      localStorage.setItem('inventory-vis-trash', JSON.stringify(updatedTrash));
      setTrashItems(updatedTrash);

      if (!items.some(i => i.sku.toLowerCase() === item.sku.toLowerCase())) {
        const updatedItems = [item, ...items];
        setItems(updatedItems);
        localStorage.setItem('inventory-vis-items', JSON.stringify(updatedItems));
        calculateLocalStats(updatedItems);
        generateLocalAISuggestions(updatedItems);
        addToast('success', `Produto "${item.name}" restaurado com sucesso!`);
        addNotification("Produto Restaurado (Offline)", `O produto ${item.name} (${item.sku}) foi restaurado da lixeira.`, "success");
      } else {
        addToast('error', `Falha ao restaurar: SKU "${item.sku}" já cadastrado por outro produto ativo.`);
      }
    } else {
      try {
        const res = await fetch(`${BACKEND_URL}/inventory/trash/${item.id}/restore`, {
          method: 'POST'
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Erro ao restaurar produto');
        }
        addToast('success', `Produto "${item.name}" restaurado com sucesso!`);
        addNotification("Produto Restaurado", `O produto ${item.name} (${item.sku}) foi restaurado com sucesso.`, "success");
        fetchData();
      } catch (err: any) {
        addToast('error', err.message || 'Erro ao restaurar item.');
      }
    }
  };

  // Permanently Delete Item from Recycle Bin
  const handleDeletePermanently = async (item: InventoryItem) => {
    if (isOffline) {
      const currentTrashStr = localStorage.getItem('inventory-vis-trash');
      let currentTrash: InventoryItem[] = [];
      if (currentTrashStr) {
        try { currentTrash = JSON.parse(currentTrashStr); } catch (e) {}
      }
      
      const updatedTrash = currentTrash.filter(t => t.id !== item.id);
      localStorage.setItem('inventory-vis-trash', JSON.stringify(updatedTrash));
      setTrashItems(updatedTrash);
      addToast('success', `Produto "${item.name}" excluído permanentemente.`);
      addNotification("Produto Excluído Definitivamente (Offline)", `O produto ${item.name} (${item.sku}) foi excluído da lixeira.`, "warning");
    } else {
      try {
        const res = await fetch(`${BACKEND_URL}/inventory/trash/${item.id}`, {
          method: 'DELETE'
        });
        if (!res.ok) throw new Error('Erro ao excluir permanentemente');
        addToast('success', `Produto "${item.name}" excluído permanentemente.`);
        addNotification("Produto Excluído Definitivamente", `O produto ${item.name} (${item.sku}) foi excluído definitivamente do banco de dados.`, "warning");
        fetchData();
      } catch (err: any) {
        addToast('error', err.message || 'Erro ao excluir item.');
      }
    }
  };

  // Restore all items from trash
  const handleRestoreAll = async () => {
    if (trashItems.length === 0) return;
    
    if (isOffline) {
      const restoredItems: InventoryItem[] = [];
      const skippedSkus: string[] = [];
      
      trashItems.forEach(item => {
        if (!items.some(i => i.sku.toLowerCase() === item.sku.toLowerCase())) {
          restoredItems.push(item);
        } else {
          skippedSkus.push(item.sku);
        }
      });

      if (restoredItems.length > 0) {
        const updatedItems = [...restoredItems, ...items];
        setItems(updatedItems);
        localStorage.setItem('inventory-vis-items', JSON.stringify(updatedItems));
        calculateLocalStats(updatedItems);
        generateLocalAISuggestions(updatedItems);
      }

      const updatedTrash = trashItems.filter(t => !restoredItems.some(r => r.id === t.id));
      localStorage.setItem('inventory-vis-trash', JSON.stringify(updatedTrash));
      setTrashItems(updatedTrash);

      if (skippedSkus.length > 0) {
        addToast('error', `Restaurados ${restoredItems.length} itens. ${skippedSkus.length} pulados devido a conflito de SKU.`);
        addNotification("Restauração de Lixeira Parcial", `Restaurados ${restoredItems.length} itens. SKUs ignorados por conflito: ${skippedSkus.join(', ')}.`, "warning");
      } else {
        addToast('success', 'Todos os itens restaurados com sucesso!');
        addNotification("Lixeira Restaurada (Offline)", "Todos os itens foram restaurados com sucesso.", "success");
      }
    } else {
      try {
        const res = await fetch(`${BACKEND_URL}/inventory/trash/restore-all`, {
          method: 'POST'
        });
        if (!res.ok) throw new Error('Erro ao restaurar todos os itens');
        addToast('success', 'Todos os itens restaurados!');
        addNotification("Lixeira Restaurada", "Todos os itens que não possuíam conflito de SKU foram restaurados.", "success");
        fetchData();
      } catch (err: any) {
        addToast('error', err.message || 'Erro ao restaurar todos os itens.');
      }
    }
  };

  // Empty trash permanently
  const handleEmptyTrash = async () => {
    if (trashItems.length === 0) return;
    
    if (isOffline) {
      localStorage.setItem('inventory-vis-trash', JSON.stringify([]));
      setTrashItems([]);
      addToast('success', 'Lixeira esvaziada.');
      addNotification("Lixeira Esvaziada (Offline)", "Todos os itens na lixeira foram removidos permanentemente.", "warning");
    } else {
      try {
        const res = await fetch(`${BACKEND_URL}/inventory/trash/empty`, {
          method: 'DELETE'
        });
        if (!res.ok) throw new Error('Erro ao esvaziar lixeira');
        addToast('success', 'Lixeira esvaziada.');
        addNotification("Lixeira Esvaziada", "Todos os itens na lixeira foram removidos permanentemente do banco de dados.", "warning");
        fetchData();
      } catch (err: any) {
        addToast('error', err.message || 'Erro ao esvaziar lixeira.');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      sku: '',
      category: 'Electronics',
      quantity: 0,
      price: 0,
      minStockLevel: defaultMinStock,
      location: ''
    });
    setFormErrors({});
    setSelectedItem(null);
  };

  const categories = Array.from(new Set([...Object.keys(categoryTranslations), ...items.map(item => item.category)]));

  const categoryChartData = categories.map(cat => {
    const totalVal = items.filter(item => item.category === cat)
                          .reduce((acc, item) => acc + (item.price * item.quantity), 0);
    return {
      name: categoryTranslations[cat] || cat,
      value: Number(totalVal.toFixed(2))
    };
  }).filter(c => c.value > 0);

  // Recharts Bar comparing quantities and asset values
  const itemsBarChartData = items.slice(0, 8).map(item => ({
    name: item.name.length > 15 ? `${item.name.substring(0, 12)}...` : item.name,
    Valor: Number((item.price * item.quantity).toFixed(0)),
    Estoque: item.quantity
  }));

  // Timeline of inventory turnover (Entradas vs Saídas)
  const timelineChartData = (() => {
    const groups: Record<string, { date: string; dateObj: Date; Entrada: number; Saida: number }> = {};
    
    // Seed last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const key = d.toISOString().split('T')[0];
      groups[key] = {
        date: label,
        dateObj: d,
        Entrada: 0,
        Saida: 0
      };
    }

    // Sum transactions
    movements.forEach(m => {
      try {
        const dateObj = new Date(m.data_movimentacao);
        const dateStr = dateObj.toISOString().split('T')[0];
        const label = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        
        if (!groups[dateStr]) {
          groups[dateStr] = {
            date: label,
            dateObj,
            Entrada: 0,
            Saida: 0
          };
        }
        
        if (m.tipo_movimentacao === 'ENTRADA') {
          groups[dateStr].Entrada += Number(m.quantidade);
        } else if (m.tipo_movimentacao === 'SAIDA') {
          groups[dateStr].Saida += Number(m.quantidade);
        }
      } catch (e) {
        console.error(e);
      }
    });

    return Object.values(groups)
      .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())
      .map(g => ({
        date: g.date,
        'Entradas': g.Entrada,
        'Saídas': g.Saida
      }));
  })();

  const displayItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) || 
                          item.sku.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter ? item.category === categoryFilter : true;
    const matchesLowStock = lowStockFilter ? item.quantity <= item.minStockLevel : true;
    const matchesTab = activeTab === 'all' 
      ? true 
      : activeTab === 'low-stock' 
        ? item.quantity <= item.minStockLevel 
        : item.category === activeTab;

    return matchesSearch && matchesCategory && matchesLowStock && matchesTab;
  });

  const paginatedItems = displayItems.slice(
    (inventoryPage - 1) * inventoryPerPage,
    inventoryPage * inventoryPerPage
  );

  const paginatedMovements = movements.slice(
    (movementsPage - 1) * movementsPerPage,
    movementsPage * movementsPerPage
  );

  const abcData = (() => {
    if (items.length === 0) return { A: { count: 0, value: 0, percent: 0 }, B: { count: 0, value: 0, percent: 0 }, C: { count: 0, value: 0, percent: 0 } };
    
    // Sort items by valuation descending
    const sorted = [...items].map(item => ({
      ...item,
      valuation: item.price * item.quantity
    })).sort((a, b) => b.valuation - a.valuation);

    const totalValuation = sorted.reduce((acc, item) => acc + item.valuation, 0);
    
    let cumulative = 0;
    const result = {
      A: { count: 0, value: 0, percent: 0 },
      B: { count: 0, value: 0, percent: 0 },
      C: { count: 0, value: 0, percent: 0 }
    };

    sorted.forEach(item => {
      cumulative += item.valuation;
      const ratio = totalValuation === 0 ? 0 : (cumulative / totalValuation);
      
      if (ratio <= 0.70) {
        result.A.count++;
        result.A.value += item.valuation;
      } else if (ratio <= 0.90) {
        result.B.count++;
        result.B.value += item.valuation;
      } else {
        result.C.count++;
        result.C.value += item.valuation;
      }
    });

    if (totalValuation > 0) {
      result.A.percent = (result.A.value / totalValuation) * 100;
      result.B.percent = (result.B.value / totalValuation) * 100;
      result.C.percent = (result.C.value / totalValuation) * 100;
    }

    return result;
  })();

  const auditStats = (() => {
    const completed = tasks.filter(t => t.status === 'CONCLUIDO');
    const correct = completed.filter(t => t.quantidade_conferida === t.quantidade_esperada);
    const accuracy = completed.length === 0 ? 100 : (correct.length / completed.length) * 100;
    const discrepancies = completed.length - correct.length;
    
    return {
      total: completed.length,
      correct: correct.length,
      discrepancies,
      accuracy: Math.round(accuracy)
    };
  })();

  const getDaysInactive = (dateStr: string) => {
    if (!dateStr) return 0;
    const diffTime = Date.now() - new Date(dateStr).getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays < 0 ? 0 : diffDays;
  };

  const slowMovingItems = [...items]
    .sort((a, b) => new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime())
    .slice(0, 5);

  const handleRequestAudit = async (item: InventoryItem) => {
    if (isOffline) {
      const localTasksStr = localStorage.getItem('inventory-vis-tasks');
      let currentLocalTasks: any[] = [];
      if (localTasksStr) {
        try {
          currentLocalTasks = JSON.parse(localTasksStr);
        } catch (e) {
          currentLocalTasks = [];
        }
      }
      
      const newLocalTask = {
        id_tarefa: `task-manual-${Math.random().toString(36).substr(2, 5)}`,
        id_produto: item.id,
        name_produto: item.name,
        sku_produto: item.sku,
        tipo_tarefa: 'CONFERENCIA_ROTATIVA',
        data_geracao: new Date().toISOString(),
        status: 'PENDENTE' as const,
        quantidade_esperada: item.quantity
      };
      
      const updated = [newLocalTask, ...currentLocalTasks];
      localStorage.setItem('inventory-vis-tasks', JSON.stringify(updated));
      setTasks(updated);
      addToast('success', `Solicitação de contagem para o item ${item.name} criada localmente.`);
      addNotification("Auditoria Agendada (Offline)", `Nova tarefa de conferência rotativa criada para o item ${item.name} (${item.sku}).`, "info");
    } else {
      try {
        const response = await fetch(`${BACKEND_URL}/inventory/tasks`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            id_produto: item.id,
            tipo_tarefa: 'CONFERENCIA_ROTATIVA',
            quantidade_esperada: item.quantity
          })
        });
        
        if (response.ok) {
          const newTask = await response.json();
          setTasks(prev => [newTask, ...prev]);
          addToast('success', `Auditoria solicitada com sucesso para o item ${item.name}!`);
          addNotification("Auditoria Agendada", `Nova tarefa de conferência rotativa criada para o item ${item.name} (${item.sku}).`, "info");
        } else {
          const errData = await response.json();
          addToast('error', `Erro ao criar auditoria: ${errData.error || 'Erro desconhecido'}`);
        }
      } catch (err: any) {
        addToast('error', `Erro de conexão ao solicitar auditoria.`);
      }
    }
  };

  if (currentUser === null) {
    return (
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '100vh', 
          backgroundColor: 'var(--bg-page)',
          backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.08) 0%, transparent 50%)',
          padding: '1.5rem'
        }}
      >
        <div 
          className="table-card" 
          style={{ 
            width: '100%', 
            maxWidth: '420px', 
            padding: '2.5rem 2rem', 
            border: '1px solid var(--border-color)', 
            background: 'rgba(20, 20, 22, 0.45)', 
            backdropFilter: 'blur(20px)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
            animation: 'modalEnter 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem' }}>
            <div style={{ 
              background: 'linear-gradient(135deg, var(--accent), var(--success))', 
              color: '#ffffff',
              width: '48px', 
              height: '48px', 
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)'
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M12 11v4" />
                <circle cx="12" cy="9" r="1.2" />
              </svg>
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', textAlign: 'center', margin: '0 0 0.25rem 0' }}>Inviolável WMS</h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>Sistema de Controle de Estoque</span>
          </div>

          {loginError && (
            <div 
              style={{ 
                padding: '0.75rem 1rem', 
                backgroundColor: 'var(--danger-bg)', 
                border: '1px solid rgba(239, 68, 68, 0.2)', 
                borderRadius: 'var(--radius-sm)', 
                color: 'var(--danger)', 
                fontSize: '0.8rem', 
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <WarningCircle size={16} />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="username" style={{ fontSize: '0.78rem', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <User size={14} />
                <span>Nome de Usuário</span>
              </label>
              <input
                type="text"
                id="username"
                className="form-input"
                placeholder="Digite seu usuário..."
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                style={{ width: '100%' }}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="password" style={{ fontSize: '0.78rem', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <LockKey size={14} />
                <span>Senha de Acesso</span>
              </label>
              <input
                type="password"
                id="password"
                className="form-input"
                placeholder="Digite sua senha..."
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                style={{ width: '100%' }}
                required
              />
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', justifyContent: 'center', height: '42px', marginTop: '0.5rem' }}
              disabled={loadingLogin}
            >
              {loadingLogin ? 'Autenticando...' : 'Entrar no Sistema'}
            </button>
          </form>

          <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
            <span>Status: {isOffline ? 'Modo Contingência (Local)' : 'Servidor Conectado'}</span>
            <span>v2.4.0</span>
          </div>
        </div>

        {/* Developer Watermark */}
        <div className={`developer-watermark ${currentUser ? 'logged-in' : ''}`}>
          <span style={{ color: 'var(--accent)', fontWeight: 'bold', marginRight: '0.4rem' }}>&lt;/&gt;</span>
          DESENVOLVIDO POR <strong style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>BERNARDO RODRIGUES</strong>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Sidebar Panel */}
      <aside className="sidebar">
        <div className="brand-logo">
          <div className="brand-icon" style={{ background: 'linear-gradient(135deg, var(--accent), var(--success))', minWidth: '32px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M12 11v4" />
              <circle cx="12" cy="9" r="1.2" />
            </svg>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 800, fontSize: '1.05rem', letterSpacing: '0.05em' }}>INVIOLÁVEL</span>
            <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>WMS-DASHBOARD</span>
          </div>
          {isOffline && (
            <span style={{ 
              fontSize: '0.65rem', 
              padding: '0.1rem 0.4rem', 
              borderRadius: '99px', 
              background: 'var(--warning-bg)', 
              color: 'var(--warning)', 
              fontWeight: 600,
              marginLeft: '0.5rem'
            }}>Offline</span>
          )}
        </div>

        <nav style={{ flex: 1 }}>
          <ul className="nav-links">
            <li className={`nav-item ${activeTab === 'all' ? 'active' : ''}`}>
              <button onClick={() => { setActiveTab('all'); setCategoryFilter(''); setLowStockFilter(false); }}>
                <ListBullets size={20} />
                <span>Estoque Físico</span>
              </button>
            </li>
            <li className={`nav-item ${activeTab === 'charts' ? 'active' : ''}`}>
              <button onClick={() => { setActiveTab('charts'); }}>
                <ChartPieSlice size={20} />
                <span>Gráficos & Análise</span>
              </button>
            </li>
            <li className={`nav-item ${activeTab === 'audit-logs' ? 'active' : ''}`}>
              <button onClick={() => { setActiveTab('audit-logs'); }}>
                <ClockCounterClockwise size={20} />
                <span>Movimentações</span>
              </button>
            </li>
            <li className={`nav-item ${activeTab === 'low-stock' ? 'active' : ''}`}>
              <button onClick={() => { setActiveTab('low-stock'); setCategoryFilter(''); setLowStockFilter(true); }}>
                <Warning size={20} color="var(--warning)" />
                <span>Alertas Críticos</span>
              </button>
            </li>
            <li className={`nav-item ${activeTab === 'idle-items' ? 'active' : ''}`}>
              <button onClick={() => { setActiveTab('idle-items'); setCategoryFilter(''); setLowStockFilter(false); }}>
                <Hourglass size={20} color="var(--warning)" />
                <span>Itens Ociosos</span>
              </button>
            </li>
            <li className={`nav-item ${activeTab === 'warehouse-map' ? 'active' : ''}`}>
              <button onClick={() => { setActiveTab('warehouse-map'); setCategoryFilter(''); setLowStockFilter(false); }}>
                <MapTrifold size={20} />
                <span>Mapa do Armazém</span>
              </button>
            </li>
            <li className={`nav-item ${activeTab === 'tasks' ? 'active' : ''}`}>
              <button onClick={() => { setActiveTab('tasks'); setCategoryFilter(''); setLowStockFilter(false); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <CheckCircle size={20} />
                  <span>Tarefas Diárias</span>
                </div>
                {tasks.filter(t => t.status === 'PENDENTE').length > 0 && (
                  <span style={{ 
                    fontSize: '0.72rem', 
                    fontWeight: 700, 
                    padding: '0.1rem 0.4rem', 
                    borderRadius: 'var(--radius-pill)', 
                    backgroundColor: tasks.some(t => {
                      if (t.status !== 'PENDENTE') return false;
                      const tDate = new Date(t.data_geracao);
                      const today = new Date();
                      return (
                        tDate.getFullYear() < today.getFullYear() ||
                        (tDate.getFullYear() === today.getFullYear() && tDate.getMonth() < today.getMonth()) ||
                        (tDate.getFullYear() === today.getFullYear() && tDate.getMonth() === today.getMonth() && tDate.getDate() < today.getDate())
                      );
                    }) ? 'var(--danger-bg)' : 'var(--warning-bg)',
                    color: tasks.some(t => {
                      if (t.status !== 'PENDENTE') return false;
                      const tDate = new Date(t.data_geracao);
                      const today = new Date();
                      return (
                        tDate.getFullYear() < today.getFullYear() ||
                        (tDate.getFullYear() === today.getFullYear() && tDate.getMonth() < today.getMonth()) ||
                        (tDate.getFullYear() === today.getFullYear() && tDate.getMonth() === today.getMonth() && tDate.getDate() < today.getDate())
                      );
                    }) ? 'var(--danger)' : 'var(--warning)'
                  }}>
                    {tasks.filter(t => t.status === 'PENDENTE').length}
                  </span>
                )}
              </button>
            </li>
            {currentUser && (currentUser.perfil === 'admin' || currentUser.perfil === 'auditor') && (
              <li className={`nav-item ${activeTab === 'settings' || activeTab === 'system-audit' || activeTab === 'trash' ? 'active' : ''}`}>
                <button onClick={() => { setActiveTab('settings'); setCategoryFilter(''); setLowStockFilter(false); }}>
                  <Gear size={20} />
                  <span>Configurações</span>
                </button>
              </li>
            )}

          </ul>
        </nav>

        {currentUser && (
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.75rem', 
              padding: '0.75rem', 
              backgroundColor: 'rgba(255, 255, 255, 0.02)', 
              border: '1px solid var(--border-color)', 
              borderRadius: 'var(--radius-md)',
              marginBottom: '0.5rem',
              overflow: 'hidden'
            }}
          >
            <div style={{ 
              width: '36px', 
              height: '36px', 
              borderRadius: '50%', 
              backgroundColor: currentUser.perfil === 'admin' ? 'var(--accent)' : currentUser.perfil === 'operador' ? 'var(--success)' : 'var(--warning)', 
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '0.9rem',
              flexShrink: 0
            }}>
              {currentUser.nome.substring(0, 2).toUpperCase()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{currentUser.nome}</span>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {currentUser.perfil === 'admin' ? 'Administrador' : currentUser.perfil === 'operador' ? 'Operador' : 'Auditor'}
              </span>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={fetchData}>
            <ArrowClockwise size={16} />
            <span>Sincronizar DB</span>
          </button>
          
          <button 
            className="btn" 
            style={{ 
              width: '100%', 
              justifyContent: 'center', 
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(16, 185, 129, 0.15))', 
              border: '1px solid rgba(99, 102, 241, 0.3)',
              color: 'var(--text-primary)'
            }} 
            onClick={() => {
              setIsAIPanelOpen(!isAIPanelOpen);
              if (!aiSuggestions) fetchAISuggestions(items, true);
            }}
          >
            <Sparkle size={16} color="var(--accent)" weight="fill" />
            <span>Insight Gemini AI</span>
          </button>

          <button 
            className="btn btn-secondary" 
            style={{ 
              width: '100%', 
              justifyContent: 'center', 
              color: 'var(--danger)', 
              borderColor: 'rgba(239, 68, 68, 0.15)',
              marginTop: '0.25rem'
            }} 
            onClick={handleLogout}
          >
            <SignOut size={16} />
            <span>Sair do Sistema</span>
          </button>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="main-content">
        
        {/* Collapsible Gemini AI Recommendations Widget */}
        {isAIPanelOpen && aiSuggestions && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.2), rgba(6, 78, 59, 0.1))',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            boxShadow: '0 8px 32px 0 rgba(99, 102, 241, 0.05)',
            borderRadius: 'var(--radius-md)',
            padding: '1.15rem 1.25rem',
            marginBottom: '1.5rem',
            position: 'relative',
            animation: 'modalEnter 0.3s ease-out'
          }}>
            <button 
              onClick={() => setIsAIPanelOpen(false)}
              style={{
                position: 'absolute', right: '1rem', top: '1rem', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer'
              }}
            >
              <X size={16} />
            </button>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
              <Sparkle size={16} color="var(--accent)" weight="fill" />
              <h2 style={{ fontSize: '1rem', fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>Recomendações e Otimização Gemini</h2>
              <span style={{ fontSize: '0.62rem', padding: '0.12rem 0.4rem', borderRadius: '10px', background: aiSuggestions.source === 'gemini' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.06)', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
                {aiSuggestions.source === 'gemini' ? 'Gemini 1.5 Flash' : 'Simulador Local Inviolável'}
              </span>
            </div>

            <p style={{ color: 'var(--text-primary)', fontSize: '0.88rem', lineHeight: '1.5', marginBottom: '1rem' }}>
              {aiSuggestions.summary}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div>
                <h4 style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Plano de Ações Críticas</h4>
                <ul style={{ paddingLeft: '1.1rem', color: 'var(--text-primary)', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {aiSuggestions.actionItems.map((action, i) => (
                    <li key={i}>{action}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Avaliação e Custos de Caixa</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.45' }}>
                  {aiSuggestions.valuationInsight}
                </p>
              </div>
            </div>
            
            <button 
              className="btn btn-secondary" 
              style={{ marginTop: '1.25rem', fontSize: '0.8rem', padding: '0.5rem 1rem' }} 
              disabled={loadingAI}
              onClick={() => fetchAISuggestions(items, true)}
            >
              {loadingAI ? 'Analisando...' : 'Reavaliar Métricas'}
            </button>
          </div>
        )}

        <header className="dashboard-header">
          <div className="header-title">
            <h1>
              {activeTab === 'charts' ? 'Relatórios de Giro' : 
               activeTab === 'audit-logs' ? 'Registro de Auditoria' : 
               activeTab === 'warehouse-map' ? 'Mapa de Endereçamento' :
               activeTab === 'low-stock' ? 'Painel de Reabastecimento' :
               activeTab === 'tasks' ? 'Tarefas Diárias (Conferência)' :
               activeTab === 'idle-items' ? 'Itens Ociosos & Sem Giro' :
               activeTab === 'settings' ? 'Painel de Configurações' :
               activeTab === 'system-audit' ? 'Trilha de Auditoria do Sistema' :
               activeTab === 'trash' ? 'Lixeira do Sistema WMS' : 'Controle do Estoque'}
            </h1>
            <p>
              {activeTab === 'settings' 
                ? 'Cadastro de categorias, políticas de backorder e parâmetros de integração do sistema'
                : activeTab === 'warehouse-map'
                ? 'Mapeamento visual de corredores, prateleiras e posições físicas de estoque'
                : activeTab === 'low-stock'
                ? 'Consolidação de estoque crítico, fornecedores indicados e emissão de ordens de compra'
                : activeTab === 'idle-items'
                ? 'Identificação de produtos sem giro e abertura direta de ordens de auditoria cíclica'
                : activeTab === 'system-audit'
                ? 'Histórico completo de logs, conexões, eventos e configurações do WMS'
                : activeTab === 'trash'
                ? 'Visualização e gestão de produtos deletados para restauração ou remoção definitiva'
                : 'Mapeamento relacional de movimentação e conformidade WMS'}
            </p>
          </div>
          
          <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', position: 'relative' }}>
            {/* Notification Bell Button */}
            <div className="notifications-wrapper">
              <button 
                className={`notifications-bell-btn ${isNotificationsOpen ? 'active' : ''}`}
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                title="Notificações"
              >
                <Bell size={20} weight={notifications.some(n => !n.read) ? 'fill' : 'regular'} />
                {notifications.some(n => !n.read) && (
                  <span className="notifications-badge">
                    {notifications.filter(n => !n.read).length}
                  </span>
                )}
              </button>

              {isNotificationsOpen && (
                <div className="notifications-dropdown">
                  <div className="notifications-header">
                    <h3>Notificações WMS</h3>
                    <div className="notifications-header-actions">
                      {notifications.some(n => !n.read) && (
                        <button 
                          className="notifications-header-btn"
                          onClick={() => {
                            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                            addToast('success', 'Todas as notificações marcadas como lidas.');
                          }}
                        >
                          Lidas
                        </button>
                      )}
                      {notifications.length > 0 && (
                        <button 
                          className="notifications-header-btn"
                          style={{ color: 'var(--text-secondary)' }}
                          onClick={() => {
                            setNotifications([]);
                            addToast('success', 'Histórico de notificações limpo.');
                          }}
                        >
                          Limpar
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="notifications-list">
                    {notifications.length === 0 ? (
                      <div className="notifications-empty">
                        <Bell size={32} style={{ color: 'var(--text-tertiary)' }} />
                        <span>Nenhuma notificação por aqui</span>
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div 
                          key={n.id} 
                          className={`notification-item ${n.read ? '' : 'unread'}`}
                          onClick={() => {
                            setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, read: true } : item));
                          }}
                        >
                          <div className={`notification-icon-indicator ${n.type}`} />
                          <div className="notification-content">
                            <span className="notification-title">{n.title}</span>
                            <span className="notification-desc">{n.description}</span>
                            <span className="notification-time">
                              {new Date(n.timestamp).toLocaleString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit',
                                day: '2-digit',
                                month: '2-digit'
                              })}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {currentUser?.perfil === 'admin' && activeTab !== 'settings' && activeTab !== 'warehouse-map' && activeTab !== 'low-stock' && activeTab !== 'idle-items' && activeTab !== 'system-audit' && activeTab !== 'trash' && (
              <button className="btn btn-primary" onClick={() => { resetForm(); setIsAddModalOpen(true); }}>
                <Plus size={18} weight="bold" />
                <span>Cadastrar Produto</span>
              </button>
            )}
          </div>
        </header>

        {/* Analytics card list */}
        {activeTab !== 'settings' && activeTab !== 'warehouse-map' && activeTab !== 'low-stock' && activeTab !== 'idle-items' && activeTab !== 'system-audit' && activeTab !== 'trash' && (
          <section className="metrics-grid">
            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-title">Valoração Financeira</span>
                <div className="metric-icon-wrapper">
                  <Coins size={20} />
                </div>
              </div>
              <div className="metric-value">
                ${stats.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="metric-footer">Soma dos ativos de estoque</div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-title">Unidades Físicas</span>
                <div className="metric-icon-wrapper">
                  <Stack size={20} />
                </div>
              </div>
              <div className="metric-value">{stats.totalItemsCount}</div>
              <div className="metric-footer">Volume total armazenado</div>
            </div>

            <div className="metric-card warning">
              <div className="metric-header">
                <span className="metric-title">Itens Críticos</span>
                <div className="metric-icon-wrapper" style={{ backgroundColor: 'var(--warning-bg)' }}>
                  <Warning size={20} />
                </div>
              </div>
              <div className="metric-value" style={{ color: stats.lowStockCount > 0 ? 'var(--warning)' : 'inherit' }}>
                {stats.lowStockCount}
              </div>
              <div className="metric-footer">Abaixo do estoque de segurança</div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-title">SKUs Ativos</span>
                <div className="metric-icon-wrapper">
                  <Package size={20} />
                </div>
              </div>
              <div className="metric-value">{stats.uniqueItemsCount}</div>
              <div className="metric-footer">Código de produtos cadastrados</div>
            </div>
          </section>
        )}

        {activeTab === 'charts' ? (
          /* charts breakdown visual panel */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="table-card" style={{ padding: '1.25rem' }}>
                <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Distribuição Financeira por Categoria</h3>
                <div style={{ width: '100%', height: 300 }}>
                  {categoryChartData.length === 0 ? (
                    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>Sem dados disponíveis</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {categoryChartData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(val) => `$${Number(val).toLocaleString()}`} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="table-card" style={{ padding: '1.25rem' }}>
                <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Comparação de Produtos (Valor vs Unidades)</h3>
                <div style={{ width: '100%', height: 300 }}>
                  {itemsBarChartData.length === 0 ? (
                    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>Sem dados disponíveis</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={itemsBarChartData}>
                        <XAxis dataKey="name" stroke="var(--text-tertiary)" fontSize={10} />
                        <YAxis stroke="var(--text-tertiary)" fontSize={10} />
                        <RechartsTooltip />
                        <Legend />
                        <Bar dataKey="Valor" fill="var(--accent)" name="Valor ($)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Estoque" fill="var(--success)" name="Unidades" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            {/* Nova linha: Curva ABC e Acurácia */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div 
                className="table-card" 
                style={{ 
                  padding: '6px', 
                  borderRadius: '24px', 
                  border: '1px solid var(--border-color)', 
                  backgroundColor: 'rgba(255,255,255,0.01)',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <div style={{ padding: '1.5rem', borderRadius: '18px', backgroundColor: 'var(--bg-card)', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.15rem', marginBottom: '0.25rem' }}>Curva ABC do Estoque</h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                        Classificação de SKUs baseada no valor acumulado em estoque.
                      </p>
                    </div>
                    <span style={{ 
                      fontSize: '0.7rem', 
                      fontWeight: 600, 
                      padding: '0.25rem 0.5rem', 
                      borderRadius: 'var(--radius-sm)', 
                      backgroundColor: 'rgba(99, 102, 241, 0.1)', 
                      color: 'var(--accent)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      Classificação ABC
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', marginBottom: '1.25rem' }}>
                    <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>
                      ${stats.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Valoração Total</span>
                  </div>

                  {/* Horizontal Stacked Progress Bar */}
                  <div style={{ 
                    height: '14px', 
                    borderRadius: 'var(--radius-pill)', 
                    overflow: 'hidden', 
                    display: 'flex', 
                    border: '1px solid rgba(255,255,255,0.05)', 
                    backgroundColor: 'rgba(255,255,255,0.03)', 
                    marginBottom: '1.5rem' 
                  }}>
                    {abcData.A.percent > 0 && (
                      <div 
                        style={{ 
                          width: `${abcData.A.percent}%`, 
                          backgroundColor: 'var(--accent)', 
                          transition: 'width 0.5s ease'
                        }} 
                        title={`Classe A: ${abcData.A.percent.toFixed(1)}%`} 
                      />
                    )}
                    {abcData.B.percent > 0 && (
                      <div 
                        style={{ 
                          width: `${abcData.B.percent}%`, 
                          backgroundColor: 'var(--warning)', 
                          transition: 'width 0.5s ease'
                        }} 
                        title={`Classe B: ${abcData.B.percent.toFixed(1)}%`} 
                      />
                    )}
                    {abcData.C.percent > 0 && (
                      <div 
                        style={{ 
                          width: `${abcData.C.percent}%`, 
                          backgroundColor: 'var(--success)', 
                          transition: 'width 0.5s ease'
                        }} 
                        title={`Classe C: ${abcData.C.percent.toFixed(1)}%`} 
                      />
                    )}
                  </div>

                  {/* Class details breakdown */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1, justifyContent: 'center' }}>
                    {/* Class A */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent)' }} />
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Classe A</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>Alta Importância (70% do valor)</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem', display: 'block' }}>
                          ${abcData.A.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                          {abcData.A.percent.toFixed(1)}% do valor • {abcData.A.count} SKU{abcData.A.count !== 1 ? 's' : ''} ({stats.uniqueItemsCount > 0 ? ((abcData.A.count / stats.uniqueItemsCount) * 100).toFixed(0) : 0}%)
                        </span>
                      </div>
                    </div>

                    {/* Class B */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--warning)' }} />
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Classe B</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>Média Importância (20% do valor)</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem', display: 'block' }}>
                          ${abcData.B.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                          {abcData.B.percent.toFixed(1)}% do valor • {abcData.B.count} SKU{abcData.B.count !== 1 ? 's' : ''} ({stats.uniqueItemsCount > 0 ? ((abcData.B.count / stats.uniqueItemsCount) * 100).toFixed(0) : 0}%)
                        </span>
                      </div>
                    </div>

                    {/* Class C */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--success)' }} />
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Classe C</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>Baixa Importância (10% do valor)</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem', display: 'block' }}>
                          ${abcData.C.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                          {abcData.C.percent.toFixed(1)}% do valor • {abcData.C.count} SKU{abcData.C.count !== 1 ? 's' : ''} ({stats.uniqueItemsCount > 0 ? ((abcData.C.count / stats.uniqueItemsCount) * 100).toFixed(0) : 0}%)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div 
                className="table-card" 
                style={{ 
                  padding: '6px', 
                  borderRadius: '24px', 
                  border: '1px solid var(--border-color)', 
                  backgroundColor: 'rgba(255,255,255,0.01)',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <div style={{ padding: '1.5rem', borderRadius: '18px', backgroundColor: 'var(--bg-card)', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.15rem', marginBottom: '0.25rem' }}>Acurácia & Auditoria</h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                        Conformidade física de estoque com base nas contagens realizadas.
                      </p>
                    </div>
                    <span style={{ 
                      fontSize: '0.7rem', 
                      fontWeight: 700, 
                      padding: '0.25rem 0.5rem', 
                      borderRadius: 'var(--radius-sm)', 
                      backgroundColor: auditStats.accuracy >= 95 ? 'var(--success-bg)' : auditStats.accuracy >= 85 ? 'var(--warning-bg)' : 'var(--danger-bg)', 
                      color: auditStats.accuracy >= 95 ? 'var(--success)' : auditStats.accuracy >= 85 ? 'var(--warning)' : 'var(--danger)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      {auditStats.accuracy === 100 ? 'Excelente (100%)' : auditStats.accuracy >= 95 ? 'Excelente' : auditStats.accuracy >= 90 ? 'Adequada' : auditStats.accuracy >= 80 ? 'Atenção' : 'Crítico'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flex: 1, flexWrap: 'wrap', justifyContent: 'space-around', margin: '0.5rem 0' }}>
                    {/* Circular gauge */}
                    <div style={{ position: 'relative', width: '110px', height: '110px' }}>
                      <svg width="110" height="110" viewBox="0 0 110 110" style={{ transform: 'rotate(-90deg)', display: 'block' }}>
                        <circle
                          cx="55"
                          cy="55"
                          r="45"
                          fill="transparent"
                          stroke="rgba(255, 255, 255, 0.04)"
                          strokeWidth="8"
                        />
                        <circle
                          cx="55"
                          cy="55"
                          r="45"
                          fill="transparent"
                          stroke={auditStats.accuracy >= 95 ? 'var(--success)' : auditStats.accuracy >= 85 ? 'var(--warning)' : 'var(--danger)'}
                          strokeWidth="8"
                          strokeDasharray={2 * Math.PI * 45}
                          strokeDashoffset={2 * Math.PI * 45 - (auditStats.accuracy / 100) * (2 * Math.PI * 45)}
                          strokeLinecap="round"
                          style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
                        />
                      </svg>
                      <div style={{
                        position: 'absolute',
                        top: '0',
                        left: '0',
                        right: '0',
                        bottom: '0',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                          {auditStats.accuracy}%
                        </span>
                        <span style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                          Acurácia
                        </span>
                      </div>
                    </div>

                    {/* Stats breakdown */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', flex: 1, minWidth: '160px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.35rem' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total de Auditorias</span>
                        <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>{auditStats.total}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.35rem' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Contagens Corretas</span>
                        <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--success)' }}>{auditStats.correct}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.35rem' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Divergências</span>
                        <span style={{ fontSize: '0.88rem', fontWeight: 700, color: auditStats.discrepancies > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
                          {auditStats.discrepancies}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '1rem', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(255,255,255,0.02)', fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Sparkle size={14} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                    <span>
                      {auditStats.total === 0 
                        ? "Nenhuma auditoria concluída no sistema. Realize as contagens diárias na aba de Tarefas." 
                        : auditStats.discrepancies === 0 
                          ? "Inventário totalmente íntegro. Nenhuma divergência física encontrada."
                          : `Identificadas ${auditStats.discrepancies} discrepâncias físicas. Recomenda-se conciliação imediata.`}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Timeline AreaChart card */}
            <div className="table-card" style={{ padding: '1.5rem' }}>
              <h3 style={{ marginBottom: '0.25rem', fontSize: '1.15rem' }}>Giro de Estoque (Histórico de Transações)</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                Monitoramento diário do volume físico de Entradas e Saídas registradas no armazém.
              </p>
              <div style={{ width: '100%', height: 320 }}>
                {timelineChartData.length === 0 ? (
                  <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>Sem dados de movimentações disponíveis</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timelineChartData} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorEntradas" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--success)" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="var(--success)" stopOpacity={0.01}/>
                        </linearGradient>
                        <linearGradient id="colorSaidas" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--danger)" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="var(--danger)" stopOpacity={0.01}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="date" stroke="var(--text-tertiary)" fontSize={11} tickLine={false} />
                      <YAxis stroke="var(--text-tertiary)" fontSize={11} tickLine={false} axisLine={false} />
                      <RechartsTooltip 
                        contentStyle={{ 
                          backgroundColor: 'var(--bg-card)', 
                          borderColor: 'var(--border-color)', 
                          borderRadius: 'var(--radius-sm)',
                          color: 'var(--text-primary)',
                          fontFamily: 'var(--font-sans)'
                        }}
                      />
                      <Legend verticalAlign="top" height={36} iconType="circle" />
                      <Area type="monotone" dataKey="Entradas" stroke="var(--success)" strokeWidth={2.5} fillOpacity={1} fill="url(#colorEntradas)" />
                      <Area type="monotone" dataKey="Saídas" stroke="var(--danger)" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSaidas)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Tabela de Baixo Giro & Estoque Parado */}
            <div className="table-card" style={{ padding: '1.5rem', marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                <div>
                  <h3 style={{ marginBottom: '0.25rem', fontSize: '1.15rem' }}>Inventário de Baixo Giro & Itens Ociosos</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    Itens que não sofreram alterações ou movimentações no estoque há mais tempo.
                  </p>
                </div>
                <span style={{ 
                  fontSize: '0.7rem', 
                  fontWeight: 600, 
                  padding: '0.25rem 0.5rem', 
                  borderRadius: 'var(--radius-sm)', 
                  backgroundColor: 'var(--warning-bg)', 
                  color: 'var(--warning)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Alerta de Ociosidade
                </span>
              </div>

              <div className="table-wrapper">
                <table className="inventory-table">
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th>SKU</th>
                      <th>Categoria</th>
                      <th style={{ textAlign: 'right' }}>Qtd. Atual</th>
                      <th style={{ textAlign: 'right' }}>Valor Unitário</th>
                      <th style={{ textAlign: 'right' }}>Valor Total</th>
                      <th style={{ textAlign: 'center' }}>Tempo de Inatividade</th>
                      <th>Última Movimentação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slowMovingItems.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '3rem' }}>
                          Nenhum produto cadastrado no sistema.
                        </td>
                      </tr>
                    ) : (
                      slowMovingItems.map((item) => {
                        const daysInactive = getDaysInactive(item.lastUpdated);
                        const totalItemVal = item.price * item.quantity;
                        
                        return (
                          <tr key={item.id}>
                            <td style={{ fontWeight: 600 }}>{item.name}</td>
                            <td>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
                                <Barcode size={12} />
                                {item.sku}
                              </span>
                            </td>
                            <td>
                              <span style={{ 
                                padding: '0.15rem 0.45rem', 
                                borderRadius: '4px', 
                                backgroundColor: 'rgba(255,255,255,0.05)', 
                                fontSize: '0.8rem', 
                                color: 'var(--text-secondary)'
                              }}>
                                {item.category}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 500 }}>{item.quantity}</td>
                            <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                              ${item.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>
                              ${totalItemVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span style={{ 
                                display: 'inline-flex', 
                                padding: '0.2rem 0.5rem', 
                                borderRadius: 'var(--radius-pill)', 
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                backgroundColor: daysInactive >= 30 ? 'var(--danger-bg)' : daysInactive >= 15 ? 'var(--warning-bg)' : 'rgba(255,255,255,0.04)',
                                color: daysInactive >= 30 ? 'var(--danger)' : daysInactive >= 15 ? 'var(--warning)' : 'var(--text-secondary)'
                              }}>
                                {daysInactive === 0 ? 'Atualizado hoje' : daysInactive === 1 ? 'Inativo há 1 dia' : `Inativo há ${daysInactive} dias`}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                {new Date(item.lastUpdated).toLocaleString('pt-BR')}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : activeTab === 'audit-logs' ? (
          /* audit logs view list */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                className="btn btn-secondary"
                style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem' }}
                onClick={exportMovementsCSV}
                title="Exportar histórico de movimentações para CSV"
              >
                <span>Exportar Histórico (CSV)</span>
              </button>
              <button
                className="btn btn-secondary"
                style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem', gap: '0.35rem', display: 'inline-flex', alignItems: 'center' }}
                onClick={exportMovementsPDF}
                title="Exportar histórico de movimentações para PDF"
              >
                <FilePdf size={16} />
                <span>Exportar Histórico (PDF)</span>
              </button>
            </div>
            
            <div className="table-card" style={{ marginBottom: 0 }}>
              <div className="table-wrapper">
                <table className="inventory-table">
                  <thead>
                    <tr>
                      <th>Data/Hora</th>
                      <th>Produto</th>
                      <th>SKU</th>
                      <th>Tipo</th>
                      <th>Subtipo</th>
                      <th>Nº OS</th>
                      <th style={{ textAlign: 'right' }}>Quantidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '3rem' }}>
                          Nenhuma movimentação de estoque registrada.
                        </td>
                      </tr>
                    ) : (
                      paginatedMovements.map((move) => (
                        <tr key={move.id_movimentacao}>
                          <td>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                              {new Date(move.data_movimentacao).toLocaleString()}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600 }}>{move.name}</td>
                          <td>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
                              <Barcode size={12} />
                              {move.sku}
                            </span>
                          </td>
                          <td>
                            <span className={`badge badge-stock ${move.tipo_movimentacao === 'ENTRADA' ? 'success' : 'danger'}`} style={{ display: 'inline-flex', gap: '0.25rem', alignItems: 'center' }}>
                              {move.tipo_movimentacao === 'ENTRADA' ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
                              {move.tipo_movimentacao}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                              {SUBTYPE_TRANSLATIONS[move.subtipo_movimentacao] || move.subtipo_movimentacao}
                            </span>
                          </td>
                          <td>
                            {move.numero_os ? (
                              <span style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '0.25rem', 
                                fontSize: '0.82rem', 
                                fontWeight: 500, 
                                color: 'var(--accent, #3b82f6)',
                                border: '1px solid rgba(59, 130, 246, 0.2)',
                                padding: '0.1rem 0.4rem',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(59, 130, 246, 0.08)'
                              }}>
                                {move.numero_os}
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>-</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>
                            {move.quantidade.toFixed(0)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {movements.length > movementsPerPage && (
                <div className="pagination-bar" style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1rem 1.25rem',
                  borderTop: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary)'
                }}>
                  <div>
                    Mostrando <strong>{Math.min(movements.length, (movementsPage - 1) * movementsPerPage + 1)}</strong> a{' '}
                    <strong>{Math.min(movements.length, movementsPage * movementsPerPage)}</strong> de{' '}
                    <strong>{movements.length}</strong> movimentações
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', height: '32px' }}
                      disabled={movementsPage === 1}
                      onClick={() => setMovementsPage(prev => Math.max(1, prev - 1))}
                    >
                      Anterior
                    </button>
                    {Array.from({ length: Math.ceil(movements.length / movementsPerPage) }).map((_, index) => {
                      const pageNum = index + 1;
                      const isCurrent = pageNum === movementsPage;
                      const totalPages = Math.ceil(movements.length / movementsPerPage);
                      if (pageNum === 1 || pageNum === totalPages || Math.abs(pageNum - movementsPage) <= 1) {
                        return (
                          <button
                            key={pageNum}
                            type="button"
                            className={`btn ${isCurrent ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ 
                              padding: '0.35rem 0.75rem', 
                              fontSize: '0.8rem', 
                              height: '32px',
                              minWidth: '32px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: isCurrent ? 'var(--accent)' : 'transparent',
                              borderColor: isCurrent ? 'var(--accent)' : 'var(--border-color)',
                              color: isCurrent ? '#fff' : 'var(--text-primary)',
                              fontWeight: isCurrent ? 600 : 400
                            }}
                            onClick={() => setMovementsPage(pageNum)}
                          >
                            {pageNum}
                          </button>
                        );
                      }
                      if (pageNum === 2 || pageNum === totalPages - 1) {
                        return <span key={pageNum} style={{ padding: '0 0.25rem', alignSelf: 'center' }}>...</span>;
                      }
                      return null;
                    })}
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', height: '32px' }}
                      disabled={movementsPage >= Math.ceil(movements.length / movementsPerPage)}
                      onClick={() => setMovementsPage(prev => Math.min(Math.ceil(movements.length / movementsPerPage), prev + 1))}
                    >
                      Próximo
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'warehouse-map' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Corridor selector buttons and inline management */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ 
                display: 'flex', 
                gap: '0.35rem', 
                padding: '0.35rem', 
                backgroundColor: 'var(--bg-card)', 
                border: '1px solid var(--border-color)', 
                borderRadius: 'var(--radius-md)',
                alignItems: 'center'
              }}>
                {corridors.map(corrid => {
                  const isSelected = selectedCorridor === corrid;
                  return (
                    <div 
                      key={corrid} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center',
                        backgroundColor: isSelected ? 'var(--accent)' : 'transparent',
                        borderRadius: 'var(--radius-sm)',
                        paddingRight: isSelected ? '0.35rem' : '0'
                      }}
                    >
                      <button
                        onClick={() => setSelectedCorridor(corrid)}
                        style={{
                          padding: '0.5rem 1rem',
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          border: 'none',
                          backgroundColor: 'transparent',
                          color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          transition: 'var(--transition-fast)'
                        }}
                      >
                        Corredor {corrid}
                      </button>
                      
                      {isSelected && currentUser?.perfil === 'admin' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteCorridor(corrid); }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#ffffff',
                            opacity: 0.75,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            padding: '0.2rem',
                            marginLeft: '-0.25rem'
                          }}
                          title={`Excluir Corredor ${corrid}`}
                        >
                          <X size={12} weight="bold" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Inline form to Add a corridor */}
              {currentUser?.perfil === 'admin' && (
                <form onSubmit={handleAddCorridor} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    className="form-input"
                    style={{ 
                      padding: '0.45rem 0.75rem', 
                      fontSize: '0.85rem', 
                      width: '140px', 
                      textTransform: 'uppercase',
                      height: '38px',
                      marginBottom: 0
                    }}
                    placeholder="Novo Corredor..."
                    value={newCorridorName}
                    onChange={(e) => setNewCorridorName(e.target.value)}
                    maxLength={3}
                  />
                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    style={{ 
                      padding: '0.45rem 1rem', 
                      fontSize: '0.85rem',
                      height: '38px'
                    }}
                  >
                    <Plus size={14} weight="bold" />
                    <span>Criar Corredor</span>
                  </button>
                </form>
              )}
            </div>

            {/* Level selector list and inline management */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginTop: '-0.25rem' }}>
              <div style={{ 
                display: 'flex', 
                gap: '0.50rem', 
                padding: '0.35rem 0.75rem', 
                backgroundColor: 'var(--bg-card)', 
                border: '1px solid var(--border-color)', 
                borderRadius: 'var(--radius-md)',
                alignItems: 'center',
                flexWrap: 'wrap',
                minHeight: '38px'
              }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', fontWeight: 600, marginRight: '0.25rem' }}>
                  Níveis Ativos:
                </span>
                {[...levels].sort((a, b) => a - b).map(lvl => {
                  return (
                    <div 
                      key={lvl} 
                      style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center',
                        backgroundColor: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.20rem 0.50rem',
                        gap: '0.35rem'
                      }}
                    >
                      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Nível {lvl}
                      </span>
                      
                      {currentUser?.perfil === 'admin' && (
                        <button
                          type="button"
                          onClick={() => handleDeleteLevel(lvl)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--danger)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            padding: '0.1rem',
                          }}
                          title={`Excluir Nível ${lvl}`}
                        >
                          <X size={12} weight="bold" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Action to Add a level */}
              {currentUser?.perfil === 'admin' && (
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={handleAddLevel}
                  style={{ 
                    padding: '0.45rem 1rem', 
                    fontSize: '0.85rem',
                    height: '38px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                >
                  <Plus size={14} weight="bold" />
                  <span>Adicionar Nível</span>
                </button>
              )}
            </div>

            {/* Warehouse Visual Grid */}
            <div className="table-card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.15rem' }}>Visualização Física - Corredor {selectedCorridor}</h3>
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span style={{ width: '10px', height: '10px', backgroundColor: 'var(--success)', borderRadius: '2px' }}></span> Seguro
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span style={{ width: '10px', height: '10px', backgroundColor: 'var(--warning)', borderRadius: '2px' }}></span> Crítico
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span style={{ width: '10px', height: '10px', backgroundColor: 'var(--danger)', borderRadius: '2px' }}></span> Zerado
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span style={{ width: '10px', height: '10px', border: '1px dashed var(--border-hover)', borderRadius: '2px' }}></span> Vazio
                  </span>
                </div>
              </div>

              {/* Grid representation */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {[...levels].sort((a, b) => b - a).map(lvl => (
                  <div key={lvl} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {/* Level Label */}
                    <div style={{ 
                      width: '80px', 
                      fontSize: '0.78rem', 
                      fontWeight: 700, 
                      color: 'var(--text-secondary)', 
                      textTransform: 'uppercase', 
                      letterSpacing: '0.05em' 
                    }}>
                      Nível {lvl}
                    </div>
                    
                    {/* Columns (Shelves) */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', flex: 1 }}>
                      {[1, 2, 3, 4, 5].map(shelf => {
                        const locCode = `${selectedCorridor}-${shelf}-${lvl}`;
                        const locCodePadded = `${selectedCorridor}-0${shelf}-0${lvl}`;
                        
                        // Find item matching location code
                        const locItem = items.find(item => {
                          const itemLoc = (item.location || '').trim().toUpperCase();
                          return itemLoc === locCode || itemLoc === locCodePadded;
                        });

                        const isLow = locItem ? locItem.quantity <= locItem.minStockLevel : false;
                        const isOut = locItem ? locItem.quantity === 0 : false;
                        
                        return (
                          <div 
                            key={shelf} 
                            style={{
                              backgroundColor: locItem ? 'var(--bg-input)' : 'transparent',
                              border: locItem 
                                ? isOut 
                                  ? '1px solid rgba(239, 68, 68, 0.4)' 
                                  : isLow 
                                  ? '1px solid rgba(245, 158, 11, 0.4)' 
                                  : '1px solid rgba(16, 185, 129, 0.4)'
                                : '1px dashed var(--border-color)',
                              borderRadius: 'var(--radius-md)',
                              padding: '0.85rem 1rem',
                              height: '110px',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              position: 'relative',
                              transition: 'var(--transition-smooth)',
                              cursor: locItem && currentUser?.perfil === 'admin' ? 'pointer' : 'default'
                            }}
                            onClick={() => {
                              if (locItem && currentUser?.perfil === 'admin') {
                                handleEditClick(locItem);
                              }
                            }}
                          >
                            {/* Slot coordinates */}
                            <span style={{ 
                              position: 'absolute', 
                              top: '0.4rem', 
                              right: '0.5rem', 
                              fontSize: '0.62rem', 
                              fontWeight: 700, 
                              color: 'var(--text-tertiary)',
                              letterSpacing: '0.05em'
                            }}>
                              {selectedCorridor}{shelf}{lvl}
                            </span>

                            {locItem ? (
                              <>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', paddingRight: '1rem' }}>
                                  <span style={{ 
                                    fontWeight: 700, 
                                    fontSize: '0.82rem', 
                                    color: 'var(--text-primary)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    display: 'block'
                                  }}>
                                    {locItem.name}
                                  </span>
                                  <span style={{ 
                                    fontSize: '0.68rem', 
                                    color: 'var(--text-secondary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.2rem'
                                  }}>
                                    <Barcode size={10} />
                                    {locItem.sku}
                                  </span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                                  <span style={{ 
                                    fontSize: '0.75rem', 
                                    fontWeight: 700,
                                    color: isOut ? 'var(--danger)' : isLow ? 'var(--warning)' : 'var(--success)'
                                  }}>
                                    {locItem.quantity} Unidades
                                  </span>
                                  <span className="badge badge-category" style={{ fontSize: '0.62rem', padding: '0.1rem 0.35rem' }}>
                                    {categoryTranslations[locItem.category] || locItem.category}
                                  </span>
                                </div>
                              </>
                            ) : (
                              <div style={{ 
                                display: 'flex', 
                                flexDirection: 'column', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                height: '100%', 
                                color: 'var(--text-tertiary)',
                                gap: '0.25rem'
                              }}>
                                <span style={{ fontSize: '1.25rem', fontWeight: 300 }}>+</span>
                                <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Livre</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Shelf number labels underneath columns */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                <div style={{ width: '80px' }}></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', flex: 1, textAlign: 'center' }}>
                  {[1, 2, 3, 4, 5].map(shelf => (
                    <div key={shelf} style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      Estante {shelf}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'low-stock' ? (
          /* low stock reordering dashboard view */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Summary statistics for reordering */}
            {(() => {
              const lowStockProducts = items.filter(item => item.quantity <= item.minStockLevel);
              const totalItemsToBuy = lowStockProducts.reduce((acc, item) => acc + Math.max(1, (item.minStockLevel * 2) - item.quantity), 0);
              const estimatedTotalInvestment = lowStockProducts.reduce((acc, item) => {
                const qty = Math.max(1, (item.minStockLevel * 2) - item.quantity);
                return acc + (qty * item.price);
              }, 0);

              return (
                <>
                  <section className="metrics-grid" style={{ marginBottom: 0 }}>
                    <div className="metric-card warning">
                      <div className="metric-header">
                        <span className="metric-title">Itens Críticos</span>
                        <div className="metric-icon-wrapper" style={{ backgroundColor: 'var(--warning-bg)' }}>
                          <Warning size={20} />
                        </div>
                      </div>
                      <div className="metric-value" style={{ color: 'var(--warning)' }}>{lowStockProducts.length}</div>
                      <div className="metric-footer">Abaixo do estoque de segurança</div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-header">
                        <span className="metric-title">Volume de Compra Sugerido</span>
                        <div className="metric-icon-wrapper">
                          <Stack size={20} />
                        </div>
                      </div>
                      <div className="metric-value">{totalItemsToBuy}</div>
                      <div className="metric-footer">Total de unidades recomendadas</div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-header">
                        <span className="metric-title">Investimento Estimado</span>
                        <div className="metric-icon-wrapper">
                          <Coins size={20} />
                        </div>
                      </div>
                      <div className="metric-value">${estimatedTotalInvestment.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      <div className="metric-footer">Custo total estimado para compra</div>
                    </div>
                  </section>

                  {lowStockProducts.length === 0 ? (
                    <div className="empty-state" style={{ padding: '4rem 2rem' }}>
                      <div className="empty-icon" style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success)' }}>
                        <CheckCircle size={32} />
                      </div>
                      <h3 className="empty-title">Estoque Totalmente Seguro</h3>
                      <p className="empty-desc">
                        Nenhum produto está abaixo do limite mínimo de segurança neste momento.
                      </p>
                    </div>
                  ) : (
                    <div className="table-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem', borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                          <h3 style={{ fontSize: '1.1rem' }}>Ordem de Compra Sugerida</h3>
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Configure os fornecedores e emita a ordem de compra consolidada.</p>
                        </div>
                        
                        <button
                          className="btn btn-primary"
                          onClick={emitPurchaseOrder}
                          title="Emitir ordem de reabastecimento em CSV"
                        >
                          Emitir Ordem de Reabastecimento
                        </button>
                      </div>

                      <div className="table-wrapper">
                        <table className="inventory-table">
                          <thead>
                            <tr>
                              <th>Produto</th>
                              <th>Categoria</th>
                              <th>Nível de Estoque</th>
                              <th>Estoque Recomendado</th>
                              <th>Compra Sugerida</th>
                              <th>Fornecedor Indicado</th>
                              <th style={{ textAlign: 'right' }}>Custo Estimado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lowStockProducts.map(item => {
                              const qtyNeeded = Math.max(1, (item.minStockLevel * 2) - item.quantity);
                              const selectedSupplier = itemSuppliers[item.id] || 'Inviolável Distribuição Ltda';
                              
                              return (
                                <tr key={item.id}>
                                  <td>
                                    <div className="item-meta">
                                      <span className="item-name">{item.name}</span>
                                      <span className="item-sku" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        <Barcode size={12} />
                                        {item.sku}
                                      </span>
                                    </div>
                                  </td>
                                  <td>
                                    <span className="badge badge-category">
                                      {categoryTranslations[item.category] || item.category}
                                    </span>
                                  </td>
                                  <td>
                                    <span className={`badge ${item.quantity === 0 ? 'danger' : 'warning'}`}>
                                      {item.quantity} (Min: {item.minStockLevel})
                                    </span>
                                  </td>
                                  <td>
                                    <span style={{ color: 'var(--text-secondary)' }}>
                                      {item.minStockLevel * 2}
                                    </span>
                                  </td>
                                  <td style={{ fontWeight: 700, color: 'var(--accent)' }}>
                                    +{qtyNeeded}
                                  </td>
                                  <td>
                                    <select
                                      className="filter-select"
                                      style={{ margin: 0, padding: '0.35rem 0.5rem', fontSize: '0.85rem', width: '220px' }}
                                      value={selectedSupplier}
                                      onChange={(e) => handleSupplierChange(item.id, e.target.value)}
                                    >
                                      <option value="Inviolável Distribuição Ltda">Inviolável Distribuição Ltda</option>
                                      <option value="Suprimentos Industriais Brasil">Suprimentos Industriais Brasil</option>
                                      <option value="Tech Solutions WMS">Tech Solutions WMS</option>
                                      <option value="Logística Global SA">Logística Global SA</option>
                                    </select>
                                  </td>
                                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                    ${(item.price * qtyNeeded).toFixed(2)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        ) : activeTab === 'tasks' ? (
          /* daily conference and auditing tasks list view */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: 0 }}>
              Tarefas diárias de inventário geradas automaticamente pelo WMS. O estoquista deve contar fisicamente os itens descritos e registrar os saldos corretos.
            </p>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <button
                className={`btn ${tasksSubTab === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ 
                  padding: '0.45rem 1rem', 
                  fontSize: '0.85rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem',
                  background: tasksSubTab === 'pending' ? 'var(--accent)' : undefined,
                  borderColor: tasksSubTab === 'pending' ? 'var(--accent)' : undefined,
                }}
                onClick={() => setTasksSubTab('pending')}
              >
                <span>Tarefas Ativas (Pendentes)</span>
                <span style={{ 
                  fontSize: '0.72rem', 
                  padding: '0.05rem 0.35rem', 
                  borderRadius: 'var(--radius-pill)', 
                  backgroundColor: tasksSubTab === 'pending' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)',
                  color: 'inherit',
                  fontWeight: 700 
                }}>
                  {tasks.filter(t => t.status === 'PENDENTE').length}
                </span>
              </button>
              <button
                className={`btn ${tasksSubTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ 
                  padding: '0.45rem 1rem', 
                  fontSize: '0.85rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem',
                  background: tasksSubTab === 'history' ? 'var(--accent)' : undefined,
                  borderColor: tasksSubTab === 'history' ? 'var(--accent)' : undefined,
                }}
                onClick={() => setTasksSubTab('history')}
              >
                <span>Histórico de Tarefas (Concluídas)</span>
                <span style={{ 
                  fontSize: '0.72rem', 
                  padding: '0.05rem 0.35rem', 
                  borderRadius: 'var(--radius-pill)', 
                  backgroundColor: tasksSubTab === 'history' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)',
                  color: 'inherit',
                  fontWeight: 700 
                }}>
                  {tasks.filter(t => t.status === 'CONCLUIDO').length}
                </span>
              </button>
            </div>

            <div className="table-card" style={{ marginBottom: 0 }}>
              <div className="table-wrapper">
                <table className="inventory-table">
                  {tasksSubTab === 'pending' ? (
                    <>
                      <thead>
                        <tr>
                          <th>Status</th>
                          <th>Tarefa</th>
                          <th>Produto</th>
                          <th>SKU</th>
                          <th>Gerada em</th>
                          <th>Esperado (WMS)</th>
                          <th style={{ textAlign: 'right' }}>Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const pending = tasks.filter(t => t.status === 'PENDENTE');
                          if (pending.length === 0) {
                            return (
                              <tr>
                                <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '3.5rem' }}>
                                  Nenhuma tarefa de conferência pendente no momento. Bom trabalho!
                                </td>
                              </tr>
                            );
                          }
                          
                          return pending.map((task) => {
                            const taskDate = new Date(task.data_geracao);
                            const today = new Date();
                            const isOverdue = taskDate.getFullYear() < today.getFullYear() ||
                              (taskDate.getFullYear() === today.getFullYear() && taskDate.getMonth() < today.getMonth()) ||
                              (taskDate.getFullYear() === today.getFullYear() && taskDate.getMonth() === today.getMonth() && taskDate.getDate() < today.getDate());

                            return (
                              <tr key={task.id_tarefa} style={isOverdue ? { backgroundColor: 'rgba(239, 68, 68, 0.02)' } : undefined}>
                                <td>
                                  <span className={`badge ${isOverdue ? 'danger' : 'warning'}`}>
                                    {isOverdue ? 'ATRASADA' : 'PENDENTE'}
                                  </span>
                                </td>
                                <td style={{ fontWeight: 600 }}>
                                  {task.tipo_tarefa === 'CONFERENCIA_SALDO' ? 'Conferência de Saldo' : 'Contagem Rotativa'}
                                </td>
                                <td>{task.name_produto}</td>
                                <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{task.sku_produto}</td>
                                <td>
                                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    {new Date(task.data_geracao).toLocaleDateString('pt-BR')}
                                  </span>
                                </td>
                                <td style={{ fontWeight: 600 }}>{task.quantidade_esperada}</td>
                                <td style={{ textAlign: 'right' }}>
                                  {currentUser?.perfil !== 'auditor' ? (
                                    <button
                                      type="button"
                                      className="btn btn-primary"
                                      style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', background: 'var(--accent)' }}
                                      onClick={() => {
                                        setSelectedTask(task);
                                        setTaskFormData({ quantidade_conferida: task.quantidade_esperada, observacao: '' });
                                        setTaskErrors({});
                                        setIsTaskModalOpen(true);
                                      }}
                                    >
                                      Conferir
                                    </button>
                                  ) : (
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Apenas Leitura</span>
                                  )}
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </>
                  ) : (
                    <>
                      <thead>
                        <tr>
                          <th>Status</th>
                          <th>Tarefa</th>
                          <th>Produto</th>
                          <th>SKU</th>
                          <th>Gerada em</th>
                          <th>Esperado (WMS)</th>
                          <th>Conferido (Físico)</th>
                          <th>Diferença</th>
                          <th>Concluída em</th>
                          <th>Observação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const completed = tasks.filter(t => t.status === 'CONCLUIDO');
                          if (completed.length === 0) {
                            return (
                              <tr>
                                <td colSpan={10} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '3.5rem' }}>
                                  Nenhuma tarefa concluída no histórico.
                                </td>
                              </tr>
                            );
                          }
                          
                          return completed.map((task) => {
                            const diff = task.quantidade_conferida! - task.quantidade_esperada;
                            return (
                              <tr key={task.id_tarefa}>
                                <td>
                                  <span className="badge success">
                                    CONCLUÍDO
                                  </span>
                                </td>
                                <td style={{ fontWeight: 600 }}>
                                  {task.tipo_tarefa === 'CONFERENCIA_SALDO' ? 'Conferência de Saldo' : 'Contagem Rotativa'}
                                </td>
                                <td>{task.name_produto}</td>
                                <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{task.sku_produto}</td>
                                <td>
                                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    {new Date(task.data_geracao).toLocaleDateString('pt-BR')}
                                  </span>
                                </td>
                                <td>{task.quantidade_esperada}</td>
                                <td style={{ fontWeight: 600 }}>{task.quantidade_conferida}</td>
                                <td style={{ 
                                  color: diff === 0 ? 'var(--success)' : 'var(--danger)',
                                  fontWeight: diff !== 0 ? 700 : 400
                                }}>
                                  {diff === 0 ? 'Sem divergência' : `${diff > 0 ? '+' : ''}${diff}`}
                                </td>
                                <td>
                                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    {task.data_conclusao ? new Date(task.data_conclusao).toLocaleString('pt-BR') : '-'}
                                  </span>
                                </td>
                                <td>
                                  <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                                    {task.observacao || 'Nenhuma observação'}
                                  </span>
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </>
                  )}
                </table>
              </div>
            </div>
          </div>
        ) : activeTab === 'idle-items' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '1.5rem' }}>
            {/* Header / Info bar */}
            <div className="table-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h3 style={{ marginBottom: '0.25rem', fontSize: '1.25rem' }}>Itens Ociosos & Sem Giro</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                    Produtos sem alteração de estoque ou movimentação por um período prolongado. Filtre o tempo de inatividade abaixo.
                  </p>
                </div>
                <span className="badge warning" style={{ display: 'inline-flex', gap: '0.25rem', alignItems: 'center' }}>
                  <Hourglass size={14} />
                  Estoque Estático
                </span>
              </div>

              {/* Filters Panel */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                gap: '2rem', 
                padding: '1rem 1.25rem', 
                borderRadius: 'var(--radius-md)', 
                backgroundColor: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border-color)',
                flexWrap: 'wrap'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, minWidth: '280px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Mínimo de Inatividade:</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--warning)', fontFamily: 'var(--font-display)' }}>
                      {idleDaysFilter === 0 ? 'Qualquer inatividade' : `${idleDaysFilter} dias`}
                    </span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="120" 
                    step="5"
                    value={idleDaysFilter} 
                    onChange={(e) => setIdleDaysFilter(Number(e.target.value))}
                    style={{ 
                      width: '100%', 
                      accentColor: 'var(--warning)', 
                      cursor: 'pointer',
                      height: '6px',
                      borderRadius: 'var(--radius-pill)',
                      backgroundColor: 'rgba(255,255,255,0.08)'
                    }} 
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                    <span>0 dias</span>
                    <span>30 dias</span>
                    <span>60 dias</span>
                    <span>90 dias</span>
                    <span>120+ dias</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Filtros Rápidos:</span>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {[7, 15, 30, 60, 90].map((d) => (
                      <button
                        key={d}
                        onClick={() => setIdleDaysFilter(d)}
                        className={`btn ${idleDaysFilter === d ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ 
                          padding: '0.35rem 0.75rem', 
                          fontSize: '0.8rem',
                          background: idleDaysFilter === d ? 'var(--warning)' : undefined,
                          borderColor: idleDaysFilter === d ? 'var(--warning)' : undefined,
                          color: idleDaysFilter === d ? 'var(--bg-page)' : undefined,
                          fontWeight: 600
                        }}
                      >
                        {d} dias
                      </button>
                    ))}
                    <button
                      onClick={() => setIdleDaysFilter(0)}
                      className={`btn ${idleDaysFilter === 0 ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ 
                        padding: '0.35rem 0.75rem', 
                        fontSize: '0.8rem',
                        background: idleDaysFilter === 0 ? 'var(--warning)' : undefined,
                        borderColor: idleDaysFilter === 0 ? 'var(--warning)' : undefined,
                        color: idleDaysFilter === 0 ? 'var(--bg-page)' : undefined,
                        fontWeight: 600
                      }}
                    >
                      Todos
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Metrics cards row */}
            {(() => {
              const filteredIdle = items.filter(item => getDaysInactive(item.lastUpdated) >= idleDaysFilter);
              const skusCount = filteredIdle.length;
              const valTotal = filteredIdle.reduce((acc, item) => acc + item.price * item.quantity, 0);
              const qtyTotal = filteredIdle.reduce((acc, item) => acc + item.quantity, 0);

              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  <div className="metric-card warning">
                    <div className="metric-header">
                      <span className="metric-title">SKUs Inativos</span>
                      <div className="metric-icon-wrapper" style={{ backgroundColor: 'var(--warning-bg)' }}>
                        <Hourglass size={20} />
                      </div>
                    </div>
                    <div className="metric-value">{skusCount}</div>
                    <div className="metric-footer">Produtos parados selecionados</div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-header">
                      <span className="metric-title">Capital Parado</span>
                      <div className="metric-icon-wrapper">
                        <Coins size={20} />
                      </div>
                    </div>
                    <div className="metric-value">
                      ${valTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="metric-footer">Valor financeiro em estoque ocioso</div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-header">
                      <span className="metric-title">Volume Físico Estático</span>
                      <div className="metric-icon-wrapper">
                        <Stack size={20} />
                      </div>
                    </div>
                    <div className="metric-value">{qtyTotal}</div>
                    <div className="metric-footer">Unidades físicas sem giro</div>
                  </div>
                </div>
              );
            })()}

            {/* Table of items */}
            <div className="table-card" style={{ marginBottom: 0 }}>
              <div className="table-wrapper">
                <table className="inventory-table">
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th>SKU</th>
                      <th>Categoria</th>
                      <th style={{ textAlign: 'right' }}>Qtd. Atual</th>
                      <th style={{ textAlign: 'right' }}>Valor Unitário</th>
                      <th style={{ textAlign: 'right' }}>Valor Total</th>
                      <th style={{ textAlign: 'center' }}>Inatividade</th>
                      <th>Última Atualização</th>
                      <th style={{ textAlign: 'right' }}>Ação Corretiva</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const filteredIdle = items
                        .filter(item => getDaysInactive(item.lastUpdated) >= idleDaysFilter)
                        .sort((a, b) => getDaysInactive(b.lastUpdated) - getDaysInactive(a.lastUpdated));

                      if (filteredIdle.length === 0) {
                        return (
                          <tr>
                            <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '4rem' }}>
                              Nenhum produto ocioso com inatividade maior ou igual a {idleDaysFilter} dias.
                            </td>
                          </tr>
                        );
                      }

                      return filteredIdle.map((item) => {
                        const daysInactive = getDaysInactive(item.lastUpdated);
                        const totalVal = item.price * item.quantity;
                        return (
                          <tr key={item.id}>
                            <td style={{ fontWeight: 600 }}>{item.name}</td>
                            <td>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
                                <Barcode size={12} />
                                {item.sku}
                              </span>
                            </td>
                            <td>
                              <span style={{ 
                                padding: '0.15rem 0.45rem', 
                                borderRadius: '4px', 
                                backgroundColor: 'rgba(255,255,255,0.05)', 
                                fontSize: '0.8rem', 
                                color: 'var(--text-secondary)'
                              }}>
                                {categoryTranslations[item.category] || item.category}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 500 }}>{item.quantity}</td>
                            <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                              ${item.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>
                              ${totalVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span style={{ 
                                display: 'inline-flex', 
                                padding: '0.2rem 0.5rem', 
                                borderRadius: 'var(--radius-pill)', 
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                backgroundColor: daysInactive >= 60 ? 'var(--danger-bg)' : daysInactive >= 30 ? 'var(--warning-bg)' : 'rgba(255,255,255,0.04)',
                                color: daysInactive >= 60 ? 'var(--danger)' : daysInactive >= 30 ? 'var(--warning)' : 'var(--text-secondary)'
                              }}>
                                {daysInactive === 0 ? 'Hoje' : `${daysInactive} dias`}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                {new Date(item.lastUpdated).toLocaleString('pt-BR')}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ 
                                  padding: '0.35rem 0.65rem', 
fontSize: '0.75rem', 
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem'
                                }}
                                onClick={() => handleRequestAudit(item)}
                              >
                                <CheckCircle size={14} style={{ color: 'var(--success)' }} />
                                <span>Solicitar Auditoria</span>
                              </button>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : activeTab === 'settings' ? (
          <>
          {currentUser?.perfil === 'admin' && (
            <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              {/* Category Registry Card */}
              <div className="table-card" style={{ padding: '1.5rem' }}>
                <h3 style={{ marginBottom: '0.5rem', fontSize: '1.15rem', color: 'var(--text-primary)' }}>Cadastro de Categorias</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                  Gerencie as categorias de produtos e defina suas respectivas políticas de Backorder (venda sem estoque físico).
                </p>

                {/* List of categories */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem', maxHeight: '350px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                  {Object.entries(categoryTranslations).map(([key, name]) => {
                    const hasBackorder = backorderCategories[key] || false;
                    // Count items using this category to show a badge
                    const itemCount = items.filter(item => item.category === key).length;
                    return (
                      <div 
                        key={key} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between', 
                          padding: '0.75rem 1rem', 
                          backgroundColor: 'var(--bg-input)', 
                          border: '1px solid var(--border-color)', 
                          borderRadius: 'var(--radius-sm)',
                          transition: 'var(--transition-fast)'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{name}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>ID: {key} ({itemCount} {itemCount === 1 ? 'produto' : 'produtos'})</span>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          {/* Backorder toggle switch / badge button */}
                          <button
                            onClick={() => handleToggleBackorder(key)}
                            className={`badge ${hasBackorder ? 'success' : 'danger'}`}
                            style={{ 
                              cursor: 'pointer', 
                              border: 'none', 
                              fontWeight: 600, 
                              fontSize: '0.75rem',
                              padding: '0.25rem 0.6rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem'
                            }}
                            title="Clique para alternar permissão de Backorder"
                          >
                            {hasBackorder ? 'Backorder: Permitido' : 'Backorder: Bloqueado'}
                          </button>

                          {/* Delete action */}
                          {key !== 'Other' && (
                            <button
                              onClick={() => handleDeleteCategory(key)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--danger)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                padding: '0.25rem'
                              }}
                              title="Remover Categoria"
                            >
                              <Trash size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Form to add a new category */}
                <form onSubmit={handleAddCategory} style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
                  <h4 style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nova Categoria</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label htmlFor="new_cat_key" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Chave / ID (Ex: Tools)</label>
                      <input
                        type="text"
                        id="new_cat_key"
                        className="form-input"
                        style={{ padding: '0.45rem 0.75rem', fontSize: '0.85rem' }}
                        placeholder="Ex: Tools"
                        value={newCategoryKey}
                        onChange={(e) => setNewCategoryKey(e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label htmlFor="new_cat_name" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Nome Exibição (Português)</label>
                      <input
                        type="text"
                        id="new_cat_name"
                        className="form-input"
                        style={{ padding: '0.45rem 0.75rem', fontSize: '0.85rem' }}
                        placeholder="Ex: Ferramentas"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <input
                        type="checkbox"
                        checked={newCategoryBackorder}
                        onChange={(e) => setNewCategoryBackorder(e.target.checked)}
                        style={{ accentColor: 'var(--accent)' }}
                      />
                      <span>Permitir Backorder por padrão</span>
                    </label>
                    
                    <button type="submit" className="btn btn-primary" style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}>
                      <Plus size={14} weight="bold" />
                      <span>Cadastrar</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* System Configurations Card */}
              <div className="table-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ marginBottom: '0.5rem', fontSize: '1.15rem', color: 'var(--text-primary)' }}>Parâmetros do Sistema</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                    Ajuste configurações críticas do WMS e parâmetros de integrações de inteligência artificial.
                  </p>

                  <form onSubmit={handleSaveSystemConfigs} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* Default minimum stock alert level */}
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label htmlFor="default_min_stock" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Alerta de Estoque Mínimo Padrão</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Usado para novos cadastros</span>
                      </label>
                      <input
                        type="number"
                        id="default_min_stock"
                        className="form-input"
                        min="0"
                        value={defaultMinStock}
                        onChange={(e) => setDefaultMinStock(Number(e.target.value))}
                      />
                    </div>

                    {/* Gemini API Key */}
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label htmlFor="gemini_api_key" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Google Gemini API Key</span>
                        {geminiApiKey ? (
                          <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>Chave Configurada</span>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--warning)', fontWeight: 600 }}>Modo Simulação Local</span>
                        )}
                      </label>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                          type="password"
                          id="gemini_api_key"
                          className="form-input"
                          placeholder="Digite sua chave de API Gemini..."
                          value={geminiApiKey}
                          onChange={(e) => setGeminiApiKey(e.target.value)}
                          style={{ flex: 1 }}
                        />
                        {geminiApiKey && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '0.5rem', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                            onClick={handleClearGeminiKey}
                            title="Limpar chave de API"
                          >
                            Limpar
                          </button>
                        )}
                      </div>
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}>
                      Salvar Configurações
                    </button>
                  </form>
                </div>

                {/* Database Connectivity Status Badge & Verification */}
                <div 
                  style={{ 
                    marginTop: '2rem', 
                    padding: '1rem', 
                    backgroundColor: 'rgba(255, 255, 255, 0.02)', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Status da Conexão PostgreSQL:</span>
                    <span 
                      className={`badge ${isOffline ? 'warning' : 'success'}`}
                      style={{ fontSize: '0.75rem', fontWeight: 700 }}
                    >
                      {isOffline ? 'Modo de Contingência (Local)' : 'Online (Ativo)'}
                    </span>
                  </div>
                  
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', lineHeight: '1.4' }}>
                    {isOffline 
                      ? 'O sistema está em execução de contingência local usando LocalStorage. Modificações e movimentações serão salvas apenas neste navegador.'
                      : 'Conexão ativa com o banco de dados PostgreSQL. Sincronização relacional de transações física em tempo real.'
                    }
                  </p>

                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ width: '100%', justifyContent: 'center', fontSize: '0.8rem', padding: '0.45rem' }} 
                    onClick={fetchData}
                    disabled={loading}
                  >
                    {loading ? 'Verificando...' : 'Re-testar Conexão com Banco'}
                  </button>
                </div>
              </div>
            </div>

            {/* User Management Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              {/* User Registry Card */}
              <div className="table-card" style={{ padding: '1.5rem' }}>
                <h3 style={{ marginBottom: '0.5rem', fontSize: '1.15rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <UserPlus size={20} color="var(--accent)" weight="bold" />
                  <span>Cadastro de Usuários</span>
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                  Registre novos usuários no sistema e defina suas permissões de acesso através de perfis.
                </p>

                <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label htmlFor="new_user_name" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Nome Completo</label>
                    <input
                      type="text"
                      id="new_user_name"
                      className="form-input"
                      placeholder="Ex: João da Silva"
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      required
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label htmlFor="new_user_username" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Usuário (Username)</label>
                      <input
                        type="text"
                        id="new_user_username"
                        className="form-input"
                        placeholder="Ex: joao.silva"
                        value={newUserUsername}
                        onChange={(e) => setNewUserUsername(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label htmlFor="new_user_password" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Senha</label>
                      <input
                        type="password"
                        id="new_user_password"
                        className="form-input"
                        placeholder="Senha de acesso..."
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label htmlFor="new_user_perfil" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Perfil de Acesso</label>
                    <select
                      id="new_user_perfil"
                      className="form-input"
                      value={newUserPerfil}
                      onChange={(e) => setNewUserPerfil(e.target.value as 'admin' | 'operador' | 'auditor')}
                      style={{ backgroundColor: 'var(--bg-input)' }}
                    >
                      <option value="operador">Operador (Acesso Operacional)</option>
                      <option value="auditor">Auditor (Acesso Somente Leitura)</option>
                      <option value="admin">Administrador (Acesso Total)</option>
                    </select>
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}>
                    <UserPlus size={16} weight="bold" />
                    <span>Cadastrar Usuário</span>
                  </button>
                </form>
              </div>

              {/* Users List Card */}
              <div className="table-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ marginBottom: '0.5rem', fontSize: '1.15rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <User size={20} color="var(--accent)" weight="bold" />
                  <span>Usuários Cadastrados</span>
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                  Lista de operadores e administradores com acesso ao WMS.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto', flex: 1, maxHeight: '330px', paddingRight: '0.25rem' }}>
                  {users.map(user => {
                    const isSelf = currentUser && user.id === currentUser.id;
                    const isAdminDefault = user.username === 'admin';
                    return (
                      <div 
                        key={user.id} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between', 
                          padding: '0.75rem 1rem', 
                          backgroundColor: 'var(--bg-input)', 
                          border: '1px solid var(--border-color)', 
                          borderRadius: 'var(--radius-sm)'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            {user.nome}
                            {isSelf && (
                              <span style={{ fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 500 }}>(você)</span>
                            )}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>@{user.username}</span>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span 
                            className="badge"
                            style={{ 
                              fontSize: '0.72rem', 
                              fontWeight: 700, 
                              padding: '0.2rem 0.5rem',
                              textTransform: 'uppercase',
                              backgroundColor: user.perfil === 'admin' ? 'rgba(99, 102, 241, 0.15)' : user.perfil === 'operador' ? 'var(--success-bg)' : 'var(--warning-bg)',
                              color: user.perfil === 'admin' ? 'var(--accent)' : user.perfil === 'operador' ? 'var(--success)' : 'var(--warning)'
                            }}
                          >
                            {user.perfil === 'admin' ? 'Admin' : user.perfil === 'operador' ? 'Operador' : 'Auditor'}
                          </span>

                          {!isAdminDefault && !isSelf && (
                            <button
                              onClick={() => handleDeleteUser(user)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--danger)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                padding: '0.25rem'
                              }}
                              title="Excluir Usuário"
                            >
                              <Trash size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            </>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: currentUser?.perfil === 'admin' ? '1fr 1fr 1fr' : '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            {/* Audit Trail Card */}
            <div className="table-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid var(--border-color)', background: 'rgba(255, 255, 255, 0.01)', backdropFilter: 'blur(12px)' }}>
              <div>
                <h3 style={{ marginBottom: '0.5rem', fontSize: '1.15rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.50rem' }}>
                  <Notebook size={20} color="var(--accent)" weight="bold" />
                  <span>Trilha de Auditoria do Sistema</span>
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem', lineHeight: '1.45' }}>
                  Histórico completo de ações, mudanças de configuração, conexões e operações físicas do WMS. Acesse a página dedicada para ver o registro cronológico completo de logs de auditoria.
                </p>
              </div>
              
              <button 
                className="btn btn-primary" 
                onClick={() => { setActiveTab('system-audit'); window.scrollTo(0, 0); }}
                style={{ width: '100%', justifyContent: 'center', marginTop: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <Notebook size={16} weight="bold" />
                <span>Acessar Trilha de Auditoria</span>
              </button>
            </div>

            {/* Recycle Bin Card */}
            <div className="table-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid var(--border-color)', background: 'rgba(255, 255, 255, 0.01)', backdropFilter: 'blur(12px)' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.15rem', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.50rem' }}>
                    <Trash size={20} color="var(--danger)" weight="bold" />
                    <span>Lixeira do WMS</span>
                  </h3>
                  {trashItems.length > 0 && (
                    <span className="badge danger" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                      {trashItems.length} {trashItems.length === 1 ? 'item' : 'itens'}
                    </span>
                  )}
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem', lineHeight: '1.45' }}>
                  Produtos excluídos do inventário ativo. Acesse a página da lixeira para restaurá-los com seu saldo anterior ou excluí-los permanentemente.
                </p>
              </div>
              
              <button 
                className="btn btn-primary" 
                onClick={() => { setActiveTab('trash'); window.scrollTo(0, 0); }}
                style={{ width: '100%', justifyContent: 'center', marginTop: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <Trash size={16} weight="bold" />
                <span>Acessar Lixeira</span>
              </button>
            </div>

            {/* Backup Card */}
            {currentUser?.perfil === 'admin' && (
              <div className="table-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid var(--border-color)', background: 'rgba(255, 255, 255, 0.01)', backdropFilter: 'blur(12px)' }}>
                <div>
                  <h3 style={{ marginBottom: '0.5rem', fontSize: '1.15rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.50rem' }}>
                    <WarningCircle size={20} color="var(--accent)" weight="bold" />
                    <span>Backup do WMS</span>
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem', lineHeight: '1.45' }}>
                    Central de cópias de segurança do banco de dados relacional PostgreSQL do WMS. Restaure estados anteriores ou gere arquivos de contingência locais.
                  </p>
                </div>
                
                <button 
                  className="btn btn-primary" 
                  onClick={() => { setActiveTab('backup'); window.scrollTo(0, 0); }}
                  style={{ width: '100%', justifyContent: 'center', marginTop: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <WarningCircle size={16} weight="bold" />
                  <span>Acessar Central de Backups</span>
                </button>
              </div>
            )}
          </div>
          </>
        ) : activeTab === 'backup' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="table-card" style={{ padding: '1.5rem', marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <WarningCircle size={24} color="var(--accent)" weight="fill" />
                    <span>Central de Backups do WMS</span>
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem', marginBottom: 0 }}>
                    Gerencie backups de segurança do banco de dados relacional PostgreSQL do WMS. Backups diários são gerados automaticamente e mantidos por 1 semana (7 dias).
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button 
                    className="btn btn-secondary"
                    style={{ padding: '0.45rem 1rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                    onClick={() => { setActiveTab('settings'); window.scrollTo(0, 0); }}
                  >
                    <Gear size={16} />
                    <span>Configurações</span>
                  </button>
                  {currentUser?.perfil === 'admin' && (
                    <button 
                      className="btn btn-primary"
                      style={{ padding: '0.45rem 1rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                      onClick={handleCreateBackup}
                      disabled={isBackingUp}
                    >
                      <Plus size={16} weight="bold" />
                      <span>{isBackingUp ? 'Gerando...' : 'Criar Backup Manual'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Backups List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '600px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                {loadingBackups ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '5rem 0', fontSize: '0.9rem' }}>
                    Carregando arquivos de backup...
                  </div>
                ) : backups.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '5rem 0', fontSize: '0.9rem' }}>
                    Nenhum arquivo de backup localizado no servidor.
                  </div>
                ) : (
                  backups.map(backup => {
                    const backupDate = new Date(backup.createdAt);
                    const formattedDate = backupDate.toLocaleString('pt-BR');
                    const sizeKB = (backup.sizeBytes / 1024).toFixed(2);
                    
                    return (
                      <div 
                        key={backup.filename} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between', 
                          padding: '1rem 1.25rem', 
                          backgroundColor: 'var(--bg-input)', 
                          border: '1px solid var(--border-color)', 
                          borderRadius: 'var(--radius-md)'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{backup.filename}</span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            Criado em: <strong style={{ color: 'var(--text-primary)' }}>{formattedDate}</strong> | Tamanho: <strong style={{ color: 'var(--text-primary)' }}>{sizeKB} KB</strong>
                          </span>
                        </div>
                        
                        {currentUser?.perfil === 'admin' && (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              onClick={() => {
                                setBackupToRestore(backup.filename);
                                setIsRestoreModalOpen(true);
                              }}
                              className="btn btn-secondary"
                              style={{ 
                                padding: '0.45rem 0.85rem', 
                                fontSize: '0.8rem', 
                                borderColor: 'rgba(16, 185, 129, 0.2)',
                                color: 'var(--success)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem'
                              }}
                              title="Restaurar banco de dados para este estado"
                            >
                              <ArrowClockwise size={16} />
                              <span>Restaurar</span>
                            </button>
                            <button
                              onClick={() => handleDeleteBackupFile(backup.filename)}
                              className="btn btn-secondary"
                              style={{ 
                                padding: '0.45rem 0.85rem', 
                                fontSize: '0.8rem', 
                                borderColor: 'rgba(239, 68, 68, 0.2)',
                                color: 'var(--danger)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem'
                              }}
                              title="Excluir arquivo de backup definitivamente"
                            >
                              <Trash size={16} />
                              <span>Excluir</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'system-audit' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="table-card" style={{ padding: '1.5rem', marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', margin: 0 }}>Trilha de Auditoria do WMS</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem', marginBottom: 0 }}>
                    Histórico completo de eventos, alterações de configurações, status de conexões e registros de auditoria física.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button 
                    className="btn btn-secondary"
                    style={{ padding: '0.45rem 1rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                    onClick={() => { setActiveTab('settings'); window.scrollTo(0, 0); }}
                  >
                    <Gear size={16} />
                    <span>Configurações</span>
                  </button>
                  {notifications.length > 0 && currentUser?.perfil === 'admin' && (
                    <button 
                      className="btn btn-secondary"
                      style={{ padding: '0.45rem 1rem', fontSize: '0.8rem', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                      onClick={() => {
                        setNotifications([]);
                        addToast('success', 'Histórico de auditoria limpo.');
                      }}
                    >
                      Limpar Logs
                    </button>
                  )}
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '600px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                {notifications.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '4rem 0', fontSize: '0.9rem' }}>
                    Nenhum registro de auditoria disponível no momento.
                  </div>
                ) : (
                  notifications.map(log => (
                    <div 
                      key={log.id} 
                      style={{ 
                        padding: '1rem 1.25rem', 
                        backgroundColor: 'var(--bg-input)', 
                        border: '1px solid var(--border-color)', 
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.35rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span 
                            style={{ 
                              display: 'inline-block', 
                              width: '8px', 
                              height: '8px', 
                              borderRadius: '50%', 
                              backgroundColor: log.type === 'success' ? 'var(--success)' : log.type === 'error' ? 'var(--danger)' : log.type === 'warning' ? 'var(--warning)' : 'var(--accent)',
                              boxShadow: `0 0 8px ${log.type === 'success' ? 'var(--success)' : log.type === 'error' ? 'var(--danger)' : log.type === 'warning' ? 'var(--warning)' : 'var(--accent)'}`
                            }} 
                          />
                          {log.title}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                          {new Date(log.timestamp).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{log.description}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'trash' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="table-card" style={{ padding: '1.5rem', marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', margin: 0 }}>Lixeira do WMS</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem', marginBottom: 0 }}>
                    Produtos removidos do estoque ativo. Eles podem ser restaurados ou excluídos definitivamente.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button 
                    className="btn btn-secondary"
                    style={{ padding: '0.45rem 1rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                    onClick={() => { setActiveTab('settings'); window.scrollTo(0, 0); }}
                  >
                    <Gear size={16} />
                    <span>Configurações</span>
                  </button>
                  {trashItems.length > 0 && currentUser?.perfil === 'admin' && (
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button 
                        className="btn btn-secondary"
                        style={{ padding: '0.45rem 1rem', fontSize: '0.8rem', color: 'var(--success)', borderColor: 'rgba(16, 185, 129, 0.2)' }}
                        onClick={handleRestoreAll}
                      >
                        Restaurar Todos
                      </button>
                      <button 
                        className="btn btn-secondary"
                        style={{ padding: '0.45rem 1rem', fontSize: '0.8rem', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                        onClick={handleEmptyTrash}
                      >
                        Esvaziar Lixeira
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '600px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                {trashItems.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '5rem 0', fontSize: '0.9rem' }}>
                    A lixeira está vazia. Nenhum produto excluído.
                  </div>
                ) : (
                  trashItems.map(item => (
                    <div 
                      key={item.id} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        padding: '1rem 1.25rem', 
                        backgroundColor: 'var(--bg-input)', 
                        border: '1px solid var(--border-color)', 
                        borderRadius: 'var(--radius-md)'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{item.name}</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          Categoria: <span className="badge badge-category" style={{ padding: '0.1rem 0.4rem', fontSize: '0.72rem' }}>{categoryTranslations[item.category] || item.category}</span>
                        </span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
                          SKU: {item.sku} | Saldo: {item.quantity} | Unitário: R$ {item.price.toFixed(2)} | Total: R$ {(item.price * item.quantity).toFixed(2)}
                        </span>
                      </div>
                      
                      {currentUser?.perfil === 'admin' ? (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            onClick={() => handleRestoreItem(item)}
                            className="btn btn-secondary"
                            style={{ 
                              padding: '0.45rem 0.85rem', 
                              fontSize: '0.8rem', 
                              borderColor: 'rgba(16, 185, 129, 0.2)',
                              color: 'var(--success)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem'
                            }}
                            title="Restaurar produto para o estoque"
                          >
                            <ArrowClockwise size={16} />
                            <span>Restaurar</span>
                          </button>
                          <button
                            onClick={() => handleDeletePermanently(item)}
                            className="btn btn-secondary"
                            style={{ 
                              padding: '0.45rem 0.85rem', 
                              fontSize: '0.8rem', 
                              borderColor: 'rgba(239, 68, 68, 0.2)',
                              color: 'var(--danger)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem'
                            }}
                            title="Excluir permanentemente"
                          >
                            <Trash size={16} />
                            <span>Excluir</span>
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Apenas Leitura</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          /* stock list table view */
          <>
            <div className="controls-bar">
              <div className="search-wrapper">
                <MagnifyingGlass className="search-icon" size={18} />
                <input
                  type="text"
                  className="search-input"
                  placeholder="Pesquisar por SKU ou descrição do produto..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="filters-wrapper">
                <select
                  className="filter-select"
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    setActiveTab('all');
                  }}
                >
                  <option value="">Todas as Categorias</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{categoryTranslations[cat] || cat}</option>
                  ))}
                </select>

                <button
                  className={`filter-btn ${lowStockFilter ? 'active' : ''}`}
                  onClick={() => setLowStockFilter(!lowStockFilter)}
                >
                  <Warning size={16} />
                  <span>Estoque Baixo</span>
                </button>

                <button
                  className="btn btn-secondary"
                  style={{ padding: '0.55rem 0.85rem', fontSize: '0.82rem', height: '38px' }}
                  onClick={exportInventoryCSV}
                  title="Exportar inventário completo para CSV"
                >
                  <span>Exportar CSV</span>
                </button>

                <button
                  className="btn btn-secondary"
                  style={{ padding: '0.55rem 0.85rem', fontSize: '0.82rem', height: '38px', gap: '0.35rem', display: 'inline-flex', alignItems: 'center' }}
                  onClick={exportInventoryPDF}
                  title="Exportar inventário completo para PDF"
                >
                  <FilePdf size={16} />
                  <span>Exportar PDF</span>
                </button>
              </div>
            </div>

            {loading ? (
              <div className="table-card" style={{ padding: '2rem' }}>
                <div className="skeleton skeleton-title"></div>
                <div className="skeleton skeleton-text" style={{ width: '90%' }}></div>
                <div className="skeleton skeleton-text" style={{ width: '85%' }}></div>
                <div className="skeleton skeleton-text"></div>
              </div>
            ) : displayItems.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <Package />
                </div>
                <h3 className="empty-title">Nenhum Registro Encontrado</h3>
                <p className="empty-desc">
                  Nenhum produto em estoque atende aos filtros selecionados.
                </p>
                <button className="btn btn-secondary" onClick={() => { setSearch(''); setCategoryFilter(''); setLowStockFilter(false); setActiveTab('all'); }}>
                  Limpar Filtros
                </button>
              </div>
            ) : (
              <div className="table-card">
                <div className="table-wrapper">
                  <table className="inventory-table">
                    <thead>
                      <tr>
                        <th>Produto</th>
                        <th>Categoria</th>
                        <th>Nível de Estoque</th>
                        <th>Preço Unitário</th>
                        <th>Valoração</th>
                        <th>Localização</th>
                        <th style={{ textAlign: 'right' }}>Ações WMS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedItems.map((item) => {
                        const isLow = item.quantity <= item.minStockLevel;
                        const stockPercentage = item.quantity === 0 ? 0 : Math.min(100, (item.quantity / (item.minStockLevel * 2)) * 100);
                        
                        return (
                          <tr key={item.id}>
                            <td>
                              <div className="item-meta">
                                <span className="item-name">{item.name}</span>
                                <span className="item-sku" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <Barcode size={12} />
                                  {item.sku}
                                </span>
                              </div>
                            </td>
                            <td>
                              <span className="badge badge-category">{categoryTranslations[item.category] || item.category}</span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: '120px' }}>
                                <span className={`badge badge-stock ${item.quantity === 0 ? 'danger' : isLow ? 'warning' : 'success'}`} style={{ alignSelf: 'flex-start' }}>
                                  {item.quantity === 0 ? 'Zerado' : isLow ? `${item.quantity} Crítico (Min: ${item.minStockLevel})` : `${item.quantity} Seguro`}
                                </span>
                                <div style={{ height: '4px', width: '100%', backgroundColor: 'var(--border-color)', borderRadius: '2px', overflow: 'hidden' }}>
                                  <div style={{ 
                                    height: '100%', 
                                    width: `${stockPercentage}%`, 
                                    backgroundColor: item.quantity === 0 ? 'var(--danger)' : isLow ? 'var(--warning)' : 'var(--success)', 
                                    borderRadius: '2px' 
                                  }}></div>
                                </div>
                              </div>
                            </td>
                            <td>${item.price.toFixed(2)}</td>
                            <td style={{ fontWeight: 500 }}>
                              ${(item.price * item.quantity).toFixed(2)}
                            </td>
                            <td>
                              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <MapPin size={12} />
                                {item.location || 'Não especificado'}
                              </span>
                            </td>
                            <td>
                              <div className="action-buttons" style={{ justifyContent: 'flex-end' }}>
                                {currentUser?.perfil !== 'auditor' && (
                                  <button 
                                    className="btn btn-secondary" 
                                    style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', gap: '0.25rem' }} 
                                    onClick={() => { setSelectedItem(item); setMovementData(prev => ({ ...prev, quantidade: 1, numero_os: '' })); setIsMovementModalOpen(true); }}
                                  >
                                    <ArrowClockwise size={12} />
                                    <span>Mover</span>
                                  </button>
                                )}
                                {currentUser?.perfil === 'admin' && (
                                  <>
                                    <button className="icon-btn edit" onClick={() => handleEditClick(item)} title="Editar Produto">
                                      <PencilSimple size={14} />
                                    </button>
                                    <button className="icon-btn delete" onClick={() => handleDeleteClick(item)} title="Deletar Produto">
                                      <Trash size={14} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {displayItems.length > inventoryPerPage && (
                  <div className="pagination-bar" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '1rem 1.25rem',
                    borderTop: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    fontSize: '0.85rem',
                    color: 'var(--text-secondary)'
                  }}>
                    <div>
                      Mostrando <strong>{Math.min(displayItems.length, (inventoryPage - 1) * inventoryPerPage + 1)}</strong> a{' '}
                      <strong>{Math.min(displayItems.length, inventoryPage * inventoryPerPage)}</strong> de{' '}
                      <strong>{displayItems.length}</strong> produtos
                    </div>
                    <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', height: '32px' }}
                        disabled={inventoryPage === 1}
                        onClick={() => setInventoryPage(prev => Math.max(1, prev - 1))}
                      >
                        Anterior
                      </button>
                      {Array.from({ length: Math.ceil(displayItems.length / inventoryPerPage) }).map((_, index) => {
                        const pageNum = index + 1;
                        const isCurrent = pageNum === inventoryPage;
                        const totalPages = Math.ceil(displayItems.length / inventoryPerPage);
                        if (pageNum === 1 || pageNum === totalPages || Math.abs(pageNum - inventoryPage) <= 1) {
                          return (
                            <button
                              key={pageNum}
                              type="button"
                              className={`btn ${isCurrent ? 'btn-primary' : 'btn-secondary'}`}
                              style={{ 
                                padding: '0.35rem 0.75rem', 
                                fontSize: '0.8rem', 
                                height: '32px',
                                minWidth: '32px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: isCurrent ? 'var(--accent)' : 'transparent',
                                borderColor: isCurrent ? 'var(--accent)' : 'var(--border-color)',
                                color: isCurrent ? '#fff' : 'var(--text-primary)',
                                fontWeight: isCurrent ? 600 : 400
                              }}
                              onClick={() => setInventoryPage(pageNum)}
                            >
                              {pageNum}
                            </button>
                          );
                        }
                        if (pageNum === 2 || pageNum === totalPages - 1) {
                          return <span key={pageNum} style={{ padding: '0 0.25rem', alignSelf: 'center' }}>...</span>;
                        }
                        return null;
                      })}
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', height: '32px' }}
                        disabled={inventoryPage >= Math.ceil(displayItems.length / inventoryPerPage)}
                        onClick={() => setInventoryPage(prev => Math.min(Math.ceil(displayItems.length / inventoryPerPage), prev + 1))}
                      >
                        Próximo
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Movement Modal (WMS Transaction Simulator) */}
      {isMovementModalOpen && selectedItem && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Registrar Movimentação Física</h3>
              <button className="modal-close" onClick={() => setIsMovementModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleMovementSubmit}>
              <div className="modal-body">
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                  Movimentar produto: <strong>{selectedItem.name}</strong> ({selectedItem.sku})
                  <br />
                  Estoque atual: <strong>{selectedItem.quantity}</strong> unidades (Mínimo: {selectedItem.minStockLevel}).
                </p>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="tipo_movimentacao">Tipo de Movimento</label>
                    <select
                      id="tipo_movimentacao"
                      name="tipo_movimentacao"
                      className="form-input"
                      value={movementData.tipo_movimentacao}
                      onChange={handleMovementChange}
                    >
                      <option value="ENTRADA">ENTRADA (Acréscimo)</option>
                      <option value="SAIDA">SAIDA (Débito)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="subtipo_movimentacao">Finalidade (Subtipo)</label>
                    <select
                      id="subtipo_movimentacao"
                      name="subtipo_movimentacao"
                      className="form-input"
                      value={movementData.subtipo_movimentacao}
                      onChange={handleMovementChange}
                    >
                      {movementData.tipo_movimentacao === 'ENTRADA' ? (
                        <>
                          <option value="AJUSTE_INVENTARIO">Ajuste de Inventário</option>
                          <option value="DEVOLUCAO">Devolução de Venda</option>
                          <option value="BONIFICACAO">Bonificação</option>
                        </>
                      ) : (
                        <>
                          <option value="NEGOCIACAO_VENDA">Negociação Venda (Faturamento)</option>
                          <option value="NEGOCIACAO_LOCADA">Negociação Locada</option>
                          <option value="TRANSFERENCIA">Transferência</option>
                          <option value="DESATIVACAO">Desativação / Sucata</option>
                          <option value="AJUSTE_INVENTARIO">Ajuste de Inventário (Perda)</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="quantidade">Quantidade a Movimentar</label>
                  <input
                    type="number"
                    id="quantidade"
                    name="quantidade"
                    className="form-input"
                    value={movementData.quantidade}
                    onChange={handleMovementChange}
                    min="1"
                  />
                  {movementErrors.quantidade && <span className="form-error">{movementErrors.quantidade}</span>}
                </div>

                {movementData.tipo_movimentacao === 'SAIDA' && ['NEGOCIACAO_VENDA', 'NEGOCIACAO_LOCADA', 'TRANSFERENCIA'].includes(movementData.subtipo_movimentacao) && (
                  <div className="form-group">
                    <label htmlFor="numero_os">Número da OS (Sistema Service) <span style={{ color: 'var(--accent, #3b82f6)' }}>*</span></label>
                    <input
                      type="text"
                      id="numero_os"
                      name="numero_os"
                      className="form-input"
                      value={movementData.numero_os}
                      onChange={handleMovementChange}
                      placeholder="Ex: OS-12345"
                      required
                    />
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="estoque_origem">Estoque Origem (Opcional)</label>
                    <input
                      type="text"
                      id="estoque_origem"
                      name="estoque_origem"
                      className="form-input"
                      value={movementData.estoque_origem}
                      onChange={handleMovementChange}
                      placeholder="Ex: Armazém A"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="estoque_destino">Estoque Destino (Opcional)</label>
                    <input
                      type="text"
                      id="estoque_destino"
                      name="estoque_destino"
                      className="form-input"
                      value={movementData.estoque_destino}
                      onChange={handleMovementChange}
                      placeholder="Ex: Corredor B"
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsMovementModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: 'var(--accent)' }}>
                  Confirmar e Processar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Cadastrar Produto</h3>
              <button className="modal-close" onClick={() => setIsAddModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="name">Nome do Produto</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    className="form-input"
                    value={formData.name}
                    onChange={handleFormChange}
                    placeholder="Ex: MacBook Pro M3"
                  />
                  {formErrors.name && <span className="form-error">{formErrors.name}</span>}
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="sku">Código SKU</label>
                    <input
                      type="text"
                      id="sku"
                      name="sku"
                      className="form-input"
                      value={formData.sku}
                      onChange={handleFormChange}
                      placeholder="Ex: MBP-M3-01"
                    />
                    {formErrors.sku && <span className="form-error">{formErrors.sku}</span>}
                  </div>
                  <div className="form-group">
                    <label htmlFor="category">Categoria</label>
                    <select
                      id="category"
                      name="category"
                      className="form-input"
                      value={formData.category}
                      onChange={handleFormChange}
                    >
                      {Object.entries(categoryTranslations).map(([key, name]) => (
                        <option key={key} value={key}>{name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="quantity">Quantidade em Estoque</label>
                    <input
                      type="number"
                      id="quantity"
                      name="quantity"
                      className="form-input"
                      value={formData.quantity}
                      onChange={handleFormChange}
                      min="0"
                    />
                    {formErrors.quantity && <span className="form-error">{formErrors.quantity}</span>}
                  </div>
                  <div className="form-group">
                    <label htmlFor="price">Preço Unitário ($)</label>
                    <input
                      type="number"
                      id="price"
                      name="price"
                      className="form-input"
                      value={formData.price}
                      onChange={handleFormChange}
                      min="0.01"
                      step="0.01"
                    />
                    {formErrors.price && <span className="form-error">{formErrors.price}</span>}
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="minStockLevel">Margem de Alerta (Mínimo)</label>
                    <input
                      type="number"
                      id="minStockLevel"
                      name="minStockLevel"
                      className="form-input"
                      value={formData.minStockLevel}
                      onChange={handleFormChange}
                      min="0"
                    />
                    {formErrors.minStockLevel && <span className="form-error">{formErrors.minStockLevel}</span>}
                  </div>
                  <div className="form-group">
                    <label htmlFor="location">Localização no Depósito</label>
                    <input
                      type="text"
                      id="location"
                      name="location"
                      className="form-input"
                      value={formData.location}
                      onChange={handleFormChange}
                      placeholder="Ex: A-3-2 (Corredor-Estante-Nível)"
                    />
                    <small style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '0.25rem', display: 'block' }}>
                      Use o formato <strong>Corredor-Estante-Nível</strong> (ex: <code>A-3-2</code>) para mapeamento visual.
                    </small>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsAddModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Cadastrar Produto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && selectedItem && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Editar Produto</h3>
              <button className="modal-close" onClick={() => setIsEditModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="edit-name">Nome do Produto</label>
                  <input
                    type="text"
                    id="edit-name"
                    name="name"
                    className="form-input"
                    value={formData.name}
                    onChange={handleFormChange}
                  />
                  {formErrors.name && <span className="form-error">{formErrors.name}</span>}
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="edit-sku">Código SKU</label>
                    <input
                      type="text"
                      id="edit-sku"
                      name="sku"
                      className="form-input"
                      value={formData.sku}
                      onChange={handleFormChange}
                    />
                    {formErrors.sku && <span className="form-error">{formErrors.sku}</span>}
                  </div>
                  <div className="form-group">
                    <label htmlFor="edit-category">Categoria</label>
                    <select
                      id="edit-category"
                      name="category"
                      className="form-input"
                      value={formData.category}
                      onChange={handleFormChange}
                    >
                      {Object.entries(categoryTranslations).map(([key, name]) => (
                        <option key={key} value={key}>{name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="edit-quantity">Quantidade em Estoque</label>
                    <input
                      type="number"
                      id="edit-quantity"
                      name="quantity"
                      className="form-input"
                      value={formData.quantity}
                      onChange={handleFormChange}
                      min="0"
                    />
                    {formErrors.quantity && <span className="form-error">{formErrors.quantity}</span>}
                  </div>
                  <div className="form-group">
                    <label htmlFor="edit-price">Preço Unitário ($)</label>
                    <input
                      type="number"
                      id="edit-price"
                      name="price"
                      className="form-input"
                      value={formData.price}
                      onChange={handleFormChange}
                      min="0.01"
                      step="0.01"
                    />
                    {formErrors.price && <span className="form-error">{formErrors.price}</span>}
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="edit-minStockLevel">Margem de Alerta (Mínimo)</label>
                    <input
                      type="number"
                      id="edit-minStockLevel"
                      name="minStockLevel"
                      className="form-input"
                      value={formData.minStockLevel}
                      onChange={handleFormChange}
                      min="0"
                    />
                    {formErrors.minStockLevel && <span className="form-error">{formErrors.minStockLevel}</span>}
                  </div>
                  <div className="form-group">
                    <label htmlFor="edit-location">Localização no Depósito</label>
                    <input
                      type="text"
                      id="edit-location"
                      name="location"
                      className="form-input"
                      value={formData.location}
                      onChange={handleFormChange}
                      placeholder="Ex: A-3-2 (Corredor-Estante-Nível)"
                    />
                    <small style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '0.25rem', display: 'block' }}>
                      Use o formato <strong>Corredor-Estante-Nível</strong> (ex: <code>A-3-2</code>) para mapeamento visual.
                    </small>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsEditModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Completion Modal */}
      {isTaskModalOpen && selectedTask && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Realizar Conferência de Estoque</h3>
              <button className="modal-close" onClick={() => setIsTaskModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleTaskSubmit}>
              <div className="modal-body">
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                  Conferindo: <strong>{selectedTask.name_produto}</strong> ({selectedTask.sku_produto})
                  <br />
                  Tipo de conferência: <strong>{selectedTask.tipo_tarefa === 'CONFERENCIA_SALDO' ? 'Conferência de Saldo' : 'Contagem Rotativa'}</strong>.
                </p>

                <div className="form-group">
                  <label>Quantidade Esperada no Sistema</label>
                  <input
                    type="number"
                    className="form-input"
                    value={selectedTask.quantidade_esperada}
                    disabled
                    style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)' }}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="quantidade_conferida">Quantidade Conferida (Física) <span style={{ color: 'var(--accent, #3b82f6)' }}>*</span></label>
                  <input
                    type="number"
                    id="quantidade_conferida"
                    name="quantidade_conferida"
                    className="form-input"
                    value={taskFormData.quantidade_conferida}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setTaskFormData(prev => ({ ...prev, quantidade_conferida: val }));
                      if (taskErrors.quantidade_conferida) {
                        setTaskErrors(prev => {
                          const copy = { ...prev };
                          delete copy.quantidade_conferida;
                          return copy;
                        });
                      }
                    }}
                    min="0"
                    required
                  />
                  {taskErrors.quantidade_conferida && <span className="form-error">{taskErrors.quantidade_conferida}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="task-observacao">Observação / Divergência (Opcional)</label>
                  <textarea
                    id="task-observacao"
                    name="observacao"
                    className="form-input"
                    style={{ minHeight: '80px', resize: 'vertical', fontFamily: 'inherit', padding: '0.55rem' }}
                    value={taskFormData.observacao}
                    onChange={(e) => setTaskFormData(prev => ({ ...prev, observacao: e.target.value }))}
                    placeholder="Descreva o motivo da divergência caso encontre alguma diferença..."
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsTaskModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: 'var(--accent)' }}>
                  Confirmar Contagem
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && selectedItem && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Remover Produto</h3>
              <button className="modal-close" onClick={() => setIsDeleteModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ padding: '1.5rem 2rem' }}>
              <p style={{ color: 'var(--text-primary)', marginBottom: '0.5rem', fontWeight: 500 }}>
                Tem certeza que deseja deletar este produto?
              </p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Item: <strong>{selectedItem.name}</strong> ({selectedItem.sku}) será permanentemente removido.
              </p>
            </div>
            <div className="modal-footer" style={{ padding: '1rem 2rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsDeleteModalOpen(false)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-danger" onClick={handleDeleteConfirm}>
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Confirmation Modal */}
      {isRestoreModalOpen && backupToRestore && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: 'var(--warning)' }}>Confirmar Restauração de Backup</h3>
              <button className="modal-close" onClick={() => { setIsRestoreModalOpen(false); setBackupToRestore(null); }}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ padding: '1.5rem 2rem' }}>
              <p style={{ color: 'var(--text-primary)', marginBottom: '0.75rem', fontWeight: 600 }}>
                Tem certeza que deseja restaurar o banco de dados do WMS?
              </p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: '1.5', marginBottom: '1rem' }}>
                Você está prestes a restaurar o arquivo: <strong style={{ color: 'var(--text-primary)' }}>{backupToRestore}</strong>.
              </p>
              <div 
                style={{ 
                  backgroundColor: 'rgba(245, 158, 11, 0.08)', 
                  border: '1px solid rgba(245, 158, 11, 0.2)', 
                  padding: '0.75rem 1rem', 
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  gap: '0.50rem',
                  alignItems: 'flex-start'
                }}
              >
                <Warning size={20} color="var(--warning)" weight="bold" style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                <span style={{ fontSize: '0.78rem', color: 'var(--warning)', lineHeight: '1.4' }}>
                  <strong>ATENÇÃO:</strong> Esta operação é irreversível. Todos os dados atuais de produtos, fornecedores, movimentações, tarefas de auditoria e usuários serão <strong>completamente apagados</strong> e substituídos pelas informações contidas no backup.
                </span>
              </div>
            </div>
            <div className="modal-footer" style={{ padding: '1rem 2rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => { setIsRestoreModalOpen(false); setBackupToRestore(null); }}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary" style={{ background: 'var(--warning)', borderColor: 'var(--warning)' }} onClick={handleRestoreBackup}>
                Confirmar e Restaurar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            <span className="toast-icon">
              {toast.type === 'success' ? (
                <CheckCircle size={18} color="var(--success)" />
              ) : (
                <WarningCircle size={18} color="var(--danger)" />
              )}
            </span>
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
      {/* Developer Watermark */}
      <div className={`developer-watermark ${currentUser ? 'logged-in' : ''}`}>
        <span style={{ color: 'var(--accent)', fontWeight: 'bold', marginRight: '0.4rem' }}>&lt;/&gt;</span>
        DESENVOLVIDO POR <strong style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>BERNARDO RODRIGUES</strong>
      </div>
    </div>
  );
}

export default App;
