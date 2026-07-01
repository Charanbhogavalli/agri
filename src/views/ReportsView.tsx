import React, { useState, useEffect, useCallback } from 'react';
import { 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { 
  FileDown, 
  BarChart3, 
  TrendingUp, 
  FileSpreadsheet,
  Award
} from 'lucide-react';
import { 
  Worker, 
  Expense, 
  Payment, 
  AttendanceRecord,
  fetchWorkers,
  fetchExpenses,
  fetchPayments,
  fetchAttendance,
  CropCycle,
  filterByCrop,
  calculateWorkerEarnings,
  calculateWorkerPayments,
  calculateWorkerPending
} from '../firebase';
import { t, subT, Language } from '../utils/translation';
import { getLocalDateString } from '../utils/date';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// Extend jsPDF type
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

interface ReportsViewProps {
  lang: Language;
  bilingual: boolean;
  showToast: (message: string, type: 'success' | 'error') => void;
  selectedCropCycleId: string;
  cropCycles: CropCycle[];
}


export const ReportsView: React.FC<ReportsViewProps> = ({
  lang,
  bilingual,
  showToast,
  selectedCropCycleId,
  cropCycles
}) => {
  const [rawWorkers, setRawWorkers] = useState<Worker[]>([]);
  const [rawExpenses, setRawExpenses] = useState<Expense[]>([]);
  const [rawPayments, setRawPayments] = useState<Payment[]>([]);
  const [rawAttendance, setRawAttendance] = useState<AttendanceRecord[]>([]);
  const [cropFilterScope, setCropFilterScope] = useState<'current' | 'all'>('current');

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'charts' | 'rankings' | 'data'>('charts');

  // Filter States
  const [reportType, setReportType] = useState<string>('all'); // all, worker, payment, expense, attendance
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const wData = await fetchWorkers();
      const eData = await fetchExpenses();
      const pData = await fetchPayments();
      const aData = await fetchAttendance();

      setRawWorkers(wData);
      setRawExpenses(eData);
      setRawPayments(pData);
      setRawAttendance(aData);
    } catch (e) {
      showToast("Error compiling ledger reports", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const applyFilters = useCallback(() => {
    if (cropFilterScope === 'all') {
      setWorkers(rawWorkers);
      setExpenses(rawExpenses);
      setPayments(rawPayments);
      setAttendance(rawAttendance);
    } else {
      const cropObj = cropCycles.find(c => c.id === selectedCropCycleId);
      const assignedIds = cropObj ? cropObj.workerIds || [] : [];
      const filteredWorkers = selectedCropCycleId === 'all' || selectedCropCycleId === 'legacy_crop_2025_2026' 
        ? rawWorkers 
        : rawWorkers.filter(w => assignedIds.includes(w.id));

      const filteredExpenses = filterByCrop(rawExpenses, selectedCropCycleId);
      const filteredPayments = filterByCrop(rawPayments, selectedCropCycleId);
      const filteredAttendance = filterByCrop(rawAttendance, selectedCropCycleId);

      setWorkers(filteredWorkers);
      setExpenses(filteredExpenses);
      setPayments(filteredPayments);
      setAttendance(filteredAttendance);
    }
  }, [selectedCropCycleId, cropFilterScope, rawWorkers, rawExpenses, rawPayments, rawAttendance, cropCycles]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const q = searchQuery.toLowerCase().trim();

  // Filtered attendance
  const filteredAttendance = attendance.filter(a => {
    if (startDate && a.date < startDate) return false;
    if (endDate && a.date > endDate) return false;
    if (q) {
      const worker = workers.find(w => w.id === a.workerId);
      if (!worker || !worker.name.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Filtered payments
  const filteredPayments = payments.filter(p => {
    if (startDate && p.date < startDate) return false;
    if (endDate && p.date > endDate) return false;
    if (q) {
      const worker = workers.find(w => w.id === p.workerId);
      const nameMatch = worker && worker.name.toLowerCase().includes(q);
      const noteMatch = p.note && p.note.toLowerCase().includes(q);
      if (!nameMatch && !noteMatch) return false;
    }
    return true;
  });

  // Filtered expenses
  const filteredExpenses = expenses.filter(e => {
    if (startDate && e.date < startDate) return false;
    if (endDate && e.date > endDate) return false;
    if (q) {
      const catMatch = e.category.toLowerCase().includes(q);
      const descMatch = e.description && e.description.toLowerCase().includes(q);
      const notesMatch = e.notes && e.notes.toLowerCase().includes(q);
      if (!catMatch && !descMatch && !notesMatch) return false;
    }
    return true;
  });

  // Compile calculations incorporating half_day weight
  const workerSummaries = workers.map(w => {
    const workerAtt = filteredAttendance.filter(a => a.workerId === w.id);
    const daysWorked = workerAtt.reduce((sum, a) => {
      if (a.status === 'present') return sum + 1;
      if (a.status === 'half_day') return sum + 0.5;
      return sum;
    }, 0);
    const earned = calculateWorkerEarnings(w, filteredAttendance);
    const paid = calculateWorkerPayments(w, filteredPayments);
    const pending = Math.max(0, calculateWorkerPending(w, filteredAttendance, filteredPayments));
    return {
      id: w.id,
      name: w.name,
      village: w.village,
      dailyWage: w.dailyWage,
      daysWorked,
      earned,
      paid,
      pending
    };
  }).filter(s => {
    // If worker report is selected, only show active ones or matching search
    if (reportType === 'worker') {
      if (q) {
        return s.name.toLowerCase().includes(q);
      }
      return s.daysWorked > 0 || s.paid > 0;
    }
    return true;
  });

  // Sort workers by earnings (Highest first) for rankings
  const rankedWorkers = [...workerSummaries]
    .filter(s => s.earned > 0)
    .sort((a, b) => b.earned - a.earned);

  const totalLaborCost = workerSummaries.reduce((sum, s) => sum + s.earned, 0);
  const totalWagesPaid = workerSummaries.reduce((sum, s) => sum + s.paid, 0);
  const totalWagesPending = workerSummaries.reduce((sum, s) => sum + s.pending, 0);
  const totalOtherExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalFarmSpending = totalLaborCost + totalOtherExpenses;

  // Highlights calculations
  let highestPaidWorker = 'None';
  let maxPaid = 0;
  workerSummaries.forEach(s => {
    if (s.paid > maxPaid) {
      maxPaid = s.paid;
      highestPaidWorker = `${s.name} (₹${s.paid})`;
    }
  });

  let mostRegularWorker = 'None';
  let maxDays = 0;
  workerSummaries.forEach(s => {
    if (s.daysWorked > maxDays) {
      maxDays = s.daysWorked;
      mostRegularWorker = `${s.name} (${s.daysWorked} days)`;
    }
  });

  let biggestExpenseCategory = 'None';
  const categorySummary: Record<string, number> = {};
  filteredExpenses.forEach(e => {
    let catKey = e.category;
    if (e.category === 'Labor' || e.category === 'Equipment') {
      catKey = 'Others';
    }
    categorySummary[catKey] = (categorySummary[catKey] || 0) + e.amount;
  });
  let maxExp = 0;
  Object.entries(categorySummary).forEach(([cat, amt]) => {
    if (amt > maxExp) {
      maxExp = amt;
      biggestExpenseCategory = `${t(cat, lang).split(' / ')[0]} (₹${amt})`;
    }
  });

  // Chart 1: Category spending distribution (Pie Chart)
  const pieData = Object.entries(categorySummary).map(([name, value]) => ({
    name: t(name, lang).split(' / ')[0],
    value
  }));
  if (totalLaborCost > 0) {
    pieData.push({
      name: t('Labor', lang).split(' / ')[0],
      value: totalLaborCost
    });
  }

  const COLORS = ['#2E7D32', '#F9A825', '#E53935', '#0288D1', '#8E24AA', '#546E7A', '#43A047', '#D81B60'];

  // Chart 2: Monthly trend bar chart (calculated dynamically from actual database entries)
  const monthlyDataMap: Record<string, { Labor: number; Expenses: number }> = {};

  // Group labor cost by month
  attendance.forEach(a => {
    const month = a.date.substring(0, 7); // YYYY-MM
    if (!monthlyDataMap[month]) {
      monthlyDataMap[month] = { Labor: 0, Expenses: 0 };
    }
    const worker = workers.find(w => w.id === a.workerId);
    if (worker) {
      const wage = a.wageForDay !== undefined ? a.wageForDay : worker.dailyWage;
      const weight = a.status === 'present' ? 1.0 : a.status === 'half_day' ? 0.5 : 0;
      monthlyDataMap[month].Labor += weight * wage;
    }
  });

  // Group expenses by month
  expenses.forEach(e => {
    const month = e.date.substring(0, 7); // YYYY-MM
    if (!monthlyDataMap[month]) {
      monthlyDataMap[month] = { Labor: 0, Expenses: 0 };
    }
    monthlyDataMap[month].Expenses += e.amount;
  });

  const monthlyBarData = Object.entries(monthlyDataMap)
    .map(([month, data]) => ({
      name: month,
      Labor: Math.round(data.Labor),
      Expenses: Math.round(data.Expenses)
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(-6); // Limit to last 6 months

  // Excel Export
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      if (reportType === 'all' || reportType === 'worker') {
        const wsWorkersData = workerSummaries.map(s => ({
          'Worker Name': s.name,
          'Village': s.village,
          'Daily Wage Rate (₹)': s.dailyWage,
          'Days Worked': s.daysWorked,
          'Total Wages Earned (₹)': s.earned,
          'Amount Paid (₹)': s.paid,
          'Pending Wages (₹)': s.pending
        }));
        const wsWorkers = XLSX.utils.json_to_sheet(wsWorkersData);
        XLSX.utils.book_append_sheet(wb, wsWorkers, 'Workers Wage Ledger');
      }

      if (reportType === 'all' || reportType === 'payment') {
        const wsPaymentsData = filteredPayments.map(p => {
          const worker = workers.find(w => w.id === p.workerId);
          return {
            'Worker Name': worker ? worker.name : 'Unknown',
            'Amount Paid (₹)': p.amount,
            'Date': p.date,
            'Note': p.note
          };
        });
        const wsPayments = XLSX.utils.json_to_sheet(wsPaymentsData);
        XLSX.utils.book_append_sheet(wb, wsPayments, 'Payments Log');
      }

      if (reportType === 'all' || reportType === 'expense') {
        const wsExpensesData = filteredExpenses.map(e => ({
          'Category': e.category,
          'Amount (₹)': e.amount,
          'Description': e.description,
          'Notes': e.notes || '',
          'Date Logged': e.date
        }));
        const wsExpenses = XLSX.utils.json_to_sheet(wsExpensesData);
        XLSX.utils.book_append_sheet(wb, wsExpenses, 'Other Farm Expenses');
      }

      if (reportType === 'all' || reportType === 'attendance') {
        const wsAttendanceData = filteredAttendance.map(a => {
          const worker = workers.find(w => w.id === a.workerId);
          const wage = a.wageForDay !== undefined ? a.wageForDay : (worker ? worker.dailyWage : 0);
          return {
            'Worker Name': worker ? worker.name : 'Unknown',
            'Date': a.date,
            'Status': a.status,
            'Daily Wage (₹)': a.status === 'absent' ? 0 : wage,
            'Work Type': a.workType || '',
            'Notes': a.notes || ''
          };
        });
        const wsAttendance = XLSX.utils.json_to_sheet(wsAttendanceData);
        XLSX.utils.book_append_sheet(wb, wsAttendance, 'Attendance Registry');
      }

      const todayStr = getLocalDateString();
      XLSX.writeFile(wb, `Paramesh_AgriBook_Report_${todayStr}.xlsx`);
      showToast("Excel file downloaded!", "success");
    } catch (error) {
      showToast("Excel export failed", "error");
    }
  };

  // PDF Export
  const handleExportPdf = () => {
    try {
      const doc = new jsPDF();
      const todayStr = getLocalDateString();
      
      doc.setFontSize(20);
      doc.setTextColor(46, 125, 50); // Primary green
      doc.text('Paramesh AgriBook - Farm Ledger', 14, 20);
      
      doc.setFontSize(10);
      doc.setTextColor(110, 110, 110);
      doc.text(`Report Type: ${reportType.toUpperCase()} | Generated on: ${todayStr}`, 14, 26);
      
      if (startDate || endDate) {
        doc.text(`Date Range: ${startDate || 'All Time'} to ${endDate || 'All Time'}`, 14, 31);
      }
      
      doc.setFontSize(12);
      doc.setTextColor(38, 50, 56);
      doc.text(`Total Labor Cost: Rs. ${totalLaborCost}`, 14, 40);
      doc.text(`Total Other Expenses: Rs. ${totalOtherExpenses}`, 14, 46);
      doc.text(`Total Wages Paid: Rs. ${totalWagesPaid}`, 14, 52);
      doc.text(`Total Wages Outstanding: Rs. ${totalWagesPending}`, 14, 58);
      doc.text(`Total Investment: Rs. ${totalFarmSpending}`, 14, 64);
      
      let nextStartY = 76;

      if (reportType === 'all' || reportType === 'worker') {
        doc.setFontSize(14);
        doc.setTextColor(46, 125, 50);
        doc.text('1. Workers Payout Ledger', 14, nextStartY);
        
        const workerHeaders = [['Name', 'Village', 'Wage', 'Days', 'Earned', 'Paid', 'Pending']];
        const workerRows = workerSummaries.map(s => [
          s.name,
          s.village || 'N/A',
          `Rs. ${s.dailyWage}`,
          s.daysWorked,
          `Rs. ${s.earned}`,
          `Rs. ${s.paid}`,
          `Rs. ${s.pending}`
        ]);
        
        doc.autoTable({
          startY: nextStartY + 4,
          head: workerHeaders,
          body: workerRows,
          theme: 'striped',
          headStyles: { fillColor: [46, 125, 50] }
        });
        nextStartY = (doc as any).lastAutoTable.finalY + 12;
      }
      
      if (reportType === 'all' || reportType === 'expense') {
        doc.setFontSize(14);
        doc.setTextColor(46, 125, 50);
        doc.text(reportType === 'all' ? '2. Farm Expenses Ledger' : 'Farm Expenses Ledger', 14, nextStartY);
        
        const expenseHeaders = [['Category', 'Amount', 'Description', 'Notes', 'Date']];
        const expenseRows = filteredExpenses.map(e => [
          e.category,
          `Rs. ${e.amount}`,
          e.description,
          e.notes || '',
          e.date
        ]);
        
        doc.autoTable({
          startY: nextStartY + 4,
          head: expenseHeaders,
          body: expenseRows,
          theme: 'striped',
          headStyles: { fillColor: [249, 168, 37] }
        });
        nextStartY = (doc as any).lastAutoTable.finalY + 12;
      }

      if (reportType === 'all' || reportType === 'payment') {
        doc.setFontSize(14);
        doc.setTextColor(46, 125, 50);
        doc.text(reportType === 'all' ? '3. Payments Ledger' : 'Payments Ledger', 14, nextStartY);
        
        const paymentHeaders = [['Worker Name', 'Amount', 'Date', 'Note']];
        const paymentRows = filteredPayments.map(p => {
          const worker = workers.find(w => w.id === p.workerId);
          return [
            worker ? worker.name : 'Unknown',
            `Rs. ${p.amount}`,
            p.date,
            p.note || ''
          ];
        });
        
        doc.autoTable({
          startY: nextStartY + 4,
          head: paymentHeaders,
          body: paymentRows,
          theme: 'striped',
          headStyles: { fillColor: [33, 150, 243] }
        });
        nextStartY = (doc as any).lastAutoTable.finalY + 12;
      }

      if (reportType === 'all' || reportType === 'attendance') {
        doc.setFontSize(14);
        doc.setTextColor(46, 125, 50);
        doc.text(reportType === 'all' ? '4. Attendance Registry' : 'Attendance Registry', 14, nextStartY);
        
        const attendanceHeaders = [['Worker Name', 'Date', 'Status', 'Daily Wage', 'Work Type', 'Notes']];
        const attendanceRows = filteredAttendance.map(a => {
          const worker = workers.find(w => w.id === a.workerId);
          const wage = a.wageForDay !== undefined ? a.wageForDay : (worker ? worker.dailyWage : 0);
          return [
            worker ? worker.name : 'Unknown',
            a.date,
            a.status,
            a.status === 'absent' ? 'Rs. 0' : `Rs. ${wage}`,
            a.workType || 'N/A',
            a.notes || ''
          ];
        });
        
        doc.autoTable({
          startY: nextStartY + 4,
          head: attendanceHeaders,
          body: attendanceRows,
          theme: 'striped',
          headStyles: { fillColor: [156, 39, 176] }
        });
      }

      doc.save(`Paramesh_AgriBook_Report_${todayStr}.pdf`);
      showToast("PDF report downloaded!", "success");
    } catch (error) {
      showToast("PDF export failed", "error");
    }
  };

  const laborPercentageVal = totalFarmSpending > 0 ? Math.round((totalLaborCost / totalFarmSpending) * 100) : 0;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 pb-24 overflow-y-auto no-scrollbar flex flex-col justify-between">
      <div>
        {/* Title */}
        <div className="mb-5 flex justify-between items-center shrink-0">
          <div>
            <h1 className="text-2xl font-extrabold text-text-dark">
              {bilingual ? `${t('reportsPage', lang)} / ${subT('reportsPage', lang)}` : t('reportsPage', lang)}
            </h1>
            <p className="text-xs text-gray-400 font-semibold mt-1">
              Analyze farm spending and export ledger balances
            </p>
          </div>
        </div>

        {/* Global Empty State check */}
        {workers.length === 0 && expenses.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white border border-[#E0DBC5]/30 rounded-3xl shadow-soft min-h-[350px] my-5">
            <svg className="w-36 h-36 text-primary/20" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="100" cy="100" r="70" stroke="#2E7D32" strokeWidth="5" strokeDasharray="10 5" />
              <path d="M70 120 L 90 90 L 110 110 L 130 80" stroke="#F9A825" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="130" cy="80" r="6" fill="#F9A825" />
              <circle cx="90" cy="90" r="4" fill="#F9A825" />
            </svg>
            <h3 className="text-lg font-black text-text-dark mt-4">
              No reports generated.
            </h3>
            <p className="text-xs text-gray-400 font-semibold mt-1.5 text-center leading-normal">
              Enter worker details, mark their attendance, and log farm expenses to generate smart ledger charts automatically.
            </p>
          </div>
        ) : (
          <>
            {/* Filters Controls Box */}
            <div className="bg-white p-5 rounded-3xl border border-[#E0DBC5]/40 shadow-soft space-y-4 mb-5 shrink-0">
              {/* Crop Scope Selector */}
              <div className="flex flex-col gap-1.5 pb-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">Report Scope</label>
                <div className="flex bg-[#F8F5E9]/70 p-0.5 rounded-xl border border-[#E0DBC5]/40 text-center text-xs font-semibold gap-0.5">
                  <button
                    type="button"
                    onClick={() => setCropFilterScope('current')}
                    className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${
                      cropFilterScope === 'current' ? 'bg-primary text-white shadow-sm' : 'text-gray-500 hover:text-text-dark'
                    }`}
                  >
                    Current Crop ({
                      selectedCropCycleId === 'all' 
                        ? t('allCrops', lang) 
                        : (() => {
                            const c = cropCycles.find(c => c.id === selectedCropCycleId);
                            return c ? `${c.cropName} (${c.season})` : 'Selected Crop';
                          })()
                    })
                  </button>
                  <button
                    type="button"
                    onClick={() => setCropFilterScope('all')}
                    className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${
                      cropFilterScope === 'all' ? 'bg-primary text-white shadow-sm' : 'text-gray-500 hover:text-text-dark'
                    }`}
                  >
                    All Crops (Aggregate)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Report Type */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">Report Type</label>
                  <select
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                    className="bg-[#F8F5E9]/50 border border-[#E0DBC5] text-text-dark font-medium rounded-xl py-2.5 px-3 text-xs focus:outline-none focus:border-primary focus:bg-white"
                  >
                    <option value="all">All Data / మొత్తం సమాచారం</option>
                    <option value="worker">Worker Wages / కూలీల లెక్కలు</option>
                    <option value="payment">Payments / చెల్లింపులు</option>
                    <option value="expense">Expenses / ఖర్చులు</option>
                    <option value="attendance">Attendance / హాజరు పట్టిక</option>
                  </select>
                </div>

                {/* Search */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">Search Keyword</label>
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-[#F8F5E9]/50 border border-[#E0DBC5] text-text-dark font-medium rounded-xl py-2.5 px-3 text-xs focus:outline-none focus:border-primary focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Start Date */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-[#F8F5E9]/50 border border-[#E0DBC5] text-text-dark font-medium rounded-xl py-2.5 px-3 text-xs focus:outline-none focus:border-primary focus:bg-white"
                  />
                </div>

                {/* End Date */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-[#F8F5E9]/50 border border-[#E0DBC5] text-text-dark font-medium rounded-xl py-2.5 px-3 text-xs focus:outline-none focus:border-primary focus:bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex bg-white p-1 rounded-2xl border border-[#E0DBC5]/40 shadow-soft mb-5 shrink-0">
              <button
                onClick={() => setActiveTab('charts')}
                className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'charts' ? 'bg-primary text-white shadow-sm' : 'text-gray-500'
                }`}
              >
                <BarChart3 size={15} />
                {bilingual ? 'Charts / చార్టులు' : 'Charts'}
              </button>
              <button
                onClick={() => setActiveTab('rankings')}
                className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'rankings' ? 'bg-primary text-white shadow-sm' : 'text-gray-500'
                }`}
              >
                <Award size={15} />
                {bilingual ? 'Rankings / ర్యాంకులు' : 'Rankings'}
              </button>
              <button
                onClick={() => setActiveTab('data')}
                className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'data' ? 'bg-primary text-white shadow-sm' : 'text-gray-500'
                }`}
              >
                <TrendingUp size={15} />
                {bilingual ? 'Summary / లెక్కలు' : 'Summary'}
              </button>
            </div>

            {/* Render tab content */}
            {activeTab === 'charts' ? (
              <div className="space-y-5">
                {/* Expense Distribution Pie Chart */}
                <div className="bg-white p-4 rounded-3xl border border-[#E0DBC5]/40 shadow-soft">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 border-l-4 border-primary pl-2">
                    Spending Distribution / ఖర్చుల విభజన
                  </h3>
                  {pieData.length === 0 ? (
                    <p className="text-xs text-gray-400 py-10 text-center font-medium">Add data to view distribution.</p>
                  ) : (
                    <div className="h-60 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={75}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => `₹${value}`} />
                          <Legend iconSize={8} layout="horizontal" align="center" verticalAlign="bottom" wrapperStyle={{ fontSize: '9px', fontWeight: 'bold' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* Monthly Spending Trend Bar Chart */}
                <div className="bg-white p-4 rounded-3xl border border-[#E0DBC5]/40 shadow-soft">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 border-l-4 border-accent pl-2">
                    Monthly Trend / నెలవారీ పోకడలు
                  </h3>
                  {monthlyBarData.length === 0 ? (
                    <p className="text-xs text-gray-400 py-10 text-center font-medium">Add data to view monthly trends.</p>
                  ) : (
                    <div className="h-60 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyBarData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0efe9" />
                          <XAxis dataKey="name" stroke="#8e8c84" fontSize={9} tickLine={false} />
                          <YAxis stroke="#8e8c84" fontSize={9} tickLine={false} />
                          <Tooltip formatter={(value) => `₹${value}`} />
                          <Legend iconSize={8} wrapperStyle={{ fontSize: '9px', fontWeight: 'bold' }} />
                          <Bar dataKey="Labor" fill="#2E7D32" name="Labor Cost" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Expenses" fill="#F9A825" name="Other Expenses" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>
            ) : activeTab === 'rankings' ? (
              <div className="bg-white p-5 rounded-3xl border border-[#E0DBC5]/40 shadow-soft space-y-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-l-4 border-primary pl-2 mb-2">
                  Worker Earnings Ranking / ఎక్కువ సంపాదించిన పనివారు
                </h3>
                
                <div className="space-y-3">
                  {rankedWorkers.map((s, idx) => (
                    <div 
                      key={s.id} 
                      className="flex items-center justify-between p-3 bg-[#F8F5E9]/20 border border-[#E0DBC5]/15 rounded-2xl"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-extrabold text-sm ${
                          idx === 0 ? 'bg-amber-100 text-amber-700' :
                          idx === 1 ? 'bg-slate-100 text-slate-700' :
                          idx === 2 ? 'bg-amber-50 text-amber-600' : 'bg-gray-50 text-gray-500'
                        }`}>
                          {idx + 1}
                        </div>
                        <div>
                          <span className="text-sm font-extrabold text-text-dark block leading-none">{s.name}</span>
                          <span className="text-[10px] text-gray-400 font-bold block mt-1">{s.daysWorked} days worked</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-black text-primary block">₹{s.earned}</span>
                        <span className="text-[9px] text-gray-400 font-bold mt-0.5 block">wage: ₹{s.dailyWage}</span>
                      </div>
                    </div>
                  ))}
                  {rankedWorkers.length === 0 && (
                    <p className="text-xs text-gray-400 py-10 text-center font-medium">No ranked worker data available.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {reportType === 'all' ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white p-4 rounded-2xl border border-[#E0DBC5]/40 shadow-soft">
                        <span className="text-[9px] text-gray-400 font-bold uppercase block tracking-wider">
                          {t('mostRegularWorker', lang)}
                        </span>
                        <span className="text-sm font-bold text-text-dark block mt-1 leading-tight">
                          {mostRegularWorker}
                        </span>
                      </div>
                      <div className="bg-white p-4 rounded-2xl border border-[#E0DBC5]/40 shadow-soft">
                        <span className="text-[9px] text-gray-400 font-bold uppercase block tracking-wider">
                          {t('highestPaidWorker', lang)}
                        </span>
                        <span className="text-sm font-bold text-text-dark block mt-1 leading-tight">
                          {highestPaidWorker}
                        </span>
                      </div>
                      <div className="bg-white p-4 rounded-2xl border border-[#E0DBC5]/40 shadow-soft">
                        <span className="text-[9px] text-gray-400 font-bold uppercase block tracking-wider">
                          {t('biggestExpense', lang)}
                        </span>
                        <span className="text-sm font-bold text-text-dark block mt-1 leading-tight truncate">
                          {biggestExpenseCategory}
                        </span>
                      </div>
                      <div className="bg-white p-4 rounded-2xl border border-[#E0DBC5]/40 shadow-soft">
                        <span className="text-[9px] text-gray-400 font-bold uppercase block tracking-wider">
                          {t('laborPercentage', lang)}
                        </span>
                        <span className="text-sm font-bold text-text-dark block mt-1 leading-tight">
                          {laborPercentageVal}%
                        </span>
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-3xl border border-[#E0DBC5]/40 shadow-soft space-y-3">
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                        {t('statistics', lang)}
                      </h3>
                      <div className="flex justify-between text-xs font-medium border-b border-gray-50 pb-2">
                        <span className="text-gray-500">Total spent on workers</span>
                        <span className="font-bold text-text-dark">₹{totalLaborCost}</span>
                      </div>
                      <div className="flex justify-between text-xs font-medium border-b border-gray-50 pb-2">
                        <span className="text-gray-500">Other expenses logged</span>
                        <span className="font-bold text-text-dark">₹{totalOtherExpenses}</span>
                      </div>
                      <div className="flex justify-between text-xs font-medium border-b border-gray-50 pb-2">
                        <span className="text-gray-500">Total wages already paid</span>
                        <span className="font-bold text-success-green">₹{totalWagesPaid}</span>
                      </div>
                      <div className="flex justify-between text-xs font-medium border-b border-gray-50 pb-2">
                        <span className="text-gray-500">Outstanding wages to pay</span>
                        <span className="font-bold text-danger-red">₹{totalWagesPending}</span>
                      </div>
                      <div className="flex justify-between text-sm font-extrabold pt-1">
                        <span className="text-primary">Total Farm Spending</span>
                        <span className="text-primary">₹{totalFarmSpending}</span>
                      </div>
                    </div>
                  </>
                ) : reportType === 'worker' ? (
                  <div className="bg-white p-4 rounded-3xl border border-[#E0DBC5]/40 shadow-soft space-y-3">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Worker Wages Summary</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="border-b border-gray-100 text-gray-400 font-bold">
                            <th className="py-2">Name</th>
                            <th className="py-2 text-center">Days</th>
                            <th className="py-2 text-right">Earned</th>
                            <th className="py-2 text-right">Paid</th>
                            <th className="py-2 text-right text-danger-red">Pending</th>
                          </tr>
                        </thead>
                        <tbody>
                          {workerSummaries.map(s => (
                            <tr key={s.id} className="border-b border-gray-50 font-semibold text-text-dark">
                              <td className="py-2 font-bold">{s.name}</td>
                              <td className="py-2 text-center">{s.daysWorked}</td>
                              <td className="py-2 text-right">₹{s.earned}</td>
                              <td className="py-2 text-right text-success-green">₹{s.paid}</td>
                              <td className="py-2 text-right text-danger-red">₹{s.pending}</td>
                            </tr>
                          ))}
                          {workerSummaries.length === 0 && (
                            <tr><td colSpan={5} className="py-4 text-center text-gray-400">No records found</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : reportType === 'payment' ? (
                  <div className="bg-white p-4 rounded-3xl border border-[#E0DBC5]/40 shadow-soft space-y-3">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Payments Report</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="border-b border-gray-100 text-gray-400 font-bold">
                            <th className="py-2">Worker</th>
                            <th className="py-2 text-right">Amount</th>
                            <th className="py-2">Date</th>
                            <th className="py-2">Note</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredPayments.map(p => {
                            const worker = workers.find(w => w.id === p.workerId);
                            return (
                              <tr key={p.id} className="border-b border-gray-50 font-semibold text-text-dark">
                                <td className="py-2 font-bold">{worker ? worker.name : 'Unknown'}</td>
                                <td className="py-2 text-right text-success-green">₹{p.amount}</td>
                                <td className="py-2">{p.date}</td>
                                <td className="py-2 text-gray-400 truncate max-w-[100px]">{p.note || '-'}</td>
                              </tr>
                            );
                          })}
                          {filteredPayments.length === 0 && (
                            <tr><td colSpan={4} className="py-4 text-center text-gray-400">No records found</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : reportType === 'expense' ? (
                  <div className="bg-white p-4 rounded-3xl border border-[#E0DBC5]/40 shadow-soft space-y-3">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Expenses Report</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="border-b border-gray-100 text-gray-400 font-bold">
                            <th className="py-2">Category</th>
                            <th className="py-2 text-right">Amount</th>
                            <th className="py-2">Date</th>
                            <th className="py-2">Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredExpenses.map(e => (
                            <tr key={e.id} className="border-b border-gray-50 font-semibold text-text-dark">
                              <td className="py-2 font-bold">{e.category}</td>
                              <td className="py-2 text-right text-danger-red font-black">₹{e.amount}</td>
                              <td className="py-2">{e.date}</td>
                              <td className="py-2 text-gray-400 truncate max-w-[100px]">{e.description || '-'}</td>
                            </tr>
                          ))}
                          {filteredExpenses.length === 0 && (
                            <tr><td colSpan={4} className="py-4 text-center text-gray-400">No records found</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white p-4 rounded-3xl border border-[#E0DBC5]/40 shadow-soft space-y-3">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Attendance Log</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="border-b border-gray-100 text-gray-400 font-bold">
                            <th className="py-2">Worker</th>
                            <th className="py-2">Date</th>
                            <th className="py-2">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredAttendance.map(a => {
                            const worker = workers.find(w => w.id === a.workerId);
                            return (
                              <tr key={a.id} className="border-b border-gray-50 font-semibold text-text-dark">
                                <td className="py-2 font-bold">{worker ? worker.name : 'Unknown'}</td>
                                <td className="py-2">{a.date}</td>
                                <td className="py-2 capitalize">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    a.status === 'present' ? 'bg-success-green/10 text-success-green' :
                                    a.status === 'half_day' ? 'bg-amber-100 text-amber-700' :
                                    'bg-danger-red/10 text-danger-red'
                                  }`}>
                                    {a.status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                          {filteredAttendance.length === 0 && (
                            <tr><td colSpan={3} className="py-4 text-center text-gray-400">No records found</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Export Section */}
            <div className="mt-8 pt-4 border-t border-[#E0DBC5]/30 shrink-0">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                Download Farm Ledger Files
              </h3>
              
              <div className="flex gap-3">
                <button
                  onClick={handleExportPdf}
                  className="flex-1 py-4 bg-primary text-white font-bold rounded-2xl shadow-soft btn-active-scale cursor-pointer flex items-center justify-center gap-1.5 text-xs transition-all"
                >
                  <FileDown size={16} />
                  {t('exportPdf', lang)}
                </button>

                <button
                  onClick={handleExportExcel}
                  className="flex-1 py-4 bg-[#F9A825] text-white font-bold rounded-2xl shadow-soft btn-active-scale cursor-pointer flex items-center justify-center gap-1.5 text-xs transition-all"
                >
                  <FileSpreadsheet size={16} />
                  {t('exportExcel', lang)}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
