import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  LayoutDashboard,
  Receipt,
  CreditCard as CreditCardIcon,
  Target,
  Plane,
  ShoppingBag,
  Bot,
  History,
  Compass,
  Sliders,
  AlertTriangle,
  Plus,
  Trash2,
  Edit2,
  TrendingUp,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Send,
  RefreshCw,
  Wallet,
  ShieldAlert,
  Activity,
  Layers,
  ChevronRight,
  PieChart as PieChartIcon
} from 'lucide-react';

// ==========================================
// TYPESCRIPT INTERFACES
// ==========================================

export type TabType =
  | 'dashboard'
  | 'transactions'
  | 'cards'
  | 'goals'
  | 'trips'
  | 'purchases'
  | 'copilot'
  | 'timemachine'
  | 'multiverse'
  | 'sandbox'
  | 'crashtest';

export interface Transaction {
  id: string;
  title: string;
  amount: number;
  type: 'income' | 'expense';
  category: 'electronics' | 'dining' | 'travel' | 'shopping' | 'groceries' | 'general' | 'salary' | 'utilities' | 'entertainment';
  date: string;
  paymentMethod: 'cash' | 'card';
  cardId?: string;
}

export interface CreditCard {
  id: string;
  name: string;
  bank: string;
  creditLimit: number;
  currentBalance: number;
  defaultRewardRate: number;
  categoryRewardRates: Record<string, number>;
}

export interface Goal {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string; // YYYY-MM
  category: string;
}

export interface Trip {
  id: string;
  title: string;
  budget: number;
  currentSavings: number;
  targetDate: string; // YYYY-MM
}

export interface PlannedPurchase {
  id: string;
  title: string;
  price: number;
  currentSavings: number;
  category: string;
}

export interface FinancialState {
  liquidCash: number;
  investments: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  transactions: Transaction[];
  cards: CreditCard[];
  goals: Goal[];
  trips: Trip[];
  purchases: PlannedPurchase[];
}

// ==========================================
// INITIAL STATE & LOCALSTORAGE
// ==========================================

const INITIAL_STATE: FinancialState = {
  liquidCash: 145000,
  investments: 650000,
  monthlyIncome: 120000,
  monthlyExpenses: 45000,
  transactions: [
    { id: 't1', title: 'Monthly Salary', amount: 120000, type: 'income', category: 'salary', date: '2026-09-01', paymentMethod: 'cash' },
    { id: 't2', title: 'MacBook Pro M3', amount: 145000, type: 'expense', category: 'electronics', date: '2026-09-05', paymentMethod: 'card', cardId: 'c1' },
    { id: 't3', title: 'Supermarket Groceries', amount: 6500, type: 'expense', category: 'groceries', date: '2026-09-10', paymentMethod: 'cash' },
    { id: 't4', title: 'Fine Dining', amount: 4200, type: 'expense', category: 'dining', date: '2026-09-12', paymentMethod: 'card', cardId: 'c2' }
  ],
  cards: [
    {
      id: 'c1',
      name: 'Regalia Gold',
      bank: 'HDFC',
      creditLimit: 300000,
      currentBalance: 145000,
      defaultRewardRate: 0.015,
      categoryRewardRates: { electronics: 0.033, travel: 0.04, shopping: 0.02 }
    },
    {
      id: 'c2',
      name: 'Amazon Pay',
      bank: 'ICICI',
      creditLimit: 200000,
      currentBalance: 4200,
      defaultRewardRate: 0.01,
      categoryRewardRates: { shopping: 0.05, groceries: 0.02, dining: 0.02 }
    },
    {
      id: 'c3',
      name: 'Atlas Credit Card',
      bank: 'Axis',
      creditLimit: 400000,
      currentBalance: 0,
      defaultRewardRate: 0.02,
      categoryRewardRates: { travel: 0.05, dining: 0.03 }
    }
  ],
  goals: [
    { id: 'g1', title: 'Emergency Fund', targetAmount: 300000, currentAmount: 180000, deadline: '2027-06', category: 'Safety' },
    { id: 'g2', title: 'New Car Down Payment', targetAmount: 250000, currentAmount: 90000, deadline: '2027-12', category: 'Asset' }
  ],
  trips: [
    { id: 'tr1', title: 'Japan Vacation', budget: 250000, currentSavings: 85000, targetDate: '2027-10' },
    { id: 'tr2', title: 'Goa Weekend', budget: 40000, currentSavings: 25000, targetDate: '2026-12' }
  ],
  purchases: [
    { id: 'p1', title: 'Sony WH-1000XM5', price: 29999, currentSavings: 15000, category: 'electronics' },
    { id: 'p2', title: 'Ergonomic Office Chair', price: 22000, currentSavings: 8000, category: 'furniture' }
  ]
};

const STORAGE_KEY = 'fintwin_state_v2';


// ==========================================
// SHARED FINANCIAL ENGINE HELPERS
// ==========================================

const DEFAULT_MARKET_CRASH_PCT = 30;
const DEFAULT_INFLATION_PCT = 10;
const DEFAULT_MEDICAL_EXPENSE = 200000;
const DEFAULT_COPILOT_ANNUAL_RETURN = 12;

function isValidYearMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function monthsUntil(target: string, from = new Date()): number {
  if (!isValidYearMonth(target)) return 0;
  const [year, month] = target.split('-').map(Number);
  return Math.max(1, (year - from.getFullYear()) * 12 + (month - (from.getMonth() + 1)));
}

function requiredMonthlyForGoal(goal: Goal, from = new Date()): number {
  if (goal.currentAmount >= goal.targetAmount) return 0;
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  return remaining / monthsUntil(goal.deadline, from);
}

function requiredMonthlyForTrip(trip: Trip, from = new Date()): number {
  if (trip.currentSavings >= trip.budget) return 0;
  const remaining = Math.max(0, trip.budget - trip.currentSavings);
  return remaining / monthsUntil(trip.targetDate, from);
}

function totalGoalRequiredMonthly(state: FinancialState, from = new Date()): number {
  return state.goals.reduce((sum, goal) => sum + requiredMonthlyForGoal(goal, from), 0);
}

function totalTripRequiredMonthly(state: FinancialState, from = new Date()): number {
  return state.trips.reduce((sum, trip) => sum + requiredMonthlyForTrip(trip, from), 0);
}

function effectiveMonthlyRateFromAnnual(annualPercent: number): number {
  return Math.pow(1 + annualPercent / 100, 1 / 12) - 1;
}

function projectInvestments(
  initialInvestment: number,
  monthlyContribution: number,
  months: number,
  annualReturnPercent: number
): number {
  const monthlyRate = effectiveMonthlyRateFromAnnual(annualReturnPercent);
  let value = Math.max(0, initialInvestment);
  for (let i = 0; i < Math.max(0, months); i++) {
    value = value * (1 + monthlyRate) + monthlyContribution;
  }
  return value;
}

function loadState(): FinancialState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_STATE;
    const parsed = JSON.parse(raw);
    return {
      liquidCash: typeof parsed.liquidCash === 'number' ? parsed.liquidCash : INITIAL_STATE.liquidCash,
      investments: typeof parsed.investments === 'number' ? parsed.investments : INITIAL_STATE.investments,
      monthlyIncome: typeof parsed.monthlyIncome === 'number' ? parsed.monthlyIncome : INITIAL_STATE.monthlyIncome,
      monthlyExpenses: typeof parsed.monthlyExpenses === 'number' ? parsed.monthlyExpenses : INITIAL_STATE.monthlyExpenses,
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : INITIAL_STATE.transactions,
      cards: Array.isArray(parsed.cards) ? parsed.cards : INITIAL_STATE.cards,
      goals: Array.isArray(parsed.goals) ? parsed.goals : INITIAL_STATE.goals,
      trips: Array.isArray(parsed.trips) ? parsed.trips : INITIAL_STATE.trips,
      purchases: Array.isArray(parsed.purchases) ? parsed.purchases : INITIAL_STATE.purchases,
    };
  } catch {
    return INITIAL_STATE;
  }
}

// ==========================================
// MAIN COMPONENT
// ==========================================

export default function FinTwinApp() {
  const [state, setState] = useState<FinancialState>(loadState);
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save state to localStorage', e);
    }
  }, [state]);

  const monthlySurplus = useMemo(() => {
    return state.monthlyIncome - state.monthlyExpenses;
  }, [state.monthlyIncome, state.monthlyExpenses]);

  // Transaction mutation helpers with proper state accounting
  const addTransaction = (txData: Omit<Transaction, 'id'>) => {
    const newTx: Transaction = { ...txData, id: 'tx_' + Date.now() };
    setState(prev => {
      let cash = prev.liquidCash;
      let cards = [...prev.cards];
      if (newTx.type === 'income') {
        cash += newTx.amount;
      } else {
        if (newTx.paymentMethod === 'cash') {
          cash -= newTx.amount;
        } else if (newTx.paymentMethod === 'card' && newTx.cardId) {
          cards = cards.map(c => c.id === newTx.cardId ? { ...c, currentBalance: c.currentBalance + newTx.amount } : c);
        }
      }
      return {
        ...prev,
        liquidCash: cash,
        cards,
        transactions: [newTx, ...prev.transactions]
      };
    });
  };

  const updateTransaction = (id: string, updatedData: Omit<Transaction, 'id'>) => {
    setState(prev => {
      const oldTx = prev.transactions.find(t => t.id === id);
      if (!oldTx) return prev;

      // 1. Reverse old effect
      let cash = prev.liquidCash;
      let cards = [...prev.cards];

      if (oldTx.type === 'income') {
        cash -= oldTx.amount;
      } else {
        if (oldTx.paymentMethod === 'cash') {
          cash += oldTx.amount;
        } else if (oldTx.paymentMethod === 'card' && oldTx.cardId) {
          cards = cards.map(c => c.id === oldTx.cardId ? { ...c, currentBalance: Math.max(0, c.currentBalance - oldTx.amount) } : c);
        }
      }

      // 2. Apply new effect
      const newTx: Transaction = { ...updatedData, id };
      if (newTx.type === 'income') {
        cash += newTx.amount;
      } else {
        if (newTx.paymentMethod === 'cash') {
          cash -= newTx.amount;
        } else if (newTx.paymentMethod === 'card' && newTx.cardId) {
          cards = cards.map(c => c.id === newTx.cardId ? { ...c, currentBalance: c.currentBalance + newTx.amount } : c);
        }
      }

      return {
        ...prev,
        liquidCash: cash,
        cards,
        transactions: prev.transactions.map(t => t.id === id ? newTx : t)
      };
    });
  };

  const deleteTransaction = (id: string) => {
    setState(prev => {
      const oldTx = prev.transactions.find(t => t.id === id);
      if (!oldTx) return prev;

      let cash = prev.liquidCash;
      let cards = [...prev.cards];

      if (oldTx.type === 'income') {
        cash -= oldTx.amount;
      } else {
        if (oldTx.paymentMethod === 'cash') {
          cash += oldTx.amount;
        } else if (oldTx.paymentMethod === 'card' && oldTx.cardId) {
          cards = cards.map(c => c.id === oldTx.cardId ? { ...c, currentBalance: Math.max(0, c.currentBalance - oldTx.amount) } : c);
        }
      }

      return {
        ...prev,
        liquidCash: cash,
        cards,
        transactions: prev.transactions.filter(t => t.id !== id)
      };
    });
  };

  // CRUD for Cards
  const addCard = (card: Omit<CreditCard, 'id'>) => {
    const newCard = { ...card, id: 'card_' + Date.now() };
    setState(prev => ({ ...prev, cards: [...prev.cards, newCard] }));
  };
  const updateCard = (id: string, card: Omit<CreditCard, 'id'>) => {
    setState(prev => ({ ...prev, cards: prev.cards.map(c => c.id === id ? { ...card, id } : c) }));
  };
  const deleteCard = (id: string) => {
    setState(prev => ({ ...prev, cards: prev.cards.filter(c => c.id !== id) }));
  };

  // CRUD for Goals
  const addGoal = (g: Omit<Goal, 'id'>) => {
    const newG = { ...g, id: 'goal_' + Date.now() };
    setState(prev => ({ ...prev, goals: [...prev.goals, newG] }));
  };
  const updateGoal = (id: string, g: Omit<Goal, 'id'>) => {
    setState(prev => ({ ...prev, goals: prev.goals.map(item => item.id === id ? { ...g, id } : item) }));
  };
  const deleteGoal = (id: string) => {
    setState(prev => ({ ...prev, goals: prev.goals.filter(item => item.id !== id) }));
  };

  // CRUD for Trips
  const addTrip = (t: Omit<Trip, 'id'>) => {
    const newT = { ...t, id: 'trip_' + Date.now() };
    setState(prev => ({ ...prev, trips: [...prev.trips, newT] }));
  };
  const updateTrip = (id: string, t: Omit<Trip, 'id'>) => {
    setState(prev => ({ ...prev, trips: prev.trips.map(item => item.id === id ? { ...t, id } : item) }));
  };
  const deleteTrip = (id: string) => {
    setState(prev => ({ ...prev, trips: prev.trips.filter(item => item.id !== id) }));
  };

  // CRUD for Purchases
  const addPurchase = (p: Omit<PlannedPurchase, 'id'>) => {
    const newP = { ...p, id: 'pur_' + Date.now() };
    setState(prev => ({ ...prev, purchases: [...prev.purchases, newP] }));
  };
  const updatePurchase = (id: string, p: Omit<PlannedPurchase, 'id'>) => {
    setState(prev => ({ ...prev, purchases: prev.purchases.map(item => item.id === id ? { ...p, id } : item) }));
  };
  const deletePurchase = (id: string) => {
    setState(prev => ({ ...prev, purchases: prev.purchases.filter(item => item.id !== id) }));
  };

  return (
    <div className="flex h-screen bg-[#0A0E17] text-slate-100 font-sans overflow-hidden">
      {/* SIDEBAR NAVIGATION */}
      <aside className="w-64 bg-[#0D1322] border-r border-cyan-500/10 flex flex-col justify-between shrink-0">
        <div>
          <div className="p-6 flex items-center gap-3 border-b border-cyan-500/10">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-wider bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">FIN<span className="text-white">TWIN</span></h1>
              <p className="text-xs text-cyan-400/60 font-mono">AI FINANCIAL ENGINE</p>
            </div>
          </div>

          <nav className="p-4 space-y-1.5 overflow-y-auto max-h-[calc(100vh-100px)]">
            <NavItem icon={<LayoutDashboard />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
            <NavItem icon={<Receipt />} label="Transactions" active={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')} />
            <NavItem icon={<CreditCardIcon />} label="Credit Cards" active={activeTab === 'cards'} onClick={() => setActiveTab('cards')} />
            <NavItem icon={<Target />} label="Financial Goals" active={activeTab === 'goals'} onClick={() => setActiveTab('goals')} />
            <NavItem icon={<Plane />} label="Trip Planner" active={activeTab === 'trips'} onClick={() => setActiveTab('trips')} />
            <NavItem icon={<ShoppingBag />} label="Planned Purchases" active={activeTab === 'purchases'} onClick={() => setActiveTab('purchases')} />
            <NavItem icon={<Bot />} label="AI Copilot" active={activeTab === 'copilot'} onClick={() => setActiveTab('copilot')} />
            <NavItem icon={<History />} label="Time Machine" active={activeTab === 'timemachine'} onClick={() => setActiveTab('timemachine')} />
            <NavItem icon={<Compass />} label="Financial Multiverse" active={activeTab === 'multiverse'} onClick={() => setActiveTab('multiverse')} />
            <NavItem icon={<Sliders />} label="Decision Sandbox" active={activeTab === 'sandbox'} onClick={() => setActiveTab('sandbox')} />
            <NavItem icon={<AlertTriangle />} label="Crash Test Lab" active={activeTab === 'crashtest'} onClick={() => setActiveTab('crashtest')} />
          </nav>
        </div>

        <div className="p-4 border-t border-cyan-500/10 bg-[#0A0E17]/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold text-sm">
              U
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium truncate">Live Portfolio</p>
              <p className="text-xs text-cyan-400/70 font-mono">₹{(state.liquidCash + state.investments).toLocaleString('en-IN')}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto bg-[#070A10] p-8">
        {activeTab === 'dashboard' && <DashboardView state={state} monthlySurplus={monthlySurplus} setActiveTab={setActiveTab} />}
        {activeTab === 'transactions' && <TransactionsView state={state} onAdd={addTransaction} onEdit={updateTransaction} onDelete={deleteTransaction} />}
        {activeTab === 'cards' && <CreditCardsView state={state} onAdd={addCard} onEdit={updateCard} onDelete={deleteCard} />}
        {activeTab === 'goals' && <GoalsView state={state} monthlySurplus={monthlySurplus} onAdd={addGoal} onEdit={updateGoal} onDelete={deleteGoal} />}
        {activeTab === 'trips' && <TripsView state={state} monthlySurplus={monthlySurplus} onAdd={addTrip} onEdit={updateTrip} onDelete={deleteTrip} />}
        {activeTab === 'purchases' && <PurchasesView state={state} monthlySurplus={monthlySurplus} onAdd={addPurchase} onEdit={updatePurchase} onDelete={deletePurchase} />}
        {activeTab === 'copilot' && <CopilotView state={state} monthlySurplus={monthlySurplus} />}
        {activeTab === 'timemachine' && <TimeMachineView state={state} />}
        {activeTab === 'multiverse' && <MultiverseView state={state} />}
        {activeTab === 'sandbox' && <SandboxView state={state} />}
        {activeTab === 'crashtest' && <CrashTestView state={state} />}
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
        active
          ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/10 text-cyan-400 border border-cyan-500/30 shadow-lg shadow-cyan-500/5'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
      }`}
    >
      <span className={`${active ? 'text-cyan-400' : 'text-slate-400'} w-5 h-5 flex items-center justify-center`}>
        {icon}
      </span>
      {label}
    </button>
  );
}

// ==========================================
// 1. DASHBOARD VIEW
// ==========================================

function DashboardView({ state, monthlySurplus, setActiveTab }: { state: FinancialState; monthlySurplus: number; setActiveTab: (t: TabType) => void }) {
  const totalNetWorth = state.liquidCash + state.investments;
  const totalCreditLimit = state.cards.reduce((acc, c) => acc + c.creditLimit, 0);
  const totalCreditUsed = state.cards.reduce((acc, c) => acc + c.currentBalance, 0);
  const creditUtilization = totalCreditLimit > 0 ? (totalCreditUsed / totalCreditLimit) * 100 : 0;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center bg-[#0D1322] p-6 rounded-2xl border border-cyan-500/10 shadow-xl">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">Financial Command Center</h2>
          <p className="text-sm text-cyan-400/70 font-mono mt-1">Real-time portfolio intelligence & engine metrics</p>
        </div>
        <button
          onClick={() => setActiveTab('copilot')}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 font-semibold text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 transition-all flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4" /> Ask AI Copilot
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard title="Total Net Worth" value={`₹${totalNetWorth.toLocaleString('en-IN')}`} icon={<Wallet className="text-cyan-400" />} change="+Live" positive />
        <MetricCard title="Liquid Cash" value={`₹${state.liquidCash.toLocaleString('en-IN')}`} icon={<DollarSign className="text-emerald-400" />} change="Available" positive />
        <MetricCard title="Investments" value={`₹${state.investments.toLocaleString('en-IN')}`} icon={<TrendingUp className="text-blue-400" />} change="Compounding" positive />
        <MetricCard title="Monthly Surplus" value={`₹${monthlySurplus.toLocaleString('en-IN')}`} icon={<Activity className="text-amber-400" />} change={monthlySurplus >= 0 ? 'Positive' : 'Deficit'} positive={monthlySurplus >= 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#0D1322] border border-cyan-500/10 rounded-2xl p-6 shadow-xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-white">Recent Transactions</h3>
            <button onClick={() => setActiveTab('transactions')} className="text-xs text-cyan-400 hover:underline flex items-center gap-1">
              View All <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-3">
            {state.transactions.slice(0, 5).map(tx => (
              <div key={tx.id} className="flex items-center justify-between p-3.5 rounded-xl bg-[#080C14] border border-slate-800/60">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tx.type === 'income' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                    {tx.type === 'income' ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="font-medium text-sm text-white">{tx.title}</p>
                    <p className="text-xs text-slate-400">{tx.date} • <span className="uppercase text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-cyan-300">{tx.category}</span></p>
                  </div>
                </div>
                <span className={`font-mono font-semibold text-sm ${tx.type === 'income' ? 'text-emerald-400' : 'text-slate-200'}`}>
                  {tx.type === 'income' ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN')}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#0D1322] border border-cyan-500/10 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Credit Utilization</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-400">Total Utilized</span>
                  <span className="font-mono text-cyan-400">₹{totalCreditUsed.toLocaleString()} / ₹{totalCreditLimit.toLocaleString()}</span>
                </div>
                <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-cyan-500 to-blue-600 h-full rounded-full" style={{ width: `${Math.min(100, creditUtilization)}%` }}></div>
                </div>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Keeping credit utilization below 30% optimizes your credit score. Current utilization is <span className="text-cyan-400 font-mono">{creditUtilization.toFixed(1)}%</span>.
              </p>
            </div>
          </div>
          <div className="pt-6 border-t border-slate-800/80">
            <button onClick={() => setActiveTab('cards')} className="w-full py-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-cyan-400 text-sm font-medium border border-cyan-500/20 transition-all flex items-center justify-center gap-2">
              <CreditCardIcon className="w-4 h-4" /> Manage Cards & Rewards
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon, change, positive }: { title: string; value: string; icon: React.ReactNode; change: string; positive: boolean }) {
  return (
    <div className="bg-[#0D1322] border border-cyan-500/10 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
      <div className="flex justify-between items-start">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{title}</span>
        <div className="p-2 rounded-xl bg-slate-800/50 border border-slate-700/50">{icon}</div>
      </div>
      <div className="mt-4">
        <h4 className="text-2xl font-bold font-mono tracking-tight text-white">{value}</h4>
        <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded font-mono ${positive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
          {change}
        </span>
      </div>
    </div>
  );
}

// ==========================================
// 2. TRANSACTIONS VIEW
// ==========================================

function TransactionsView({
  state,
  onAdd,
  onEdit,
  onDelete
}: {
  state: FinancialState;
  onAdd: (tx: Omit<Transaction, 'id'>) => void;
  onEdit: (id: string, tx: Omit<Transaction, 'id'>) => void;
  onDelete: (id: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [category, setCategory] = useState<Transaction['category']>('general');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [cardId, setCardId] = useState(state.cards[0]?.id || '');

  const openAddModal = () => {
    setEditingId(null);
    setTitle('');
    setAmount('');
    setType('expense');
    setCategory('general');
    setDate(new Date().toISOString().split('T')[0]);
    setPaymentMethod('cash');
    setCardId(state.cards[0]?.id || '');
    setIsOpen(true);
  };

  const openEditModal = (tx: Transaction) => {
    setEditingId(tx.id);
    setTitle(tx.title);
    setAmount(tx.amount.toString());
    setType(tx.type);
    setCategory(tx.category);
    setDate(tx.date);
    setPaymentMethod(tx.paymentMethod);
    setCardId(tx.cardId || state.cards[0]?.id || '');
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!title || isNaN(numAmount) || numAmount <= 0) return;

    const data = {
      title,
      amount: numAmount,
      type,
      category,
      date,
      paymentMethod,
      cardId: paymentMethod === 'card' ? cardId : undefined
    };

    if (editingId) {
      onEdit(editingId, data);
    } else {
      onAdd(data);
    }
    setIsOpen(false);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center bg-[#0D1322] p-6 rounded-2xl border border-cyan-500/10 shadow-xl">
        <div>
          <h2 className="text-2xl font-bold text-white">Transactions Ledger</h2>
          <p className="text-sm text-cyan-400/70 font-mono mt-1">Full CRUD with automatic liquid cash & credit card accounting</p>
        </div>
        <button
          onClick={openAddModal}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 font-semibold text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 transition-all flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" /> Add Transaction
        </button>
      </div>

      <div className="bg-[#0D1322] border border-cyan-500/10 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-xs font-mono text-cyan-400/70 bg-[#080C14]">
                <th className="p-4">Title & Category</th>
                <th className="p-4">Date</th>
                <th className="p-4">Payment Method</th>
                <th className="p-4">Type</th>
                <th className="p-4 text-right">Amount</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm">
              {state.transactions.map(tx => {
                const card = state.cards.find(c => c.id === tx.cardId);
                return (
                  <tr key={tx.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="p-4">
                      <p className="font-semibold text-white">{tx.title}</p>
                      <span className="text-xs uppercase px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono">{tx.category}</span>
                    </td>
                    <td className="p-4 font-mono text-slate-300">{tx.date}</td>
                    <td className="p-4">
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-800/80 text-slate-300 border border-slate-700">
                        {tx.paymentMethod === 'card' ? `Card (${card?.name || 'Unknown'})` : 'Cash'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1 font-semibold text-xs px-2.5 py-1 rounded-full ${tx.type === 'income' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                        {tx.type === 'income' ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                        {tx.type}
                      </span>
                    </td>
                    <td className={`p-4 text-right font-mono font-bold ${tx.type === 'income' ? 'text-emerald-400' : 'text-slate-100'}`}>
                      {tx.type === 'income' ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => openEditModal(tx)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => onDelete(tx.id)} className="p-2 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-rose-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#0D1322] border border-cyan-500/20 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-6">
            <h3 className="text-xl font-bold text-white">{editingId ? 'Edit Transaction' : 'Add Transaction'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-cyan-400/80 mb-1">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  required
                  className="w-full bg-[#080C14] border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500 font-medium text-sm"
                  placeholder="e.g. Grocery Run"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-cyan-400/80 mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    required
                    min="1"
                    className="w-full bg-[#080C14] border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500 font-mono text-sm"
                    placeholder="5000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-cyan-400/80 mb-1">Type</label>
                  <select
                    value={type}
                    onChange={e => setType(e.target.value as any)}
                    className="w-full bg-[#080C14] border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500 text-sm"
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-cyan-400/80 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as any)}
                    className="w-full bg-[#080C14] border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500 text-sm"
                  >
                    <option value="general">General</option>
                    <option value="electronics">Electronics</option>
                    <option value="dining">Dining</option>
                    <option value="travel">Travel</option>
                    <option value="shopping">Shopping</option>
                    <option value="groceries">Groceries</option>
                    <option value="salary">Salary</option>
                    <option value="utilities">Utilities</option>
                    <option value="entertainment">Entertainment</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-mono text-cyan-400/80 mb-1">Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    required
                    className="w-full bg-[#080C14] border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500 text-sm"
                  />
                </div>
              </div>

              {type === 'expense' && (
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-800">
                  <div>
                    <label className="block text-xs font-mono text-cyan-400/80 mb-1">Payment Method</label>
                    <select
                      value={paymentMethod}
                      onChange={e => setPaymentMethod(e.target.value as any)}
                      className="w-full bg-[#080C14] border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500 text-sm"
                    >
                      <option value="cash">Liquid Cash</option>
                      <option value="card">Credit Card</option>
                    </select>
                  </div>
                  {paymentMethod === 'card' && (
                    <div>
                      <label className="block text-xs font-mono text-cyan-400/80 mb-1">Select Card</label>
                      <select
                        value={cardId}
                        onChange={e => setCardId(e.target.value)}
                        className="w-full bg-[#080C14] border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500 text-sm"
                      >
                        {state.cards.map(c => (
                          <option key={c.id} value={c.id}>{c.name} ({c.bank})</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-sm shadow-lg shadow-cyan-500/20"
                >
                  {editingId ? 'Save Changes' : 'Add Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 3. CREDIT CARDS VIEW & DYNAMIC RECOMMENDATIONS
// ==========================================

function CreditCardsView({
  state,
  onAdd,
  onEdit,
  onDelete
}: {
  state: FinancialState;
  onAdd: (c: Omit<CreditCard, 'id'>) => void;
  onEdit: (id: string, c: Omit<CreditCard, 'id'>) => void;
  onDelete: (id: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [bank, setBank] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [currentBalance, setCurrentBalance] = useState('');
  const [defaultRewardRate, setDefaultRewardRate] = useState('0.01');
  const [catRatesStr, setCatRatesStr] = useState('electronics: 0.03, travel: 0.04');

  // Recommendation Sandbox State
  const [simAmount, setSimAmount] = useState('50000');
  const [simCategory, setSimCategory] = useState('electronics');

  const openAddModal = () => {
    setEditingId(null);
    setName('');
    setBank('');
    setCreditLimit('');
    setCurrentBalance('');
    setDefaultRewardRate('0.01');
    setCatRatesStr('electronics: 0.03, travel: 0.04');
    setIsOpen(true);
  };

  const openEditModal = (c: CreditCard) => {
    setEditingId(c.id);
    setName(c.name);
    setBank(c.bank);
    setCreditLimit(c.creditLimit.toString());
    setCurrentBalance(c.currentBalance.toString());
    setDefaultRewardRate(c.defaultRewardRate.toString());
    const str = Object.entries(c.categoryRewardRates).map(([k, v]) => `${k}: ${v}`).join(', ');
    setCatRatesStr(str);
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const limitNum = parseFloat(creditLimit);
    const balNum = parseFloat(currentBalance);
    const defRate = parseFloat(defaultRewardRate);
    if (!name || !bank || !Number.isFinite(limitNum) || limitNum <= 0) return;
    const safeBalance = Number.isFinite(balNum) ? balNum : 0;
    const safeDefaultRate = Number.isFinite(defRate) ? defRate : 0.01;
    if (safeBalance < 0 || safeBalance > limitNum || safeDefaultRate < 0) return;

    const categoryRewardRates: Record<string, number> = {};
    catRatesStr.split(',').forEach(pair => {
      const parts = pair.split(':');
      if (parts.length === 2) {
        const k = parts[0].trim().toLowerCase();
        const v = parseFloat(parts[1]);
        if (k && Number.isFinite(v) && v >= 0) categoryRewardRates[k] = v;
      }
    });

    const data = {
      name,
      bank,
      creditLimit: limitNum,
      currentBalance: safeBalance,
      defaultRewardRate: safeDefaultRate,
      categoryRewardRates
    };

    if (editingId) {
      onEdit(editingId, data);
    } else {
      onAdd(data);
    }
    setIsOpen(false);
  };

  // Dynamic Card Recommendation Engine
  const purchaseAmountNum = parseFloat(simAmount) || 0;
  const evaluatedCards = useMemo(() => {
    return state.cards.map(card => {
      const availableCredit = card.creditLimit - card.currentBalance;
      const isEligible = availableCredit >= purchaseAmountNum;
      const categoryRate = card.categoryRewardRates[simCategory] !== undefined
        ? card.categoryRewardRates[simCategory]
        : card.defaultRewardRate;
      const reward = purchaseAmountNum * categoryRate;
      const newBalance = card.currentBalance + purchaseAmountNum;
      const utilizationAfter = (newBalance / card.creditLimit) * 100;

      return {
        card,
        availableCredit,
        isEligible,
        categoryRate,
        reward,
        utilizationAfter
      };
    }).sort((a, b) => {
      if (a.isEligible && !b.isEligible) return -1;
      if (!a.isEligible && b.isEligible) return 1;
      return b.reward - a.reward;
    });
  }, [state.cards, purchaseAmountNum, simCategory]);

  const bestEligible = evaluatedCards.find(e => e.isEligible);

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center bg-[#0D1322] p-6 rounded-2xl border border-cyan-500/10 shadow-xl">
        <div>
          <h2 className="text-2xl font-bold text-white">Credit Cards & Rewards Engine</h2>
          <p className="text-sm text-cyan-400/70 font-mono mt-1">Dynamic reward optimization & eligibility analysis</p>
        </div>
        <button
          onClick={openAddModal}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 font-semibold text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 transition-all flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" /> Add Credit Card
        </button>
      </div>

      {/* Interactive Recommendation Widget */}
      <div className="bg-[#0D1322] border border-cyan-500/20 rounded-2xl p-6 shadow-2xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Smart Card Selector Simulation</h3>
            <p className="text-xs text-slate-400">Test any purchase category and amount to find the highest-earning eligible card.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#080C14] p-5 rounded-xl border border-slate-800">
          <div>
            <label className="block text-xs font-mono text-cyan-400 mb-1">Purchase Amount (₹)</label>
            <input
              type="number"
              value={simAmount}
              onChange={e => setSimAmount(e.target.value)}
              className="w-full bg-[#0D1322] border border-slate-700 rounded-xl px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-cyan-400 mb-1">Category</label>
            <select
              value={simCategory}
              onChange={e => setSimCategory(e.target.value)}
              className="w-full bg-[#0D1322] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500"
            >
              <option value="electronics">Electronics</option>
              <option value="travel">Travel</option>
              <option value="shopping">Shopping</option>
              <option value="dining">Dining</option>
              <option value="groceries">Groceries</option>
              <option value="general">General</option>
            </select>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-slate-300 mb-3">Recommendation Results:</h4>
          {evaluatedCards.length === 0 ? (
            <p className="text-sm text-slate-400">No credit cards added yet.</p>
          ) : !bestEligible ? (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm font-medium">
              ⚠️ No card has sufficient available credit (₹{purchaseAmountNum.toLocaleString()}) for this purchase!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {evaluatedCards.map((item, idx) => {
                const isBest = idx === 0 && item.isEligible;
                return (
                  <div key={item.card.id} className={`p-5 rounded-2xl border flex flex-col justify-between ${isBest ? 'bg-gradient-to-br from-cyan-500/10 to-blue-600/10 border-cyan-500/50 shadow-lg shadow-cyan-500/10' : 'bg-[#080C14] border-slate-800'}`}>
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-xs font-mono text-cyan-400">{item.card.bank}</p>
                          <h5 className="font-bold text-white text-base">{item.card.name}</h5>
                        </div>
                        {isBest && (
                          <span className="px-2 py-0.5 rounded-full bg-cyan-500 text-black text-[10px] font-bold uppercase tracking-wider">
                            Best Choice
                          </span>
                        )}
                      </div>
                      <div className="space-y-1.5 mt-4 text-xs">
                        <div className="flex justify-between text-slate-300">
                          <span>Reward Rate:</span>
                          <span className="font-mono font-semibold text-emerald-400">{(item.categoryRate * 100).toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span>Estimated Reward:</span>
                          <span className="font-mono font-semibold text-cyan-400">₹{item.reward.toFixed(0)}</span>
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span>Available Credit:</span>
                          <span className="font-mono">₹{item.availableCredit.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span>Utilization After:</span>
                          <span className={`font-mono ${item.utilizationAfter > 80 ? 'text-rose-400' : 'text-slate-300'}`}>{item.utilizationAfter.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-800/80">
                      <span className={`inline-block w-full text-center py-1.5 rounded-lg text-xs font-semibold ${item.isEligible ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                        {item.isEligible ? 'Eligible' : 'Insufficient Credit'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Cards Table */}
      <div className="bg-[#0D1322] border border-cyan-500/10 rounded-2xl shadow-xl overflow-hidden p-6 space-y-4">
        <h3 className="text-lg font-semibold text-white">All Active Credit Cards</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {state.cards.map(c => {
            const avail = c.creditLimit - c.currentBalance;
            const util = (c.currentBalance / c.creditLimit) * 100;
            return (
              <div key={c.id} className="bg-[#080C14] border border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-lg">
                <div>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-mono text-cyan-400 uppercase">{c.bank}</span>
                      <h4 className="font-bold text-lg text-white">{c.name}</h4>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => openEditModal(c)} className="p-1.5 rounded bg-slate-800 text-cyan-400 hover:bg-slate-700"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => onDelete(c.id)} className="p-1.5 rounded bg-slate-800 text-rose-400 hover:bg-rose-500/20"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Credit Limit:</span>
                      <span className="font-mono text-white">₹{c.creditLimit.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Current Balance:</span>
                      <span className="font-mono text-rose-400">₹{c.currentBalance.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Available:</span>
                      <span className="font-mono text-emerald-400">₹{avail.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-800">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">Utilization</span>
                    <span className="font-mono text-cyan-400">{util.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${Math.min(100, util)}%` }}></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {isOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#0D1322] border border-cyan-500/20 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-6">
            <h3 className="text-xl font-bold text-white">{editingId ? 'Edit Credit Card' : 'Add Credit Card'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-cyan-400/80 mb-1">Card Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  className="w-full bg-[#080C14] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm"
                  placeholder="e.g. Regalia Gold"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-cyan-400/80 mb-1">Bank</label>
                  <input
                    type="text"
                    value={bank}
                    onChange={e => setBank(e.target.value)}
                    required
                    className="w-full bg-[#080C14] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm"
                    placeholder="HDFC"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-cyan-400/80 mb-1">Credit Limit (₹)</label>
                  <input
                    type="number"
                    value={creditLimit}
                    onChange={e => setCreditLimit(e.target.value)}
                    required
                    min="1"
                    className="w-full bg-[#080C14] border border-slate-700 rounded-xl px-4 py-2.5 text-white font-mono text-sm"
                    placeholder="300000"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-cyan-400/80 mb-1">Current Balance (₹)</label>
                  <input
                    type="number"
                    value={currentBalance}
                    onChange={e => setCurrentBalance(e.target.value)}
                    className="w-full bg-[#080C14] border border-slate-700 rounded-xl px-4 py-2.5 text-white font-mono text-sm"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-cyan-400/80 mb-1">Default Reward Rate</label>
                  <input
                    type="number"
                    step="0.005"
                    value={defaultRewardRate}
                    onChange={e => setDefaultRewardRate(e.target.value)}
                    className="w-full bg-[#080C14] border border-slate-700 rounded-xl px-4 py-2.5 text-white font-mono text-sm"
                    placeholder="0.01"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-mono text-cyan-400/80 mb-1">Category Rewards (category: rate, ...)</label>
                <input
                  type="text"
                  value={catRatesStr}
                  onChange={e => setCatRatesStr(e.target.value)}
                  className="w-full bg-[#080C14] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm font-mono"
                  placeholder="electronics: 0.033, travel: 0.04"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-sm shadow-lg shadow-cyan-500/20"
                >
                  {editingId ? 'Save Changes' : 'Add Card'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 4. GOALS VIEW & GOAL COLLISION ENGINE
// ==========================================

function GoalsView({
  state,
  monthlySurplus,
  onAdd,
  onEdit,
  onDelete
}: {
  state: FinancialState;
  monthlySurplus: number;
  onAdd: (g: Omit<Goal, 'id'>) => void;
  onEdit: (id: string, g: Omit<Goal, 'id'>) => void;
  onDelete: (id: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [deadline, setDeadline] = useState('2027-12');
  const [category, setCategory] = useState('Safety');

  const openAddModal = () => {
    setEditingId(null);
    setTitle('');
    setTargetAmount('');
    setCurrentAmount('');
    setDeadline('2027-12');
    setCategory('Safety');
    setIsOpen(true);
  };

  const openEditModal = (g: Goal) => {
    setEditingId(g.id);
    setTitle(g.title);
    setTargetAmount(g.targetAmount.toString());
    setCurrentAmount(g.currentAmount.toString());
    setDeadline(g.deadline);
    setCategory(g.category);
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tNum = parseFloat(targetAmount);
    const cNum = parseFloat(currentAmount);
    if (!title.trim() || !Number.isFinite(tNum) || tNum <= 0 || !isValidYearMonth(deadline)) return;
    const safeCurrent = Number.isFinite(cNum) ? cNum : 0;
    if (safeCurrent < 0 || safeCurrent > tNum) return;

    const data = {
      title: title.trim(),
      targetAmount: tNum,
      currentAmount: safeCurrent,
      deadline,
      category: category.trim() || 'General'
    };

    if (editingId) {
      onEdit(editingId, data);
    } else {
      onAdd(data);
    }
    setIsOpen(false);
  };

  // Goal Collision & Required Monthly Engine
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const evaluatedGoals = state.goals.map(g => {
    const monthsRemaining = monthsUntil(g.deadline, now);
    const remainingAmount = Math.max(0, g.targetAmount - g.currentAmount);
    const requiredMonthly = requiredMonthlyForGoal(g, now);
    const progress = g.targetAmount > 0 ? (g.currentAmount / g.targetAmount) * 100 : 0;
    const isAlreadyFunded = g.currentAmount >= g.targetAmount;

    return { ...g, monthsRemaining, remainingAmount, requiredMonthly, progress, isAlreadyFunded };
  });

  const totalRequiredMonthly = totalGoalRequiredMonthly(state, now);
  const totalTripsRequiredMonthly = totalTripRequiredMonthly(state, now);
  const sharedPlanRequiredMonthly = totalRequiredMonthly + totalTripsRequiredMonthly;
  const surplusShortfall = sharedPlanRequiredMonthly - Math.max(0, monthlySurplus);

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center bg-[#0D1322] p-6 rounded-2xl border border-cyan-500/10 shadow-xl">
        <div>
          <h2 className="text-2xl font-bold text-white">Financial Goals & Collision Engine</h2>
          <p className="text-sm text-cyan-400/70 font-mono mt-1">Multi-goal deadline & monthly surplus collision analysis</p>
        </div>
        <button
          onClick={openAddModal}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 font-semibold text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 transition-all flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" /> Add Goal
        </button>
      </div>

      {/* Collision Summary Banner */}
      <div className={`p-6 rounded-2xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xl ${surplusShortfall > 0 ? 'bg-gradient-to-br from-amber-500/10 to-rose-500/10 border-amber-500/30' : 'bg-gradient-to-br from-emerald-500/15 to-cyan-500/10 border-emerald-500/30'}`}>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <AlertCircle className={`w-5 h-5 ${surplusShortfall > 0 ? 'text-amber-400' : 'text-emerald-400'}`} />
            <h3 className="text-lg font-bold text-white">Monthly Goal Funding Status</h3>
          </div>
          <p className="text-xs text-slate-300">
            {surplusShortfall > 0
              ? `Warning: Your goals + trips require ₹${sharedPlanRequiredMonthly.toFixed(0)}/mo, compared with your monthly surplus of ₹${monthlySurplus.toLocaleString()}.`
              : `Great job! Your monthly surplus (₹${monthlySurplus.toLocaleString()}) covers the current goal + trip funding requirement of ₹${sharedPlanRequiredMonthly.toFixed(0)}/mo.`}
          </p>
        </div>
        <div className="flex gap-4 font-mono text-sm">
          <div className="bg-[#080C14] px-4 py-3 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-xs">Goals + Trips Required</span>
            <span className="font-bold text-cyan-400">₹{sharedPlanRequiredMonthly.toFixed(0)}/mo</span>
          </div>
          <div className="bg-[#080C14] px-4 py-3 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-xs">Monthly Surplus</span>
            <span className="font-bold text-emerald-400">₹{monthlySurplus.toLocaleString()}/mo</span>
          </div>
        </div>
      </div>

      {/* Goals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {evaluatedGoals.map(g => (
          <div key={g.id} className="bg-[#0D1322] border border-cyan-500/10 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-6">
            <div>
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-cyan-300">{g.category}</span>
                  <h3 className="font-bold text-lg text-white mt-1">{g.title}</h3>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => openEditModal(g)} className="p-1.5 rounded bg-slate-800 text-cyan-400 hover:bg-slate-700"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => onDelete(g.id)} className="p-1.5 rounded bg-slate-800 text-rose-400 hover:bg-rose-500/20"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Progress:</span>
                  <span className="font-mono text-white">₹{g.currentAmount.toLocaleString()} / ₹{g.targetAmount.toLocaleString()}</span>
                </div>
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-cyan-500 to-blue-600 h-full rounded-full" style={{ width: `${Math.min(100, g.progress)}%` }}></div>
                </div>
              </div>
            </div>

            <div className="bg-[#080C14] p-4 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
              <div className="flex justify-between text-slate-300">
                <span>Deadline:</span>
                <span className="text-cyan-400">{g.deadline} ({g.monthsRemaining} mos left)</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Required Allocation:</span>
                <span className="font-bold text-emerald-400">₹{g.isAlreadyFunded ? 0 : g.requiredMonthly.toFixed(0)} / mo</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Status:</span>
                <span className={g.isAlreadyFunded ? 'text-emerald-400 font-bold' : 'text-slate-200'}>
                  {g.isAlreadyFunded ? 'Already Funded 🎉' : 'In Progress'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#0D1322] border border-cyan-500/20 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-6">
            <h3 className="text-xl font-bold text-white">{editingId ? 'Edit Financial Goal' : 'Add Financial Goal'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-cyan-400/80 mb-1">Goal Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  required
                  className="w-full bg-[#080C14] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm"
                  placeholder="e.g. Dream House"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-cyan-400/80 mb-1">Target Amount (₹)</label>
                  <input
                    type="number"
                    value={targetAmount}
                    onChange={e => setTargetAmount(e.target.value)}
                    required
                    min="1"
                    className="w-full bg-[#080C14] border border-slate-700 rounded-xl px-4 py-2.5 text-white font-mono text-sm"
                    placeholder="500000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-cyan-400/80 mb-1">Current Saved (₹)</label>
                  <input
                    type="number"
                    value={currentAmount}
                    onChange={e => setCurrentAmount(e.target.value)}
                    className="w-full bg-[#080C14] border border-slate-700 rounded-xl px-4 py-2.5 text-white font-mono text-sm"
                    placeholder="50000"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-cyan-400/80 mb-1">Deadline (YYYY-MM)</label>
                  <input
                    type="text"
                    value={deadline}
                    onChange={e => setDeadline(e.target.value)}
                    required
                    className="w-full bg-[#080C14] border border-slate-700 rounded-xl px-4 py-2.5 text-white font-mono text-sm"
                    placeholder="2027-12"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-cyan-400/80 mb-1">Category</label>
                  <input
                    type="text"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    required
                    className="w-full bg-[#080C14] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm"
                    placeholder="Safety"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-sm shadow-lg shadow-cyan-500/20"
                >
                  {editingId ? 'Save Changes' : 'Add Goal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 5. TRIP PLANNER VIEW
// ==========================================

function TripsView({
  state,
  monthlySurplus,
  onAdd,
  onEdit,
  onDelete
}: {
  state: FinancialState;
  monthlySurplus: number;
  onAdd: (t: Omit<Trip, 'id'>) => void;
  onEdit: (id: string, t: Omit<Trip, 'id'>) => void;
  onDelete: (id: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [budget, setBudget] = useState('');
  const [currentSavings, setCurrentSavings] = useState('');
  const [targetDate, setTargetDate] = useState('2027-10');

  const openAddModal = () => {
    setEditingId(null);
    setTitle('');
    setBudget('');
    setCurrentSavings('');
    setTargetDate('2027-10');
    setIsOpen(true);
  };

  const openEditModal = (t: Trip) => {
    setEditingId(t.id);
    setTitle(t.title);
    setBudget(t.budget.toString());
    setCurrentSavings(t.currentSavings.toString());
    setTargetDate(t.targetDate);
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const bNum = parseFloat(budget);
    const sNum = parseFloat(currentSavings);
    if (!title.trim() || !Number.isFinite(bNum) || bNum <= 0 || !isValidYearMonth(targetDate)) return;
    const safeSavings = Number.isFinite(sNum) ? sNum : 0;
    if (safeSavings < 0 || safeSavings > bNum) return;

    const data = {
      title: title.trim(),
      budget: bNum,
      currentSavings: safeSavings,
      targetDate
    };

    if (editingId) {
      onEdit(editingId, data);
    } else {
      onAdd(data);
    }
    setIsOpen(false);
  };

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const evaluatedTrips = state.trips.map(tr => {
    const monthsRemaining = monthsUntil(tr.targetDate, now);
    const remainingAmount = Math.max(0, tr.budget - tr.currentSavings);
    const requiredMonthly = requiredMonthlyForTrip(tr, now);
    const progress = tr.budget > 0 ? (tr.currentSavings / tr.budget) * 100 : 0;
    const otherGoalAndTripRequired = totalGoalRequiredMonthly(state, now) +
      totalTripRequiredMonthly(state, now) - requiredMonthly;
    const availableAfterOtherPlans = Math.max(0, monthlySurplus - otherGoalAndTripRequired);
    const projectedSavings = tr.currentSavings + (availableAfterOtherPlans * monthsRemaining);
    const isOnTrack = projectedSavings >= tr.budget;

    return {
      ...tr,
      monthsRemaining,
      remainingAmount,
      requiredMonthly,
      progress,
      projectedSavings,
      availableAfterOtherPlans,
      isOnTrack
    };
  });

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center bg-[#0D1322] p-6 rounded-2xl border border-cyan-500/10 shadow-xl">
        <div>
          <h2 className="text-2xl font-bold text-white">Trip Planner & Readiness Engine</h2>
          <p className="text-sm text-cyan-400/70 font-mono mt-1">Dynamic deadline & monthly contribution feasibility analysis</p>
        </div>
        <button
          onClick={openAddModal}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 font-semibold text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 transition-all flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" /> Add Trip
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {evaluatedTrips.map(tr => (
          <div key={tr.id} className="bg-[#0D1322] border border-cyan-500/10 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-6">
            <div>
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-xl text-white">{tr.title}</h3>
                <div className="flex gap-1.5">
                  <button onClick={() => openEditModal(tr)} className="p-1.5 rounded bg-slate-800 text-cyan-400 hover:bg-slate-700"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => onDelete(tr.id)} className="p-1.5 rounded bg-slate-800 text-rose-400 hover:bg-rose-500/20"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Savings Progress:</span>
                  <span className="font-mono text-white">₹{tr.currentSavings.toLocaleString()} / ₹{tr.budget.toLocaleString()}</span>
                </div>
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-cyan-500 to-blue-600 h-full rounded-full" style={{ width: `${Math.min(100, tr.progress)}%` }}></div>
                </div>
              </div>
            </div>

            <div className="bg-[#080C14] p-4 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
              <div className="flex justify-between text-slate-300">
                <span>Target Date:</span>
                <span className="text-cyan-400">{tr.targetDate} ({tr.monthsRemaining} mos left)</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Required Monthly:</span>
                <span className="font-bold text-emerald-400">₹{tr.requiredMonthly.toFixed(0)} / mo</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Surplus After Other Plans:</span>
                <span className="text-cyan-400">₹{tr.availableAfterOtherPlans.toFixed(0)} / mo</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Projected Savings:</span>
                <span className="text-slate-200">₹{tr.projectedSavings.toFixed(0)}</span>
              </div>
              <div className="flex justify-between text-slate-300 pt-2 border-t border-slate-800">
                <span>Readiness Status:</span>
                <span className={`px-2 py-0.5 rounded font-bold ${tr.isOnTrack ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                  {tr.isOnTrack ? 'On Track ✈️' : 'At Risk ⚠️'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#0D1322] border border-cyan-500/20 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-6">
            <h3 className="text-xl font-bold text-white">{editingId ? 'Edit Trip' : 'Add Trip'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-cyan-400/80 mb-1">Trip Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  required
                  className="w-full bg-[#080C14] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm"
                  placeholder="e.g. Europe Tour"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-cyan-400/80 mb-1">Budget (₹)</label>
                  <input
                    type="number"
                    value={budget}
                    onChange={e => setBudget(e.target.value)}
                    required
                    min="1"
                    className="w-full bg-[#080C14] border border-slate-700 rounded-xl px-4 py-2.5 text-white font-mono text-sm"
                    placeholder="200000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-cyan-400/80 mb-1">Current Saved (₹)</label>
                  <input
                    type="number"
                    value={currentSavings}
                    onChange={e => setCurrentSavings(e.target.value)}
                    className="w-full bg-[#080C14] border border-slate-700 rounded-xl px-4 py-2.5 text-white font-mono text-sm"
                    placeholder="50000"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-mono text-cyan-400/80 mb-1">Target Date (YYYY-MM)</label>
                <input
                  type="text"
                  value={targetDate}
                  onChange={e => setTargetDate(e.target.value)}
                  required
                  className="w-full bg-[#080C14] border border-slate-700 rounded-xl px-4 py-2.5 text-white font-mono text-sm"
                  placeholder="2027-10"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-sm shadow-lg shadow-cyan-500/20"
                >
                  {editingId ? 'Save Changes' : 'Add Trip'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 6. PLANNED PURCHASES VIEW
// ==========================================

function PurchasesView({
  state,
  monthlySurplus,
  onAdd,
  onEdit,
  onDelete
}: {
  state: FinancialState;
  monthlySurplus: number;
  onAdd: (p: Omit<PlannedPurchase, 'id'>) => void;
  onEdit: (id: string, p: Omit<PlannedPurchase, 'id'>) => void;
  onDelete: (id: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [currentSavings, setCurrentSavings] = useState('');
  const [category, setCategory] = useState('electronics');

  const openAddModal = () => {
    setEditingId(null);
    setTitle('');
    setPrice('');
    setCurrentSavings('');
    setCategory('electronics');
    setIsOpen(true);
  };

  const openEditModal = (p: PlannedPurchase) => {
    setEditingId(p.id);
    setTitle(p.title);
    setPrice(p.price.toString());
    setCurrentSavings(p.currentSavings.toString());
    setCategory(p.category);
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pNum = parseFloat(price);
    const sNum = parseFloat(currentSavings);
    if (!title.trim() || !Number.isFinite(pNum) || pNum <= 0) return;
    const safeSavings = Number.isFinite(sNum) ? sNum : 0;
    if (safeSavings < 0 || safeSavings > pNum) return;

    const data = {
      title: title.trim(),
      price: pNum,
      currentSavings: safeSavings,
      category: category.trim() || 'general'
    };

    if (editingId) {
      onEdit(editingId, data);
    } else {
      onAdd(data);
    }
    setIsOpen(false);
  };

  const evaluatedPurchases = state.purchases.map(p => {
    const remainingAmount = Math.max(0, p.price - p.currentSavings);
    const canBeFundedFromCash = state.liquidCash >= remainingAmount;
    let monthsRequired = 0;
    if (!canBeFundedFromCash) {
      if (monthlySurplus > 0) {
        monthsRequired = Math.ceil(remainingAmount / monthlySurplus);
      } else {
        monthsRequired = Infinity;
      }
    }
    const liquidityAfter = state.liquidCash - remainingAmount;

    return {
      ...p,
      remainingAmount,
      canBeFundedFromCash,
      monthsRequired,
      liquidityAfter
    };
  });

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center bg-[#0D1322] p-6 rounded-2xl border border-cyan-500/10 shadow-xl">
        <div>
          <h2 className="text-2xl font-bold text-white">Planned Purchases & Affordability Engine</h2>
          <p className="text-sm text-cyan-400/70 font-mono mt-1">Dynamic liquid cash & monthly surplus affordability modeling</p>
        </div>
        <button
          onClick={openAddModal}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 font-semibold text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 transition-all flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" /> Add Purchase
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {evaluatedPurchases.map(p => (
          <div key={p.id} className="bg-[#0D1322] border border-cyan-500/10 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-6">
            <div>
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-cyan-300">{p.category}</span>
                  <h3 className="font-bold text-xl text-white mt-1">{p.title}</h3>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => openEditModal(p)} className="p-1.5 rounded bg-slate-800 text-cyan-400 hover:bg-slate-700"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => onDelete(p.id)} className="p-1.5 rounded bg-slate-800 text-rose-400 hover:bg-rose-500/20"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>

              <div className="mt-6 space-y-2 text-sm font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Price:</span>
                  <span className="text-white font-bold">₹{p.price.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Current Savings Allocated:</span>
                  <span className="text-emerald-400">₹{p.currentSavings.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Remaining Amount:</span>
                  <span className="text-cyan-400 font-bold">₹{p.remainingAmount.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="bg-[#080C14] p-4 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
              <div className="flex justify-between text-slate-300">
                <span>Fundable from Liquid Cash:</span>
                <span className={p.canBeFundedFromCash ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {p.canBeFundedFromCash ? 'Yes ✅' : 'No ❌'}
                </span>
              </div>
              {!p.canBeFundedFromCash && (
                <div className="flex justify-between text-slate-300">
                  <span>Months Required (Surplus):</span>
                  <span className="text-amber-400 font-bold">{p.monthsRequired === Infinity ? 'Infinite (Negative Surplus)' : `${p.monthsRequired} months`}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-300">
                <span>Liquid Cash After Purchase:</span>
                <span className={p.liquidityAfter < 0 ? 'text-rose-400' : 'text-emerald-400'}>₹{p.liquidityAfter.toLocaleString()}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#0D1322] border border-cyan-500/20 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-6">
            <h3 className="text-xl font-bold text-white">{editingId ? 'Edit Planned Purchase' : 'Add Planned Purchase'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-cyan-400/80 mb-1">Item Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  required
                  className="w-full bg-[#080C14] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm"
                  placeholder="e.g. MacBook Pro"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-cyan-400/80 mb-1">Price (₹)</label>
                  <input
                    type="number"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    required
                    min="1"
                    className="w-full bg-[#080C14] border border-slate-700 rounded-xl px-4 py-2.5 text-white font-mono text-sm"
                    placeholder="150000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-cyan-400/80 mb-1">Current Saved (₹)</label>
                  <input
                    type="number"
                    value={currentSavings}
                    onChange={e => setCurrentSavings(e.target.value)}
                    className="w-full bg-[#080C14] border border-slate-700 rounded-xl px-4 py-2.5 text-white font-mono text-sm"
                    placeholder="50000"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-mono text-cyan-400/80 mb-1">Category</label>
                <input
                  type="text"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  required
                  className="w-full bg-[#080C14] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm"
                  placeholder="electronics"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-sm shadow-lg shadow-cyan-500/20"
                >
                  {editingId ? 'Save Changes' : 'Add Purchase'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 7. AI COPILOT VIEW (ADVANCED NL PARSING & LIVE STATE)
// ==========================================

function CopilotView({ state, monthlySurplus }: { state: FinancialState; monthlySurplus: number }) {
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'copilot'; text: string }>>([
    {
      sender: 'copilot',
      text: 'Hello! I am your FinTwin AI Copilot, directly connected to your live financial state. Ask me about credit card recommendations, trip affordability, goal collisions, job loss crash tests, or time machine projections!'
    }
  ]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const parseAmount = (q: string): number | null => {
    const lower = q.toLowerCase();
    // match lakh / L
    const lakhMatch = lower.match(/(\d+(\.\d+)?)\s*(lakh|l)/);
    if (lakhMatch) return parseFloat(lakhMatch[1]) * 100000;

    // match k
    const kMatch = lower.match(/(\d+(\.\d+)?)\s*k/);
    if (kMatch) return parseFloat(kMatch[1]) * 1000;

    // match raw numbers with commas or symbols
    const cleanNum = lower.replace(/[^\d]/g, '');
    if (cleanNum) {
      const val = parseInt(cleanNum, 10);
      if (val > 0) return val;
    }
    return null;
  };

  const parseCategory = (q: string): string => {
    const lower = q.toLowerCase();
    if (lower.includes('macbook') || lower.includes('laptop') || lower.includes('phone') || lower.includes('electronics') || lower.includes('sony')) return 'electronics';
    if (lower.includes('restaurant') || lower.includes('dining') || lower.includes('dinner') || lower.includes('food')) return 'dining';
    if (lower.includes('flight') || lower.includes('trip') || lower.includes('travel') || lower.includes('japan') || lower.includes('dubai') || lower.includes('goa')) return 'travel';
    if (lower.includes('amazon') || lower.includes('shopping') || lower.includes('clothes')) return 'shopping';
    if (lower.includes('grocery') || lower.includes('supermarket')) return 'groceries';
    return 'general';
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userText = input.trim();
    setMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setInput('');

    setTimeout(() => {
      const q = userText.toLowerCase();
      let responseText = '';

      const parsePercent = (text: string): number | null => {
        const match = text.match(/(\d+(?:\.\d+)?)\s*%/);
        return match ? parseFloat(match[1]) : null;
      };

      const amount = parseAmount(q);
      const requestedPercent = parsePercent(q);
      const now = new Date();

      if (q.includes('lose my job') || q.includes('job loss')) {
        // Use the live expense figure rather than hiding a 70% assumption.
        // Users can explicitly ask for an essential-expense percentage if they want one.
        const essentialPctMatch = q.match(/(\d+(?:\.\d+)?)\s*%.*(?:essential|expense)/);
        const essentialPct = essentialPctMatch ? parseFloat(essentialPctMatch[1]) : 100;
        const essentialExpenses = state.monthlyExpenses * (essentialPct / 100);
        const runwayMonths = state.liquidCash / Math.max(1, essentialExpenses);
        responseText = `🚨 **Job Loss Simulation:**\n- Liquid Cash: ₹${state.liquidCash.toLocaleString()}\n- Monthly Expenses Used: ₹${essentialExpenses.toLocaleString()} (${essentialPct}% of current expenses)\n- **Survival Runway:** ~${runwayMonths.toFixed(1)} months on liquid cash alone.\n- Investments remain separate: ₹${state.investments.toLocaleString()}\n${essentialPct === 100 ? 'Tip: ask with a percentage such as "job loss with 70% essential expenses" to test a leaner budget.' : ''}`;
      } else if (q.includes('market crash')) {
        const crashPct = requestedPercent ?? DEFAULT_MARKET_CRASH_PCT;
        const boundedCrashPct = Math.min(100, Math.max(0, crashPct));
        const after = state.investments * (1 - boundedCrashPct / 100);
        responseText = `📉 **Market Crash Simulation (${boundedCrashPct}%):**\n- Investments Before: ₹${state.investments.toLocaleString()}\n- Investments After: ₹${after.toLocaleString()}\n- Loss: ₹${(state.investments - after).toLocaleString()}\n- Liquid Cash remains separate at: ₹${state.liquidCash.toLocaleString()}${requestedPercent === null ? `\n- No percentage was supplied, so the Crash Test Lab default of ${DEFAULT_MARKET_CRASH_PCT}% was used.` : ''}`;
      } else if (q.includes('medical') || q.includes('hospital')) {
        if (amount === null) {
          responseText = `🏥 Please specify the medical expense amount, for example: "medical emergency ₹2 lakh". I will then calculate the cash shortfall from your live state.`;
        } else {
          const amt = amount;
          const cashAfter = state.liquidCash - amt;
          responseText = `🏥 **Medical Emergency Simulation (₹${amt.toLocaleString()}):**\n- Covered from Liquid Cash? ${cashAfter >= 0 ? 'Yes ✅' : 'No ❌'}\n- Liquid Cash After: ₹${cashAfter.toLocaleString()}\n${cashAfter < 0 ? `⚠️ Shortfall of ₹${Math.abs(cashAfter).toLocaleString()} would need to be sourced from credit or investments.` : ''}`;
        }
      } else if (q.includes('inflation')) {
        const inflationPct = requestedPercent ?? DEFAULT_INFLATION_PCT;
        const inflatedExpenses = state.monthlyExpenses * (1 + inflationPct / 100);
        const newSurplus = state.monthlyIncome - inflatedExpenses;
        responseText = `📈 **Inflation Surge Simulation (${inflationPct}%):**\n- Current Monthly Expenses: ₹${state.monthlyExpenses.toLocaleString()}\n- Inflated Expenses: ₹${inflatedExpenses.toLocaleString()}\n- New Monthly Surplus: ₹${newSurplus.toLocaleString()}${requestedPercent === null ? `\n- No percentage was supplied, so the Crash Test Lab default of ${DEFAULT_INFLATION_PCT}% was used.` : ''}`;
      } else if (q.includes('card') || q.includes('recommend') || q.includes('use')) {
        if (amount === null) {
          responseText = `💳 Please specify the purchase amount so I can compare your live cards. Example: "Which card for ₹50,000 travel?"`;
        } else {
          const cat = parseCategory(q);
          const evaluated = state.cards.map(card => {
            const avail = card.creditLimit - card.currentBalance;
            const isElig = avail >= amount;
            const rate = card.categoryRewardRates[cat] !== undefined ? card.categoryRewardRates[cat] : card.defaultRewardRate;
            const reward = amount * rate;
            return { card, isElig, reward, rate };
          }).sort((a, b) => (b.isElig ? 1 : 0) - (a.isElig ? 1 : 0) || b.reward - a.reward);

          const best = evaluated.find(e => e.isElig);
          if (!best) {
            responseText = `💳 For your ₹${amount.toLocaleString()} purchase in category "${cat}", no credit card has sufficient available credit.`;
          } else {
            responseText = `💳 **Card Analysis:**\n- Eligible card with highest calculated reward: **${best.card.name} (${best.card.bank})**\n- Category: ${cat}\n- Reward Rate: ${(best.rate * 100).toFixed(1)}%\n- Estimated Reward: ₹${best.reward.toFixed(0)}\n- Available Credit: ₹${(best.card.creditLimit - best.card.currentBalance).toLocaleString()}`;
          }
        }
      } else if (q.includes('trip') || q.includes('japan') || q.includes('dubai') || q.includes('goa') || q.includes('afford')) {
        const tripMatch = state.trips.find(tr => q.includes(tr.title.toLowerCase()));
        if (tripMatch) {
          const monthsRem = monthsUntil(tripMatch.targetDate, now);
          const rem = Math.max(0, tripMatch.budget - tripMatch.currentSavings);
          const reqMo = requiredMonthlyForTrip(tripMatch, now);
          const otherPlanRequired = totalGoalRequiredMonthly(state, now) + totalTripRequiredMonthly(state, now) - reqMo;
          const availableAfterOtherPlans = Math.max(0, monthlySurplus - otherPlanRequired);
          responseText = `✈️ **Trip Analysis for ${tripMatch.title}:**\n- Budget: ₹${tripMatch.budget.toLocaleString()}\n- Current Savings: ₹${tripMatch.currentSavings.toLocaleString()}\n- Remaining: ₹${rem.toLocaleString()}\n- Required Monthly: ₹${reqMo.toFixed(0)}/mo\n- Surplus Available After Other Goals/Trips: ₹${availableAfterOtherPlans.toFixed(0)}/mo\n- Status: ${availableAfterOtherPlans >= reqMo ? 'Funding requirement fits the shared monthly plan.' : 'The shared monthly plan has a funding gap.'}`;
        } else if (amount !== null) {
          const rem = Math.max(0, amount - state.liquidCash);
          responseText = `✈️ **Trip Affordability Check (₹${amount.toLocaleString()}):**\n- Liquid Cash: ₹${state.liquidCash.toLocaleString()}\n- Can be funded instantly from cash? ${state.liquidCash >= amount ? 'Yes ✅' : 'No ❌'}\n- Remaining if funded from cash: ₹${rem.toLocaleString()}\n- Monthly Surplus: ₹${monthlySurplus.toLocaleString()}/mo`;
        } else {
          responseText = `✈️ Tell me the trip amount or the name of one of your saved trips (for example, "Can I afford my Japan Vacation?").`;
        }
      } else if (q.includes('projection') || q.includes('time machine') || q.includes('future wealth') || q.includes('wait') || q.includes('years') || q.includes('months') || q.includes('become')) {
        const monthMatch = q.match(/(\d+)\s*(month|months|yr|yrs|year|years)/);
        const months = monthMatch
          ? (/^yr|^year/.test(monthMatch[2]) ? parseInt(monthMatch[1], 10) * 12 : parseInt(monthMatch[1], 10))
          : 12;
        const annualRet = requestedPercent ?? DEFAULT_COPILOT_ANNUAL_RETURN;
        const contribution = Math.max(0, monthlySurplus);
        const inv = projectInvestments(state.investments, contribution, months, annualRet);
        responseText = `⏳ **Time Machine Projection (${months} months):**\n- Annual return assumption: ${annualRet}%\n- Monthly contribution invested: ₹${contribution.toLocaleString()}\n- Projected Investments: ₹${inv.toLocaleString()}\n- Projected Liquid Cash: ₹${state.liquidCash.toLocaleString()}\n- Total Wealth: ₹${(inv + state.liquidCash).toLocaleString()}${requestedPercent === null ? `\n- The Time Machine default return of ${DEFAULT_COPILOT_ANNUAL_RETURN}% was used.` : ''}`;
      } else {
        responseText = `🤖 **FinTwin Copilot Summary:**\n- Net Worth: ₹${(state.liquidCash + state.investments).toLocaleString()}\n- Liquid Cash: ₹${state.liquidCash.toLocaleString()}\n- Investments: ₹${state.investments.toLocaleString()}\n- Monthly Surplus: ₹${monthlySurplus.toLocaleString()}\n- Goal Funding Required: ₹${totalGoalRequiredMonthly(state, now).toFixed(0)}/mo\n- Trip Funding Required: ₹${totalTripRequiredMonthly(state, now).toFixed(0)}/mo\n- Active Goals: ${state.goals.length} | Active Trips: ${state.trips.length}\nAsk me about credit cards, trip affordability, goal collisions, crash tests, or future wealth projections.`;
      }

      setMessages(prev => [...prev, { sender: 'copilot', text: responseText }]);
    }, 400);
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-120px)] flex flex-col bg-[#0D1322] border border-cyan-500/10 rounded-2xl shadow-2xl overflow-hidden">
      <div className="p-5 bg-[#0D1322] border-b border-cyan-500/10 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="font-bold text-white">AI Copilot & Financial Engine</h2>
          <p className="text-xs text-cyan-400 font-mono">Live State Connected • Amount & Category Parsing Active</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((m, idx) => (
          <div key={idx} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xl rounded-2xl p-4 text-sm leading-relaxed whitespace-pre-line shadow-lg ${m.sender === 'user' ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium' : 'bg-[#080C14] text-slate-200 border border-slate-800'}`}>
              {m.text}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className="p-4 bg-[#080C14] border-t border-cyan-500/10 flex gap-3">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="e.g. 'Which card for a ₹1.5 lakh MacBook?' or 'What if I lose my job?'"
          className="flex-1 bg-[#0D1322] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan-500"
        />
        <button
          type="submit"
          className="px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 transition-all flex items-center justify-center"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}

// ==========================================
// 8. TIME MACHINE VIEW (EFFECTIVE MONTHLY COMPOUNDING)
// ==========================================

function TimeMachineView({ state }: { state: FinancialState }) {
  const [horizonYears, setHorizonYears] = useState(5);
  const [annualReturn, setAnnualReturn] = useState(12);
  const [extraMonthly, setExtraMonthly] = useState(10000);

  const months = horizonYears * 12;
  const annualRateDecimal = annualReturn / 100;
  const effectiveMonthlyRate = effectiveMonthlyRateFromAnnual(annualReturn);
  const totalMonthlyContribution = Math.max(0, (state.monthlyIncome - state.monthlyExpenses) + extraMonthly);

  let projectedInv = state.investments;
  let totalContributions = 0;
  for (let i = 0; i < months; i++) {
    projectedInv = projectedInv * (1 + effectiveMonthlyRate) + totalMonthlyContribution;
    totalContributions += totalMonthlyContribution;
  }

  const projectedTotalWealth = projectedInv + state.liquidCash;
  const growth = projectedInv - state.investments - totalContributions;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="bg-[#0D1322] p-6 rounded-2xl border border-cyan-500/10 shadow-xl">
        <h2 className="text-2xl font-bold text-white">Time Machine Engine</h2>
        <p className="text-sm text-cyan-400/70 font-mono mt-1">Effective monthly compounding with liquid cash separation</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="bg-[#0D1322] border border-cyan-500/10 rounded-2xl p-6 shadow-xl space-y-6">
          <h3 className="text-lg font-semibold text-white">Projection Parameters</h3>

          <div>
            <label className="block text-xs font-mono text-cyan-400 mb-2">Time Horizon: {horizonYears} Years ({months} months)</label>
            <input
              type="range"
              min="1"
              max="30"
              value={horizonYears}
              onChange={e => setHorizonYears(parseInt(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-cyan-400 mb-2">Annual Return: {annualReturn}% (Effective Monthly: {(effectiveMonthlyRate * 100).toFixed(3)}%)</label>
            <input
              type="range"
              min="4"
              max="25"
              step="0.5"
              value={annualReturn}
              onChange={e => setAnnualReturn(parseFloat(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-cyan-400 mb-1">Extra Monthly Savings (₹)</label>
            <input
              type="number"
              value={extraMonthly}
              onChange={e => setExtraMonthly(parseFloat(e.target.value) || 0)}
              className="w-full bg-[#080C14] border border-slate-700 rounded-xl px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#0D1322] border border-cyan-500/10 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <span className="text-xs font-mono text-cyan-400">PROJECTED INVESTMENTS</span>
              <h4 className="text-3xl font-bold font-mono text-white mt-2">₹{Math.round(projectedInv).toLocaleString('en-IN')}</h4>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-800 text-xs font-mono space-y-1 text-slate-300">
              <div className="flex justify-between"><span>Initial:</span> <span>₹{state.investments.toLocaleString()}</span></div>
              <div className="flex justify-between"><span>Contributions:</span> <span>₹{Math.round(totalContributions).toLocaleString()}</span></div>
              <div className="flex justify-between"><span>Compounding Growth:</span> <span className="text-emerald-400">₹{Math.round(growth).toLocaleString()}</span></div>
            </div>
          </div>

          <div className="bg-[#0D1322] border border-cyan-500/10 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <span className="text-xs font-mono text-emerald-400">PROJECTED LIQUID CASH</span>
              <h4 className="text-3xl font-bold font-mono text-white mt-2">₹{state.liquidCash.toLocaleString('en-IN')}</h4>
            </div>
            <p className="text-xs text-slate-400 mt-4 leading-relaxed">
              Liquid cash is kept separate. The model assumes the monthly surplus shown above is invested each month; existing liquid cash is not automatically consumed or compounded.
            </p>
          </div>

          <div className="md:col-span-2 bg-gradient-to-r from-cyan-500/10 to-blue-600/10 border border-cyan-500/30 rounded-2xl p-6 shadow-xl flex justify-between items-center">
            <div>
              <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">Total Projected Wealth</span>
              <h3 className="text-3xl font-bold font-mono text-white mt-1">₹{Math.round(projectedTotalWealth).toLocaleString('en-IN')}</h3>
            </div>
            <div className="p-3 rounded-xl bg-cyan-500/20 text-cyan-400">
              <Sparkles className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 9. FINANCIAL MULTIVERSE VIEW
// ==========================================

function MultiverseView({ state }: { state: FinancialState }) {
  const [horizonYears, setHorizonYears] = useState(5);
  const scenarios = [8, 12, 15, 18];
  const months = horizonYears * 12;
  const monthlySurplus = Math.max(0, state.monthlyIncome - state.monthlyExpenses);

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="bg-[#0D1322] p-6 rounded-2xl border border-cyan-500/10 shadow-xl flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Financial Multiverse Scenarios</h2>
          <p className="text-sm text-cyan-400/70 font-mono mt-1">Effective monthly compounding across multiple annual return benchmarks</p>
        </div>
        <div>
          <label className="text-xs font-mono text-cyan-400 mr-2">Horizon: {horizonYears} yrs</label>
          <input
            type="range"
            min="1"
            max="20"
            value={horizonYears}
            onChange={e => setHorizonYears(parseInt(e.target.value))}
            className="accent-cyan-500 cursor-pointer"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {scenarios.map(annualReturn => {
          const rateDec = annualReturn / 100;
          const monthlyRate = effectiveMonthlyRateFromAnnual(annualReturn);
          let val = state.investments;
          for (let i = 0; i < months; i++) {
            val = val * (1 + monthlyRate) + monthlySurplus;
          }
          const diff = val - state.investments;

          return (
            <div key={annualReturn} className="bg-[#0D1322] border border-cyan-500/10 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-6">
              <div>
                <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 font-bold">
                  {annualReturn}% Annual Return
                </span>
                <h3 className="text-2xl font-bold font-mono text-white mt-4">₹{Math.round(val).toLocaleString('en-IN')}</h3>
              </div>

              <div className="space-y-2 text-xs font-mono pt-4 border-t border-slate-800 text-slate-300">
                <div className="flex justify-between">
                  <span>Monthly Rate:</span>
                  <span className="text-cyan-400">{(monthlyRate * 100).toFixed(3)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Growth from Base:</span>
                  <span className="text-emerald-400">+₹{Math.round(diff).toLocaleString()}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==========================================
// 10. DECISION SANDBOX VIEW
// ==========================================

function SandboxView({ state }: { state: FinancialState }) {
  const [horizonYears, setHorizonYears] = useState(5);
  const [baselineReturn, setBaselineReturn] = useState(8);
  const [scenarioReturn, setScenarioReturn] = useState(15);
  const [extraMonthly, setExtraMonthly] = useState(15000);

  const months = horizonYears * 12;
  const monthlySurplus = Math.max(0, state.monthlyIncome - state.monthlyExpenses) + extraMonthly;

  const calcVal = (ret: number) => {
    const mRate = effectiveMonthlyRateFromAnnual(ret);
    let v = state.investments;
    for (let i = 0; i < months; i++) {
      v = v * (1 + mRate) + monthlySurplus;
    }
    return v;
  };

  const baselineVal = calcVal(baselineReturn);
  const scenarioVal = calcVal(scenarioReturn);
  const diff = scenarioVal - baselineVal;
  const pctDiff = baselineVal > 0 ? (diff / baselineVal) * 100 : 0;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="bg-[#0D1322] p-6 rounded-2xl border border-cyan-500/10 shadow-xl">
        <h2 className="text-2xl font-bold text-white">Decision Sandbox</h2>
        <p className="text-sm text-cyan-400/70 font-mono mt-1">Compare scenario against baseline using identical compounding math</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="bg-[#0D1322] border border-cyan-500/10 rounded-2xl p-6 shadow-xl space-y-6">
          <h3 className="text-lg font-semibold text-white">Sandbox Controls</h3>

          <div>
            <label className="block text-xs font-mono text-cyan-400 mb-2">Horizon: {horizonYears} Years</label>
            <input
              type="range"
              min="1"
              max="25"
              value={horizonYears}
              onChange={e => setHorizonYears(parseInt(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-cyan-400 mb-2">Baseline Return: {baselineReturn}%</label>
            <input
              type="range"
              min="4"
              max="15"
              value={baselineReturn}
              onChange={e => setBaselineReturn(parseInt(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-cyan-400 mb-2">Scenario Return: {scenarioReturn}%</label>
            <input
              type="range"
              min="6"
              max="25"
              value={scenarioReturn}
              onChange={e => setScenarioReturn(parseInt(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-cyan-400 mb-1">Additional Monthly Savings (₹)</label>
            <input
              type="number"
              value={extraMonthly}
              onChange={e => setExtraMonthly(parseFloat(e.target.value) || 0)}
              className="w-full bg-[#080C14] border border-slate-700 rounded-xl px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#0D1322] border border-cyan-500/10 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <span className="text-xs font-mono text-slate-400">BASELINE ({baselineReturn}%)</span>
              <h4 className="text-2xl font-bold font-mono text-white mt-2">₹{Math.round(baselineVal).toLocaleString('en-IN')}</h4>
            </div>
          </div>

          <div className="bg-[#0D1322] border border-cyan-500/10 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <span className="text-xs font-mono text-cyan-400">SCENARIO ({scenarioReturn}%)</span>
              <h4 className="text-2xl font-bold font-mono text-white mt-2">₹{Math.round(scenarioVal).toLocaleString('en-IN')}</h4>
            </div>
          </div>

          <div className="bg-gradient-to-br from-cyan-500/10 to-blue-600/10 border border-cyan-500/30 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <span className="text-xs font-mono text-emerald-400">DIFFERENCE</span>
              <h4 className="text-2xl font-bold font-mono text-emerald-400 mt-2">+₹{Math.round(diff).toLocaleString('en-IN')}</h4>
            </div>
            <span className="inline-block mt-4 text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
              +{pctDiff.toFixed(1)}% Wealth Delta
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 11. CRASH TEST LAB VIEW
// ==========================================

function CrashTestView({ state }: { state: FinancialState }) {
  const [marketCrashPct, setMarketCrashPct] = useState(30);
  const [medicalAmt, setMedicalAmt] = useState(200000);
  const [inflationRate, setInflationRate] = useState(10);

  // Job Loss Calculations
  const essentialExpensePct = 70;
  const essentialExpenses = state.monthlyExpenses * (essentialExpensePct / 100);
  const runwayMonths = state.liquidCash / Math.max(1, essentialExpenses);

  // Market Crash Calculations
  const investmentsAfter = state.investments * (1 - marketCrashPct / 100);
  const investmentLoss = state.investments - investmentsAfter;

  // Medical Calculations
  const cashAfterMedical = state.liquidCash - medicalAmt;

  // Inflation Calculations
  const inflatedExpenses = state.monthlyExpenses * (1 + inflationRate / 100);
  const newSurplus = state.monthlyIncome - inflatedExpenses;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="bg-[#0D1322] p-6 rounded-2xl border border-cyan-500/10 shadow-xl">
        <h2 className="text-2xl font-bold text-white">Crash Test Lab</h2>
        <p className="text-sm text-cyan-400/70 font-mono mt-1">Stress-test your financial resilience against black swan events</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* A. Job Loss */}
        <div className="bg-[#0D1322] border border-cyan-500/10 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400"><ShieldAlert className="w-5 h-5" /></div>
            <h3 className="text-lg font-bold text-white">A. Job Loss Simulation</h3>
          </div>
          <p className="text-xs text-slate-400">Income becomes 0. Evaluates survival runway from liquid cash alone.</p>
          <div className="bg-[#080C14] p-4 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
            <div className="flex justify-between text-slate-300"><span>Liquid Cash:</span> <span className="text-cyan-400">₹{state.liquidCash.toLocaleString()}</span></div>
            <div className="flex justify-between text-slate-300"><span>Essential Expenses ({essentialExpensePct}%):</span> <span className="text-slate-200">₹{essentialExpenses.toFixed(0)}/mo</span></div>
            <div className="flex justify-between text-slate-300 pt-2 border-t border-slate-800">
              <span>Survival Runway:</span>
              <span className="text-emerald-400 font-bold">{runwayMonths.toFixed(1)} months</span>
            </div>
            <div className="flex justify-between text-slate-300"><span>Separate Investments:</span> <span className="text-blue-400">₹{state.investments.toLocaleString()}</span></div>
          </div>
        </div>

        {/* B. Market Crash */}
        <div className="bg-[#0D1322] border border-cyan-500/10 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400"><TrendingUp className="w-5 h-5" /></div>
            <h3 className="text-lg font-bold text-white">B. Market Crash Simulation</h3>
          </div>
          <div>
            <label className="block text-xs font-mono text-cyan-400 mb-2">Crash Percentage: {marketCrashPct}%</label>
            <input
              type="range"
              min="10"
              max="60"
              value={marketCrashPct}
              onChange={e => setMarketCrashPct(parseInt(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer"
            />
          </div>
          <div className="bg-[#080C14] p-4 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
            <div className="flex justify-between text-slate-300"><span>Before Crash:</span> <span className="text-cyan-400">₹{state.investments.toLocaleString()}</span></div>
            <div className="flex justify-between text-slate-300"><span>After Crash:</span> <span className="text-rose-400">₹{Math.round(investmentsAfter).toLocaleString()}</span></div>
            <div className="flex justify-between text-slate-300 pt-2 border-t border-slate-800">
              <span>Loss:</span>
              <span className="text-rose-400 font-bold">-₹{Math.round(investmentLoss).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* C. Medical Emergency */}
        <div className="bg-[#0D1322] border border-cyan-500/10 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400"><AlertTriangle className="w-5 h-5" /></div>
            <h3 className="text-lg font-bold text-white">C. Medical Emergency</h3>
          </div>
          <div>
            <label className="block text-xs font-mono text-cyan-400 mb-1">Medical Expense Amount (₹)</label>
            <input
              type="number"
              value={medicalAmt}
              onChange={e => setMedicalAmt(parseFloat(e.target.value) || 0)}
              className="w-full bg-[#080C14] border border-slate-700 rounded-xl px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div className="bg-[#080C14] p-4 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
            <div className="flex justify-between text-slate-300"><span>Initial Liquid Cash:</span> <span className="text-cyan-400">₹{state.liquidCash.toLocaleString()}</span></div>
            <div className="flex justify-between text-slate-300"><span>Cash After Medical:</span> <span className={cashAfterMedical < 0 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>₹{cashAfterMedical.toLocaleString()}</span></div>
            {cashAfterMedical < 0 && (
              <p className="text-rose-400 pt-2">⚠️ Shortfall of ₹{Math.abs(cashAfterMedical).toLocaleString()} requires credit or investment liquidation.</p>
            )}
          </div>
        </div>

        {/* D. Inflation Surge */}
        <div className="bg-[#0D1322] border border-cyan-500/10 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400"><Activity className="w-5 h-5" /></div>
            <h3 className="text-lg font-bold text-white">D. Inflation Surge</h3>
          </div>
          <div>
            <label className="block text-xs font-mono text-cyan-400 mb-2">Inflation Rate: {inflationRate}%</label>
            <input
              type="range"
              min="5"
              max="25"
              value={inflationRate}
              onChange={e => setInflationRate(parseInt(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer"
            />
          </div>
          <div className="bg-[#080C14] p-4 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
            <div className="flex justify-between text-slate-300"><span>Inflated Expenses:</span> <span className="text-rose-400">₹{Math.round(inflatedExpenses).toLocaleString()}/mo</span></div>
            <div className="flex justify-between text-slate-300 pt-2 border-t border-slate-800">
              <span>New Monthly Surplus:</span>
              <span className={newSurplus >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>₹{Math.round(newSurplus).toLocaleString()}/mo</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}