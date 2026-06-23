import React, { useState, useEffect } from 'react';
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
  Users, 
  DollarSign,
  AlertCircle,
  FileSpreadsheet,
  Award,
  Calendar,
  ChevronRight
} from 'lucide-react';
import { 
  Worker, 
  Expense, 
  Payment, 
  AttendanceRecord,
  fetchWorkers,
  fetchExpenses,
  fetchPayments 
} from '../firebase';
import { t, subT, Language } from '../utils/translation';
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
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  lang,
  bilingual,
  showToast
}) => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'charts' | 'rankings' | 'data'>('charts');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const wData = await fetchWorkers();
      const eData = await fetchExpenses();
      const pData = await fetchPayments();
      const aData = JSON.parse(localStorage.getItem('pramesh_attendance') || '[]');

      setWorkers(wData);
      setExpenses(eData);
      setPayments(pData);
      setAttendance(aData);
    } catch (e) {
      showToast("Error compiling ledger reports", "error");
    } finally {
      setLoading(false);
    }
  };

  // Compile calculations (June 2026)
  const workerSummaries = workers.map(w => {
    const daysWorked = attendance.filter(a => a.workerId === w.id && a.status === 'present').length;
    const earned = daysWorked * w.dailyWage;
    const paid = payments.filter(p => p.workerId === w.id).reduce((sum, p) => sum + p.amount, 0);
    const pending = Math.max(0, earned - paid);
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
  });

  // Sort workers by earnings (Highest first) for rankings
  const rankedWorkers = [...workerSummaries].sort((a, b) => b.earned - a.earned);

  const totalLaborCost = workerSummaries.reduce((sum, s) => sum + s.earned, 0);
  const totalWagesPaid = workerSummaries.reduce((sum, s) => sum + s.paid, 0);
  const totalWagesPending = workerSummaries.reduce((sum, s) => sum + s.pending, 0);
  const totalOtherExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
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
  expenses.forEach(e => {
    // Map Labor and Equipment to Others if they exist in DB
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

  // Chart 2: Monthly trend bar chart (June vs previous mock months)
  const monthlyBarData = [
    { name: 'Apr 26', Labor: 12000, Expenses: 8500 },
    { name: 'May 26', Labor: 14500, Expenses: 9200 },
    { name: 'Jun 26', Labor: totalLaborCost, Expenses: totalOtherExpenses }
  ];

  // Excel Export
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

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

      const wsExpensesData = expenses.map(e => ({
        'Category': e.category,
        'Amount (₹)': e.amount,
        'Description': e.description,
        'Date Logged': e.date
      }));
      const wsExpenses = XLSX.utils.json_to_sheet(wsExpensesData);
      XLSX.utils.book_append_sheet(wb, wsExpenses, 'Other Farm Expenses');

      XLSX.writeFile(wb, `Pramesh_AgriBook_Report_2026-06-23.xlsx`);
      showToast("Excel file downloaded!", "success");
    } catch (error) {
      showToast("Excel export failed", "error");
    }
  };

  // PDF Export
  const handleExportPdf = () => {
    try {
      const doc = new jsPDF();
      
      doc.setFontSize(22);
      doc.setTextColor(46, 125, 50); // Primary green
      doc.text('Pramesh AgriBook - Farm Ledger', 14, 20);
      
      doc.setFontSize(10);
      doc.setTextColor(110, 110, 110);
      doc.text(`Monthly Summary Report | Date: 23 June 2026`, 14, 26);
      
      doc.setFontSize(12);
      doc.setTextColor(38, 50, 56);
      doc.text(`Total Labor Cost: Rs. ${totalLaborCost}`, 14, 38);
      doc.text(`Total Other Expenses: Rs. ${totalOtherExpenses}`, 14, 44);
      doc.text(`Total Wages Paid: Rs. ${totalWagesPaid}`, 14, 50);
      doc.text(`Total Wages Outstanding: Rs. ${totalWagesPending}`, 14, 56);
      doc.text(`Total Investment (Spending): Rs. ${totalFarmSpending}`, 14, 62);
      
      doc.setFontSize(14);
      doc.setTextColor(46, 125, 50);
      doc.text('1. Workers Payout Ledger', 14, 76);
      
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
        startY: 80,
        head: workerHeaders,
        body: workerRows,
        theme: 'striped',
        headStyles: { fillColor: [46, 125, 50] }
      });
      
      const finalY = (doc as any).lastAutoTable.finalY + 12;
      doc.text('2. Farm Expenses Ledger', 14, finalY);
      
      const expenseHeaders = [['Category', 'Amount', 'Description', 'Date']];
      const expenseRows = expenses.map(e => [
        e.category,
        `Rs. ${e.amount}`,
        e.description,
        e.date
      ]);
      
      doc.autoTable({
        startY: finalY + 4,
        head: expenseHeaders,
        body: expenseRows,
        theme: 'striped',
        headStyles: { fillColor: [249, 168, 37] } // Accent Gold
      });

      doc.save(`Pramesh_AgriBook_Report_2026-06-23.pdf`);
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
          /* SVG Empty State illustration */
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white border border-[#E0DBC5]/30 rounded-3xl shadow-soft min-h-[350px] my-5">
            <svg className="w-36 h-36 text-primary/20" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="100" cy="100" r="70" stroke="#2E7D32" strokeWidth="5" strokeDasharray="10 5" />
              <path d="M70 120 L 90 90 L 110 110 L 130 80" stroke="#F9A825" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="130" cy="80" r="6" fill="#F9A825" />
              <circle cx="90" cy="90" r="4" fill="#F9A825" />
            </svg>
            <h3 className="text-lg font-black text-text-dark mt-4">
              No reports available
            </h3>
            <p className="text-xs text-gray-400 font-semibold mt-1.5 text-center leading-normal">
              Enter worker details, mark their attendance, and log farm expenses to generate smart ledger charts automatically.
            </p>
          </div>
        ) : (
          <>
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
                </div>
              </div>
            ) : activeTab === 'rankings' ? (
              /* Worker Rankings Tab */
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
                        {/* Medal Rank badge */}
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
                </div>
              </div>
            ) : (
              /* Statistics / Summary Tab */
              <div className="space-y-4">
                {/* Highlights grid */}
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

                {/* Financial overview ledger table */}
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
