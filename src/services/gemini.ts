import { GoogleGenerativeAI } from '@google/generative-ai';
import { Worker, Expense, Payment } from '../firebase';

// Helper to get Gemini API key
export const getGeminiApiKey = (): string => {
  const saved = localStorage.getItem('pramesh_settings');
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
  
  // Date default to today (2026-06-23)
  const todayStr = '2026-06-23';

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
    const systemPrompt = `You are a smart parser for a farm ledger app. 
Parse the user's text and extract transaction details.
Today is Tuesday, June 23, 2026.

Available Workers in system: [${workersInfo}]
Allowed Expense Categories: [Labor, Seeds, Fertilizer, Diesel, Tractor, Transport, Equipment, Others]

Return JSON in this EXACT schema:
{
  "type": "payment" | "expense" | "unknown",
  "workerId": "id_of_worker" | null,
  "workerName": "matched_worker_name" | null,
  "category": "one_of_allowed_categories" | null,
  "amount": number,
  "date": "YYYY-MM-DD" (use today's date 2026-06-23 if date is not specified),
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
// 2. Smart AI Observations Generator
// ----------------------------------------------------
export interface AIObservation {
  textEn: string;
  textTe: string;
}

// Local analytics parser to generate smart insights locally if no API key is provided
const generateMockObservations = (
  workers: Worker[],
  expenses: Expense[],
  payments: Payment[]
): AIObservation[] => {
  const insights: AIObservation[] = [];

  // Calculate stats
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);

  // 1. Highest paid worker
  if (payments.length > 0 && workers.length > 0) {
    const payMap: Record<string, number> = {};
    payments.forEach(p => {
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

  // 2. Highest expense category
  if (expenses.length > 0) {
    const expMap: Record<string, number> = {};
    expenses.forEach(e => {
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
    
    // Translate category to Telugu
    const categoryTeMap: Record<string, string> = {
      Labor: 'కూలీల ఖర్చులు', Seeds: 'విత్తనాలు', Fertilizer: 'ఎరువులు', 
      Diesel: 'డీజిల్ / ఆయిల్', Tractor: 'ట్రాక్టర్ అద్దె', Transport: 'రవాణా', 
      Equipment: 'పనిముట్లు', Others: 'ఇతర ఖర్చులు'
    };
    
    insights.push({
      textEn: `${maxCat} is the highest expense category at ₹${maxExp}.`,
      textTe: `అత్యధిక ఖర్చు చేసిన కేటగిరీ ₹${maxExp} తో "${categoryTeMap[maxCat] || maxCat}" గా ఉంది.`
    });

    // 3. Labor percentage
    const laborExp = expMap['Labor'] || 0;
    const combinedSpending = totalExpenses + totalPayments; // Labor wages in payments + general expenses
    if (combinedSpending > 0) {
      const wageSum = totalPayments + laborExp;
      const wagePct = Math.round((wageSum / combinedSpending) * 100);
      if (wagePct > 0) {
        insights.push({
          textEn: `Labor and wages account for ${wagePct}% of total farm spending.`,
          textTe: `మొత్తం వ్యవసాయ ఖర్చులలో కూలీలు మరియు వేతనాలు ${wagePct}% గా ఉన్నాయి.`
        });
      }
    }
  }

  // 4. Default insights if not enough data
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

export const generateAIObservations = async (
  workers: Worker[],
  expenses: Expense[],
  payments: Payment[]
): Promise<AIObservation[]> => {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    console.log("No Gemini API key. Generating smart observations locally.");
    return generateMockObservations(workers, expenses, payments);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: { responseMimeType: 'application/json' }
    });

    const dataSummary = {
      workersCount: workers.length,
      workersList: workers.map(w => ({ name: w.name, wage: w.dailyWage, status: w.status })),
      expensesSummary: expenses.map(e => ({ category: e.category, amount: e.amount, date: e.date, desc: e.description })),
      paymentsSummary: payments.map(p => {
        const worker = workers.find(w => w.id === p.workerId);
        return { workerName: worker?.name || 'Unknown', amount: p.amount, date: p.date };
      })
    };

    const systemPrompt = `You are a smart farming assistant analyzing a farm ledger's monthly logs.
Generate exactly 4 simple, direct, and practical observations based on the current farm records. 
Create observations that are helpful for a farmer. Keep them concise.

Current Farm Records JSON:
${JSON.stringify(dataSummary, null, 2)}

For each observation, provide:
1. The text in plain, simple English (textEn).
2. The text translated into simple, natural, conversational Telugu script (textTe). Avoid heavy literal translation; write it how a Telugu farmer speaks.

Return JSON in this EXACT schema:
[
  {
    "textEn": "Ramesh received the highest payment of ₹5000 this month.",
    "textTe": "ఈ నెలలో రమేష్ అత్యధికంగా ₹5000 చెల్లింపును అందుకున్నారు."
  },
  ...
]`;

    const result = await model.generateContent(systemPrompt);
    const responseText = result.response.text();
    return JSON.parse(responseText) as AIObservation[];
  } catch (error) {
    console.error("Gemini AI Observations error, falling back to mock:", error);
    return generateMockObservations(workers, expenses, payments);
  }
};
