import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Edit2, Trash2, Phone, X, MapPin, DollarSign, FileText, Check, History } from 'lucide-react';
import { 
  Worker, 
  Payment,
  AttendanceRecord,
  fetchWorkers, 
  createWorker, 
  editWorker, 
  removeWorker,
  fetchPayments,
  createPayment,
  fetchAttendance,
  CropCycle,
  filterByCrop,
  editCropCycle,
  calculateWorkerEarnings,
  calculateWorkerPayments,
  calculateWorkerPending
} from '../firebase';
import { t, subT, Language } from '../utils/translation';
import { getLocalDateString } from '../utils/date';

interface WorkersViewProps {
  lang: Language;
  bilingual: boolean;
  showToast: (message: string, type: 'success' | 'error') => void;
  selectedCropCycleId: string;
  cropCycles: CropCycle[];
  onRefreshCropCycles: () => Promise<void>;
}

export const WorkersView: React.FC<WorkersViewProps> = ({
  lang,
  bilingual,
  showToast,
  selectedCropCycleId,
  cropCycles,
  onRefreshCropCycles
}) => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [rawPayments, setRawPayments] = useState<Payment[]>([]);
  const [rawAttendance, setRawAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'wage_asc' | 'wage_desc' | 'date'>('name');
  
  // Modals state
  const [showFormModal, setShowFormModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [activeWorkerForPay, setActiveWorkerForPay] = useState<{ worker: Worker; pending: number } | null>(null);
  const [historyWorker, setHistoryWorker] = useState<Worker | null>(null);
  const [historyTab, setHistoryTab] = useState<'attendance' | 'payments' | 'cropHistory'>('attendance');
  
  // Worker Form fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [village, setVillage] = useState('');
  const [dailyWage, setDailyWage] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [notes, setNotes] = useState('');

  // Payment Form fields
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(getLocalDateString());
  const [payNote, setPayNote] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const workersData = await fetchWorkers();
      const paymentsData = await fetchPayments();
      const allAtt = await fetchAttendance();

      // Find workers assigned to crop cycle if specific one is selected
      const cropObj = cropCycles.find(c => c.id === selectedCropCycleId);
      const assignedIds = cropObj ? cropObj.workerIds || [] : [];
      const filteredWorkers = selectedCropCycleId === 'all' || selectedCropCycleId === 'legacy_crop_2025_2026' 
        ? workersData 
        : workersData.filter(w => assignedIds.includes(w.id));

      const filteredPayments = filterByCrop(paymentsData, selectedCropCycleId);
      const filteredAttendance = filterByCrop(allAtt, selectedCropCycleId);

      setWorkers(filteredWorkers);
      setPayments(filteredPayments);
      setAttendance(filteredAttendance);
      setRawPayments(paymentsData);
      setRawAttendance(allAtt);
    } catch (e) {
      showToast("Error loading workers data", "error");
    } finally {
      setLoading(false);
    }
  }, [selectedCropCycleId, cropCycles, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openAddModal = () => {
    setEditingWorker(null);
    setName('');
    setPhone('');
    setVillage('');
    setDailyWage('');
    setStatus('active');
    setNotes('');
    setShowFormModal(true);
  };

  const openEditModal = (worker: Worker) => {
    setEditingWorker(worker);
    setName(worker.name);
    setPhone(worker.phone);
    setVillage(worker.village);
    setDailyWage(worker.dailyWage.toString());
    setStatus(worker.status);
    setNotes(worker.notes);
    setShowFormModal(true);
  };

  const openPayDirectModal = (worker: Worker, pending: number) => {
    setActiveWorkerForPay({ worker, pending });
    setPayAmount(pending > 0 ? pending.toString() : '');
    setPayDate(getLocalDateString());
    setPayNote('');
    setShowPayModal(true);
  };

  const handleSaveWorker = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      showToast("Please enter a worker name", "error");
      return;
    }
    
    const wageNum = parseFloat(dailyWage);
    if (isNaN(wageNum) || wageNum <= 0) {
      showToast("Please enter a valid wage amount", "error");
      return;
    }

    try {
      const workerData = {
        name: name.trim(),
        phone: phone.trim(),
        village: village.trim(),
        dailyWage: wageNum,
        status,
        notes: notes.trim()
      };

      if (editingWorker) {
        if (!window.confirm("Are you sure you want to save changes to this worker?")) return;
        await editWorker(editingWorker.id, workerData);
        showToast("Worker updated successfully", "success");
      } else {
        if (!window.confirm("Are you sure you want to add this new worker?")) return;
        const newId = await createWorker(workerData);
        if (selectedCropCycleId !== 'all' && selectedCropCycleId !== 'legacy_crop_2025_2026') {
          const activeCrop = cropCycles.find(c => c.id === selectedCropCycleId);
          if (activeCrop) {
            const currentWorkerIds = activeCrop.workerIds || [];
            if (!currentWorkerIds.includes(newId)) {
              await editCropCycle(selectedCropCycleId, {
                workerIds: [...currentWorkerIds, newId]
              });
              await onRefreshCropCycles();
            }
          }
        }
        showToast("Worker added successfully", "success");
      }

      setShowFormModal(false);
      loadData();
    } catch (error) {
      showToast("Failed to save worker", "error");
    }
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkerForPay) return;

    const amtNum = parseFloat(payAmount);
    if (isNaN(amtNum) || amtNum <= 0) {
      showToast("Please enter a valid amount", "error");
      return;
    }

    if (amtNum > activeWorkerForPay.pending) {
      showToast(t('validationPayExceedsPending', lang), "error");
      return;
    }

    setSavingPayment(true);
    try {
      if (!window.confirm(`Are you sure you want to record a payment of ₹${amtNum} to ${activeWorkerForPay.worker.name}?`)) {
        setSavingPayment(false);
        return;
      }
      await createPayment({
        workerId: activeWorkerForPay.worker.id,
        amount: amtNum,
        date: payDate,
        note: payNote.trim() || 'Wage Payment',
        cropCycleId: selectedCropCycleId !== 'all' ? selectedCropCycleId : 'legacy_crop_2025_2026'
      });

      showToast(t('paymentSuccess', lang), "success");
      setShowPayModal(false);
      loadData(); // Refresh all calculations
    } catch (err: any) {
      showToast(err.message || "Failed to record payment", "error");
    } finally {
      setSavingPayment(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm(t('confirmDelete', lang))) {
      try {
        await removeWorker(id);
        showToast("Worker deleted successfully", "success");
        loadData();
      } catch (error: any) {
        showToast(error.message || "Failed to delete worker", "error");
      }
    }
  };

  // Filter and sort workers based on state
  const sortedAndFilteredWorkers = workers
    .filter(w => 
      w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.village.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      } else if (sortBy === 'wage_asc') {
        return a.dailyWage - b.dailyWage;
      } else if (sortBy === 'wage_desc') {
        return b.dailyWage - a.dailyWage;
      } else if (sortBy === 'date') {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
      return 0;
    });

  return (
    <div className="flex-1 p-4 pb-24 overflow-y-auto no-scrollbar flex flex-col">
      {/* Title */}
      <div className="mb-5 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-text-dark">
            {bilingual ? `${t('workers', lang)} / ${subT('workers', lang)}` : t('workers', lang)}
          </h1>
          <p className="text-xs text-gray-400 font-semibold mt-1">
            Manage your agricultural workforce
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-primary text-white p-3 rounded-2xl shadow-soft btn-active-scale cursor-pointer flex items-center gap-1 font-bold text-sm"
        >
          <Plus size={18} />
          {t('addWorker', lang)}
        </button>
      </div>

      {/* Search Input */}
      <div className="relative mb-4 shrink-0">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('searchWorker', lang)}
          className="w-full bg-white border border-[#E0DBC5] text-text-dark font-medium rounded-2xl py-3.5 pl-11 pr-4 text-sm focus:outline-none focus:border-primary transition-all placeholder-gray-400"
        />
        <Search className="absolute left-4 top-3.5 text-gray-400" size={18} />
      </div>

      {/* Sort Options */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 no-scrollbar select-none shrink-0 items-center">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1 shrink-0">Sort By:</span>
        <button
          onClick={() => setSortBy('name')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
            sortBy === 'name' ? 'bg-primary text-white shadow-sm' : 'bg-white text-gray-500 border border-[#E0DBC5]/40'
          }`}
        >
          Name
        </button>
        <button
          onClick={() => setSortBy('wage_asc')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
            sortBy === 'wage_asc' ? 'bg-primary text-white shadow-sm' : 'bg-white text-gray-500 border border-[#E0DBC5]/40'
          }`}
        >
          Wage: Low-High
        </button>
        <button
          onClick={() => setSortBy('wage_desc')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
            sortBy === 'wage_desc' ? 'bg-primary text-white shadow-sm' : 'bg-white text-gray-500 border border-[#E0DBC5]/40'
          }`}
        >
          Wage: High-Low
        </button>
        <button
          onClick={() => setSortBy('date')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
            sortBy === 'date' ? 'bg-primary text-white shadow-sm' : 'bg-white text-gray-500 border border-[#E0DBC5]/40'
          }`}
        >
          Date Added
        </button>
      </div>

      {/* Workers list */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : sortedAndFilteredWorkers.length === 0 ? (
        /* Empty State Illustration */
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white border border-[#E0DBC5]/30 rounded-3xl shadow-soft min-h-[350px]">
          <svg className="w-40 h-40 text-[#81C784]/30" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="100" cy="100" r="70" fill="#E8F5E9" />
            <path d="M70 120 C 70 90, 85 85, 100 85 C 115 85, 130 90, 130 120" stroke="#81C784" strokeWidth="6" strokeLinecap="round" />
            <circle cx="100" cy="65" r="18" stroke="#81C784" strokeWidth="6" />
            <path d="M100 125 L 100 160" stroke="#81C784" strokeWidth="6" strokeLinecap="round" />
            <path d="M85 140 L 115 140" stroke="#81C784" strokeWidth="6" strokeLinecap="round" />
            <circle cx="50" cy="130" r="4" fill="#F9A825" />
            <circle cx="150" cy="80" r="5" fill="#F9A825" />
          </svg>
          <h3 className="text-lg font-black text-text-dark mt-4">
            {t('emptyWorkers', lang)}
          </h3>
          <p className="text-xs text-gray-400 font-semibold mt-1.5 text-center px-4 leading-normal">
            {t('addWorkerPrompt', lang)}
          </p>
          <button
            onClick={openAddModal}
            className="mt-6 px-6 py-3.5 bg-primary text-white font-bold rounded-2xl shadow-soft btn-active-scale cursor-pointer flex items-center gap-1.5 text-sm"
          >
            <Plus size={16} />
            {t('addWorker', lang)}
          </button>
        </div>
      ) : (
        <div className="space-y-4 flex-1">
          {sortedAndFilteredWorkers.map(w => {
            const earned = calculateWorkerEarnings(w, attendance);
            const paid = calculateWorkerPayments(w, payments);
            const pending = calculateWorkerPending(w, attendance, payments);
            const pendingVal = pending > 0 ? pending : 0;
            const advanceVal = pending < 0 ? Math.abs(pending) : 0;

            return (
              <div
                key={w.id}
                className="bg-white p-4 rounded-3xl border border-[#E0DBC5]/40 shadow-soft relative flex flex-col justify-between"
              >
                {/* Header section */}
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="text-lg font-bold text-text-dark leading-tight">{w.name}</h3>
                    <div className="flex items-center gap-1.5 mt-1 text-xs font-bold text-primary">
                      <span>₹{w.dailyWage} / day</span>
                      <span className="text-gray-300">•</span>
                      <span className="flex items-center gap-0.5 text-gray-400">
                        <MapPin size={12} />
                        {w.village || 'No Village'}
                      </span>
                    </div>
                  </div>
                  <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full ${
                    w.status === 'active' ? 'bg-success-green/10 text-success-green' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {t(w.status, lang)}
                  </span>
                </div>

                {/* Calculated Payout Metrics */}
                <div className="grid grid-cols-3 gap-2 bg-[#F8F5E9]/35 p-3 rounded-2xl border border-[#E0DBC5]/15 text-center mt-2.5">
                  <div>
                    <span className="text-[9px] text-gray-400 font-extrabold uppercase block tracking-wider">
                      Earned
                    </span>
                    <span className="text-sm font-black text-text-dark block mt-0.5">
                      ₹{earned}
                    </span>
                  </div>
                  <div className="border-x border-gray-100">
                    <span className="text-[9px] text-gray-400 font-extrabold uppercase block tracking-wider">
                      Paid
                    </span>
                    <span className="text-sm font-black text-success-green block mt-0.5">
                      ₹{paid}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-gray-400 font-extrabold uppercase block tracking-wider">
                      {advanceVal > 0 ? 'Advance' : 'Pending'}
                    </span>
                    <span className={`text-sm font-black block mt-0.5 ${
                      pendingVal > 0 ? 'text-danger-red animate-pulse-soft' : 'text-success-green'
                    }`}>
                      ₹{advanceVal > 0 ? advanceVal : pendingVal}
                    </span>
                  </div>
                </div>

                {w.notes && (
                  <div className="bg-[#F8F5E9]/50 border border-[#E0DBC5]/30 rounded-xl p-2.5 mt-3 text-xs text-gray-500 font-medium flex gap-1.5">
                    <FileText size={14} className="text-accent shrink-0 mt-0.5" />
                    <span className="italic leading-snug">{w.notes}</span>
                  </div>
                )}

                {/* Action Buttons Row */}
                <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-50">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDelete(w.id)}
                      className="p-2.5 bg-danger-red/10 text-danger-red rounded-xl active:scale-90 transition-all cursor-pointer"
                      title="Delete Worker"
                    >
                      <Trash2 size={15} />
                    </button>
                    <button
                      onClick={() => openEditModal(w)}
                      className="p-2.5 bg-primary/10 text-primary rounded-xl active:scale-90 transition-all cursor-pointer"
                      title="Edit Details"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => setHistoryWorker(w)}
                      className="p-2.5 bg-accent/10 text-accent rounded-xl active:scale-90 transition-all cursor-pointer"
                      title="View Ledger Statement"
                    >
                      <History size={15} />
                    </button>
                    {w.phone && (
                      <a
                        href={`tel:${w.phone}`}
                        className="p-2.5 bg-success-green/10 text-success-green rounded-xl active:scale-90 transition-all cursor-pointer"
                        title="Call Worker"
                      >
                        <Phone size={15} />
                      </a>
                    )}
                  </div>

                  {/* Direct payment CTA */}
                  <button
                    onClick={() => openPayDirectModal(w, pendingVal)}
                    className="px-4 py-2 bg-accent text-white font-extrabold rounded-xl shadow-sm text-xs btn-active-scale cursor-pointer flex items-center gap-1"
                  >
                    <DollarSign size={13} />
                    Pay Worker
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Worker Drawer Sheet */}
      <AnimatePresence>
        {showFormModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end justify-center p-4">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-white w-full max-w-md rounded-t-3xl p-6 shadow-premium relative border-t border-[#E0DBC5] max-h-[90vh] overflow-y-auto"
            >
              <button 
                onClick={() => setShowFormModal(false)}
                className="absolute top-4 right-4 p-1.5 bg-gray-100 rounded-full text-gray-500 active:scale-90"
              >
                <X size={18} />
              </button>

              <h3 className="text-xl font-bold text-text-dark mb-5">
                {editingWorker ? t('editWorker', lang) : t('addWorker', lang)}
              </h3>

              <form onSubmit={handleSaveWorker} className="space-y-4">
                {/* Name */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">
                    {t('name', lang)}
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ramesh"
                    className="form-input"
                  />
                </div>

                {/* Phone */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">
                    {t('phone', lang)}
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 9848022338"
                    className="form-input"
                  />
                </div>

                {/* Village */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">
                    {t('village', lang)}
                  </label>
                  <input
                    type="text"
                    value={village}
                    onChange={(e) => setVillage(e.target.value)}
                    placeholder="e.g. Undi"
                    className="form-input"
                  />
                </div>

                {/* Daily Wage */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">
                    {t('dailyWage', lang)}
                  </label>
                  <input
                    type="number"
                    required
                    value={dailyWage}
                    onChange={(e) => setDailyWage(e.target.value)}
                    placeholder="e.g. 500"
                    className="form-input"
                  />
                </div>

                {/* Status Toggle */}
                <div className="flex items-center justify-between p-2 bg-[#F8F5E9] rounded-2xl border border-[#E0DBC5]/50">
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider pl-2">
                    {t('status', lang)}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setStatus('active')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        status === 'active' ? 'bg-primary text-white shadow-sm' : 'bg-white text-gray-400 border border-gray-200'
                      }`}
                    >
                      {t('active', lang)}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus('inactive')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        status === 'inactive' ? 'bg-gray-400 text-white shadow-sm' : 'bg-white text-gray-400 border border-gray-200'
                      }`}
                    >
                      {t('inactive', lang)}
                    </button>
                  </div>
                </div>

                {/* Notes */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">
                    {t('notes', lang)}
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Tractor driving or planting"
                    className="form-input resize-none"
                  />
                </div>

                {/* Save Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowFormModal(false)}
                    className="flex-1 py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl active:scale-95 text-sm transition-all cursor-pointer"
                  >
                    {t('cancel', lang)}
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-4 bg-primary text-white font-bold rounded-2xl active:scale-95 shadow-soft text-sm transition-all cursor-pointer"
                  >
                    {t('save', lang)}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Direct Record Payment Drawer Sheet */}
      <AnimatePresence>
        {showPayModal && activeWorkerForPay && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end justify-center p-4">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-white w-full max-w-md rounded-t-3xl p-6 shadow-premium relative border-t border-[#E0DBC5]"
            >
              <button 
                onClick={() => setShowPayModal(false)}
                className="absolute top-4 right-4 p-1.5 bg-gray-100 rounded-full text-gray-500 active:scale-90"
              >
                <X size={18} />
              </button>

              <h3 className="text-xl font-bold text-text-dark mb-1">
                Record Payment
              </h3>
              <p className="text-xs text-gray-400 font-semibold mb-5">
                Paying <strong className="text-primary">{activeWorkerForPay.worker.name}</strong>
              </p>

              <form onSubmit={handleSavePayment} className="space-y-4">
                {/* Amount */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">
                    Amount (₹)
                  </label>
                  <input
                    type="number"
                    required
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="e.g. 1000"
                    className="form-input"
                  />
                  {activeWorkerForPay.pending > 0 && (
                    <div className="text-[9px] text-gray-400 pl-1 mt-0.5">
                      Pending balance: ₹{activeWorkerForPay.pending} (pre-filled)
                    </div>
                  )}
                </div>

                {/* Date */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    required
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="form-input"
                  />
                </div>

                {/* Note */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">
                    Note
                  </label>
                  <input
                    type="text"
                    value={payNote}
                    onChange={(e) => setPayNote(e.target.value)}
                    placeholder="e.g. Weekly Wage / Advance"
                    className="form-input"
                  />
                </div>

                {/* Save Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowPayModal(false)}
                    className="flex-1 py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl active:scale-95 text-sm transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingPayment}
                    className="flex-1 py-4 bg-primary text-white font-bold rounded-2xl active:scale-95 shadow-soft text-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {savingPayment ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <Check size={15} />
                        Record Payout
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Worker History Drawer Sheet */}
      <AnimatePresence>
        {historyWorker && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end justify-center p-4">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-white w-full max-w-md rounded-t-3xl p-6 shadow-premium relative border-t border-[#E0DBC5] max-h-[90vh] overflow-y-auto flex flex-col"
            >
              <button 
                onClick={() => setHistoryWorker(null)}
                className="absolute top-4 right-4 p-1.5 bg-gray-100 rounded-full text-gray-500 active:scale-90"
              >
                <X size={18} />
              </button>

              <h3 className="text-xl font-bold text-text-dark mb-1">
                Worker History & Ledger
              </h3>
              <p className="text-xs text-gray-400 font-semibold mb-4">
                Detailed statement for <strong className="text-primary">{historyWorker.name}</strong>
              </p>

              {/* Stats Card */}
              {(() => {
                const wAtt = attendance.filter(a => a.workerId === historyWorker.id);
                const wPay = payments.filter(p => p.workerId === historyWorker.id);
                const pDays = wAtt.filter(a => a.status === 'present').length;
                const hDays = wAtt.filter(a => a.status === 'half_day').length;
                const totalEarned = calculateWorkerEarnings(historyWorker, attendance);
                const totalPaid = calculateWorkerPayments(historyWorker, payments);
                const balance = calculateWorkerPending(historyWorker, attendance, payments);
                
                return (
                  <>
                    <div className="grid grid-cols-4 gap-2 bg-[#F8F5E9]/50 p-3 rounded-2xl border border-[#E0DBC5] text-center mb-4 text-[10px]">
                      <div>
                        <span className="text-[8px] text-gray-400 font-bold block uppercase">Days Worked</span>
                        <span className="text-xs font-black text-text-dark block mt-1">{pDays + hDays * 0.5}</span>
                      </div>
                      <div>
                        <span className="text-[8px] text-gray-400 font-bold block uppercase">Earned</span>
                        <span className="text-xs font-black text-text-dark block mt-1">₹{totalEarned}</span>
                      </div>
                      <div>
                        <span className="text-[8px] text-gray-400 font-bold block uppercase">Paid</span>
                        <span className="text-xs font-black text-success-green block mt-1">₹{totalPaid}</span>
                      </div>
                      <div>
                        {balance >= 0 ? (
                          <>
                            <span className="text-[8px] text-gray-400 font-bold block uppercase">Pending</span>
                            <span className="text-xs font-black text-danger-red block mt-1">₹{balance}</span>
                          </>
                        ) : (
                          <>
                            <span className="text-[8px] text-gray-400 font-bold block uppercase">Advance</span>
                            <span className="text-xs font-black text-success-green block mt-1">₹{Math.abs(balance)}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Tabs inside history drawer */}
                    <div className="flex bg-[#F8F5E9] p-1 rounded-xl border border-[#E0DBC5]/50 mb-4 text-[10px] gap-0.5">
                      <button
                        type="button"
                        onClick={() => setHistoryTab('attendance')}
                        className={`flex-1 py-2 font-bold rounded-lg transition-all cursor-pointer ${
                          historyTab === 'attendance' ? 'bg-primary text-white shadow-sm' : 'text-gray-500'
                        }`}
                      >
                        Attendance ({wAtt.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setHistoryTab('payments')}
                        className={`flex-1 py-2 font-bold rounded-lg transition-all cursor-pointer ${
                          historyTab === 'payments' ? 'bg-primary text-white shadow-sm' : 'text-gray-500'
                        }`}
                      >
                        Payments ({wPay.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setHistoryTab('cropHistory')}
                        className={`flex-1 py-2 font-bold rounded-lg transition-all cursor-pointer ${
                          historyTab === 'cropHistory' ? 'bg-primary text-white shadow-sm' : 'text-gray-500'
                        }`}
                      >
                        Crop History
                      </button>
                    </div>

                    {/* Tab contents */}
                    <div className="flex-1 min-h-[250px] overflow-y-auto max-h-[40vh] space-y-2 pr-1 no-scrollbar">
                      {historyTab === 'attendance' ? (
                        wAtt.length === 0 ? (
                          <div className="text-center py-10 text-gray-400 text-xs">No attendance recorded.</div>
                        ) : (
                          [...wAtt]
                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                            .map(a => (
                              <div key={a.id || a.date} className="flex justify-between items-center bg-[#F8F5E9]/20 border border-[#E0DBC5]/10 p-2.5 rounded-xl">
                                <div>
                                  <span className="text-xs font-bold text-text-dark block">{a.date}</span>
                                  {a.workType && <span className="text-[9px] text-gray-400 block mt-0.5">{a.workType}</span>}
                                </div>
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                                  a.status === 'present' 
                                    ? 'bg-success-green/10 text-success-green' 
                                    : a.status === 'half_day'
                                      ? 'bg-amber-100 text-amber-700'
                                      : 'bg-danger-red/10 text-danger-red'
                                }`}>
                                  {a.status === 'half_day' ? 'Half Day' : a.status}
                                </span>
                              </div>
                            ))
                        )
                      ) : historyTab === 'payments' ? (
                        wPay.length === 0 ? (
                          <div className="text-center py-10 text-gray-400 text-xs">No payments recorded.</div>
                        ) : (
                          [...wPay]
                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                            .map(p => (
                              <div key={p.id} className="flex justify-between items-start bg-[#F8F5E9]/20 border border-[#E0DBC5]/10 p-2.5 rounded-xl text-xs">
                                <div>
                                  <span className="font-bold text-text-dark block">₹{p.amount}</span>
                                  {p.note && <span className="text-[9px] text-gray-400 block mt-0.5">{p.note}</span>}
                                </div>
                                <span className="text-[10px] font-semibold text-gray-400">{p.date}</span>
                              </div>
                            ))
                        )
                      ) : (
                        (() => {
                          const cropRows = cropCycles.map(c => {
                            const cycleAtt = rawAttendance.filter(a => a.workerId === historyWorker.id && a.cropCycleId === c.id);
                            const cyclePay = rawPayments.filter(p => p.workerId === historyWorker.id && p.cropCycleId === c.id);
                            const pDays = cycleAtt.filter(a => a.status === 'present').length;
                            const hDays = cycleAtt.filter(a => a.status === 'half_day').length;
                            const days = pDays + hDays * 0.5;
                            const earned = calculateWorkerEarnings(historyWorker, cycleAtt);
                            const paid = calculateWorkerPayments(historyWorker, cyclePay);
                            const balance = calculateWorkerPending(historyWorker, cycleAtt, cyclePay);
                            const name = c.id === 'legacy_crop_2025_2026' ? '2025 to 2026' : c.cropName;
                            const season = c.id === 'legacy_crop_2025_2026' ? '2025 to 2026' : c.season;
                            return { name, season, days, earned, paid, balance };
                          }).filter(row => row.days > 0 || row.paid > 0);

                          // Legacy records grouping
                          const legacyAtt = rawAttendance.filter(a => a.workerId === historyWorker.id && !a.cropCycleId);
                          const legacyPay = rawPayments.filter(p => p.workerId === historyWorker.id && !p.cropCycleId);
                          const lpDays = legacyAtt.filter(a => a.status === 'present').length;
                          const lhDays = legacyAtt.filter(a => a.status === 'half_day').length;
                          const legacyDays = lpDays + lhDays * 0.5;
                          const legacyEarned = calculateWorkerEarnings(historyWorker, legacyAtt);
                          const legacyPaid = calculateWorkerPayments(historyWorker, legacyPay);
                          const legacyBalance = calculateWorkerPending(historyWorker, legacyAtt, legacyPay);

                          if (legacyDays > 0 || legacyPaid > 0) {
                            cropRows.push({
                              name: 'Legacy Records',
                              season: 'N/A',
                              days: legacyDays,
                              earned: legacyEarned,
                              paid: legacyPaid,
                              balance: legacyBalance
                            });
                          }

                          if (cropRows.length === 0) {
                            return <div className="text-center py-10 text-gray-400 text-xs">No crop cycle history.</div>;
                          }

                          return (
                            <div className="space-y-3">
                              {cropRows.map((row, idx) => (
                                <div key={idx} className="bg-[#F8F5E9]/30 border border-[#E0DBC5]/30 p-3 rounded-2xl flex flex-col gap-1.5 shadow-xs">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <h4 className="text-[11px] font-bold text-text-dark leading-tight">
                                        {row.season && row.season !== 'N/A' ? `${row.name} (${row.season})` : row.name}
                                      </h4>
                                    </div>
                                    <span className="text-[10px] font-extrabold text-primary">₹{row.earned} earned</span>
                                  </div>
                                  <div className="grid grid-cols-3 gap-2 text-center text-[10px] pt-1.5 border-t border-dashed border-[#E0DBC5]/20 mt-1">
                                    <div>
                                      <span className="text-[8px] text-gray-400 block font-bold">Days</span>
                                      <span className="font-extrabold text-text-dark block">{row.days}</span>
                                    </div>
                                    <div>
                                      <span className="text-[8px] text-gray-400 block font-bold">Paid</span>
                                      <span className="font-extrabold text-success-green block">₹{row.paid}</span>
                                    </div>
                                    <div>
                                      <span className="text-[8px] text-gray-400 block font-bold">{row.balance >= 0 ? 'Pending' : 'Advance'}</span>
                                      <span className={`font-extrabold block ${row.balance >= 0 ? 'text-danger-red' : 'text-success-green'}`}>
                                        ₹{Math.abs(row.balance)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })()
                      )}
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
