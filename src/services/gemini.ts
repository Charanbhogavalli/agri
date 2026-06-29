import { GoogleGenerativeAI } from '@google/generative-ai';
import { Worker, Expense, Payment, AttendanceRecord } from '../firebase';
import { getLocalDateString } from '../utils/date';

// Helper to get Gemini API key
export const getGeminiApiKey = (): string => {
  const saved = localStorage.getItem('paramesh_settings');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.geminiKey) return parsed.geminiKey;
    } catch (e) {}
  }
  return import.meta.env.VITE_GEMINI_API_KEY || '';
};

// ----------------------------------------------------
// 1. Natural Language Parser
// ----------------------------------------------------
export interface ParsedTransaction {
  type: 'payment' | 'expense' | 'unknown';
  workerId?: string;
  workerName?: string;
  category?: 'Labor' | 'Seeds' | 'Fertilizer' | 'Diesel' | 'Tractor' | 'Transport' | 'Equipment' | 'Others';
  amount: number;
  date: string; // YYYY-MM-DD
  description: string;
}

// Local mock parser if no API key is provided
const mockParseText = (text: string, workers: Worker[]): ParsedTransaction => {
  const lowerText = text.toLowerCase();
  
  // Extract amount (number)
  const amountMatch = lowerText.match(/\d+/);
  const amount = amountMatch ? parseInt(amountMatch[0], 10) : 0;
  
  // Date default to today
  const todayStr = getLocalDateString();

  // Check if it is a payment (contains "paid" or "pay" or "wages" to a worker)
  const isPayment = lowerText.includes('paid') || lowerText.includes('pay') || lowerText.includes('gave') || lowerText.includes('wages');
  
  if (isPayment || workers.some(w => lowerText.includes(w.name.toLowerCase()))) {
    // Find matching worker
    const matchedWorker = workers.find(w => lowerText.includes(w.name.toLowerCase()));
    return {
      type: 'payment',
      workerId: matchedWorker?.id || 'unknown',
      workerName: matchedWorker?.name || 'Unknown Worker',
      amount,
      date: todayStr,
      description: `Payment of ₹${amount} to ${matchedWorker?.name || 'Worker'}`
    };
  }

  // Check if it is an expense
  const categories: Expense['category'][] = ['Seeds', 'Fertilizer', 'Diesel', 'Tractor', 'Transport', 'Equipment', 'Others', 'Labor'];
  let matchedCategory: Expense['category'] = 'Others';
  
  for (const cat of categories) {
    if (lowerText.includes(cat.toLowerCase())) {
      matchedCategory = cat;
      break;
    }
  }

  // If "diesel" is found but no category, category is Diesel
  if (lowerText.includes('diesel') || lowerText.includes('fuel') || lowerText.includes('oil')) {
    matchedCategory = 'Diesel';
  } else if (lowerText.includes('seed')) {
    matchedCategory = 'Seeds';
  } else if (lowerText.includes('fertilizer') || lowerText.includes('urea') || lowerText.includes('mandhu')) {
    matchedCategory = 'Fertilizer';
  } else if (lowerText.includes('tractor') || lowerText.includes('dunnutha') || lowerText.includes('plough')) {
    matchedCategory = 'Tractor';
  } else if (lowerText.includes('transport') || lowerText.includes('auto') || lowerText.includes('lorry')) {
    matchedCategory = 'Transport';
  } else if (lowerText.includes('tools') || lowerText.includes('spray') || lowerText.includes('machine')) {
    matchedCategory = 'Equipment';
  }

  return {
    type: 'expense',
    category: matchedCategory,
    amount,
    date: todayStr,
    description: text // Keep original text as description
  };
};

export const parseNaturalLanguage = async (
  text: string,
  workers: Worker[]
): Promise<ParsedTransaction> => {
  const apiKey = getGeminiApiKey();
  
  if (!apiKey) {
    console.log("No Gemini API key. Using local regex parser.");
    return mockParseText(text, workers);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // Use gemini-1.5-flash for speed and reliability in extraction
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: { responseMimeType: 'application/json' }
    });

    const workersInfo = workers.map(w => `{ id: "${w.id}", name: "${w.name}" }`).join(', ');
    const today = new Date();
    const weekday = today.toLocaleDateString('en-US', { weekday: 'long' });
    const monthDayYear = today.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
    const todayStr = getLocalDateString(today);

    const systemPrompt = `You are a smart parser for a farm ledger app. 
Parse the user's text and extract transaction details.
Today is ${weekday}, ${monthDayYear}.
 
Available Workers in system: [${workersInfo}]
Allowed Expense Categories: [Labor, Seeds, Fertilizer, Diesel, Tractor, Transport, Equipment, Others]

Return JSON in this EXACT schema:
{
  "type": "payment" | "expense" | "unknown",
  "workerId": "id_of_worker" | null,
  "workerName": "matched_worker_name" | null,
  "category": "one_of_allowed_categories" | null,
  "amount": number,
  "date": "YYYY-MM-DD" (use today's date ${todayStr} if date is not specified),
  "description": "Short clean description of the transaction"
}

Examples:
- "Paid Ramesh 2000": type is "payment", workerName is "Ramesh", amount is 2000, description is "Payment to Ramesh"
- "Diesel expense 1500 for tractor": type is "expense", category is "Diesel", amount is 1500, description is "Diesel for tractor"
- "Fertilizer 3500 yesterday": type is "expense", category is "Fertilizer", amount is 3500, date is "2026-06-22", description is "Fertilizer"

Parse the text: "${text}"`;

    const result = await model.generateContent(systemPrompt);
    const responseText = result.response.text();
    const parsed = JSON.parse(responseText);
    
    // Validate workerId matching if not fully matched by Gemini
    if (parsed.type === 'payment' && parsed.workerName && !parsed.workerId) {
      const match = workers.find(w => w.name.toLowerCase() === parsed.workerName.toLowerCase());
      if (match) parsed.workerId = match.id;
    }

    return parsed as ParsedTransaction;
  } catch (error) {
    console.error("Gemini NLP Parser error, falling back to mock:", error);
    return mockParseText(text, workers);
  }
};

// ----------------------------------------------------
// 2. Smart Programmatic Insights Generator
// ----------------------------------------------------
export interface AIObservation {
  textEn: string;
  textTe: string;
}

const getPreviousMonthStr = (currentMonthStr: string): string => {
  const [yearStr, monthStr] = currentMonthStr.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10);
  month -= 1;
  if (month === 0) {
    month = 12;
    year -= 1;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
};

export const getInsightsList = (
  workers: Worker[],
  expenses: Expense[],
  payments: Payment[],
  attendance: AttendanceRecord[],
  currentMonthStr: string
): AIObservation[] => {
  const insights: AIObservation[] = [];

  const curMonthPayments = payments.filter(p => p.date.startsWith(currentMonthStr));
  const curMonthExpenses = expenses.filter(e => e.date.startsWith(currentMonthStr));
  const curMonthAttendance = attendance.filter(a => a.date.startsWith(currentMonthStr));

  // 1. Top Paid Worker (this month)
  if (curMonthPayments.length > 0 && workers.length > 0) {
    const payMap: Record<string, number> = {};
    curMonthPayments.forEach(p => {
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
    const topWorker = workers.find(w => w.id === maxWorkerId);
    if (topWorker) {
      insights.push({
        textEn: `${topWorker.name} received the highest payment of ₹${maxPay} this month.`,
        textTe: `ఈ నెలలో ${topWorker.name} అత్యధికంగా ₹${maxPay} చెల్లింపును అందుకున్నారు.`
      });
    }
  }

  // 2. Most Regular Worker (this month)
  if (curMonthAttendance.length > 0 && workers.length > 0) {
    const attMap: Record<string, number> = {};
    curMonthAttendance.forEach(a => {
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
    const topWorker = workers.find(w => w.id === regularWorkerId);
    if (topWorker && maxDays > 0) {
      insights.push({
        textEn: `${topWorker.name} is the most regular worker this month with ${maxDays} days of work.`,
        textTe: `ఈ నెలలో ${topWorker.name} అత్యధికంగా ${maxDays} రోజులు పని చేసి అత్యంత క్రమశిక్షణ గల కూలీగా నిలిచారు.`
      });
    }
  }

  // 3. Pending Wages (all-time)
  if (workers.length > 0) {
    let totalPending = 0;
    workers.forEach(w => {
      const workerAtt = attendance.filter(a => a.workerId === w.id);
      const earned = workerAtt.reduce((sum, a) => {
        const wage = a.wageForDay !== undefined ? a.wageForDay : w.dailyWage;
        if (a.status === 'present') return sum + wage;
        if (a.status === 'half_day') return sum + wage * 0.5;
        return sum;
      }, 0);
      const paid = payments.filter(p => p.workerId === w.id).reduce((sum, p) => sum + p.amount, 0);
      const pending = earned - paid;
      if (pending > 0) {
        totalPending += pending;
      }
    });
    if (totalPending > 0) {
      insights.push({
        textEn: `Total outstanding wages across all workers is ₹${totalPending}.`,
        textTe: `కూలీలందరికీ కలిపి మొత్తం బకాయి కూలి ₹${totalPending} గా ఉంది.`
      });
    }
  }

  // 4. Biggest Expense Category (this month)
  if (curMonthExpenses.length > 0) {
    const expMap: Record<string, number> = {};
    curMonthExpenses.forEach(e => {
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
    const categoryTeMap: Record<string, string> = {
      Labor: 'కూలీల ఖర్చులు', Seeds: 'విత్తనాలు', Fertilizer: 'エరువులు', 
      Diesel: 'డీజిల్ / ఆయిల్', Tractor: 'ట్రాక్టర్ అద్దె', Transport: 'రవాణా', 
      Equipment: 'పనిముట్లు', Others: 'ఇతర ఖర్చులు'
    };
    if (maxCat) {
      insights.push({
        textEn: `Biggest expense category this month is ${maxCat} (₹${maxExp}).`,
        textTe: `ఈ నెలలో అత్యధిక ఖర్చు చేసిన కేటగిరీ "${categoryTeMap[maxCat] || maxCat}" (₹${maxExp}).`
      });
    }
  }

  // 5. Top 5 Workers by Attendance (this month)
  if (curMonthAttendance.length > 0 && workers.length > 0) {
    const attMap: Record<string, number> = {};
    curMonthAttendance.forEach(a => {
      const weight = a.status === 'present' ? 1.0 : a.status === 'half_day' ? 0.5 : 0;
      attMap[a.workerId] = (attMap[a.workerId] || 0) + weight;
    });
    const sortedWorkers = Object.entries(attMap)
      .map(([wId, days]) => ({
        worker: workers.find(w => w.id === wId),
        days
      }))
      .filter(item => item.worker && item.days > 0)
      .sort((a, b) => b.days - a.days)
      .slice(0, 5);

    if (sortedWorkers.length > 0) {
      const namesEn = sortedWorkers.map(item => `${item.worker?.name} (${item.days}d)`).join(', ');
      const namesTe = sortedWorkers.map(item => `${item.worker?.name} (${item.days} రోజులు)`).join(', ');
      insights.push({
        textEn: `Top active workers this month: ${namesEn}.`,
        textTe: `ఈ నెలలో ఎక్కువ రోజులు పనిచేసిన కూలీలు: ${namesTe}.`
      });
    }
  }

  // 6. Monthly Trend (Total Spending)
  const curMonthLaborCost = curMonthAttendance.reduce((sum, a) => {
    const worker = workers.find(w => w.id === a.workerId);
    if (!worker) return sum;
    const wage = a.wageForDay !== undefined ? a.wageForDay : worker.dailyWage;
    const weight = a.status === 'present' ? 1.0 : a.status === 'half_day' ? 0.5 : 0;
    return sum + (weight * wage);
  }, 0);
  const curMonthExpensesTotal = curMonthExpenses.reduce((sum, e) => sum + e.amount, 0);
  const curMonthTotalSpending = curMonthLaborCost + curMonthExpensesTotal;

  const prevMonthStr = getPreviousMonthStr(currentMonthStr);
  const prevMonthAttendance = attendance.filter(a => a.date.startsWith(prevMonthStr));
  const prevMonthExpenses = expenses.filter(e => e.date.startsWith(prevMonthStr));

  const prevMonthLaborCost = prevMonthAttendance.reduce((sum, a) => {
    const worker = workers.find(w => w.id === a.workerId);
    if (!worker) return sum;
    const wage = a.wageForDay !== undefined ? a.wageForDay : worker.dailyWage;
    const weight = a.status === 'present' ? 1.0 : a.status === 'half_day' ? 0.5 : 0;
    return sum + (weight * wage);
  }, 0);
  const prevMonthExpensesTotal = prevMonthExpenses.reduce((sum, e) => sum + e.amount, 0);
  const prevMonthTotalSpending = prevMonthLaborCost + prevMonthExpensesTotal;

  if (prevMonthTotalSpending > 0) {
    const percentDiff = Math.round(((curMonthTotalSpending - prevMonthTotalSpending) / prevMonthTotalSpending) * 100);
    const trendWordEn = percentDiff >= 0 ? 'increased by' : 'decreased by';
    const trendWordTe = percentDiff >= 0 ? 'పెరిగింది' : 'తగ్గింది';
    insights.push({
      textEn: `Total spending this month (₹${curMonthTotalSpending}) has ${trendWordEn} ${Math.abs(percentDiff)}% compared to last month (₹${prevMonthTotalSpending}).`,
      textTe: `గత నెలతో (₹${prevMonthTotalSpending}) పోలిస్తే ఈ నెల మొత్తం ఖర్చు (₹${curMonthTotalSpending}) ${Math.abs(percentDiff)}% ${trendWordTe}.`
    });
  } else if (curMonthTotalSpending > 0) {
    insights.push({
      textEn: `Logged ₹${curMonthTotalSpending} in total spending this month. Keep updating to see monthly trends.`,
      textTe: `ఈ నెలలో మొత్తం ₹${curMonthTotalSpending} ఖర్చు నమోదైంది. నెలవారీ మార్పులను చూడటానికి ఖర్చులను నమోదు చేస్తూ ఉండండి.`
    });
  }

  // 7. Default fallbacks if there are less than 3 insights
  if (insights.length < 3) {
    insights.push({
      textEn: "Tip: Add daily attendance regularly to generate accurate weekly wage calculations automatically.",
      textTe: "చిట్కా: ప్రతిరోజూ హాజరును క్రమంగా నమోదు చేస్తే వారపు కూలి లెక్కలు ఆటోమేటిక్‌గా తయారవుతాయి."
    });
    insights.push({
      textEn: "Remember to log diesel and tractor expenses to track exact mechanization costs.",
      textTe: "ట్రాక్టర్ మరియు డీజిల్ ఖర్చులను నమోదు చేయడం ద్వారా యంత్రాల ఖర్చులను సులభంగా తెలుసుకోవచ్చు."
    });
  }

  return insights;
};

// Deprecated in favor of programmatic getInsightsList, kept for signature compatibility
export const generateAIObservations = async (
  workers: Worker[],
  expenses: Expense[],
  payments: Payment[]
): Promise<AIObservation[]> => {
  return getInsightsList(workers, expenses, payments, [], '2026-06');
};
