import React, { useState, useEffect } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, UserCheck } from 'lucide-react';
import { Worker, AttendanceRecord, fetchWorkers, fetchAttendanceByDate, saveAttendanceList } from '../firebase';
import { t, subT, Language } from '../utils/translation';

interface AttendanceViewProps {
  lang: Language;
  bilingual: boolean;
  showToast: (message: string, type: 'success' | 'error') => void;
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({
  lang,
  bilingual,
  showToast
}) => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [attendance, setAttendance] = useState<Record<string, 'present' | 'absent'>>({});
  const [selectedDate, setSelectedDate] = useState('2026-06-23'); // Target system date
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAttendanceData();
  }, [selectedDate]);

  const loadAttendanceData = async () => {
    setLoading(true);
    try {
      // 1. Fetch workers
      const workersData = await fetchWorkers();
      const activeWorkers = workersData.filter(w => w.status === 'active');
      setWorkers(activeWorkers);

      // 2. Fetch attendance for this date
      const attendanceData = await fetchAttendanceByDate(selectedDate);
      
      // 3. Map to state
      const attMap: Record<string, 'present' | 'absent'> = {};
      
      activeWorkers.forEach(w => {
        const record = attendanceData.find(a => a.workerId === w.id);
        attMap[w.id] = record ? record.status : 'absent';
      });

      setAttendance(attMap);
    } catch (e) {
      showToast("Error loading attendance records", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (workerId: string) => {
    setAttendance(prev => ({
      ...prev,
      [workerId]: prev[workerId] === 'present' ? 'absent' : 'present'
    }));
  };

  const handleMarkAll = (status: 'present' | 'absent') => {
    const updated: Record<string, 'present' | 'absent'> = {};
    workers.forEach(w => {
      updated[w.id] = status;
    });
    setAttendance(updated);
    showToast(status === 'present' ? "All workers marked present" : "All workers marked absent", "success");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const recordsToSave = Object.entries(attendance).map(([workerId, status]) => ({
        workerId,
        date: selectedDate,
        status
      }));

      await saveAttendanceList(selectedDate, recordsToSave);
      showToast(t('attendanceSaved', lang), "success");
    } catch (e) {
      showToast("Error saving attendance", "error");
    } finally {
      setSaving(false);
    }
  };

  const adjustDate = (days: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, '0');
    const dd = String(current.getDate()).padStart(2, '0');
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
  };

  const formatDateLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    const weekday = d.toLocaleDateString(lang === 'te' ? 'te-IN' : 'en-US', { weekday: 'long' });
    const formatted = d.toLocaleDateString(lang === 'te' ? 'te-IN' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${weekday}, ${formatted}`;
  };

  // Live Statistics Calculations
  const totalCount = workers.length;
  const presentCount = Object.values(attendance).filter(status => status === 'present').length;
  const absentCount = totalCount - presentCount;
  
  const totalLaborCostToday = workers
    .filter(w => attendance[w.id] === 'present')
    .reduce((sum, w) => sum + w.dailyWage, 0);

  return (
    <div className="flex-1 p-4 pb-24 overflow-y-auto no-scrollbar flex flex-col justify-between">
      <div>
        {/* Title */}
        <div className="mb-5">
          <h1 className="text-2xl font-extrabold text-text-dark">
            {bilingual ? `${t('attendancePage', lang)} / ${subT('attendancePage', lang)}` : t('attendancePage', lang)}
          </h1>
          <p className="text-xs text-gray-400 font-semibold mt-1">
            Tap a card to toggle presence for the day
          </p>
        </div>

        {/* Date Selector */}
        <div className="bg-white px-4 py-3 rounded-2xl border border-[#E0DBC5]/40 shadow-soft flex items-center justify-between mb-5">
          <button 
            onClick={() => adjustDate(-1)}
            className="p-2 bg-[#F8F5E9] hover:bg-gray-100 rounded-xl text-primary active:scale-90 transition-all cursor-pointer"
          >
            <ChevronLeft size={20} />
          </button>
          
          <div className="text-center font-sans">
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
        <div className="grid grid-cols-3 gap-2.5 mb-5 text-center">
          <div className="bg-white p-3 rounded-2xl border border-[#E0DBC5]/30 shadow-soft">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Present</span>
            <span className="text-lg font-black text-success-green block mt-0.5">{presentCount}</span>
          </div>
          <div className="bg-white p-3 rounded-2xl border border-[#E0DBC5]/30 shadow-soft">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Absent</span>
            <span className="text-lg font-black text-danger-red block mt-0.5">{absentCount}</span>
          </div>
          <div className="bg-white p-3 rounded-2xl border border-[#E0DBC5]/30 shadow-soft">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Today's Cost</span>
            <span className="text-sm font-black text-text-dark block mt-1">₹{totalLaborCostToday}</span>
          </div>
        </div>

        {/* Bulk Selectors & Counts */}
        <div className="flex justify-between items-center mb-4 pl-1">
          <div className="text-xs font-bold text-gray-500">
            {t('totalWorkers', lang)}: <span className="text-text-dark font-extrabold">{totalCount}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleMarkAll('absent')}
              className="px-3 py-1.5 bg-danger-red/10 text-danger-red font-bold text-xs rounded-xl active:scale-95 transition-all cursor-pointer"
            >
              Clear All
            </button>
            <button
              onClick={() => handleMarkAll('present')}
              className="px-3 py-1.5 bg-primary/10 text-primary font-bold text-xs rounded-xl active:scale-95 transition-all cursor-pointer"
            >
              Mark All
            </button>
          </div>
        </div>

        {/* Workers Attendance List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : workers.length === 0 ? (
          <div className="bg-white border border-[#E0DBC5]/40 rounded-3xl p-8 text-center shadow-soft">
            <UserCheck className="mx-auto text-gray-300 mb-2" size={40} />
            <p className="text-sm font-semibold text-gray-500">No active workers found in database.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {workers.map(w => {
              const isPresent = attendance[w.id] === 'present';
              return (
                <div
                  key={w.id}
                  onClick={() => handleToggle(w.id)}
                  className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer select-none flex items-center justify-between ${
                    isPresent 
                      ? 'bg-success-green/5 border-success-green/40 shadow-sm' 
                      : 'bg-white border-[#E0DBC5]/40 shadow-soft'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      {isPresent ? (
                        <CheckCircle2 className="text-success-green fill-success-green/10" size={26} />
                      ) : (
                        <div className="w-[26px] h-[26px] rounded-full border-2 border-gray-300 bg-white"></div>
                      )}
                    </div>
                    
                    <div>
                      <span className="text-base font-bold text-text-dark block leading-tight">
                        {w.name}
                      </span>
                      <span className="text-xs text-gray-400 font-semibold mt-1 block">
                        ₹{w.dailyWage} / {t('dailyWage', lang)}
                      </span>
                    </div>
                  </div>

                  <span className={`text-xs font-extrabold uppercase px-3 py-1.5 rounded-xl ${
                    isPresent ? 'bg-success-green/10 text-success-green' : 'bg-danger-red/10 text-danger-red'
                  }`}>
                    {isPresent ? t('present', lang) : t('absent', lang)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="mt-8 pt-4 border-t border-[#E0DBC5]/30">
        <button
          onClick={handleSave}
          disabled={saving || loading || workers.length === 0}
          className="w-full py-4.5 bg-primary hover:bg-primary-light text-white font-bold rounded-2xl shadow-soft btn-active-scale cursor-pointer disabled:bg-gray-200 disabled:text-gray-400 transition-all flex items-center justify-center gap-2 text-base"
        >
          {saving ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <>
              <CheckCircle2 size={20} />
              {t('saveAttendance', lang)}
            </>
          )}
        </button>
      </div>
    </div>
  );
};
