import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  DollarSign, 
  Plus, 
  History, 
  Calendar, 
  FileText, 
  ChevronDown, 
  ChevronUp, 
  Check, 
  X, 
  ArrowUpRight, 
  Search, 
  Trash2, 
  Edit2 
} from 'lucide-react';
import { 
  Worker, 
  Payment, 
  AttendanceRecord, 
  fetchWorkers, 
  fetchPayments, 
  createPayment, 
  editPayment, 
  removePayment,
  fetchAttendance
} from '../firebase';
import { t, subT, Language } from '../utils/translation';

interface PaymentsViewProps {
  lang: Language;
  bilingual: boolean;
  showToast: (message: string, type: 'success' | 'error') => void;
}

interface WorkerPaymentSummary {
  worker: Worker;
  totalEarned: number;
  totalPaid: number;
  pendingAmount: number;
  advanceAmount: number;
  paymentHistory: Payment[];
}

export const PaymentsView: React.FC<PaymentsViewProps> = ({
  lang,
  bilingual,
  showToast
}) => {
  const [summaries, setSummaries] = useState<WorkerPaymentSummary[]>([]);
  const [globalPayments, setGlobalPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [expandedWorkerId, setExpandedWorkerId] = useState<string | null>(null);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [activeSummary, setActiveSummary] = useState<WorkerPaymentSummary | null>(null);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);

  // Form Fields
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('2026-06-23'); // Target system date
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPaymentsData();
  }, [startDate, endDate]);

  const loadPaymentsData = async () => {
    setLoading(true);
    try {
      const workersData = await fetchWorkers();
      const paymentsData = await fetchPayments();
      const allAttendance = await fetchAttendance();

      // Apply date filters to payments
      const filteredPayments = paymentsData.filter(p => {
        const matchesStart = startDate ? p.date >= startDate : true;
        const matchesEnd = endDate ? p.date <= endDate : true;
        return matchesStart && matchesEnd;
      });

      // Sort global transactions (newest first)
      const sortedGlobal = [...filteredPayments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setGlobalPayments(sortedGlobal);

      // Calculate summaries for each worker
      const compiled: WorkerPaymentSummary[] = workersData.map(w => {
        // Attendance calculations incorporating half days
        const presentDays = allAttendance.filter(a => a.workerId === w.id && a.status === 'present').length;
        const halfDays = allAttendance.filter(a => a.workerId === w.id && a.status === 'half_day').length;
        const totalEarned = (presentDays + (halfDays * 0.5)) * w.dailyWage;

        // Payments for this worker
        const workerHistory = filteredPayments
          .filter(p => p.workerId === w.id)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        const totalPaid = workerHistory.reduce((sum, p) => sum + p.amount, 0);
        
        const balance = totalEarned - totalPaid;
        const pendingAmount = balance > 0 ? balance : 0;
        const advanceAmount = balance < 0 ? Math.abs(balance) : 0;

        return {
          worker: w,
          totalEarned,
          totalPaid,
          pendingAmount,
          advanceAmount,
          paymentHistory: workerHistory
        };
      });

      setSummaries(compiled);
    } catch (e) {
      showToast("Error loading payment ledger", "error");
    } finally {
      setLoading(false);
    }
  };

  const openAddPaymentModal = (summary: WorkerPaymentSummary) => {
    setActiveSummary(summary);
    setAmount(summary.pendingAmount > 0 ? summary.pendingAmount.toString() : '');
    setDate('2026-06-23');
    setNote('');
    setShowAddModal(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSummary) return;

    const amtNum = parseFloat(amount);
    if (isNaN(amtNum) || amtNum <= 0) {
      showToast("Please enter a valid amount", "error");
      return;
    }

    if (!window.confirm(`Are you sure you want to record a payment of ₹${amtNum} for ${activeSummary.worker.name}?`)) {
      return;
    }

    setSaving(true);
    try {
      await createPayment({
        workerId: activeSummary.worker.id,
        amount: amtNum,
        date,
        note: note.trim() || 'Wage Payment'
      });

      showToast("Payment recorded successfully!", "success");
      setShowAddModal(false);
      loadPaymentsData();
    } catch (error) {
      showToast("Failed to record payment", "error");
    } finally {
      setSaving(false);
    }
  };

  const openEditPaymentModal = (payment: Payment, workerName: string) => {
    setEditingPayment(payment);
    setAmount(payment.amount.toString());
    setDate(payment.date);
    setNote(payment.note);
    // Create a temporary summary to display name in modal
    setActiveSummary({
      worker: { name: workerName } as Worker,
      totalEarned: 0, totalPaid: 0, pendingAmount: 0, advanceAmount: 0, paymentHistory: []
    });
    setShowEditModal(true);
  };

  const handleEditPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayment) return;

    const amtNum = parseFloat(amount);
    if (isNaN(amtNum) || amtNum <= 0) {
      showToast("Please enter a valid amount", "error");
      return;
    }

    if (!window.confirm("Are you sure you want to update this payment record?")) {
      return;
    }

    setSaving(true);
    try {
      await editPayment(editingPayment.id, {
        amount: amtNum,
        date,
        note: note.trim()
      });

      showToast("Payment updated successfully!", "success");
      setShowEditModal(false);
      setEditingPayment(null);
      loadPaymentsData();
    } catch (error) {
      showToast("Failed to update payment", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePayment = async (paymentId: string, amount: number, workerName: string) => {
    if (!window.confirm(`Are you sure you want to delete the payment of ₹${amount} recorded for ${workerName}?`)) {
      return;
    }

    try {
      await removePayment(paymentId);
      showToast("Payment deleted successfully!", "success");
      loadPaymentsData();
    } catch (error) {
      showToast("Failed to delete payment", "error");
    }
  };

  const toggleHistory = (workerId: string) => {
    setExpandedWorkerId(prev => (prev === workerId ? null : workerId));
  };

  // Filter summaries based on search query
  const filteredSummaries = summaries.filter(s =>
    s.worker.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.worker.village.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // General totals
  const totalEarnedAll = summaries.reduce((sum, s) => sum + s.totalEarned, 0);
  const totalPaidAll = summaries.reduce((sum, s) => sum + s.totalPaid, 0);
  const totalPendingAll = summaries.reduce((sum, s) => sum + s.pendingAmount, 0);
  const totalAdvanceAll = summaries.reduce((sum, s) => sum + s.advanceAmount, 0);

  return (
    <div className="flex-1 p-4 pb-24 overflow-y-auto no-scrollbar space-y-5">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-extrabold text-text-dark">
          {bilingual ? `${t('paymentsPage', lang)} / ${subT('paymentsPage', lang)}` : t('paymentsPage', lang)}
        </h1>
        <p className="text-xs text-gray-400 font-semibold mt-1">
          Record payouts and track outstanding wage balances
        </p>
      </div>

      {/* Global Financial Summary Cards */}
      <div className="grid grid-cols-4 gap-1.5 bg-white p-3.5 rounded-3xl border border-[#E0DBC5]/40 shadow-soft text-center shrink-0">
        <div>
          <span className="text-[8px] text-gray-400 font-bold uppercase tracking-wider block">
            {t('totalEarned', lang)}
          </span>
          <span className="text-xs font-black text-text-dark block mt-1">
            ₹{totalEarnedAll}
          </span>
        </div>
        <div className="border-l border-gray-100">
          <span className="text-[8px] text-gray-400 font-bold uppercase tracking-wider block">
            Paid
          </span>
          <span className="text-xs font-black text-success-green block mt-1">
            ₹{totalPaidAll}
          </span>
        </div>
        <div className="border-l border-gray-100">
          <span className="text-[8px] text-gray-400 font-bold uppercase tracking-wider block">
            Pending
          </span>
          <span className={`text-xs font-black block mt-1 ${
            totalPendingAll > 0 ? 'text-danger-red animate-pulse-soft' : 'text-success-green'
          }`}>
            ₹{totalPendingAll}
          </span>
        </div>
        <div className="border-l border-gray-100">
          <span className="text-[8px] text-gray-400 font-bold uppercase tracking-wider block">
            Advances
          </span>
          <span className="text-xs font-black text-primary block mt-1">
            ₹{totalAdvanceAll}
          </span>
        </div>
      </div>

      {/* Filters card */}
      <div className="bg-white p-4 rounded-3xl border border-[#E0DBC5]/40 shadow-soft space-y-3 shrink-0">
        <div className="flex gap-2">
          {/* Search Input */}
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search worker name or village..."
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

      {/* Content layout */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : summaries.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center p-8 bg-white border border-[#E0DBC5]/30 rounded-3xl shadow-soft min-h-[250px]">
          <DollarSign size={40} className="text-gray-300 mb-2" />
          <h3 className="text-lg font-black text-text-dark">No payment history found.</h3>
          <p className="text-xs text-gray-400 mt-1 text-center">Add workers and record wages to start tracking payouts.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Worker Payout Grid */}
          <div className="space-y-3">
            {filteredSummaries.map(s => {
              const isExpanded = expandedWorkerId === s.worker.id;
              const hasBalance = s.pendingAmount > 0;
              const hasAdvance = s.advanceAmount > 0;
              
              return (
                <div
                  key={s.worker.id}
                  className="bg-white rounded-3xl border border-[#E0DBC5]/40 shadow-soft overflow-hidden transition-all duration-200"
                >
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-base font-bold text-text-dark leading-tight">
                          {s.worker.name}
                        </h3>
                        <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block mt-0.5">
                          {s.worker.village || 'No Village'}
                        </span>
                      </div>

                      <button
                        onClick={() => openAddPaymentModal(s)}
                        className="px-4 py-2 bg-accent text-white font-extrabold rounded-xl shadow-sm text-xs btn-active-scale cursor-pointer flex items-center gap-1"
                      >
                        <Plus size={13} />
                        {t('payButton', lang)}
                      </button>
                    </div>

                    {/* Financial Metrics */}
                    <div className="grid grid-cols-4 gap-1.5 bg-[#F8F5E9]/40 p-2.5 rounded-2xl border border-[#E0DBC5]/20 text-center">
                      <div>
                        <span className="text-[8px] text-gray-400 font-bold uppercase block">Earned</span>
                        <span className="text-[11px] font-bold text-text-dark block mt-0.5">₹{s.totalEarned}</span>
                      </div>
                      <div className="border-l border-gray-100/80">
                        <span className="text-[8px] text-gray-400 font-bold uppercase block">Paid</span>
                        <span className="text-[11px] font-bold text-success-green block mt-0.5">₹{s.totalPaid}</span>
                      </div>
                      <div className="border-l border-gray-100/80">
                        <span className="text-[8px] text-gray-400 font-bold uppercase block">Pending</span>
                        <span className={`text-[11px] font-bold block mt-0.5 ${hasBalance ? 'text-danger-red' : 'text-success-green'}`}>
                          ₹{s.pendingAmount}
                        </span>
                      </div>
                      <div className="border-l border-gray-100/80">
                        <span className="text-[8px] text-gray-400 font-bold uppercase block">Advance</span>
                        <span className="text-[11px] font-bold text-primary block mt-0.5">
                          ₹{s.advanceAmount}
                        </span>
                      </div>
                    </div>

                    {/* History Toggle */}
                    {s.paymentHistory.length > 0 && (
                      <button
                        onClick={() => toggleHistory(s.worker.id)}
                        className="w-full flex items-center justify-center gap-1 text-[10px] font-bold text-primary mt-3 pt-2 border-t border-gray-50 uppercase tracking-wider"
                      >
                        <History size={12} />
                        Statement history ({s.paymentHistory.length})
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    )}
                  </div>

                  {/* Expandable statement history list */}
                  <AnimatePresence>
                    {isExpanded && s.paymentHistory.length > 0 && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="bg-[#F8F5E9]/20 border-t border-[#E0DBC5]/30 overflow-hidden"
                      >
                        <div className="p-4 space-y-2 max-h-56 overflow-y-auto no-scrollbar">
                          {s.paymentHistory.map(p => (
                            <div
                              key={p.id}
                              className="bg-white p-2.5 rounded-xl border border-[#E0DBC5]/25 flex items-center justify-between text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-success-green/10 text-success-green rounded-lg shrink-0">
                                  <ArrowUpRight size={13} />
                                </div>
                                <div className="min-w-0">
                                  <span className="font-bold text-text-dark block">₹{p.amount}</span>
                                  {p.note && <span className="text-[9px] text-gray-400 font-semibold block truncate">{p.note}</span>}
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="font-semibold text-gray-400 text-[10px]">{p.date}</span>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => openEditPaymentModal(p, s.worker.name)}
                                    className="p-1.5 bg-primary/10 text-primary rounded-lg active:scale-90"
                                    title="Edit payment"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                  <button
                                    onClick={() => handleDeletePayment(p.id, p.amount, s.worker.name)}
                                    className="p-1.5 bg-danger-red/10 text-danger-red rounded-lg active:scale-90"
                                    title="Delete payment"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          {/* Recent Payouts transactions feed */}
          {globalPayments.length > 0 && (
            <div className="bg-white p-5 rounded-3xl border border-[#E0DBC5]/40 shadow-soft space-y-3">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-l-4 border-primary pl-2 mb-2">
                All Transactions Log / లాగ్ వివరాలు
              </h3>
              
              <div className="space-y-2.5 max-h-60 overflow-y-auto no-scrollbar pr-1">
                {globalPayments.map(p => {
                  const workerObj = summaries.find(s => s.worker.id === p.workerId);
                  const wName = workerObj?.worker.name || 'Worker';
                  return (
                    <div key={p.id} className="flex justify-between items-center bg-[#F8F5E9]/20 border border-[#E0DBC5]/15 p-2.5 rounded-2xl text-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-2 bg-success-green/10 text-success-green rounded-xl shrink-0">
                          <DollarSign size={14} />
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-text-dark block leading-tight truncate">{wName}</span>
                          <span className="text-[9px] text-gray-400 font-semibold mt-0.5 block truncate">{p.note}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 shrink-0 text-right">
                        <div>
                          <span className="font-black text-success-green block leading-tight">+ ₹{p.amount}</span>
                          <span className="text-[9px] text-gray-400 font-semibold mt-0.5 block">{p.date}</span>
                        </div>
                        
                        <div className="flex gap-1 shrink-0 ml-1">
                          <button
                            onClick={() => openEditPaymentModal(p, wName)}
                            className="p-1.5 bg-primary/10 text-primary rounded-lg active:scale-90"
                          >
                            <Edit2 size={11} />
                          </button>
                          <button
                            onClick={() => handleDeletePayment(p.id, p.amount, wName)}
                            className="p-1.5 bg-danger-red/10 text-danger-red rounded-lg active:scale-90"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Record Payment Drawer Sheet */}
      <AnimatePresence>
        {showAddModal && activeSummary && (
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

              <h3 className="text-xl font-bold text-text-dark mb-1">
                {t('recordPayment', lang)}
              </h3>
              <p className="text-xs text-gray-400 font-semibold mb-5">
                Recording payment for <strong className="text-primary">{activeSummary.worker.name}</strong>
              </p>

              <form onSubmit={handleRecordPayment} className="space-y-4">
                {/* Amount */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">
                    {t('enterAmount', lang)}
                  </label>
                  <input
                    type="number"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 2000"
                    className="form-input"
                  />
                  {activeSummary.pendingAmount > 0 && (
                    <div className="text-[9px] text-gray-400 pl-1 mt-0.5">
                      Pending balance: ₹{activeSummary.pendingAmount} (pre-filled)
                    </div>
                  )}
                </div>

                {/* Date */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">
                    {t('paymentDate', lang)}
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="form-input"
                  />
                </div>

                {/* Note */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">
                    {t('paymentNote', lang)}
                  </label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. Weekly Wage / Advance / Payout"
                    className="form-input"
                  />
                  {/* Note suggestions */}
                  <div className="flex gap-2 mt-2">
                    <span
                      onClick={() => setNote("Weekly wages")}
                      className="text-[10px] bg-[#F8F5E9] text-primary px-2.5 py-1 rounded-lg border border-[#E0DBC5] font-semibold cursor-pointer active:scale-95 transition-all"
                    >
                      Weekly Wages
                    </span>
                    <span
                      onClick={() => setNote("Advance payout")}
                      className="text-[10px] bg-[#F8F5E9] text-primary px-2.5 py-1 rounded-lg border border-[#E0DBC5] font-semibold cursor-pointer active:scale-95 transition-all"
                    >
                      Advance
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
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

      {/* Edit Payment Drawer Sheet */}
      <AnimatePresence>
        {showEditModal && editingPayment && activeSummary && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end justify-center p-4">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-white w-full max-w-md rounded-t-3xl p-6 shadow-premium relative border-t border-[#E0DBC5]"
            >
              <button 
                onClick={() => setShowEditModal(false)}
                className="absolute top-4 right-4 p-1.5 bg-gray-100 rounded-full text-gray-500 active:scale-90"
              >
                <X size={18} />
              </button>

              <h3 className="text-xl font-bold text-text-dark mb-1">
                Edit Payment Record
              </h3>
              <p className="text-xs text-gray-400 font-semibold mb-5">
                Modifying payment for <strong className="text-primary">{activeSummary.worker.name}</strong>
              </p>

              <form onSubmit={handleEditPayment} className="space-y-4">
                {/* Amount */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">
                    {t('enterAmount', lang)}
                  </label>
                  <input
                    type="number"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 2000"
                    className="form-input"
                  />
                </div>

                {/* Date */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">
                    {t('paymentDate', lang)}
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="form-input"
                  />
                </div>

                {/* Note */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">
                    {t('paymentNote', lang)}
                  </label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. Weekly Wage / Advance"
                    className="form-input"
                  />
                </div>

                {/* Action Buttons */}
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
                        Update Payout
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
