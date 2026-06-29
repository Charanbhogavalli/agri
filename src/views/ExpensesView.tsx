import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Search, 
  X, 
  Check, 
  Calendar, 
  Layers,
  Fuel, 
  Sprout, 
  Trash2,
  Edit2,
  FileText,
  Filter
} from 'lucide-react';
import { Expense, fetchExpenses, createExpense, editExpense, removeExpense, CropCycle, filterByCrop } from '../firebase';
import { t, subT, Language } from '../utils/translation';
import { getLocalDateString } from '../utils/date';

interface ExpensesViewProps {
  lang: Language;
  bilingual: boolean;
  showToast: (message: string, type: 'success' | 'error') => void;
  selectedCropCycleId: string;
  cropCycles: CropCycle[];
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  lang,
  bilingual,
  showToast,
  selectedCropCycleId,
  cropCycles
}) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingExpenseObj, setEditingExpenseObj] = useState<Expense | null>(null);

  // Form Fields
  const [category, setCategory] = useState<Expense['category']>('Others');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(getLocalDateString()); // Target system date
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadExpenses();
  }, [startDate, endDate, selectedCropCycleId]);

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const allData = await fetchExpenses();
      const data = filterByCrop(allData, selectedCropCycleId);
      
      // Filter by date range first
      const dateFiltered = data.filter(e => {
        const matchesStart = startDate ? e.date >= startDate : true;
        const matchesEnd = endDate ? e.date <= endDate : true;
        return matchesStart && matchesEnd;
      });

      const sorted = dateFiltered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setExpenses(sorted);
    } catch (e) {
      showToast("Error loading expenses", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
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

    if (!window.confirm(`Are you sure you want to add this expense of ₹${amtNum} under ${category}?`)) {
      return;
    }

    setSaving(true);
    try {
      await createExpense({
        category,
        amount: amtNum,
        description: description.trim(),
        notes: notes.trim(),
        date,
        cropCycleId: selectedCropCycleId !== 'all' && selectedCropCycleId !== 'legacy' ? selectedCropCycleId : undefined
      });

      showToast("Expense recorded successfully!", "success");
      setShowAddModal(false);
      
      // Reset form
      setCategory('Others');
      setAmount('');
      setDescription('');
      setNotes('');
      setDate(getLocalDateString());
      
      loadExpenses();
    } catch (error) {
      showToast("Failed to save expense", "error");
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (exp: Expense) => {
    setEditingExpenseObj(exp);
    setCategory(exp.category);
    setAmount(exp.amount.toString());
    setDescription(exp.description);
    setNotes(exp.notes || '');
    setDate(exp.date);
    setShowEditModal(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpenseObj) return;

    const amtNum = parseFloat(amount);
    if (isNaN(amtNum) || amtNum <= 0) {
      showToast("Please enter a valid expense amount", "error");
      return;
    }

    if (!description.trim()) {
      showToast("Please enter a short description", "error");
      return;
    }

    if (!window.confirm("Are you sure you want to update this expense record?")) {
      return;
    }

    setSaving(true);
    try {
      await editExpense(editingExpenseObj.id, {
        category,
        amount: amtNum,
        description: description.trim(),
        notes: notes.trim(),
        date
      });

      showToast("Expense updated successfully!", "success");
      setShowEditModal(false);
      setEditingExpenseObj(null);
      loadExpenses();
    } catch (error) {
      showToast("Failed to update expense", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (expenseId: string, amount: number, desc: string) => {
    if (!window.confirm(`Are you sure you want to delete the expense of ₹${amount} for "${desc}"?`)) {
      return;
    }

    try {
      await removeExpense(expenseId);
      showToast("Expense deleted successfully!", "success");
      loadExpenses();
    } catch (error) {
      showToast("Failed to delete expense", "error");
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
      case 'Equipment':
        return { emoji: '🛠️', label: 'Equipment', bg: 'bg-[#ECEFF1] text-[#455A64]', border: 'border-[#B0BEC5]/30' };
      case 'Labor':
        return { emoji: '👷', label: 'Labor', bg: 'bg-[#E8F5E9] text-[#2E7D32]', border: 'border-[#A5D6A7]/30' };
      default:
        return { emoji: '📦', label: 'Others', bg: 'bg-[#ECEFF1] text-[#37474F]', border: 'border-[#90A4AE]/30' };
    }
  };

  const categoriesList: Expense['category'][] = [
    'Seeds', 'Fertilizer', 'Diesel', 'Tractor', 'Transport', 'Equipment', 'Labor', 'Others'
  ];

  // Filter list
  const filteredExpenses = expenses.filter(e => {
    const matchesSearch = e.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          e.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (e.notes && e.notes.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCatFilter = selectedCategoryFilter === 'All' || e.category === selectedCategoryFilter;
    return matchesSearch && matchesCatFilter;
  });

  const totalExpenseSum = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="flex-1 p-4 pb-24 overflow-y-auto no-scrollbar flex flex-col">
      {/* Title block */}
      <div className="mb-5 flex justify-between items-center shrink-0">
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
            setCategory('Others');
            setAmount('');
            setDescription('');
            setNotes('');
            setDate(getLocalDateString());
            setShowAddModal(true);
          }}
          className="bg-primary text-white p-3 rounded-2xl shadow-soft btn-active-scale cursor-pointer flex items-center gap-1 font-bold text-sm"
        >
          <Plus size={18} />
          {t('addExpense', lang)}
        </button>
      </div>

      {/* Dynamic Total Cost Card */}
      <div className="bg-white p-4 rounded-3xl border border-[#E0DBC5]/40 shadow-soft text-center mb-4 shrink-0">
        <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">
          Total Filtered Expenses
        </span>
        <span className="text-xl font-black text-danger-red block mt-1">
          ₹{totalExpenseSum}
        </span>
      </div>

      {/* Filter Options Card */}
      <div className="bg-white p-4 rounded-3xl border border-[#E0DBC5]/40 shadow-soft space-y-3 mb-4 shrink-0">
        <div className="flex gap-2">
          {/* Search Input */}
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search description, notes or category..."
              className="w-full bg-[#F8F5E9]/50 border border-[#E0DBC5] text-text-dark font-medium rounded-xl py-2.5 pl-9 pr-3 text-xs focus:outline-none focus:border-primary transition-all placeholder-gray-400"
            />
            <Search className="absolute left-3 top-3 text-gray-400" size={15} />
          </div>
        </div>

        {/* Date Filters */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="flex flex-col gap-0.5">
            <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider pl-1">Start Date</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-[#F8F5E9]/50 border border-[#E0DBC5] text-text-dark font-medium rounded-xl py-2 px-3 text-[11px] focus:outline-none focus:border-primary"
            />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider pl-1">End Date</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-[#F8F5E9]/50 border border-[#E0DBC5] text-text-dark font-medium rounded-xl py-2 px-3 text-[11px] focus:outline-none focus:border-primary"
            />
          </div>
        </div>
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
        /* Empty State */
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white border border-[#E0DBC5]/30 rounded-3xl shadow-soft min-h-[300px]">
          <Layers size={40} className="text-gray-300 mb-2" />
          <h3 className="text-lg font-black text-text-dark mt-2">No expenses recorded.</h3>
          <p className="text-xs text-gray-400 text-center mt-1">Keep track of farm bills by logging a new expense.</p>
        </div>
      ) : (
        <div className="space-y-3.5 flex-1">
          {filteredExpenses.map(e => {
            const theme = getCategoryDetails(e.category);
            return (
              <motion.div
                key={e.id}
                layout
                className="bg-white p-4 rounded-3xl border border-[#E0DBC5]/40 shadow-soft flex flex-col justify-between"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-12 h-12 rounded-2xl ${theme.bg} shrink-0 flex items-center justify-center text-xl`}>
                      {theme.emoji}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-text-dark leading-tight truncate">
                        {e.description}
                      </h3>
                      <span className="text-[9px] text-gray-400 font-extrabold uppercase tracking-wider block mt-1">
                        {t(e.category, lang).split(' / ')[0]}
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
                </div>

                {e.notes && (
                  <div className="bg-[#F8F5E9]/50 border border-[#E0DBC5]/30 rounded-xl p-2.5 mt-3.5 text-xs text-gray-500 font-medium flex gap-1.5">
                    <FileText size={14} className="text-accent shrink-0 mt-0.5" />
                    <span className="italic leading-snug">{e.notes}</span>
                  </div>
                )}

                {/* Edit / Delete actions row */}
                <div className="flex gap-2 justify-end mt-3.5 pt-3 border-t border-gray-50">
                  <button
                    onClick={() => openEditModal(e)}
                    className="p-2 bg-primary/10 text-primary rounded-xl active:scale-90 flex items-center gap-1 text-[10px] font-bold"
                  >
                    <Edit2 size={12} />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(e.id, e.amount, e.description)}
                    className="p-2 bg-danger-red/10 text-danger-red rounded-xl active:scale-90 flex items-center gap-1 text-[10px] font-bold"
                  >
                    <Trash2 size={12} />
                    Delete
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add Expense Drawer Sheet */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end justify-center p-4">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-white w-full max-w-md rounded-t-3xl p-6 shadow-premium relative border-t border-[#E0DBC5] max-h-[90vh] overflow-y-auto"
            >
              <button 
                onClick={() => setShowAddModal(false)}
                className="absolute top-4 right-4 p-1.5 bg-gray-100 rounded-full text-gray-500 active:scale-90"
              >
                <X size={18} />
              </button>

              <h3 className="text-xl font-bold text-text-dark mb-4">
                {t('addExpense', lang)}
              </h3>

              <form onSubmit={handleCreate} className="space-y-4">
                {/* Category selection */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as Expense['category'])}
                    className="form-input bg-white"
                  >
                    {categoriesList.map(cat => (
                      <option key={cat} value={cat}>
                        {getCategoryDetails(cat).emoji} {t(cat, lang).split(' / ')[0]}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Amount */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">
                    Amount (₹)
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
                    Description
                  </label>
                  <input
                    type="text"
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Tractor fuel or Urea bags"
                    className="form-input"
                  />
                </div>

                {/* Date */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="form-input"
                  />
                </div>

                {/* Notes */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">
                    Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Purchased from local dealer in village"
                    className="form-input resize-none"
                  />
                </div>

                {/* Save Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl active:scale-95 text-sm transition-all"
                  >
                    {t('cancel', lang)}
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-4 bg-primary text-white font-bold rounded-2xl active:scale-95 shadow-soft text-sm transition-all flex items-center justify-center gap-1.5"
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

      {/* Edit Expense Drawer Sheet */}
      <AnimatePresence>
        {showEditModal && editingExpenseObj && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end justify-center p-4">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-white w-full max-w-md rounded-t-3xl p-6 shadow-premium relative border-t border-[#E0DBC5] max-h-[90vh] overflow-y-auto"
            >
              <button 
                onClick={() => setShowEditModal(false)}
                className="absolute top-4 right-4 p-1.5 bg-gray-100 rounded-full text-gray-500 active:scale-90"
              >
                <X size={18} />
              </button>

              <h3 className="text-xl font-bold text-text-dark mb-4">
                Edit Expense Details
              </h3>

              <form onSubmit={handleUpdate} className="space-y-4">
                {/* Category selection */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as Expense['category'])}
                    className="form-input bg-white"
                  >
                    {categoriesList.map(cat => (
                      <option key={cat} value={cat}>
                        {getCategoryDetails(cat).emoji} {t(cat, lang).split(' / ')[0]}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Amount */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">
                    Amount (₹)
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
                    Description
                  </label>
                  <input
                    type="text"
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Tractor fuel or Urea bags"
                    className="form-input"
                  />
                </div>

                {/* Date */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="form-input"
                  />
                </div>

                {/* Notes */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">
                    Notes
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Purchased from local dealer in village"
                    className="form-input resize-none"
                  />
                </div>

                {/* Save Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="flex-1 py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl active:scale-95 text-sm transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-4 bg-primary text-white font-bold rounded-2xl active:scale-95 shadow-soft text-sm transition-all flex items-center justify-center gap-1.5"
                  >
                    {saving ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <Check size={15} />
                        Update Details
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
