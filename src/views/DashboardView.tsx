import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  TrendingDown, 
  DollarSign, 
  Clock, 
  Sparkles, 
  Send, 
  Check, 
  AlertCircle,
  FileText,
  TrendingUp,
  X,
  Award,
  Calendar,
  Flame
} from 'lucide-react';
import { 
  Worker, 
  Expense, 
  Payment, 
  AttendanceRecord,
  fetchWorkers,
  fetchExpenses,
  fetchPayments,
  fetchAttendanceByDate,
  fetchAttendance,
  createPayment,
  createExpense,
  CropCycle,
  filterByCrop
} from '../firebase';
import { t, subT, Language } from '../utils/translation';
import { parseNaturalLanguage, getInsightsList, AIObservation, ParsedTransaction } from '../services/gemini';
import { calculateWeeklyReport, sendWeeklyReport } from '../services/resend';

interface DashboardViewProps {
  lang: Language;
  bilingual: boolean;
  onNavigate: (view: string) => void;
  showToast: (message: string, type: 'success' | 'error') => void;
  selectedCropCycleId: string;
  cropCycles: CropCycle[];
}

const getLocalDateString = (d: Date = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getLocalMonthString = (d: Date = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const getPreviousSundayDate = (d: Date = new Date()): string => {
  const day = d.getDay();
  const diff = day === 0 ? 7 : day;
  const prevSunday = new Date(d);
  prevSunday.setDate(d.getDate() - diff);
  return prevSunday.toISOString().split('T')[0];
};

const getWeekRange = (sundayDateStr: string) => {
  const sunday = new Date(sundayDateStr);
  const monday = new Date(sunday);
  monday.setDate(sunday.getDate() - 6);
  const formatOptions: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  return `${monday.toLocaleDateString('en-US', formatOptions)} - ${sunday.toLocaleDateString('en-US', formatOptions)}`;
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  lang,
  bilingual,
  onNavigate,
  showToast,
  selectedCropCycleId,
  cropCycles
}) => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord[]>([]);
  const [allAttendance, setAllAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // NLP Input State
  const [nlpText, setNlpText] = useState('');
  const [nlpParsing, setNlpParsing] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParsedTransaction | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // AI Insights State
  const [insights, setInsights] = useState<AIObservation[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);

  // Weekly Report State
  const [weeklyReportSent, setWeeklyReportSent] = useState<boolean | null>(null);
  const [sendingReport, setSendingReport] = useState(false);

  useEffect(() => {
    loadData();
  }, [selectedCropCycleId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const workersData = await fetchWorkers();
      const expensesData = await fetchExpenses();
      const paymentsData = await fetchPayments();
      const allAttData = await fetchAttendance();
      const todayStr = getLocalDateString();
      const currentMonthStr = getLocalMonthString();

      // Apply Crop filters
      const filteredExpenses = filterByCrop(expensesData, selectedCropCycleId);
      const filteredPayments = filterByCrop(paymentsData, selectedCropCycleId);
      const filteredAttendance = filterByCrop(allAttData, selectedCropCycleId);

      const todayAtt = filteredAttendance.filter(a => a.date === todayStr);

      setWorkers(workersData);
      setExpenses(filteredExpenses);
      setPayments(filteredPayments);
      setTodayAttendance(todayAtt);
      setAllAttendance(filteredAttendance);

      // Check if weekly report for the previous Sunday has been sent
      const prevSundayStr = getPreviousSundayDate();
      const expectedWeekRange = getWeekRange(prevSundayStr);
      const logged = JSON.parse(localStorage.getItem('paramesh_weekly_emails') || '[]');
      const isSent = logged.some((e: any) => e.weekRange === expectedWeekRange && e.success);
      setWeeklyReportSent(isSent);

      // Load AI Insights programmatically using filtered datasets
      setInsightsLoading(true);
      const obs = getInsightsList(workersData, filteredExpenses, filteredPayments, filteredAttendance, currentMonthStr);
      setInsights(obs);
    } catch (e) {
      console.error(e);
      showToast("Error loading dashboard data", "error");
    } finally {
      setInsightsLoading(false);
      setLoading(false);
    }
  };

  // Trigger Weekly Email Report manually
  const handleSendWeeklyReport = async () => {
    setSendingReport(true);
    try {
      const allAttData = await fetchAttendance();
      const prevSundayStr = getPreviousSundayDate();
      const calculatedReport = calculateWeeklyReport(workers, allAttData, payments, expenses, prevSundayStr);
      
      const result = await sendWeeklyReport(calculatedReport);
      if (result.success) {
        showToast(result.message, "success");
        setWeeklyReportSent(true);
      } else {
        showToast(result.message, "error");
      }
    } catch (e: any) {
      showToast("Email send failed: " + e.message, "error");
    } finally {
      setSendingReport(false);
    }
  };

  // Submit NLP Text
  const handleNlpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nlpText.trim()) return;

    setNlpParsing(true);
    try {
      const parsed = await parseNaturalLanguage(nlpText, workers);
      setParsedResult(parsed);
      setShowConfirmModal(true);
    } catch (error) {
      showToast("AI parsing failed", "error");
    } finally {
      setNlpParsing(false);
    }
  };

  // Save NLP Transaction
  const handleConfirmSave = async () => {
    if (!parsedResult) return;

    try {
      if (parsedResult.type === 'payment') {
        if (!parsedResult.workerId || parsedResult.workerId === 'unknown') {
          showToast("Could not match worker name", "error");
          return;
        }
        await createPayment({
          workerId: parsedResult.workerId,
          amount: parsedResult.amount,
          date: parsedResult.date,
          note: parsedResult.description,
          cropCycleId: selectedCropCycleId !== 'all' && selectedCropCycleId !== 'legacy' ? selectedCropCycleId : undefined
        });
        showToast(t('paymentSuccess', lang), "success");
      } else if (parsedResult.type === 'expense') {
        await createExpense({
          category: parsedResult.category || 'Others',
          amount: parsedResult.amount,
          description: parsedResult.description,
          notes: '',
          date: parsedResult.date,
          cropCycleId: selectedCropCycleId !== 'all' && selectedCropCycleId !== 'legacy' ? selectedCropCycleId : undefined
        });
        showToast(t('expenseSuccess', lang), "success");
      } else {
        showToast("Invalid entry type", "error");
        return;
      }

      setShowConfirmModal(false);
      setNlpText('');
      setParsedResult(null);
      loadData(); // Reload stats
    } catch (error) {
      showToast("Error saving transaction", "error");
    }
  };

  const currentMonthStr = getLocalMonthString();

  // Calculations for dashboard incorporating half_day status
  const presentCount = todayAttendance.reduce((sum, a) => {
    if (a.status === 'present') return sum + 1;
    if (a.status === 'half_day') return sum + 0.5;
    return sum;
  }, 0);
  const activeWorkersCount = workers.filter(w => w.status === 'active').length;

  const currentMonthExpenses = expenses
    .filter(e => e.date.startsWith(currentMonthStr))
    .reduce((sum, e) => sum + e.amount, 0);

  const currentMonthPayments = payments
    .filter(p => p.date.startsWith(currentMonthStr))
    .reduce((sum, p) => sum + p.amount, 0);

  const currentMonthAttendance = allAttendance.filter((a: any) => a.date.startsWith(currentMonthStr));
  
  let totalLaborCost = 0;
  workers.forEach(w => {
    const workerAtt = currentMonthAttendance.filter((a: any) => a.workerId === w.id);
    const earned = workerAtt.reduce((sum, a) => {
      const wage = a.wageForDay !== undefined ? a.wageForDay : w.dailyWage;
      if (a.status === 'present') return sum + wage;
      if (a.status === 'half_day') return sum + wage * 0.5;
      return sum;
    }, 0);
    totalLaborCost += earned;
  });

  const pendingWages = Math.max(0, totalLaborCost - currentMonthPayments);
  const totalSpending = totalLaborCost + currentMonthExpenses;

  // 1. Highest Paid Worker (dynamic month)
  const payMap: Record<string, number> = {};
  payments.filter(p => p.date.startsWith(currentMonthStr)).forEach(p => {
    payMap[p.workerId] = (payMap[p.workerId] || 0) + p.amount;
  });
  let maxPay = 0;
  let maxWorkerId = '';
  Object.entries(payMap).forEach(([wId, amt]) => {
    if (amt > maxPay) {
      maxPay = amt;
      maxWorkerId = wId;
    }
  });
  const topPaidWorker = workers.find(w => w.id === maxWorkerId);
  const highestPaidWorkerStr = topPaidWorker ? `${topPaidWorker.name} (₹${maxPay})` : 'None';

  // 2. Most Regular Worker (dynamic month)
  const attMap: Record<string, number> = {};
  currentMonthAttendance.forEach((a: any) => {
    const weight = a.status === 'present' ? 1.0 : a.status === 'half_day' ? 0.5 : 0;
    attMap[a.workerId] = (attMap[a.workerId] || 0) + weight;
  });
  let maxDays = 0;
  let regularWorkerId = '';
  Object.entries(attMap).forEach(([wId, days]) => {
    if (days > maxDays) {
      maxDays = days;
      regularWorkerId = wId;
    }
  });
  const topRegularWorker = workers.find(w => w.id === regularWorkerId);
  const mostRegularWorkerStr = topRegularWorker ? `${topRegularWorker.name} (${maxDays} days)` : 'None';

  // 3. Biggest Expense Category (dynamic month)
  const expMap: Record<string, number> = {};
  expenses.filter(e => e.date.startsWith(currentMonthStr)).forEach(e => {
    expMap[e.category] = (expMap[e.category] || 0) + e.amount;
  });
  let maxExp = 0;
  let maxCat = '';
  Object.entries(expMap).forEach(([cat, amt]) => {
    if (amt > maxExp) {
      maxExp = amt;
      maxCat = cat;
    }
  });
  const biggestExpenseCategoryStr = maxCat ? `${t(maxCat, lang).split(' / ')[0]} (₹${maxExp})` : 'None';

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 pb-24 overflow-y-auto no-scrollbar space-y-5">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-extrabold text-text-dark leading-tight">
          {bilingual ? `${t('title', lang)} / ${subT('title', lang)}` : t('title', lang)}
        </h1>
        <p className="text-xs text-gray-400 font-semibold mt-1">
          {bilingual ? `${t('tagline', lang)} | ${subT('tagline', lang)}` : t('tagline', lang)}
        </p>
      </div>

      {/* Main KPI Badges Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Today's workers */}
        <div 
          onClick={() => onNavigate('attendance')}
          className="bg-white p-4 rounded-3xl border border-[#E0DBC5]/40 shadow-soft cursor-pointer active:scale-98 transition-all duration-200"
        >
          <div className="flex items-center gap-1.5 text-primary mb-1">
            <Users size={16} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              {t('todaysWorkers', lang)}
            </span>
          </div>
          <div className="text-xl font-black text-text-dark mt-1">
            {presentCount} <span className="text-xs text-gray-400 font-bold">/ {activeWorkersCount}</span>
          </div>
          {bilingual && <div className="text-[10px] text-gray-400 font-semibold">{subT('todaysWorkers', lang)}</div>}
        </div>

        {/* Weekly Report Email Status */}
        <div 
          onClick={handleSendWeeklyReport}
          className="bg-white p-4 rounded-3xl border border-[#E0DBC5]/40 shadow-soft cursor-pointer relative overflow-hidden active:scale-98 transition-all duration-200"
        >
          <div className="flex items-center gap-1.5 text-accent mb-1">
            <FileText size={16} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              {t('weeklyReportStatus', lang)}
            </span>
          </div>
          <div className="flex items-center gap-1 mt-1 font-extrabold text-sm">
            {sendingReport ? (
              <span className="text-gray-400 text-xs animate-pulse">{t('checking', lang)}</span>
            ) : weeklyReportSent ? (
              <span className="text-success-green flex items-center gap-0.5">
                <Check size={14} /> {t('sent', lang)}
              </span>
            ) : (
              <span className="text-danger-red flex items-center gap-0.5 pulse-indicator">
                <AlertCircle size={14} /> {t('notSent', lang)}
              </span>
            )}
          </div>
          {bilingual && <div className="text-[10px] text-gray-400 font-semibold">{subT('weeklyReportStatus', lang)}</div>}
        </div>

        {/* Money spent on workers (TOTAL LABOR COST) */}
        <div 
          onClick={() => onNavigate('payments')}
          className="bg-white p-4 rounded-3xl border border-[#E0DBC5]/40 shadow-soft cursor-pointer active:scale-98 transition-all duration-200"
        >
          <div className="flex items-center gap-1.5 text-primary mb-1">
            <TrendingUp size={16} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              {t('totalLaborCost', lang)}
            </span>
          </div>
          <div className="text-lg font-black text-text-dark mt-1">₹{totalLaborCost}</div>
          {bilingual && <div className="text-[10px] text-gray-400 font-semibold">{subT('totalLaborCost', lang)}</div>}
        </div>

        {/* Money Spent on Expenses (TOTAL EXPENSES) */}
        <div 
          onClick={() => onNavigate('expenses')}
          className="bg-white p-4 rounded-3xl border border-[#E0DBC5]/40 shadow-soft cursor-pointer active:scale-98 transition-all duration-200"
        >
          <div className="flex items-center gap-1.5 text-danger-red mb-1">
            <TrendingDown size={16} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              {t('totalExpenses', lang)}
            </span>
          </div>
          <div className="text-lg font-black text-text-dark mt-1">₹{currentMonthExpenses}</div>
          {bilingual && <div className="text-[10px] text-gray-400 font-semibold">{subT('totalExpenses', lang)}</div>}
        </div>

        {/* Amount already paid (MONEY PAID) */}
        <div 
          onClick={() => onNavigate('payments')}
          className="bg-white p-4 rounded-3xl border border-[#E0DBC5]/40 shadow-soft cursor-pointer active:scale-98 transition-all duration-200"
        >
          <div className="flex items-center gap-1.5 text-success-green mb-1">
            <DollarSign size={16} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              {t('moneyPaid', lang)}
            </span>
          </div>
          <div className="text-lg font-black text-success-green mt-1">₹{currentMonthPayments}</div>
          {bilingual && <div className="text-[10px] text-gray-400 font-semibold">{subT('moneyPaid', lang)}</div>}
        </div>

        {/* Still need to pay (PENDING AMOUNT) */}
        <div 
          onClick={() => onNavigate('payments')}
          className="bg-white p-4 rounded-3xl border border-[#E0DBC5]/40 shadow-soft cursor-pointer active:scale-98 transition-all duration-200"
        >
          <div className="flex items-center gap-1.5 text-danger-red mb-1">
            <Clock size={16} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              {t('pendingAmount', lang)}
            </span>
          </div>
          <div className="text-lg font-black text-danger-red mt-1">₹{pendingWages}</div>
          {bilingual && <div className="text-[10px] text-gray-400 font-semibold">{subT('pendingAmount', lang)}</div>}
        </div>
      </div>

      {/* New Farm Leaderboards Block */}
      <div className="bg-white p-5 rounded-3xl border border-[#E0DBC5]/40 shadow-soft space-y-3">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1 flex items-center gap-1.5">
          <Award size={15} className="text-accent" />
          {bilingual ? 'Monthly Highlights / ఈ నెల ముఖ్యాంశాలు' : 'Monthly Summary Highlights'}
        </h3>
        
        <div className="grid grid-cols-2 gap-3 pt-1">
          {/* Total Spending */}
          <div className="bg-[#F8F5E9]/30 p-3 rounded-2xl border border-[#E0DBC5]/20">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Total Spending</span>
            <span className="text-base font-extrabold text-text-dark block mt-0.5">₹{totalSpending}</span>
          </div>
          {/* Highest Paid */}
          <div className="bg-[#F8F5E9]/30 p-3 rounded-2xl border border-[#E0DBC5]/20">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Highest Paid Worker</span>
            <span className="text-xs font-bold text-text-dark block mt-0.5 truncate">{highestPaidWorkerStr}</span>
          </div>
          {/* Most Regular */}
          <div className="bg-[#F8F5E9]/30 p-3 rounded-2xl border border-[#E0DBC5]/20">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Most Regular</span>
            <span className="text-xs font-bold text-text-dark block mt-0.5 truncate">{mostRegularWorkerStr}</span>
          </div>
          {/* Biggest Expense */}
          <div className="bg-[#F8F5E9]/30 p-3 rounded-2xl border border-[#E0DBC5]/20">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Biggest Expense Category</span>
            <span className="text-xs font-bold text-text-dark block mt-0.5 truncate">{biggestExpenseCategoryStr}</span>
          </div>
        </div>
      </div>

      {/* NLP Intelligent Entry Box */}
      <div className="bg-white p-5 rounded-3xl border border-[#E0DBC5]/40 shadow-premium">
        <h2 className="text-lg font-bold text-text-dark flex items-center gap-2 mb-1">
          <Sparkles className="text-accent fill-accent/10" size={20} />
          {bilingual ? 'Voice / Text Entry (స్మార్ట్ వాయిస్ / టెక్స్ట్)' : 'Smart AI Entry'}
        </h2>
        <p className="text-xs text-gray-400 font-semibold mb-4 leading-normal">
          Type or speak details naturally to log them.
        </p>

        <form onSubmit={handleNlpSubmit} className="relative">
          <input
            type="text"
            value={nlpText}
            onChange={(e) => setNlpText(e.target.value)}
            placeholder={t('nlpPlaceholder', lang)}
            className="w-full bg-[#F8F5E9]/50 border border-[#E0DBC5] text-text-dark rounded-2xl py-4 pl-4 pr-12 text-sm font-medium focus:outline-none focus:border-primary focus:bg-white transition-all placeholder-gray-400"
          />
          <button
            type="submit"
            disabled={nlpParsing || !nlpText.trim()}
            className="absolute right-2 top-2 p-2 bg-primary text-white rounded-xl active:scale-95 disabled:bg-gray-100 disabled:text-gray-400 transition-all cursor-pointer"
          >
            {nlpParsing ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Send size={18} />
            )}
          </button>
        </form>

        {/* Help Suggestions */}
        <div className="mt-3 flex flex-wrap gap-2">
          <span 
            onClick={() => setNlpText("Paid Ramesh 2000")}
            className="text-xs bg-[#F8F5E9] text-primary px-3 py-1.5 rounded-lg border border-[#E0DBC5]/50 font-semibold cursor-pointer hover:bg-primary/5 active:scale-95 transition-all"
          >
            "Paid Ramesh 2000"
          </span>
          <span 
            onClick={() => setNlpText("Diesel expense 1500")}
            className="text-xs bg-[#F8F5E9] text-primary px-3 py-1.5 rounded-lg border border-[#E0DBC5]/50 font-semibold cursor-pointer hover:bg-primary/5 active:scale-95 transition-all"
          >
            "Diesel expense 1500"
          </span>
        </div>
      </div>

      {/* AI Insights Observations (Beautiful Green Card) */}
      <div className="bg-success-green/5 p-5 rounded-3xl border border-success-green/20 shadow-soft">
        <h2 className="text-lg font-bold text-primary flex items-center gap-2 mb-3">
          <Sparkles className="text-success-green fill-success-green/10" size={18} />
          {t('aiInsights', lang)}
        </h2>

        {insightsLoading ? (
          <div className="py-6 flex flex-col items-center justify-center">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2"></div>
            <p className="text-xs text-gray-400 font-semibold">{t('aiLoading', lang)}</p>
          </div>
        ) : insights.length === 0 ? (
          <p className="text-sm text-gray-500 font-medium">{t('aiError', lang)}</p>
        ) : (
          <div className="space-y-3">
            {insights.map((insight, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="flex items-start gap-2.5 bg-white p-3.5 rounded-2xl border border-success-green/10 shadow-sm"
              >
                <div className="text-success-green mt-0.5 font-bold">🌱</div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-text-dark leading-snug">
                    {insight.textEn}
                  </p>
                  {(lang === 'te' || bilingual) && (
                    <p className="text-xs text-gray-500 font-medium mt-1 leading-snug">
                      {insight.textTe}
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Action Navigation Shortcuts */}
      <div className="flex justify-between gap-3">
        <button 
          onClick={() => onNavigate('workers')}
          className="flex-1 py-4 bg-primary text-white font-bold rounded-2xl shadow-soft btn-active-scale cursor-pointer flex flex-col items-center gap-1 text-xs transition-all"
        >
          <Users size={18} />
          {t('workers', lang)}
        </button>
        <button 
          onClick={() => onNavigate('attendance')}
          className="flex-1 py-4 bg-primary text-white font-bold rounded-2xl shadow-soft btn-active-scale cursor-pointer flex flex-col items-center gap-1 text-xs transition-all"
        >
          <Check size={18} />
          {t('attendance', lang)}
        </button>
        <button 
          onClick={() => onNavigate('payments')}
          className="flex-1 py-4 bg-[#F9A825] text-white font-bold rounded-2xl shadow-soft btn-active-scale cursor-pointer flex flex-col items-center gap-1 text-xs transition-all"
        >
          <DollarSign size={18} />
          {t('payments', lang)}
        </button>
      </div>

      {/* Confirm NLP Transaction Modal */}
      <AnimatePresence>
        {showConfirmModal && parsedResult && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end justify-center p-4">
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-white w-full max-w-md rounded-t-3xl p-6 shadow-premium relative border-t border-[#E0DBC5]"
            >
              <button 
                onClick={() => {
                  setShowConfirmModal(false);
                  setParsedResult(null);
                }}
                className="absolute top-4 right-4 p-1.5 bg-gray-100 rounded-full text-gray-500 active:scale-90"
              >
                <X size={18} />
              </button>

              <h3 className="text-xl font-bold text-text-dark mb-1 flex items-center gap-2">
                <Sparkles className="text-accent" size={20} />
                {bilingual ? 'Verify Ledger Entry / సరిచూసుకోండి' : t('nlpSuccess', lang)}
              </h3>
              <p className="text-xs text-gray-400 font-semibold mb-4">
                Verify the extracted details before saving.
              </p>

              {/* Parsed Fields */}
              <div className="bg-[#F8F5E9] p-4 rounded-2xl border border-[#E0DBC5] space-y-3 mb-6">
                {/* Type Row */}
                <div className="flex justify-between items-center border-bottom border-[#E0DBC5]/40 pb-2">
                  <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
                    {bilingual ? 'Entry Type / రకం' : 'Entry Type'}
                  </span>
                  <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase ${
                    parsedResult.type === 'payment' ? 'bg-success-green/10 text-success-green' : 'bg-danger-red/10 text-danger-red'
                  }`}>
                    {parsedResult.type === 'payment' ? t('paidAmount', lang) : t('expenses', lang)}
                  </span>
                </div>

                {/* Worker or Category Row */}
                {parsedResult.type === 'payment' ? (
                  <div className="flex justify-between items-center border-bottom border-[#E0DBC5]/40 pb-2">
                    <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
                      {t('name', lang)}
                    </span>
                    <span className="text-sm font-bold text-text-dark">
                      {parsedResult.workerName}
                    </span>
                  </div>
                ) : (
                  <div className="flex justify-between items-center border-bottom border-[#E0DBC5]/40 pb-2">
                    <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
                      {t('category', lang)}
                    </span>
                    <span className="text-sm font-bold text-text-dark">
                      {t(parsedResult.category || 'Others', lang)}
                    </span>
                  </div>
                )}

                {/* Amount Row */}
                <div className="flex justify-between items-center border-bottom border-[#E0DBC5]/40 pb-2">
                  <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
                    {t('amount', lang)}
                  </span>
                  <span className="text-lg font-bold text-text-dark">
                    ₹{parsedResult.amount}
                  </span>
                </div>

                {/* Date Row */}
                <div className="flex justify-between items-center border-bottom border-[#E0DBC5]/40 pb-2">
                  <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
                    {parsedResult.type === 'payment' ? t('paymentDate', lang) : t('expenseDate', lang)}
                  </span>
                  <span className="text-sm font-semibold text-text-dark">
                    {parsedResult.date}
                  </span>
                </div>

                {/* Description Row */}
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
                    {t('description', lang)}
                  </span>
                  <input
                    type="text"
                    value={parsedResult.description}
                    onChange={(e) => setParsedResult({ ...parsedResult, description: e.target.value })}
                    className="w-full bg-white border border-[#E0DBC5] text-text-dark font-medium rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowConfirmModal(false);
                    setParsedResult(null);
                  }}
                  className="flex-1 py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl active:scale-95 text-sm transition-all"
                >
                  {t('cancel', lang)}
                </button>
                <button
                  onClick={handleConfirmSave}
                  className="flex-1 py-4 bg-primary text-white font-bold rounded-2xl active:scale-95 shadow-soft text-sm transition-all"
                >
                  {t('nlpSaveConfirm', lang)}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
