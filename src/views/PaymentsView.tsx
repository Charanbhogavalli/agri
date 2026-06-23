import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DollarSign, Plus, History, Calendar, FileText, ChevronDown, ChevronUp, Check, X, ArrowUpRight, Search } from 'lucide-react';
import { Worker, Payment, AttendanceRecord, fetchWorkers, fetchPayments, createPayment } from '../firebase';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedWorkerId, setExpandedWorkerId] = useState<string | null>(null);

  // Record Payment Modal State
  const [showModal, setShowModal] = useState(false);
  const [activeSummary, setActiveSummary] = useState<WorkerPaymentSummary | null>(null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('2026-06-23'); // Target system date
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPaymentsData();
  }, []);

  const loadPaymentsData = async () => {
    setLoading(true);
    try {
      const workersData = await fetchWorkers();
      const paymentsData = await fetchPayments();
      
      // Sort global transactions (newest first)
      const sortedGlobal = [...paymentsData].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setGlobalPayments(sortedGlobal);

      const allAttendance: AttendanceRecord[] = JSON.parse(localStorage.getItem('pramesh_attendance') || '[]');

      // Calculate summaries for each worker
      const compiled: WorkerPaymentSummary[] = workersData.map(w => {
        const daysWorked = allAttendance.filter(a => a.workerId === w.id && a.status === 'present').length;
        const totalEarned = daysWorked * w.dailyWage;
        const workerHistory = paymentsData
          .filter(p => p.workerId === w.id)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const totalPaid = workerHistory.reduce((sum, p) => sum + p.amount, 0);
        const pendingAmount = Math.max(0, totalEarned - totalPaid);

        return {
          worker: w,
          totalEarned,
          totalPaid,
          pendingAmount,
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

  const openPaymentModal = (summary: WorkerPaymentSummary) => {
    setActiveSummary(summary);
    setAmount(summary.pendingAmount > 0 ? summary.pendingAmount.toString() : '');
    setDate('2026-06-23');
    setNote('');
    setShowModal(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSummary) return;

    const amtNum = parseFloat(amount);
    if (isNaN(amtNum) || amtNum <= 0) {
      showToast("Please enter a valid amount", "error");
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

      showToast(t('paymentSuccess', lang), "success");
      setShowModal(false);
      loadPaymentsData();
    } catch (error) {
      showToast("Failed to record payment", "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleHistory = (workerId: string) => {
    setExpandedWorkerId(prev => (prev === workerId ? null : workerId));
  };

  const filteredSummaries = summaries.filter(s =>
    s.worker.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.worker.village.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // General totals
  const totalEarnedAll = summaries.reduce((sum, s) => sum + s.totalEarned, 0);
  const totalPaidAll = summaries.reduce((sum, s) => sum + s.totalPaid, 0);
  const totalPendingAll = summaries.reduce((sum, s) => sum + s.pendingAmount, 0);

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
      <div className="grid grid-cols-3 gap-2 bg-white p-4 rounded-3xl border border-[#E0DBC5]/40 shadow-soft text-center shrink-0">
        <div>
          <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">
            {t('totalEarned', lang)}
          </span>
          <span className="text-sm font-extrabold text-text-dark block mt-1">
            ₹{totalEarnedAll}
          </span>
        </div>
        <div className="border-x border-gray-100">
          <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">
            {t('paidAmount', lang)}
          </span>
          <span className="text-sm font-extrabold text-success-green block mt-1">
            ₹{totalPaidAll}
          </span>
        </div>
        <div>
          <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">
            {t('pendingWages', lang)}
          </span>
          <span className={`text-sm font-extrabold block mt-1 ${
            totalPendingAll > 0 ? 'text-danger-red animate-pulse-soft' : 'text-success-green'
          }`}>
            ₹{totalPendingAll}
          </span>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative shrink-0">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('searchWorker', lang)}
          className="w-full bg-white border border-[#E0DBC5] text-text-dark font-medium rounded-2xl py-3.5 pl-11 pr-4 text-sm focus:outline-none focus:border-primary transition-all placeholder-gray-400"
        />
        <Search className="absolute left-4 top-3.5 text-gray-400" size={18} />
      </div>

      {/* Content layout */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : summaries.length === 0 ? (
        /* Empty State Illustration */
        <div className="flex flex-col items-center justify-center p-8 bg-white border border-[#E0DBC5]/30 rounded-3xl shadow-soft min-h-[300px]">
          <svg className="w-36 h-36 text-accent/25" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="40" y="50" width="120" height="100" rx="16" fill="#FFFDE5" stroke="#F9A825" strokeWidth="5" />
            <circle cx="100" cy="100" r="22" fill="#F9A825" fillOpacity="0.1" stroke="#F9A825" strokeWidth="5" />
            <path d="M100 88 L 100 112" stroke="#F9A825" strokeWidth="5" strokeLinecap="round" />
            <path d="M88 100 L 112 100" stroke="#F9A825" strokeWidth="5" strokeLinecap="round" />
            <circle cx="65" cy="72" r="5" fill="#2E7D32" />
            <circle cx="135" cy="72" r="5" fill="#2E7D32" />
          </svg>
          <h3 className="text-lg font-black text-text-dark mt-4">
            No payments tracked yet
          </h3>
          <p className="text-xs text-gray-400 font-semibold mt-1.5 text-center leading-normal">
            Add workers first and mark their attendance. You will see wage calculations here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Worker Payout Grid */}
          <div className="space-y-3">
            {filteredSummaries.map(s => {
              const isExpanded = expandedWorkerId === s.worker.id;
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
                        onClick={() => openPaymentModal(s)}
                        className="px-4 py-2 bg-accent text-white font-extrabold rounded-xl shadow-sm text-xs btn-active-scale cursor-pointer flex items-center gap-1"
                      >
                        <Plus size={13} />
                        {t('payButton', lang)}
                      </button>
                    </div>

                    {/* Financial Metrics */}
                    <div className="grid grid-cols-3 gap-2 bg-[#F8F5E9]/40 p-2.5 rounded-2xl border border-[#E0DBC5]/20 text-center">
                      <div>
                        <span className="text-[9px] text-gray-400 font-bold uppercase block">
                          Earned
                        </span>
                        <span className="text-xs font-bold text-text-dark block mt-0.5">
                          ₹{s.totalEarned}
                        </span>
                      </div>
                      <div className="border-x border-gray-100">
                        <span className="text-[9px] text-gray-400 font-bold uppercase block">
                          Paid
                        </span>
                        <span className="text-xs font-bold text-success-green block mt-0.5">
                          ₹{s.totalPaid}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-gray-400 font-bold uppercase block">
                          Pending
                        </span>
                        <span className={`text-xs font-bold block mt-0.5 ${
                          s.pendingAmount > 0 ? 'text-danger-red' : 'text-success-green'
                        }`}>
                          ₹{s.pendingAmount}
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
                        History ({s.paymentHistory.length})
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    )}
                  </div>

                  {/* History Drawer */}
                  <AnimatePresence>
                    {isExpanded && s.paymentHistory.length > 0 && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="bg-[#F8F5E9]/20 border-t border-[#E0DBC5]/30 overflow-hidden"
                      >
                        <div className="p-4 space-y-2 max-h-48 overflow-y-auto no-scrollbar">
                          {s.paymentHistory.map(p => (
                            <div
                              key={p.id}
                              className="bg-white p-2.5 rounded-xl border border-[#E0DBC5]/25 flex items-center justify-between text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-success-green/10 text-success-green rounded-lg">
                                  <ArrowUpRight size={13} />
                                </div>
                                <div>
                                  <span className="font-bold text-text-dark block">₹{p.amount}</span>
                                  <span className="text-[9px] text-gray-400 font-semibold">{p.note}</span>
                                </div>
                              </div>
                              <span className="font-semibold text-gray-500">{p.date}</span>
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
                Recent Transactions / ఇటీవలి చెల్లింపులు
              </h3>
              
              <div className="space-y-2.5 max-h-60 overflow-y-auto no-scrollbar pr-1">
                {globalPayments.slice(0, 10).map(p => {
                  const workerObj = summaries.find(s => s.worker.id === p.workerId);
                  return (
                    <div key={p.id} className="flex justify-between items-center bg-[#F8F5E9]/20 border border-[#E0DBC5]/15 p-2.5 rounded-2xl">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-success-green/10 text-success-green rounded-xl">
                          <DollarSign size={14} />
                        </div>
                        <div>
                          <span className="text-sm font-bold text-text-dark block leading-tight">{workerObj?.worker.name || 'Worker'}</span>
                          <span className="text-[9px] text-gray-400 font-semibold mt-0.5 block">{p.note}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-black text-success-green block leading-tight">+ ₹{p.amount}</span>
                        <span className="text-[9px] text-gray-400 font-semibold mt-0.5 block">{p.date}</span>
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
        {showModal && activeSummary && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end justify-center p-4">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-white w-full max-w-md rounded-t-3xl p-6 shadow-premium relative border-t border-[#E0DBC5]"
            >
              <button 
                onClick={() => setShowModal(false)}
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
                    placeholder="e.g. Weekly Wage / Advance / Partial payout"
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
