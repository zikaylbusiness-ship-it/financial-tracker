import React, { useState, useMemo, useEffect } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  query,
} from "firebase/firestore";
import { auth, db } from "./lib/firebase";
import EnvelopeLetter from "./components/EnvelopeLetter";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  Search,
  Brain,
  AlertCircle,
  Receipt,
  Wallet,
  TrendingUp,
  CheckCircle2,
  Clock,
  Sparkles,
  Plus,
  X,
  ChevronRight,
  Check,
  Flame,
  Heart,
  Trash2,
  Edit2,
  Download,
  Upload,
  Banknote,
  ArrowUpRight,
  LogOut,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import clsx from "clsx";
import confetti from "canvas-confetti";
import { twMerge } from "tailwind-merge";

// --- Types ---
type Task = {
  id: number;
  title: string;
  completed: boolean;
};
export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);
};

function formatMyDate(dateString: string) {
  if (!dateString) return "";
  const [y, m, d] = dateString.split("-");
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// --- Data Types & Mocks ---
import {
  Transaction,
  TransactionType,
  CategoryType,
  initialData,
} from "./data";

const MONTHLY_BUDGET = 20000;

// Soft pastel colors
const getCategoryColors = (
  theme: "female" | "male",
): Record<string, string> => ({
  "Business & Content": theme === "female" ? "#F48FB1" : "#60a5fa",
  Education: "#FFE5B4",
  "Fixed Subscriptions": theme === "female" ? "#E0BBE4" : "#cbd5e1",
  Lifestyle: theme === "female" ? "#D4F0F0" : "#e0e7ff",
  "Salary / Income": "#C5E1A5",
  "Beauty & Health": "#FFCDD2",
  "Food Expenses": "#FFE082",
  Transportation: "#B3E5FC",
  Miscellaneous: theme === "female" ? "#FFF9C4" : "#bae6fd",
  Other: "#E2E8F0",
});

export default function App() {
  const theme = "female";
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [isAuthLoaded, setIsAuthLoaded] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    // Sync from Firestore (Public Web Share)
    const unsubTasks = onSnapshot(
      collection(db, "users/public_sync/tasks"),
      async (snapshot) => {
        if (snapshot.empty && !localStorage.getItem("seeded_tasks_public")) {
          const initialTasks = [
            {
              id: 1,
              title: "Clean the room 🧹",
              completed: false,
              createdAt: Date.now(),
            },
            {
              id: 2,
              title: "Study for 2 hours 📚",
              completed: false,
              createdAt: Date.now(),
            },
            {
              id: 3,
              title: "Workout 💪",
              completed: true,
              createdAt: Date.now(),
            },
          ];
          initialTasks.forEach(async (t) => {
            await setDoc(
              doc(db, "users/public_sync/tasks", t.id.toString()),
              t,
            );
          });
          localStorage.setItem("seeded_tasks_public", "true");
        }
        const fbTasks = snapshot.docs.map(
          (doc) => ({ ...doc.data(), id: Number(doc.id) }) as Task,
        );
        setTasks(fbTasks.sort((a, b) => b.id - a.id));
      },
      (error) => {
        console.error("Firebase Tasks Error:", error);
      },
    );

    const unsubTx = onSnapshot(
      collection(db, "users/public_sync/transactions"),
      async (snapshot) => {
        if (!localStorage.getItem("seeded_tx_v2_public")) {
          initialData.forEach(async (tx) => {
            await setDoc(
              doc(db, "users/public_sync/transactions", tx.id.toString()),
              tx,
            );
          });
          localStorage.setItem("seeded_tx_v2_public", "true");
        }
        const fbTx = snapshot.docs.map(
          (doc) => ({ ...doc.data(), id: Number(doc.id) }) as Transaction,
        );
        setTransactions(
          fbTx.sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
          ),
        );
      },
      (error) => {
        console.error("Firebase Tx Error:", error);
      },
    );

    setIsAuthLoaded(true);

    return () => {
      unsubTasks();
      unsubTx();
    };
  }, []);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    return `${year}-${month}`; // e.g., '2026-05'
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    item: "",
    cost: "",
    category: "Lifestyle" as CategoryType,
    status: "Paid" as "Paid" | "Pending",
    mop: "Cash",
    type: "Expense" as TransactionType,
  });

  // --- Derived State & Calculations ---
  const {
    totalSpent,
    totalIncome,
    pendingDebts,
    pendingLoans,
    pendingItems,
    categoryTotals,
    mopTotals,
    dailyData,
  } = useMemo(() => {
    let spent = 0;
    let income = 0;
    let debt = 0;
    let loan = 0;
    const catTotals: Record<string, number> = {};
    const mTals: Record<string, number> = {};
    const dData: Record<string, { income: number; expense: number }> = {};
    const pendingList: Transaction[] = [];

    const currentMonthTx = transactions.filter((tx) =>
      tx.date.startsWith(selectedMonth),
    );

    currentMonthTx.forEach((tx) => {
      // MOP Summary
      if (tx.status === "Paid" && tx.type === "Expense") {
        const normalizedMop = tx.mop.trim().toUpperCase();
        if (normalizedMop && normalizedMop !== "-") {
          mTals[normalizedMop] = (mTals[normalizedMop] || 0) + tx.cost;
        }
      }

      if (tx.type === "Expense") {
        if (tx.status === "Paid") {
          spent += tx.cost;
          catTotals[tx.category] = (catTotals[tx.category] || 0) + tx.cost;
          // Daily
          const day = tx.date.split("-")[2];
          if (!dData[day]) dData[day] = { income: 0, expense: 0 };
          dData[day].expense += tx.cost;
        } else {
          pendingList.push(tx);
        }
      } else if (tx.type === "Income") {
        if (tx.status === "Paid") {
          income += tx.cost;
          // Daily
          const day = tx.date.split("-")[2];
          if (!dData[day]) dData[day] = { income: 0, expense: 0 };
          dData[day].income += tx.cost;
        } else {
          pendingList.push(tx);
        }
      } else if (tx.type === "Debt (I owe)") {
        if (tx.status === "Pending") {
          debt += tx.cost;
          pendingList.push(tx);
        }
      } else if (tx.type === "Loan (Owed to me)") {
        if (tx.status === "Pending") {
          loan += tx.cost;
          pendingList.push(tx);
        }
      }
    });

    const monthIndex = parseInt(selectedMonth.split("-")[1], 10) - 1;
    const monthName = new Date(2000, monthIndex).toLocaleString("en-US", {
      month: "short",
    });

    const formattedDaily = Object.keys(dData)
      .sort()
      .map((d) => ({
        day: `${monthName} ${parseInt(d, 10)}`,
        income: dData[d].income,
        expense: dData[d].expense,
      }));

    return {
      totalSpent: spent,
      totalIncome: income,
      pendingDebts: debt,
      pendingLoans: loan,
      pendingItems: pendingList.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      ),
      categoryTotals: catTotals,
      mopTotals: mTals,
      dailyData: formattedDaily,
    };
  }, [transactions, selectedMonth]);

  const topCategory =
    Object.entries(categoryTotals).sort(
      (a, b) => (b[1] as number) - (a[1] as number),
    )[0]?.[0] || "None Yet";
  const burnRate = Math.min((totalSpent / MONTHLY_BUDGET) * 100, 100);

  const pieData = Object.keys(categoryTotals).map((key) => ({
    name: key,
    value: categoryTotals[key],
  }));

  const filteredTransactions = transactions
    .filter((tx) => tx.date.startsWith(selectedMonth))
    .filter(
      (tx) =>
        tx.item.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.mop.toLowerCase().includes(searchQuery.toLowerCase()),
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // --- Actions ---
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (modalMode === "add") {
      const newEntry: Transaction = {
        id: Date.now(),
        date: formData.date,
        item: formData.item,
        cost: parseFloat(formData.cost) || 0,
        category: formData.category,
        status: formData.status,
        type: formData.type,
        mop: formData.status === "Pending" ? "-" : formData.mop,
      };
      await setDoc(
        doc(db, "users/public_sync/transactions", newEntry.id.toString()),
        newEntry,
      );
    } else if (modalMode === "edit" && editingId !== null) {
      const updatedTx = {
        id: editingId,
        date: formData.date,
        item: formData.item,
        cost: parseFloat(formData.cost) || 0,
        category: formData.category,
        status: formData.status,
        type: formData.type,
        mop: formData.status === "Pending" ? "-" : formData.mop,
      };
      await setDoc(
        doc(db, "users/public_sync/transactions", editingId.toString()),
        updatedTx,
      );
    }
    closeModal();
  };

  const openAddModal = () => {
    setModalMode("add");
    setEditingId(null);
    setFormData({
      date: new Date().toISOString().split("T")[0],
      item: "",
      cost: "",
      category: "Lifestyle",
      status: "Paid",
      mop: "Cash",
      type: "Expense",
    });
    setIsModalOpen(true);
  };

  const openEditModal = (tx: Transaction) => {
    setModalMode("edit");
    setEditingId(tx.id);
    setFormData({
      date: tx.date,
      item: tx.item,
      cost: String(tx.cost),
      category: tx.category,
      status: tx.status,
      type: tx.type,
      mop: tx.status === "Pending" ? "Cash" : tx.mop,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleDelete = async (id: number) => {
    await deleteDoc(doc(db, "users/public_sync/transactions", id.toString()));
  };

  const markAsPaid = async (id: number) => {
    const tx = transactions.find((t) => t.id === id);
    if (!tx) return;
    const updated = { ...tx, status: "Paid", mop: "G-CASH" };
    await setDoc(
      doc(db, "users/public_sync/transactions", id.toString()),
      updated,
    );
  };

  const activeChartColor = "#F48FB1"; // pink
  const activeIncomeColor = "#34d399"; // emerald

  const triggerConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#F48FB1", "#FFF9C4", "#D4F0F0"],
    });
  };

  const toggleTask = async (id: number) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const updated = { ...task, completed: !task.completed };
    if (updated.completed) triggerConfetti();
    await setDoc(doc(db, "users/public_sync/tasks", id.toString()), updated);
  };

  const addTask = async (title: string) => {
    if (!title.trim()) return;
    const newTask = {
      id: Date.now(),
      title,
      completed: false,
      createdAt: Date.now(),
    };
    await setDoc(
      doc(db, "users/public_sync/tasks", newTask.id.toString()),
      newTask,
    );
  };

  const completedTasksCount = tasks.filter((t) => t.completed).length;
  const progressPercent =
    tasks.length > 0 ? (completedTasksCount / tasks.length) * 100 : 0;

  return (
    <div
      className={clsx(
        "min-h-screen bg-gradient-to-br from-pink-50 via-white to-yellow-50 font-sans text-slate-800 selection:bg-pink-200 selection:text-pink-900 pb-20 overflow-x-hidden theme-female",
      )}
    >
      <EnvelopeLetter />
      {/* Decorative Blur Backgrounds */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-pink-200/40 blur-3xl pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[#FFF9C4]/40 blur-3xl pointer-events-none" />

      {/* Navbar / Header */}
      <header className="relative z-40 sticky top-0 bg-white/60 backdrop-blur-md border-b border-pink-100 shadow-sm shadow-pink-50/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-pink-200 to-yellow-200 rounded-xl flex items-center justify-center text-yellow-500 shadow-sm shadow-pink-200/50 overflow-hidden">
              {authUser?.photoURL ? (
                <img
                  src={authUser.photoURL}
                  alt="Profile"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <Sparkles size={20} strokeWidth={2.5} />
              )}
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-800">
                Mga Gastos ni Self
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold border-none bg-pink-50 text-pink-600 focus:ring-2 focus:ring-pink-300 outline-none cursor-pointer"
            />
            <button
              onClick={openAddModal}
              className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 bg-gradient-to-r from-pink-400 to-yellow-400 hover:from-pink-500 hover:to-yellow-500 text-white rounded-full shadow-md shadow-pink-200 transition-transform font-bold text-xs sm:text-sm tracking-wide active:scale-95"
            >
              <Plus size={16} strokeWidth={3} />{" "}
              <span className="hidden sm:inline">New Transaction</span>
              <span className="sm:hidden">Add</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-8 relative z-10">
        {/* Top Bubbles */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <motion.div
            whileHover={{ y: -4 }}
            className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-5 flex flex-col justify-between shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-emerald-100 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 text-emerald-300 opacity-20">
              <Download size={80} strokeWidth={2} />
            </div>
            <div className="relative z-10 w-full mb-2">
              <p className="text-emerald-600 font-bold uppercase tracking-widest text-[10px] mb-1 flex items-center gap-1.5">
                <CheckCircle2 size={12} className="fill-emerald-100" /> Total
                Income
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">
                {formatCurrency(totalIncome)}
              </h2>
            </div>
          </motion.div>

          <motion.div
            whileHover={{ y: -4 }}
            className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-5 flex flex-col justify-between shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-yellow-100 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 text-yellow-300 opacity-20">
              <Upload size={80} strokeWidth={2} />
            </div>
            <div className="relative z-10 w-full mb-2">
              <p className="text-yellow-500 font-bold uppercase tracking-widest text-[10px] mb-1 flex items-center gap-1.5">
                <Wallet size={12} className="fill-yellow-100 text-yellow-500" />{" "}
                Total Spent
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">
                {formatCurrency(totalSpent)}
              </h2>
            </div>
          </motion.div>

          <motion.div
            whileHover={{ y: -4 }}
            className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-5 flex flex-col justify-between shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-yellow-100 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 text-yellow-300 opacity-20">
              <Clock size={80} strokeWidth={2} />
            </div>
            <div className="relative z-10 w-full mb-2">
              <p className="text-yellow-600 font-bold uppercase tracking-widest text-[10px] mb-1 flex items-center gap-1.5">
                <AlertCircle size={12} className="fill-yellow-100" /> Debts (I
                Owe)
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">
                {formatCurrency(pendingDebts)}
              </h2>
            </div>
          </motion.div>

          <motion.div
            whileHover={{ y: -4 }}
            className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-5 flex flex-col justify-between shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-blue-100 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 text-blue-300 opacity-20">
              <Banknote size={80} strokeWidth={2} />
            </div>
            <div className="relative z-10 w-full mb-2">
              <p className="text-blue-500 font-bold uppercase tracking-widest text-[10px] mb-1 flex items-center gap-1.5">
                <ArrowUpRight size={12} /> Loans (Owed to Me)
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">
                {formatCurrency(pendingLoans)}
              </h2>
            </div>
          </motion.div>
        </div>

        {/* Dashboard Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          <div className="lg:col-span-2 space-y-6 lg:space-y-8">
            {/* Charts area */}
            <div className="bg-white/80 backdrop-blur-xl border border-pink-50 rounded-[2rem] p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <h3 className="font-bold text-slate-800 text-lg mb-6 flex items-center gap-2">
                <TrendingUp className="text-pink-400" size={20} />
                Daily Cash Flow
              </h3>
              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={dailyData}
                    margin={{ top: 5, right: 0, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#fdf2f8"
                    />
                    <XAxis
                      dataKey="day"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 600 }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 600 }}
                      tickFormatter={(val) => `₱${val}`}
                    />
                    <RechartsTooltip
                      cursor={{ fill: "#fff1f2" }}
                      contentStyle={{
                        borderRadius: "16px",
                        border: "1px solid #fce7f3",
                        boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
                        fontWeight: 600,
                      }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Bar
                      dataKey="income"
                      fill={activeIncomeColor}
                      radius={[4, 4, 0, 0]}
                      name="Income"
                    />
                    <Bar
                      dataKey="expense"
                      fill={activeChartColor}
                      radius={[4, 4, 0, 0]}
                      name="Expense"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="bg-white/80 backdrop-blur-xl border border-pink-50 rounded-[2rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2 text-base">
                  <Receipt className="text-pink-400" size={18} /> Category Split
                </h3>
                <div className="h-[180px] w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {pieData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={
                              getCategoryColors(theme)[entry.name] || "#CBD5E1"
                            }
                          />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{
                          borderRadius: "16px",
                          border: "none",
                          boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
                          fontWeight: 600,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-3 mt-4">
                  {pieData.map((d) => (
                    <div
                      key={d.name}
                      className="flex justify-between items-center text-xs font-bold w-full bg-slate-50/50 px-3 py-2 rounded-xl"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full shadow-sm"
                          style={{
                            backgroundColor: getCategoryColors(theme)[d.name],
                          }}
                        ></span>
                        <span className="text-slate-600 truncate max-w-[100px]">
                          {d.name}
                        </span>
                      </div>
                      <span className="text-slate-800">
                        {((d.value / totalSpent) * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur-xl border border-pink-50 rounded-[2rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2 text-base">
                    <Flame className="text-yellow-400" size={18} /> Budget vs
                    Actual
                  </h3>

                  <div className="w-full h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={[
                          { name: "Budget", value: MONTHLY_BUDGET },
                          { name: "Spent", value: totalSpent },
                        ]}
                        margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#fdf2f8"
                        />
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          tick={{
                            fontSize: 11,
                            fill: "#94a3b8",
                            fontWeight: 600,
                          }}
                          dy={10}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{
                            fontSize: 11,
                            fill: "#94a3b8",
                            fontWeight: 600,
                          }}
                          tickFormatter={(val) => `₱${val}`}
                          width={60}
                        />
                        <RechartsTooltip
                          cursor={{ fill: "#fff1f2" }}
                          contentStyle={{
                            borderRadius: "16px",
                            border: "1px solid #fce7f3",
                            boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
                            fontWeight: 600,
                          }}
                          formatter={(value: number) => formatCurrency(value)}
                        />
                        <Bar
                          dataKey="value"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={50}
                        >
                          {[
                            { name: "Budget", value: MONTHLY_BUDGET },
                            { name: "Spent", value: totalSpent },
                          ].map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={index === 0 ? "#fcd34d" : "#f472b6"}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="mt-4 bg-gradient-to-r from-pink-50 to-yellow-50 border border-pink-100 p-4 rounded-2xl flex items-center justify-between shadow-sm">
                  <span className="text-[11px] text-pink-500 font-bold uppercase tracking-widest">
                    Remaining
                  </span>
                  <span className="font-bold text-slate-800 text-lg">
                    {formatCurrency(MONTHLY_BUDGET - totalSpent)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-1 flex flex-col gap-6 lg:gap-8">
            {/* Task Tracker / Notepad */}
            <div className="bg-white/80 backdrop-blur-xl border border-pink-100 rounded-[2rem] p-6 lg:p-8 flex flex-col shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#FFF9C4] to-yellow-200 rounded-xl flex items-center justify-center text-yellow-600 shadow-sm shadow-yellow-200/50">
                    <Heart
                      size={20}
                      className="fill-yellow-100"
                      strokeWidth={2.5}
                    />
                  </div>
                  <h3 className="font-bold text-lg tracking-tight text-slate-800">
                    My Notepad
                  </h3>
                </div>
                <span className="text-sm font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-full">
                  {completedTasksCount}/{tasks.length} Done
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-100 rounded-full h-3 mb-2 overflow-hidden shadow-inner p-0.5">
                <div
                  className="h-full rounded-full transition-all duration-1000 bg-gradient-to-r from-emerald-300 to-teal-400 shadow-sm"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Mini Dashboard / Accomplishment Statement */}
              <div className="mb-6 px-1">
                <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                  <Sparkles size={12} className="text-yellow-400" />
                  {tasks.length === 0
                    ? "Add some assignments or tasks to track your goals!"
                    : progressPercent === 100
                      ? "Incredible job! You've accomplished everything!"
                      : progressPercent > 50
                        ? `You're crushing it! Only ${tasks.length - completedTasksCount} task${tasks.length - completedTasksCount === 1 ? "" : "s"} left.`
                        : progressPercent > 0
                          ? "Off to a great start! Keep the momentum going."
                          : "Let's tackle that first task. You've got this!"}
                </p>
              </div>

              <div className="space-y-3 mb-6 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className={clsx(
                      "flex items-center gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer group hover:shadow-sm",
                      task.completed
                        ? "bg-slate-50 border-slate-100 opacity-60"
                        : "bg-white border-pink-50 hover:border-pink-100",
                    )}
                    onClick={() => toggleTask(task.id)}
                  >
                    <div
                      className={clsx(
                        "w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors",
                        task.completed
                          ? "bg-emerald-400 border-emerald-400 text-white"
                          : "border-slate-200 group-hover:border-pink-300 bg-white",
                      )}
                    >
                      {task.completed && <Check size={14} strokeWidth={3.5} />}
                    </div>
                    <span
                      className={clsx(
                        "font-semibold text-sm transition-all",
                        task.completed
                          ? "line-through text-slate-400 decoration-slate-300"
                          : "text-slate-700",
                      )}
                    >
                      {task.title}
                    </span>
                  </div>
                ))}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const input = e.currentTarget.elements.namedItem(
                    "taskTitle",
                  ) as HTMLInputElement;
                  addTask(input.value);
                  input.value = "";
                }}
                className="mt-auto flex flex-col gap-3"
              >
                <label
                  htmlFor="taskTitle"
                  className="text-xs font-bold text-pink-400 uppercase tracking-widest ml-1"
                >
                  New To-Do
                </label>
                <div className="flex gap-2 relative">
                  <input
                    id="taskTitle"
                    name="taskTitle"
                    type="text"
                    placeholder="e.g. Study, clean..."
                    autoComplete="off"
                    className="w-full pl-5 pr-12 py-3.5 bg-slate-50 hover:bg-white focus:bg-white border text-sm font-semibold text-slate-700 border-slate-200 focus:border-pink-300 rounded-2xl focus:outline-none focus:ring-4 focus:ring-pink-100 transition-all shadow-sm placeholder:text-slate-400"
                  />
                  <button
                    type="submit"
                    className="absolute right-2 top-2 bottom-2 w-10 bg-gradient-to-r from-pink-400 to-yellow-400 text-white hover:scale-105 rounded-xl flex items-center justify-center transition-transform active:scale-95 shadow-sm shadow-pink-200"
                  >
                    <Plus size={18} strokeWidth={3} />
                  </button>
                </div>
              </form>
            </div>

            {/* AI Auditor Box - Aesthetic, Girly, Professional */}
            <div className="bg-gradient-to-br from-pink-50 via-white to-pink-50/50 backdrop-blur-xl border border-pink-100 rounded-[2rem] p-6 sm:p-8 flex flex-col relative overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] h-full">
              <div className="absolute -top-10 -right-10 text-pink-200/40">
                <Brain size={180} />
              </div>

              <div className="flex items-center gap-3 mb-8 relative z-10">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-pink-100 text-yellow-400 shadow-sm shadow-pink-100/50">
                  <Sparkles size={20} strokeWidth={2.5} />
                </div>
                <h3 className="font-bold text-lg tracking-tight text-slate-800">
                  Financial Advisor
                </h3>
              </div>

              <div className="space-y-4 flex-1 relative z-10">
                <div className="bg-white border border-pink-50 rounded-2xl p-4.5 shadow-sm hover:shadow-md hover:border-pink-100 transition-all">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex-shrink-0 text-yellow-400 bg-yellow-50 p-1.5 rounded-lg">
                      <AlertCircle size={16} strokeWidth={3} />
                    </div>
                    <p className="text-sm font-semibold leading-relaxed text-slate-600">
                      You have{" "}
                      <strong className="text-slate-800">
                        {pendingItems.length} pending items
                      </strong>{" "}
                      needing action, including{" "}
                      <span className="text-yellow-600 font-bold">
                        {formatCurrency(pendingDebts)}
                      </span>{" "}
                      in active debts to pay.
                    </p>
                  </div>
                </div>

                <div className="bg-white border border-pink-50 rounded-2xl p-4.5 shadow-sm hover:shadow-md hover:border-pink-100 transition-all">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex-shrink-0 text-emerald-400 bg-emerald-50 p-1.5 rounded-lg">
                      <TrendingUp size={16} strokeWidth={3} />
                    </div>
                    <p className="text-sm font-semibold leading-relaxed text-slate-600">
                      Your net cash flow is{" "}
                      <strong
                        className={
                          totalIncome >= totalSpent
                            ? "text-emerald-500"
                            : "text-yellow-500"
                        }
                      >
                        {formatCurrency(totalIncome - totalSpent)}
                      </strong>
                      . Keep an eye on expenses!
                    </p>
                  </div>
                </div>

                <div className="bg-white border border-pink-50 rounded-2xl p-4.5 shadow-sm hover:shadow-md hover:border-pink-100 transition-all">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex-shrink-0 text-sky-400 bg-sky-50 p-1.5 rounded-lg">
                      <Heart size={16} strokeWidth={3} />
                    </div>
                    <p className="text-sm font-semibold leading-relaxed text-slate-600">
                      <strong>{topCategory}</strong> makes up{" "}
                      {totalSpent > 0
                        ? (
                            ((categoryTotals[topCategory] || 0) / totalSpent) *
                            100
                          ).toFixed(0)
                        : 0}
                      % of your expenses.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Transaction Table */}
        <div className="bg-white/80 backdrop-blur-xl border border-pink-50 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden flex flex-col">
          <div className="p-6 sm:px-8 sm:py-7 border-b border-pink-50 flex flex-col sm:flex-row sm:items-center justify-between gap-5 bg-white/50">
            <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
              <Receipt className="text-pink-400" size={20} /> All Transactions
            </h3>
            <div className="relative w-full sm:w-auto">
              <Search
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Search entries..."
                className="pl-11 pr-5 py-2.5 text-sm font-semibold bg-slate-50 border border-slate-100 rounded-full w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-pink-300 focus:bg-white transition-all text-slate-700 placeholder:text-slate-400 placeholder:font-medium shadow-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Mobile Cards View (< md) */}
          <div className="block md:hidden divide-y divide-pink-50/80 bg-white/30">
            {filteredTransactions.map((tx) => (
              <div
                key={tx.id}
                className="p-5 hover:bg-pink-50/40 transition-colors"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-bold text-slate-800 text-base tracking-tight">
                      {tx.item}
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">
                      {formatMyDate(tx.date)} &bull; {tx.type} &bull; {tx.mop}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-800 text-base">
                      {formatCurrency(tx.cost)}
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-center mt-4">
                  <span
                    className="text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-widest shadow-sm"
                    style={{
                      backgroundColor:
                        getCategoryColors(theme)[tx.category] || "#F1F5F9",
                      color: "#334155",
                    }}
                  >
                    {tx.category}
                  </span>
                  <div className="flex items-center gap-2">
                    {tx.status === "Pending" && (
                      <button
                        onClick={() => markAsPaid(tx.id)}
                        className="bg-white border border-emerald-200 hover:bg-emerald-50 text-emerald-600 px-2 sm:px-3 py-1.5 rounded-full shadow-sm text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 transition-colors"
                      >
                        <Check size={12} strokeWidth={3} />{" "}
                        <span className="hidden sm:inline">Paid</span>
                      </button>
                    )}
                    <span
                      className={cn(
                        "text-[10px] font-bold px-2 sm:px-3 py-1.5 rounded-full flex items-center gap-1.5 w-max shadow-sm",
                        tx.status === "Paid"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                          : "bg-white text-yellow-600 border border-yellow-200",
                      )}
                    >
                      {tx.status === "Paid" ? (
                        <CheckCircle2 size={12} className="text-emerald-500" />
                      ) : (
                        <Clock size={12} className="text-yellow-500" />
                      )}
                      {tx.status}
                    </span>
                    <button
                      onClick={() => openEditModal(tx)}
                      className="p-1.5 bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 rounded-full shadow-sm transition-colors"
                    >
                      <Edit2 size={12} strokeWidth={3} />
                    </button>
                    <button
                      onClick={() => handleDelete(tx.id)}
                      className="p-1.5 bg-white border border-yellow-200 text-yellow-400 hover:bg-yellow-50 hover:text-yellow-600 rounded-full shadow-sm transition-colors"
                    >
                      <Trash2 size={12} strokeWidth={3} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {filteredTransactions.length > 0 && (
              <div className="p-5 bg-pink-50/50 flex justify-between items-center text-slate-800 font-bold border-t border-pink-100">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">
                    Total Income
                  </span>
                  <span className="text-emerald-600 text-sm">
                    {formatCurrency(
                      filteredTransactions
                        .filter((t) => t.type === "Income")
                        .reduce((s, c) => s + c.cost, 0),
                    )}
                  </span>
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">
                    Total Expense
                  </span>
                  <span className="text-pink-600 text-sm">
                    {formatCurrency(
                      filteredTransactions
                        .filter((t) => t.type === "Expense")
                        .reduce((s, c) => s + c.cost, 0),
                    )}
                  </span>
                </div>
              </div>
            )}
            {filteredTransactions.length === 0 && (
              <div className="py-12 text-center text-slate-400 font-semibold text-sm">
                <div className="flex flex-col items-center gap-3">
                  <Search size={32} className="text-pink-200" />
                  <p>No magical expenses found.</p>
                </div>
              </div>
            )}
          </div>

          {/* Desktop Table View (>= md) */}
          <div className="hidden md:block overflow-x-auto w-full pb-4">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-white/50 text-[11px] uppercase tracking-widest text-slate-400 font-bold border-b border-pink-50/80">
                  <th className="px-8 py-5 whitespace-nowrap">Date</th>
                  <th className="px-8 py-5 whitespace-nowrap">Details</th>
                  <th className="px-8 py-5 whitespace-nowrap">Category</th>
                  <th className="px-8 py-5 whitespace-nowrap text-right">
                    Amount
                  </th>
                  <th className="px-8 py-5 whitespace-nowrap text-center">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50/80 bg-white/30">
                {filteredTransactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="hover:bg-pink-50/40 transition-colors group"
                  >
                    <td className="px-8 py-5 whitespace-nowrap text-xs font-bold text-slate-500">
                      {formatMyDate(tx.date)}
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <div className="font-bold text-slate-800 text-sm tracking-tight">
                        {tx.item}
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">
                        {tx.type} &bull; {tx.mop}
                      </div>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <span
                        className="text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-widest shadow-sm"
                        style={{
                          backgroundColor:
                            getCategoryColors(theme)[tx.category] || "#F1F5F9",
                          color: "#334155",
                        }}
                      >
                        {tx.category}
                      </span>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap text-right font-bold text-slate-700 text-sm">
                      {formatCurrency(tx.cost)}
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap">
                      <div className="flex items-center justify-center gap-3">
                        <span
                          className={cn(
                            "text-[11px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 w-max shadow-sm",
                            tx.status === "Paid"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                              : "bg-white text-yellow-600 border border-yellow-200",
                          )}
                        >
                          {tx.status === "Paid" ? (
                            <CheckCircle2
                              size={14}
                              className="text-emerald-500"
                            />
                          ) : (
                            <Clock size={14} className="text-yellow-500" />
                          )}
                          {tx.status}
                        </span>
                        {tx.status === "Pending" && (
                          <button
                            onClick={() => markAsPaid(tx.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 text-emerald-600 px-3 py-1.5 rounded-full shadow-sm text-[10px] font-bold uppercase tracking-widest flex items-center gap-1"
                          >
                            <Check size={12} strokeWidth={3} /> Paid
                          </button>
                        )}
                        <button
                          onClick={() => openEditModal(tx)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-2 bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 rounded-full shadow-sm"
                        >
                          <Edit2 size={14} strokeWidth={2.5} />
                        </button>
                        <button
                          onClick={() => handleDelete(tx.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-2 bg-white border border-yellow-200 text-yellow-400 hover:bg-yellow-50 hover:text-yellow-600 rounded-full shadow-sm"
                        >
                          <Trash2 size={14} strokeWidth={2.5} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredTransactions.length > 0 && (
                  <tr className="bg-pink-50/50 border-t-2 border-pink-100 font-bold">
                    <td
                      colSpan={3}
                      className="px-8 py-5 whitespace-nowrap text-right text-slate-700 uppercase tracking-widest text-xs"
                    >
                      Total for{" "}
                      {new Date(
                        2000,
                        parseInt(selectedMonth.split("-")[1], 10) - 1,
                      ).toLocaleString("en-US", {
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap text-right">
                      <div className="flex flex-col gap-1 items-end">
                        <div className="flex justify-between w-32 border-b border-white pb-1">
                          <span className="text-[10px] uppercase tracking-widest text-slate-500">
                            Income
                          </span>
                          <span className="text-emerald-600 text-sm ml-4">
                            {formatCurrency(
                              filteredTransactions
                                .filter((t) => t.type === "Income")
                                .reduce((s, c) => s + c.cost, 0),
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between w-32 pt-1">
                          <span className="text-[10px] uppercase tracking-widest text-slate-500">
                            Expense
                          </span>
                          <span className="text-pink-600 text-sm ml-4">
                            {formatCurrency(
                              filteredTransactions
                                .filter((t) => t.type === "Expense")
                                .reduce((s, c) => s + c.cost, 0),
                            )}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5"></td>
                  </tr>
                )}
                {filteredTransactions.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-16 text-center text-slate-400 font-semibold text-sm"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <Search size={32} className="text-pink-200" />
                        <p>No magical expenses found matching your search.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Add/Edit Expense Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="absolute inset-0 bg-slate-900/10 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-white p-6 sm:p-8 rounded-[2.5rem] shadow-[0_20px_60px_rgb(0,0,0,0.1)] border border-pink-100 max-w-md w-full relative z-10 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                    <Sparkles
                      size={24}
                      className="text-pink-400 fill-pink-400"
                    />
                    {modalMode === "add" ? "Quick Entry" : "Edit Entry"}
                  </h2>
                  <p className="text-[11px] font-bold text-pink-400 uppercase tracking-widest mt-1.5 ml-1">
                    {modalMode === "add" ? "Add to ledger" : "Update details"}
                  </p>
                </div>
                <button
                  onClick={closeModal}
                  className="text-slate-400 hover:text-slate-800 bg-slate-50 hover:bg-pink-50 rounded-full p-2.5 transition-colors"
                >
                  <X size={18} strokeWidth={3} />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-pink-400 uppercase tracking-widest mb-1.5 ml-1">
                      Type
                    </label>
                    <div className="relative">
                      <select
                        value={formData.type}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            type: e.target.value as TransactionType,
                          })
                        }
                        className="w-full pl-5 pr-10 py-3 bg-slate-50 hover:bg-slate-100 border-none rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-pink-300 transition-all font-bold text-slate-700 text-sm appearance-none shadow-sm cursor-pointer"
                      >
                        <option value="Expense">Expense</option>
                        <option value="Income">Income</option>
                        <option value="Debt (I owe)">Debt (I owe)</option>
                        <option value="Loan (Owed to me)">
                          Loan (Owed to me)
                        </option>
                      </select>
                      <ChevronRight
                        size={16}
                        strokeWidth={3}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-pink-300 rotate-90 pointer-events-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-pink-400 uppercase tracking-widest mb-1.5 ml-1">
                      Title
                    </label>
                    <input
                      required
                      type="text"
                      value={formData.item}
                      onChange={(e) =>
                        setFormData({ ...formData, item: e.target.value })
                      }
                      className="w-full px-5 py-3 bg-slate-50 hover:bg-slate-100 border-none rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-pink-300 transition-all font-bold text-slate-700 text-sm shadow-sm"
                      placeholder="e.g. Canva Pro"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-pink-400 uppercase tracking-widest mb-1.5 ml-1">
                      Amount (PHP)
                    </label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      value={formData.cost}
                      onChange={(e) =>
                        setFormData({ ...formData, cost: e.target.value })
                      }
                      className="w-full px-5 py-3 bg-slate-50 hover:bg-slate-100 border-none rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-pink-300 transition-all font-bold text-slate-700 text-sm shadow-sm"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-pink-400 uppercase tracking-widest mb-1.5 ml-1">
                      Date
                    </label>
                    <input
                      required
                      type="date"
                      value={formData.date}
                      onChange={(e) =>
                        setFormData({ ...formData, date: e.target.value })
                      }
                      className="w-full px-5 py-3 bg-slate-50 hover:bg-slate-100 border-none rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-pink-300 transition-all font-bold text-slate-700 text-sm shadow-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-pink-400 uppercase tracking-widest mb-1.5 ml-1">
                      Category
                    </label>
                    <div className="relative">
                      <select
                        value={formData.category}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            category: e.target.value as CategoryType,
                          })
                        }
                        className="w-full pl-5 pr-10 py-3 bg-slate-50 hover:bg-slate-100 border-none rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-pink-300 transition-all font-bold text-slate-700 text-sm appearance-none shadow-sm cursor-pointer"
                      >
                        {Object.keys(getCategoryColors(theme)).map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                      <ChevronRight
                        size={16}
                        strokeWidth={3}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-pink-300 rotate-90 pointer-events-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-pink-400 uppercase tracking-widest mb-1.5 ml-1">
                      Status
                    </label>
                    <div className="relative">
                      <select
                        value={formData.status}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            status: e.target.value as "Paid" | "Pending",
                          })
                        }
                        className="w-full pl-5 pr-10 py-3 bg-slate-50 hover:bg-slate-100 border-none rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-pink-300 transition-all font-bold text-slate-700 text-sm appearance-none shadow-sm cursor-pointer"
                      >
                        <option value="Paid">Paid</option>
                        <option value="Pending">Pending</option>
                      </select>
                      <ChevronRight
                        size={16}
                        strokeWidth={3}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-pink-300 rotate-90 pointer-events-none"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-pink-400 uppercase tracking-widest mb-1.5 ml-1">
                    Payment Method
                  </label>
                  <div className="relative">
                    <select
                      value={formData.mop}
                      onChange={(e) =>
                        setFormData({ ...formData, mop: e.target.value })
                      }
                      disabled={formData.status === "Pending"}
                      className="w-full pl-5 pr-10 py-3 bg-slate-50 hover:bg-slate-100 border-none rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-pink-300 transition-all font-bold text-slate-700 text-sm appearance-none disabled:opacity-50 shadow-sm cursor-pointer disabled:cursor-not-allowed"
                    >
                      <option value="G-CASH">G-CASH</option>
                      <option value="Go-Tyme">Go-Tyme</option>
                      <option value="Maribank">Maribank</option>
                      <option value="Cash">Cash</option>
                    </select>
                    <ChevronRight
                      size={16}
                      strokeWidth={3}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-pink-300 rotate-90 pointer-events-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-4 mt-6 bg-gradient-to-r from-pink-400 to-yellow-400 text-white font-bold text-sm tracking-wide rounded-2xl hover:from-pink-500 hover:to-yellow-500 shadow-lg shadow-pink-200 transition-transform active:scale-[0.98] flex justify-center items-center gap-2"
                >
                  <Check size={18} strokeWidth={3} />{" "}
                  {modalMode === "add"
                    ? "Save Transaction"
                    : "Update Transaction"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Action Button for Mobile/Tablet */}
      <div className="fixed bottom-8 right-6 md:right-10 z-50 animate-bounce">
        <button
          onClick={openAddModal}
          className="w-16 h-16 bg-gradient-to-br from-pink-400 to-yellow-400 text-white rounded-full shadow-2xl shadow-pink-300 flex items-center justify-center transition-transform hover:scale-110 active:scale-95 border-4 border-white"
        >
          <Plus size={32} strokeWidth={3} />
        </button>
      </div>
    </div>
  );
}
