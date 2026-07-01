import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, 
  ChevronLeft, 
  ChevronRight, 
  UserCheck, 
  Search, 
  Trash2, 
  Edit2, 
  X, 
  Calendar, 
  Filter, 
  History,
  Clock
} from 'lucide-react';
import { 
  Worker, 
  AttendanceRecord, 
  fetchWorkers, 
  fetchAttendanceByDate, 
  fetchAttendance, 
  saveAttendanceList, 
  editAttendance, 
  removeAttendance,
  CropCycle,
  filterByCrop
} from '../firebase';
import { t, subT, Language } from '../utils/translation';
import { getLocalDateString } from '../utils/date';


interface AttendanceViewProps {
  lang: Language;
  bilingual: boolean;
  showToast: (message: string, type: 'success' | 'error') => void;
  selectedCropCycleId: string;
  cropCycles: CropCycle[];
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({
  lang,
  bilingual,
  showToast,
  selectedCropCycleId,
  cropCycles
}) => {
  // Navigation tabs: 'register' (mark attendance) and 'history' (view/edit past records)
  const [activeTab, setActiveTab] = useState<'register' | 'history'>('register');
  
  // Workers and raw data lists
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [allAttendance, setAllAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // --- REGISTER TAB STATES ---
  const [selectedDate, setSelectedDate] = useState(getLocalDateString()); // Target system date (dynamic today)
  const [registerAttendance, setRegisterAttendance] = useState<Record<string, 'present' | 'absent' | 'half_day'>>({});
  const [registerWages, setRegisterWages] = useState<Record<string, string>>({});
  const [registerWorkTypes, setRegisterWorkTypes] = useState<Record<string, string>>({});
  const [registerNotes, setRegisterNotes] = useState<Record<string, string>>({});
  const [registerSearch, setRegisterSearch] = useState('');

  // --- HISTORY TAB STATES ---
  const [historySearch, setHistorySearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'absent' | 'half_day'>('all');
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editStatus, setEditStatus] = useState<'present' | 'absent' | 'half_day'>('present');
  
  // Edit modal fields
  const [editWage, setEditWage] = useState('');
  const [editWorkType, setEditWorkType] = useState('');
  const [editNotes, setEditNotes] = useState('');

  useEffect(() => {
    loadData();
  }, [selectedDate, activeTab, selectedCropCycleId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const workersData = await fetchWorkers();
      setWorkers(workersData); // Keep all workers for history rendering lookup

      // Determine workers associated with selected crop cycle
      const cropObj = cropCycles.find(c => c.id === selectedCropCycleId);
      const assignedIds = cropObj ? cropObj.workerIds || [] : [];
      const filteredWorkers = selectedCropCycleId === 'all' || selectedCropCycleId === 'legacy_crop_2025_2026' 
        ? workersData 
        : workersData.filter(w => assignedIds.includes(w.id));

      const activeWorkers = filteredWorkers.filter(w => w.status === 'active');

      if (activeTab === 'register') {
        const attendanceData = await fetchAttendanceByDate(selectedDate);
        const attMap: Record<string, 'present' | 'absent' | 'half_day'> = {};
        const wageMap: Record<string, string> = {};
        const typeMap: Record<string, string> = {};
        const notesMap: Record<string, string> = {};
        
        activeWorkers.forEach(w => {
          const record = filterByCrop(attendanceData, selectedCropCycleId).find(a => a.workerId === w.id);
          attMap[w.id] = record ? record.status : 'absent';
          wageMap[w.id] = record && record.wageForDay !== undefined ? record.wageForDay.toString() : w.dailyWage.toString();
          typeMap[w.id] = record && record.workType ? record.workType : '';
          notesMap[w.id] = record && record.notes ? record.notes : '';
        });
        setRegisterAttendance(attMap);
        setRegisterWages(wageMap);
        setRegisterWorkTypes(typeMap);
        setRegisterNotes(notesMap);
      } else {
        let attendanceData = await fetchAttendance();
        attendanceData = filterByCrop(attendanceData, selectedCropCycleId);
        setAllAttendance(attendanceData);
      }
    } catch (e) {
      showToast("Error loading attendance records", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterStatusChange = (workerId: string, status: 'present' | 'absent' | 'half_day') => {
    setRegisterAttendance(prev => ({
      ...prev,
      [workerId]: status
    }));

    // Autofill wage using default if empty or not set
    const worker = workers.find(w => w.id === workerId);
    if (worker && (!registerWages[workerId] || registerWages[workerId] === '0')) {
      setRegisterWages(prev => ({
        ...prev,
        [workerId]: worker.dailyWage.toString()
      }));
    }
  };

  const handleMarkAll = (status: 'present' | 'absent' | 'half_day') => {
    const updated: Record<string, 'present' | 'absent' | 'half_day'> = {};
    const updatedWages: Record<string, string> = { ...registerWages };

    const cropObj = cropCycles.find(c => c.id === selectedCropCycleId);
    const assignedIds = cropObj ? cropObj.workerIds || [] : [];
    const filteredWorkers = selectedCropCycleId === 'all' || selectedCropCycleId === 'legacy_crop_2025_2026' 
      ? workers 
      : workers.filter(w => assignedIds.includes(w.id));

    filteredWorkers.filter(w => w.status === 'active').forEach(w => {
      updated[w.id] = status;
      if (status !== 'absent' && (!updatedWages[w.id] || updatedWages[w.id] === '0')) {
        updatedWages[w.id] = w.dailyWage.toString();
      }
    });

    setRegisterAttendance(updated);
    setRegisterWages(updatedWages);
    
    let msg = "All workers marked absent";
    if (status === 'present') msg = "All workers marked present";
    if (status === 'half_day') msg = "All workers marked half day";
    showToast(msg, "success");
  };

  const handleSaveRegister = async () => {
    // Validation: Check for negative daily wages for active workers
    for (const [workerId, status] of Object.entries(registerAttendance)) {
      if (status !== 'absent') {
        const rawWage = parseFloat(registerWages[workerId]);
        if (isNaN(rawWage) || rawWage < 0) {
          showToast(t('validationNegative', lang), "error");
          return;
        }
      }
    }

    if (!window.confirm(`Are you sure you want to save attendance for ${formatDateLabel(selectedDate)}?`)) {
      return;
    }
    
    setSaving(true);
    try {
      const recordsToSave = Object.entries(registerAttendance).map(([workerId, status]) => {
        const rawWage = parseFloat(registerWages[workerId]);
        const wageForDay = isNaN(rawWage) || status === 'absent' ? 0 : rawWage;
        return {
          workerId,
          date: selectedDate,
          status,
          wageForDay,
          workType: registerWorkTypes[workerId] || '',
          notes: registerNotes[workerId] || '',
          cropCycleId: selectedCropCycleId !== 'all' ? selectedCropCycleId : 'legacy_crop_2025_2026'
        };
      });

      await saveAttendanceList(selectedDate, recordsToSave);
      showToast(t('attendanceSaved', lang), "success");
      loadData();
    } catch (e) {
      showToast("Error saving attendance", "error");
    } finally {
      setSaving(false);
    }
  };

  // --- HISTORY CRUD ACTIONS ---
  const handleOpenEdit = (record: AttendanceRecord) => {
    setEditingRecord(record);
    setEditStatus(record.status);

    const worker = workers.find(w => w.id === record.workerId);
    setEditWage(record.wageForDay !== undefined ? record.wageForDay.toString() : (worker ? worker.dailyWage.toString() : ''));
    setEditWorkType(record.workType || '');
    setEditNotes(record.notes || '');
  };

  const handleSaveEdit = async () => {
    if (!editingRecord) return;
    
    const rawWage = parseFloat(editWage);
    if (editStatus !== 'absent' && (isNaN(rawWage) || rawWage < 0)) {
      showToast(t('validationNegative', lang), "error");
      return;
    }

    if (!window.confirm("Are you sure you want to change this attendance status?")) {
      return;
    }

    try {
      // If Firestore, unique ID is workerId_date
      const docId = editingRecord.id || `${editingRecord.workerId}_${editingRecord.date}`;
      const wageForDay = isNaN(rawWage) || editStatus === 'absent' ? 0 : rawWage;
      
      await editAttendance(docId, { 
        status: editStatus,
        wageForDay,
        workType: editWorkType,
        notes: editNotes
      });
      showToast("Attendance updated successfully", "success");
      setEditingRecord(null);
      loadData();
    } catch (e) {
      showToast("Failed to update attendance", "error");
    }
  };

  const handleDeleteRecord = async (recordId: string, workerName: string, date: string) => {
    if (!window.confirm(`Are you sure you want to delete the attendance log for ${workerName} on ${date}?`)) {
      return;
    }

    try {
      await removeAttendance(recordId);
      showToast("Attendance record deleted", "success");
      loadData();
    } catch (e) {
      showToast("Failed to delete attendance", "error");
    }
  };

  const adjustDate = (days: number) => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    const current = new Date(year, month - 1, day);
    current.setDate(current.getDate() + days);
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, '0');
    const dd = String(current.getDate()).padStart(2, '0');
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
  };

  const formatDateLabel = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    const weekday = d.toLocaleDateString(lang === 'te' ? 'te-IN' : 'en-US', { weekday: 'long' });
    const formatted = d.toLocaleDateString(lang === 'te' ? 'te-IN' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${weekday}, ${formatted}`;
  };

  // --- REGISTER COMPUTED VALUES ---
  const activeCropObj = cropCycles.find(c => c.id === selectedCropCycleId);
  const assignedCropWorkerIds = activeCropObj ? activeCropObj.workerIds || [] : [];
  const activeWorkers = workers.filter(w => 
    w.status === 'active' && 
    (selectedCropCycleId === 'all' || selectedCropCycleId === 'legacy_crop_2025_2026' || assignedCropWorkerIds.includes(w.id))
  );
  const filteredRegisterWorkers = activeWorkers.filter(w => 
    w.name.toLowerCase().includes(registerSearch.toLowerCase()) ||
    w.village.toLowerCase().includes(registerSearch.toLowerCase())
  );

  const regPresentCount = Object.values(registerAttendance).filter(s => s === 'present').length;
  const regHalfCount = Object.values(registerAttendance).filter(s => s === 'half_day').length;
  const regAbsentCount = Object.values(registerAttendance).filter(s => s === 'absent').length;

  const totalLaborCostToday = activeWorkers.reduce((sum, w) => {
    const status = registerAttendance[w.id];
    const rawWage = parseFloat(registerWages[w.id]);
    const wage = isNaN(rawWage) ? w.dailyWage : rawWage;
    if (status === 'present') return sum + wage;
    if (status === 'half_day') return sum + wage * 0.5;
    return sum;
  }, 0);

  // --- HISTORY COMPUTED VALUES ---
  const filteredHistoryRecords = allAttendance
    .filter(a => {
      const worker = workers.find(w => w.id === a.workerId);
      if (!worker) return false;

      const matchesSearch = worker.name.toLowerCase().includes(historySearch.toLowerCase()) || 
                            worker.village.toLowerCase().includes(historySearch.toLowerCase());
      
      const matchesStart = startDate ? a.date >= startDate : true;
      const matchesEnd = endDate ? a.date <= endDate : true;
      const matchesStatus = statusFilter === 'all' ? true : a.status === statusFilter;

      return matchesSearch && matchesStart && matchesEnd && matchesStatus;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const histPresentCount = filteredHistoryRecords.filter(r => r.status === 'present').length;
  const histHalfCount = filteredHistoryRecords.filter(r => r.status === 'half_day').length;
  const histAbsentCount = filteredHistoryRecords.filter(r => r.status === 'absent').length;
  const totalHistCount = filteredHistoryRecords.length;

  const histAttendancePercentage = totalHistCount > 0 
    ? Math.round(((histPresentCount + histHalfCount * 0.5) / totalHistCount) * 100)
    : 0;

  const totalHistLaborCost = filteredHistoryRecords.reduce((sum, r) => {
    const worker = workers.find(w => w.id === r.workerId);
    if (!worker) return sum;
    const wage = r.wageForDay !== undefined ? r.wageForDay : worker.dailyWage;
    if (r.status === 'present') return sum + wage;
    if (r.status === 'half_day') return sum + wage * 0.5;
    return sum;
  }, 0);

  return (
    <div className="flex-1 p-4 pb-24 overflow-y-auto no-scrollbar flex flex-col justify-between">
      <div>
        {/* Title */}
        <div className="mb-5 flex justify-between items-center shrink-0">
          <div>
            <h1 className="text-2xl font-extrabold text-text-dark">
              {bilingual ? `${t('attendancePage', lang)} / ${subT('attendancePage', lang)}` : t('attendancePage', lang)}
            </h1>
            <p className="text-xs text-gray-400 font-semibold mt-1">
              {activeTab === 'register' 
                ? 'Register daily workforce presence' 
                : 'Review and modify attendance statements'}
            </p>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-white p-1 rounded-2xl border border-[#E0DBC5]/40 shadow-soft mb-5 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('register')}
            className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'register' ? 'bg-primary text-white shadow-sm' : 'text-gray-500'
            }`}
          >
            <CheckCircle2 size={15} />
            {bilingual ? 'Register / హాజరు పట్టీ' : 'Register'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'history' ? 'bg-primary text-white shadow-sm' : 'text-gray-500'
            }`}
          >
            <History size={15} />
            {bilingual ? 'History / చరిత్ర' : 'History Log'}
          </button>
        </div>

        {/* ----------------- REGISTER TAB VIEW ----------------- */}
        {activeTab === 'register' && (
          selectedCropCycleId === 'all' || selectedCropCycleId === 'legacy_crop_2025_2026' ? (
            <div className="bg-white border border-[#E0DBC5]/40 rounded-3xl p-8 text-center shadow-soft my-6">
              <Calendar className="mx-auto text-primary mb-3 animate-pulse" size={48} />
              <h3 className="text-base font-bold text-text-dark">
                {bilingual ? 'Select Crop Cycle / పంటను ఎంచుకోండి' : 'Select Crop Cycle'}
              </h3>
              <p className="text-xs text-gray-400 mt-2 max-w-xs mx-auto leading-relaxed">
                {t('cropSelectAlert', lang)}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
            {/* Date Selector */}
            <div className="bg-white px-4 py-3 rounded-2xl border border-[#E0DBC5]/40 shadow-soft flex items-center justify-between">
              <button 
                onClick={() => adjustDate(-1)}
                className="p-2 bg-[#F8F5E9] hover:bg-gray-100 rounded-xl text-primary active:scale-90 transition-all cursor-pointer"
              >
                <ChevronLeft size={20} />
              </button>
              
              <div className="text-center">
                <span className="text-[10px] font-bold text-gray-400 block uppercase tracking-wider">
                  {t('dateSelector', lang)}
                </span>
                <span className="text-sm font-extrabold text-text-dark mt-0.5 block">
                  {formatDateLabel(selectedDate)}
                </span>
              </div>

              <button 
                onClick={() => adjustDate(1)}
                className="p-2 bg-[#F8F5E9] hover:bg-gray-100 rounded-xl text-primary active:scale-90 transition-all cursor-pointer"
              >
                <ChevronRight size={20} />
              </button>
            </div>

            {/* Attendance statistics grid */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-white p-2.5 rounded-2xl border border-[#E0DBC5]/30 shadow-soft">
                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block">Present</span>
                <span className="text-base font-black text-success-green block mt-0.5">{regPresentCount}</span>
              </div>
              <div className="bg-white p-2.5 rounded-2xl border border-[#E0DBC5]/30 shadow-soft">
                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block">Half Day</span>
                <span className="text-base font-black text-amber-500 block mt-0.5">{regHalfCount}</span>
              </div>
              <div className="bg-white p-2.5 rounded-2xl border border-[#E0DBC5]/30 shadow-soft">
                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block">Absent</span>
                <span className="text-base font-black text-danger-red block mt-0.5">{regAbsentCount}</span>
              </div>
              <div className="bg-white p-2.5 rounded-2xl border border-[#E0DBC5]/30 shadow-soft">
                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block">Cost</span>
                <span className="text-xs font-black text-text-dark block mt-1">₹{totalLaborCostToday}</span>
              </div>
            </div>

            {/* Search and Bulk Mark actions */}
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={registerSearch}
                  onChange={(e) => setRegisterSearch(e.target.value)}
                  placeholder="Search worker by name..."
                  className="w-full bg-white border border-[#E0DBC5] text-text-dark font-medium rounded-xl py-2.5 pl-9 pr-3 text-xs focus:outline-none focus:border-primary transition-all placeholder-gray-400"
                />
                <Search className="absolute left-3 top-3 text-gray-400" size={15} />
              </div>
              
              <div className="flex gap-1">
                <button
                  onClick={() => handleMarkAll('absent')}
                  className="px-2.5 py-2.5 bg-danger-red/10 text-danger-red font-bold text-[10px] rounded-xl active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                >
                  Clear All
                </button>
                <button
                  onClick={() => handleMarkAll('present')}
                  className="px-2.5 py-2.5 bg-primary/10 text-primary font-bold text-[10px] rounded-xl active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                >
                  Mark All
                </button>
              </div>
            </div>

            {/* Attendance List */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : filteredRegisterWorkers.length === 0 ? (
              <div className="bg-white border border-[#E0DBC5]/40 rounded-3xl p-8 text-center shadow-soft">
                <UserCheck className="mx-auto text-gray-300 mb-2" size={40} />
                <p className="text-sm font-semibold text-gray-500">No active workers matches search.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRegisterWorkers.map(w => {
                  const status = registerAttendance[w.id] || 'absent';
                  return (
                    <div
                      key={w.id}
                      className="p-4 rounded-3xl bg-white border border-[#E0DBC5]/40 shadow-soft flex flex-col gap-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-bold text-text-dark block leading-tight truncate">
                            {w.name}
                          </span>
                          <span className="text-[10px] text-gray-400 font-semibold mt-1 block">
                            ₹{w.dailyWage} / day • {w.village || 'No Village'}
                          </span>
                        </div>

                        {/* Presence Toggle Buttons */}
                        <div className="flex bg-[#F8F5E9] p-0.5 rounded-2xl border border-[#E0DBC5]/40 text-center shrink-0">
                          <button
                            type="button"
                            onClick={() => handleRegisterStatusChange(w.id, 'present')}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer ${
                              status === 'present' 
                                ? 'bg-success-green text-white shadow-sm' 
                                : 'text-gray-400 hover:text-gray-600'
                            }`}
                          >
                            Present
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRegisterStatusChange(w.id, 'half_day')}
                            className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer ${
                              status === 'half_day' 
                                ? 'bg-amber-500 text-white shadow-sm' 
                                : 'text-gray-400 hover:text-gray-600'
                            }`}
                          >
                            Half Day
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRegisterStatusChange(w.id, 'absent')}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer ${
                              status === 'absent' 
                                ? 'bg-danger-red text-white shadow-sm' 
                                : 'text-gray-400 hover:text-gray-600'
                            }`}
                          >
                            Absent
                          </button>
                        </div>
                      </div>

                      {/* Variable Wage Details Input */}
                      {status !== 'absent' && (
                        <div className="pt-3 border-t border-[#E0DBC5]/30 grid grid-cols-3 gap-2">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider pl-1">{t('wageForDay', lang)}</span>
                            <input
                              type="number"
                              min="0"
                              value={registerWages[w.id] || ''}
                              onChange={(e) => setRegisterWages(prev => ({ ...prev, [w.id]: e.target.value }))}
                              className="w-full bg-[#F8F5E9]/50 border border-[#E0DBC5] text-text-dark font-semibold rounded-lg py-1 px-2 text-[10px] focus:outline-none focus:border-primary"
                            />
                          </div>

                          <div className="flex flex-col gap-0.5">
                            <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider pl-1">{t('workType', lang)}</span>
                            <input
                              type="text"
                              value={registerWorkTypes[w.id] || ''}
                              onChange={(e) => setRegisterWorkTypes(prev => ({ ...prev, [w.id]: e.target.value }))}
                              placeholder="weeding, harvesting..."
                              className="w-full bg-[#F8F5E9]/50 border border-[#E0DBC5] text-text-dark font-semibold rounded-lg py-1 px-2 text-[10px] focus:outline-none focus:border-primary"
                            />
                          </div>

                          <div className="flex flex-col gap-0.5">
                            <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider pl-1">{t('notes', lang)}</span>
                            <input
                              type="text"
                              value={registerNotes[w.id] || ''}
                              onChange={(e) => setRegisterNotes(prev => ({ ...prev, [w.id]: e.target.value }))}
                              placeholder="extra hours..."
                              className="w-full bg-[#F8F5E9]/50 border border-[#E0DBC5] text-text-dark font-semibold rounded-lg py-1 px-2 text-[10px] focus:outline-none focus:border-primary"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Save Button */}
            {!loading && activeWorkers.length > 0 && (
              <div className="pt-4 border-t border-[#E0DBC5]/30">
                <button
                  onClick={handleSaveRegister}
                  disabled={saving}
                  className="w-full py-4 bg-primary hover:bg-primary-light text-white font-bold rounded-2xl shadow-soft btn-active-scale cursor-pointer disabled:bg-gray-200 disabled:text-gray-400 transition-all flex items-center justify-center gap-2 text-sm"
                >
                  {saving ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      Save Attendance Register
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
          )
        )}

        {/* ----------------- HISTORY TAB VIEW ----------------- */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {/* Filter Section */}
            <div className="bg-white p-4 rounded-3xl border border-[#E0DBC5]/40 shadow-soft space-y-3 shrink-0">
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-gray-400" />
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Search & Filters</span>
              </div>
              
              <div className="relative">
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Search worker by name or village..."
                  className="w-full bg-[#F8F5E9]/50 border border-[#E0DBC5] text-text-dark font-medium rounded-xl py-2.5 pl-9 pr-3 text-xs focus:outline-none focus:border-primary transition-all placeholder-gray-400"
                />
                <Search className="absolute left-3 top-3 text-gray-400" size={15} />
              </div>

              {/* Date Filters */}
              <div className="grid grid-cols-2 gap-2">
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

              {/* Status Filters */}
              <div className="flex gap-1.5 items-center">
                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider pl-1 shrink-0">Status:</span>
                <div className="flex gap-1 overflow-x-auto no-scrollbar pb-0.5 select-none">
                  {(['all', 'present', 'half_day', 'absent'] as const).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatusFilter(s)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold shrink-0 transition-all cursor-pointer ${
                        statusFilter === s 
                          ? 'bg-primary text-white shadow-xs' 
                          : 'bg-[#F8F5E9] text-gray-500 border border-[#E0DBC5]/50'
                      }`}
                    >
                      {s === 'all' ? 'All' : s === 'half_day' ? 'Half Day' : s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* History Statistics Summary */}
            {filteredHistoryRecords.length > 0 && (
              <div className="grid grid-cols-4 gap-2 text-center bg-white p-3 rounded-2xl border border-[#E0DBC5]/30 shadow-soft">
                <div>
                  <span className="text-[8px] font-bold text-gray-400 uppercase block">Records</span>
                  <span className="text-xs font-black text-text-dark block mt-0.5">{totalHistCount}</span>
                </div>
                <div>
                  <span className="text-[8px] font-bold text-gray-400 uppercase block">Pres. %</span>
                  <span className="text-xs font-black text-primary block mt-0.5">{histAttendancePercentage}%</span>
                </div>
                <div>
                  <span className="text-[8px] font-bold text-gray-400 uppercase block">P / HD / A</span>
                  <span className="text-[10px] font-bold text-gray-500 block mt-0.5">{histPresentCount}/{histHalfCount}/{histAbsentCount}</span>
                </div>
                <div>
                  <span className="text-[8px] font-bold text-gray-400 uppercase block">Total Cost</span>
                  <span className="text-xs font-black text-text-dark block mt-0.5">₹{totalHistLaborCost}</span>
                </div>
              </div>
            )}

            {/* History List */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : filteredHistoryRecords.length === 0 ? (
              <div className="bg-white border border-[#E0DBC5]/40 rounded-3xl p-8 text-center shadow-soft">
                <Calendar className="mx-auto text-gray-300 mb-2" size={40} />
                <h3 className="text-base font-bold text-text-dark">No attendance records available.</h3>
                <p className="text-xs text-gray-400 mt-1">Try resetting date filters or search queries.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredHistoryRecords.map(r => {
                  const worker = workers.find(w => w.id === r.workerId);
                  const workerName = worker ? worker.name : 'Unknown Worker';
                  const workerWage = worker ? worker.dailyWage : 0;
                  const wage = r.wageForDay !== undefined ? r.wageForDay : workerWage;
                  const finalCost = r.status === 'present' ? wage : r.status === 'half_day' ? wage * 0.5 : 0;

                  return (
                    <div
                      key={r.id || `${r.workerId}_${r.date}`}
                      className="p-3 bg-white rounded-2xl border border-[#E0DBC5]/30 shadow-soft flex items-center justify-between text-xs gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-text-dark truncate block leading-tight">{workerName}</span>
                          <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${
                            r.status === 'present' 
                              ? 'bg-success-green/10 text-success-green' 
                              : r.status === 'half_day'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-danger-red/10 text-danger-red'
                          }`}>
                            {r.status === 'half_day' ? 'Half Day' : r.status}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-400 font-semibold block mt-1">
                          Date: {r.date} • Wage: ₹{finalCost} {r.workType ? `• ${r.workType}` : ''} {r.notes ? `(${r.notes})` : ''}
                        </span>
                      </div>

                      {/* Edit / Delete actions */}
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(r)}
                          className="p-2 bg-primary/10 text-primary rounded-xl active:scale-90 hover:bg-primary/20"
                          title="Edit Attendance"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRecord(r.id || `${r.workerId}_${r.date}`, workerName, r.date)}
                          className="p-2 bg-danger-red/10 text-danger-red rounded-xl active:scale-90 hover:bg-danger-red/20"
                          title="Delete Record"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Status Modal drawer */}
      <AnimatePresence>
        {editingRecord && (() => {
          const workerObj = workers.find(w => w.id === editingRecord.workerId);
          return (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end justify-center p-4">
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                className="bg-white w-full max-w-md rounded-t-3xl p-6 shadow-premium relative border-t border-[#E0DBC5]"
              >
                <button 
                  onClick={() => setEditingRecord(null)}
                  className="absolute top-4 right-4 p-1.5 bg-gray-100 rounded-full text-gray-500 active:scale-90"
                >
                  <X size={18} />
                </button>

                <h3 className="text-lg font-bold text-text-dark mb-1">
                  Edit Attendance Record
                </h3>
                <p className="text-xs text-gray-400 font-semibold mb-5">
                  Updating log for <strong className="text-primary">{workerObj ? workerObj.name : 'Worker'}</strong> on <strong>{editingRecord.date}</strong>
                </p>

                {/* Edit options */}
                <div className="space-y-4">
                  <div className="flex bg-[#F8F5E9] p-1 rounded-2xl border border-[#E0DBC5]/50 text-center">
                    {(['present', 'half_day', 'absent'] as const).map(statusOpt => (
                      <button
                        key={statusOpt}
                        type="button"
                        onClick={() => setEditStatus(statusOpt)}
                        className={`flex-1 py-3.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                          editStatus === statusOpt 
                            ? statusOpt === 'present'
                              ? 'bg-success-green text-white shadow-sm'
                              : statusOpt === 'half_day'
                                ? 'bg-amber-500 text-white shadow-sm'
                                : 'bg-danger-red text-white shadow-sm'
                            : 'text-gray-400 hover:text-gray-600'
                        }`}
                      >
                        {statusOpt === 'half_day' ? 'Half Day' : statusOpt.charAt(0).toUpperCase() + statusOpt.slice(1)}
                      </button>
                    ))}
                  </div>

                  {editStatus !== 'absent' && (
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="flex flex-col gap-1 col-span-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase pl-1">{t('wageForDay', lang)}</label>
                        <input
                          type="number"
                          min="0"
                          value={editWage}
                          onChange={(e) => setEditWage(e.target.value)}
                          className="form-input text-xs"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase pl-1">{t('workType', lang)}</label>
                        <input
                          type="text"
                          value={editWorkType}
                          onChange={(e) => setEditWorkType(e.target.value)}
                          className="form-input text-xs"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase pl-1">{t('notes', lang)}</label>
                        <input
                          type="text"
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          className="form-input text-xs"
                        />
                      </div>
                    </div>
                  )}

                  {/* Buttons */}
                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setEditingRecord(null)}
                      className="flex-1 py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl active:scale-95 text-sm transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      className="flex-1 py-4 bg-primary text-white font-bold rounded-2xl active:scale-95 shadow-soft text-sm transition-all"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
};
