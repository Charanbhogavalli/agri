import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Search, 
  X, 
  Check, 
  AlertCircle,
  Calendar,
  Layers,
  Fuel, 
  Sprout, 
  Trash2,
  Settings,
  Truck,
  Wrench,
  Users,
  Compass
} from 'lucide-react';
import { Expense, fetchExpenses, createExpense } from '../firebase';
import { t, subT, Language } from '../utils/translation';

interface ExpensesViewProps {
  lang: Language;
  bilingual: boolean;
  showToast: (message: string, type: 'success' | 'error') => void;
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  lang,
  bilingual,
  showToast
}) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('All');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [category, setCategory] = useState<Expense['category']>('Others');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('2026-06-23'); // Target system date
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadExpenses();
  }, []);

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const data = await fetchExpenses();
      const sorted = data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setExpenses(sorted);
    } catch (e) {
      showToast("Error loading expenses", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const amtNum = parseFloat(amount);
    if (isNaN(amtNum) || amtNum <= 0) {
      showToast("Please enter a valid expense amount", "error");
      return;
    }

    if (!description.trim()) {
      showToast("Please enter a short description", "error");
      return;
    }

    setSaving(true);
    try {
      await createExpense({
        category,
        amount: amtNum,
        description: description.trim(),
        date
      });

      showToast(t('expenseSuccess', lang), "success");
      setShowModal(false);
      
      setCategory('Others');
      setAmount('');
      setDescription('');
      setDate('2026-06-23');
      
      loadExpenses();
    } catch (error) {
      showToast("Failed to save expense", "error");
    } finally {
      setSaving(false);
    }
  };

  // Helper to return category details (Emoji, Icon, Color classes)
  const getCategoryDetails = (cat: Expense['category']) => {
    switch (cat) {
      case 'Seeds':
        return { emoji: '🌾', label: 'Seeds', bg: 'bg-[#FFF8E1] text-[#F57F17]', border: 'border-[#FFE082]/30' };
      case 'Fertilizer':
        return { emoji: '💊', label: 'Fertilizer', bg: 'bg-[#E0F2F1] text-[#004D40]', border: 'border-[#4DB6AC]/30' };
      case 'Diesel':
        return { emoji: '⛽', label: 'Diesel', bg: 'bg-[#FFF3E0] text-[#E65100]', border: 'border-[#FFB74D]/30' };
      case 'Tractor':
        return { emoji: '🚜', label: 'Tractor', bg: 'bg-[#F3E5F5] text-[#4A148C]', border: 'border-[#BA68C8]/30' };
      case 'Transport':
        return { emoji: '🚚', label: 'Transport', bg: 'bg-[#E1F5FE] text-[#01579B]', border: 'border-[#4FC3F7]/30' };
      default:
        return { emoji: '📦', label: 'Others', bg: 'bg-[#ECEFF1] text-[#37474F]', border: 'border-[#90A4AE]/30' };
    }
  };

  const categoriesList: Expense['category'][] = [
    'Seeds', 'Fertilizer', 'Diesel', 'Tractor', 'Transport', 'Others'
  ];

  // Filter list
  const filteredExpenses = expenses.filter(e => {
    // Map standard firebase data to simplified categories if needed (e.g. Labor -> Others)
    const matchesSearch = e.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          e.category.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Normalize filter match
    let mappedCat = e.category;
    if (e.category === 'Labor' || e.category === 'Equipment') {
      mappedCat = 'Others';
    }
    const matchesCatFilter = selectedCategoryFilter === 'All' || mappedCat === selectedCategoryFilter;
    return matchesSearch && matchesCatFilter;
  });

  return (
    <div className="flex-1 p-4 pb-24 overflow-y-auto no-scrollbar flex flex-col">
      {/* Title block */}
      <div className="mb-5 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-text-dark">
            {bilingual ? `${t('expensesPage', lang)} / ${subT('expensesPage', lang)}` : t('expensesPage', lang)}
          </h1>
          <p className="text-xs text-gray-400 font-semibold mt-1">
            Log fuel, seeds, tractor renting and general bills
          </p>
        </div>
        <button
          onClick={() => {
            setDate('2026-06-23');
            setShowModal(true);
          }}
          className="bg-primary text-white p-3 rounded-2xl shadow-soft btn-active-scale cursor-pointer flex items-center gap-1 font-bold text-sm"
        >
          <Plus size={18} />
          {t('addExpense', lang)}
        </button>
      </div>

      {/* Search Input */}
      <div className="relative mb-4 shrink-0">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search descriptions or categories..."
          className="w-full bg-white border border-[#E0DBC5] text-text-dark font-medium rounded-2xl py-3.5 pl-11 pr-4 text-sm focus:outline-none focus:border-primary transition-all placeholder-gray-400"
        />
        <Search className="absolute left-4 top-3.5 text-gray-400" size={18} />
      </div>

      {/* Horizontal Category Scroll Filters */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 no-scrollbar select-none shrink-0">
        <button
          onClick={() => setSelectedCategoryFilter('All')}
          className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
            selectedCategoryFilter === 'All'
              ? 'bg-primary text-white shadow-sm'
              : 'bg-white text-gray-500 border border-[#E0DBC5]/40'
          }`}
        >
          All
        </button>
        {categoriesList.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategoryFilter(cat)}
            className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
              selectedCategoryFilter === cat
                ? 'bg-primary text-white shadow-sm'
                : 'bg-white text-gray-500 border border-[#E0DBC5]/40'
            }`}
          >
            {getCategoryDetails(cat).emoji} {t(cat, lang).split(' / ')[0]}
          </button>
        ))}
      </div>

      {/* Expenses List */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center py-10">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredExpenses.length === 0 ? (
        /* Empty State Illustration */
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white border border-[#E0DBC5]/30 rounded-3xl shadow-soft min-h-[300px]">
          <svg className="w-36 h-36 text-primary/20" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="50" y="60" width="100" height="90" rx="14" fill="#E8F5E9" stroke="#2E7D32" strokeWidth="5" />
            <circle cx="100" cy="105" r="20" stroke="#2E7D32" strokeWidth="5" />
            <path d="M100 75 L 100 85" stroke="#2E7D32" strokeWidth="5" strokeLinecap="round" />
            <path d="M85 90 L 115 90" stroke="#2E7D32" strokeWidth="5" strokeLinecap="round" />
            <path d="M125 125 L 140 140" stroke="#2E7D32" strokeWidth="5" strokeLinecap="round" />
          </svg>
          <h3 className="text-lg font-black text-text-dark mt-4">
            No expenses logged yet
          </h3>
          <p className="text-xs text-gray-400 font-semibold mt-1.5 text-center leading-normal">
            Keep track of fuel, seeds, fertilizer and tractor rents by adding a new expense.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-6 px-6 py-3.5 bg-primary text-white font-bold rounded-2xl shadow-soft btn-active-scale cursor-pointer flex items-center gap-1.5 text-sm"
          >
            <Plus size={16} />
            {t('addExpense', lang)}
          </button>
        </div>
      ) : (
        <div className="space-y-3 flex-1">
          {filteredExpenses.map(e => {
            // Map other categories back to Others for local display styling
            let catKey = e.category;
            if (e.category === 'Labor' || e.category === 'Equipment') {
              catKey = 'Others';
            }
            const theme = getCategoryDetails(catKey);
            return (
              <motion.div
                key={e.id}
                layout
                className="bg-white p-4 rounded-3xl border border-[#E0DBC5]/40 shadow-soft flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl ${theme.bg} shrink-0 flex items-center justify-center text-xl`}>
                    {theme.emoji}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-text-dark leading-tight">
                      {e.description}
                    </h3>
                    <span className="text-[9px] text-gray-400 font-extrabold uppercase tracking-wider block mt-1">
                      {t(catKey, lang).split(' / ')[0]}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-base font-extrabold text-danger-red block">
                    - ₹{e.amount}
                  </span>
                  <span className="text-[9px] text-gray-400 font-semibold mt-1 block">
                    {e.date}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add Expense Drawer Sheet */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end justify-center p-4">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-white w-full max-w-md rounded-t-3xl p-6 shadow-premium relative border-t border-[#E0DBC5] max-h-[90vh] overflow-y-auto"
            >
              <button 
                onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 p-1.5 bg-gray-100 rounded-full text-gray-500 active:scale-90"
              >
                <X size={18} />
              </button>

              <h3 className="text-xl font-bold text-text-dark mb-4">
                {t('addExpense', lang)}
              </h3>

              <form onSubmit={handleSave} className="space-y-4">
                {/* Category Card Selection Grid */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">
                    {t('category', lang)}
                  </label>
                  
                  <div className="grid grid-cols-3 gap-2.5">
                    {categoriesList.map(cat => {
                      const isSelected = category === cat;
                      const theme = getCategoryDetails(cat);
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setCategory(cat)}
                          className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1 active:scale-95 cursor-pointer ${
                            isSelected 
                              ? 'bg-primary text-white border-primary shadow-soft' 
                              : 'bg-white text-gray-700 border-[#E0DBC5]/60 hover:bg-[#F8F5E9]/20'
                          }`}
                        >
                          <span className="text-2xl block">{theme.emoji}</span>
                          <span className="text-[10px] font-bold tracking-tight block">
                            {t(cat, lang).split(' / ')[0]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Amount */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">
                    {t('amount', lang)}
                  </label>
                  <input
                    type="number"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 1500"
                    className="form-input"
                  />
                </div>

                {/* Description */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">
                    {t('description', lang)}
                  </label>
                  <input
                    type="text"
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Tractor fuel or Paddy seeds"
                    className="form-input"
                  />
                  {/* Suggestions */}
                  <div className="flex gap-2 mt-2 pl-1">
                    <span
                      onClick={() => setDescription("Tractor fuel")}
                      className="text-[10px] bg-[#F8F5E9] text-primary px-2.5 py-1 rounded-lg border border-[#E0DBC5] font-semibold cursor-pointer active:scale-95 transition-all"
                    >
                      Tractor Fuel
                    </span>
                    <span
                      onClick={() => setDescription("Seeds purchase")}
                      className="text-[10px] bg-[#F8F5E9] text-primary px-2.5 py-1 rounded-lg border border-[#E0DBC5] font-semibold cursor-pointer active:scale-95 transition-all"
                    >
                      Seeds
                    </span>
                  </div>
                </div>

                {/* Date */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">
                    {t('expenseDate', lang)}
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="form-input"
                  />
                </div>

                {/* Save Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl active:scale-95 text-sm transition-all cursor-pointer"
                  >
                    {t('cancel', lang)}
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-4 bg-primary text-white font-bold rounded-2xl active:scale-95 shadow-soft text-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {saving ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <Check size={15} />
                        {t('save', lang)}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
