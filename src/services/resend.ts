import { Worker, AttendanceRecord, Payment, Expense } from '../firebase';

export interface WeeklyReportData {
  weekRange: string; // e.g., "15 June 2026 - 21 June 2026"
  workerSummaries: {
    name: string;
    daysWorked: number;
    dailyWage: number;
    totalEarned: number;
    amountPaid: number;
    pendingAmount: number;
  }[];
  totalLaborCost: number;
  totalExpenses: number;
  highestPaidWorker: string;
  biggestExpenseCategory: string;
  mostRegularWorker: string;
}

// Helper to get Resend config from settings
export const getResendConfig = () => {
  const saved = localStorage.getItem('paramesh_settings');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return {
        apiKey: parsed.resendKey || import.meta.env.VITE_RESEND_API_KEY || '',
        fatherEmail: parsed.fatherEmail || '',
        familyEmail: parsed.familyEmail || '',
        adminEmail: parsed.adminEmail || '',
        senderEmail: parsed.senderEmail || 'onboarding@resend.dev'
      };
    } catch (e) {}
  }
  return {
    apiKey: import.meta.env.VITE_RESEND_API_KEY || '',
    fatherEmail: '',
    familyEmail: '',
    adminEmail: '',
    senderEmail: 'onboarding@resend.dev'
  };
};

// ----------------------------------------------------
// 1. Calculate Weekly Report Data
// ----------------------------------------------------
export const calculateWeeklyReport = (
  workers: Worker[],
  attendance: AttendanceRecord[],
  payments: Payment[],
  expenses: Expense[],
  targetSundayDate: string // YYYY-MM-DD
): WeeklyReportData => {
  // Get date range (Monday to Sunday)
  const sunday = new Date(targetSundayDate);
  const monday = new Date(sunday);
  monday.setDate(sunday.getDate() - 6);

  const formatOptions: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  const weekRange = `${monday.toLocaleDateString('en-US', formatOptions)} - ${sunday.toLocaleDateString('en-US', formatOptions)}`;

  const mondayStr = monday.toISOString().split('T')[0];
  const sundayStr = sunday.toISOString().split('T')[0];

  // Filter lists for the week
  const weekAttendance = attendance.filter(a => a.date >= mondayStr && a.date <= sundayStr);
  const weekPayments = payments.filter(p => p.date >= mondayStr && p.date <= sundayStr);
  const weekExpenses = expenses.filter(e => e.date >= mondayStr && e.date <= sundayStr);

  // Compile worker details
  let totalLaborCost = 0;
  const workerSummaries = workers.map(w => {
    // Count days worked incorporating half_day weight
    const workerAtt = weekAttendance.filter(a => a.workerId === w.id);
    const daysWorked = workerAtt.reduce((sum, a) => {
      if (a.status === 'present') return sum + 1;
      if (a.status === 'half_day') return sum + 0.5;
      return sum;
    }, 0);
    const totalEarned = daysWorked * w.dailyWage;
    totalLaborCost += totalEarned;

    // Payments for this worker during the week
    const amountPaid = weekPayments
      .filter(p => p.workerId === w.id)
      .reduce((sum, p) => sum + p.amount, 0);

    const pendingAmount = totalEarned - amountPaid;

    return {
      name: w.name,
      daysWorked,
      dailyWage: w.dailyWage,
      totalEarned,
      amountPaid,
      pendingAmount
    };
  }).filter(ws => ws.daysWorked > 0 || ws.amountPaid > 0); // Include if they worked or got paid this week

  // Calculate total expenses
  const totalExpenses = weekExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Highest Paid Worker
  let highestPaidWorker = 'None';
  let maxPaid = 0;
  workerSummaries.forEach(ws => {
    if (ws.amountPaid > maxPaid) {
      maxPaid = ws.amountPaid;
      highestPaidWorker = `${ws.name} (₹${ws.amountPaid})`;
    }
  });

  // Most Regular Worker
  let mostRegularWorker = 'None';
  let maxDays = 0;
  workerSummaries.forEach(ws => {
    if (ws.daysWorked > maxDays) {
      maxDays = ws.daysWorked;
      mostRegularWorker = `${ws.name} (${ws.daysWorked} days)`;
    }
  });

  // Biggest Expense Category
  let biggestExpenseCategory = 'None';
  const categoryMap: Record<string, number> = {};
  weekExpenses.forEach(e => {
    categoryMap[e.category] = (categoryMap[e.category] || 0) + e.amount;
  });
  let maxExp = 0;
  Object.entries(categoryMap).forEach(([cat, amt]) => {
    if (amt > maxExp) {
      maxExp = amt;
      biggestExpenseCategory = `${cat} (₹${amt})`;
    }
  });

  return {
    weekRange,
    workerSummaries,
    totalLaborCost,
    totalExpenses,
    highestPaidWorker,
    biggestExpenseCategory,
    mostRegularWorker
  };
};

// ----------------------------------------------------
// 2. Email HTML Generator
// ----------------------------------------------------
const generateEmailHtml = (data: WeeklyReportData): string => {
  const workerRows = data.workerSummaries.map(ws => `
    <tr>
      <td style="padding: 12px 15px; border-bottom: 1px solid #E5E2D3; font-weight: bold; color: #263238;">${ws.name}</td>
      <td style="padding: 12px 15px; border-bottom: 1px solid #E5E2D3; text-align: center; color: #263238;">${ws.daysWorked}</td>
      <td style="padding: 12px 15px; border-bottom: 1px solid #E5E2D3; text-align: right; color: #263238;">₹${ws.dailyWage}</td>
      <td style="padding: 12px 15px; border-bottom: 1px solid #E5E2D3; text-align: right; font-weight: bold; color: #263238;">₹${ws.totalEarned}</td>
      <td style="padding: 12px 15px; border-bottom: 1px solid #E5E2D3; text-align: right; color: #4CAF50; font-weight: bold;">₹${ws.amountPaid}</td>
      <td style="padding: 12px 15px; border-bottom: 1px solid #E5E2D3; text-align: right; color: ${ws.pendingAmount > 0 ? '#E53935' : '#2E7D32'}; font-weight: bold;">₹${ws.pendingAmount}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Weekly Farm Report</title>
        <style>
          body {
            font-family: 'Segoe UI', Helvetica, Arial, sans-serif;
            background-color: #F8F5E9;
            color: #263238;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #FFFFFF;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(46, 125, 50, 0.08);
            border: 1px solid #E0DBC5;
          }
          .header {
            background-color: #2E7D32;
            padding: 30px;
            text-align: center;
            color: #FFFFFF;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            letter-spacing: 0.5px;
          }
          .header p {
            margin: 5px 0 0;
            opacity: 0.9;
            font-size: 14px;
          }
          .content {
            padding: 30px 20px;
          }
          .stats-row {
            display: flex;
            margin-bottom: 25px;
            gap: 15px;
          }
          .stat-card {
            flex: 1;
            background-color: #F8F5E9;
            border-radius: 12px;
            padding: 15px;
            text-align: center;
            border: 1px solid #E0DBC5;
          }
          .stat-card .label {
            font-size: 12px;
            color: #6b6375;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 5px;
          }
          .stat-card .value {
            font-size: 20px;
            font-weight: bold;
            color: #2E7D32;
          }
          .section-title {
            font-size: 16px;
            font-weight: bold;
            color: #2E7D32;
            border-left: 4px solid #F9A825;
            padding-left: 8px;
            margin: 25px 0 15px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 25px;
          }
          th {
            background-color: #2E7D32;
            color: #FFFFFF;
            text-align: left;
            padding: 10px 15px;
            font-size: 12px;
            text-transform: uppercase;
          }
          .insights-card {
            background-color: #FFFDF5;
            border: 1.5px dashed #F9A825;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 25px;
          }
          .insight-item {
            margin-bottom: 10px;
            font-size: 14px;
            line-height: 1.4;
          }
          .insight-item:last-child {
            margin-bottom: 0;
          }
          .footer {
            background-color: #F8F5E9;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #6b6375;
            border-top: 1px solid #E0DBC5;
          }
        </style>
      </head>
      <body>
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F8F5E9; padding: 20px 0;">
          <tr>
            <td>
              <div class="container">
                <div class="header">
                  <h1>🌾 Paramesh AgriBook</h1>
                  <p>Weekly Farm Report (${data.weekRange})</p>
                </div>
                <div class="content">
                  
                  <div class="stats-row" style="margin-top: 0;">
                    <div class="stat-card">
                      <div class="label">Total Labor Cost</div>
                      <div class="value">₹${data.totalLaborCost}</div>
                    </div>
                    <div class="stat-card">
                      <div class="label">Total Expenses</div>
                      <div class="value">₹${data.totalExpenses}</div>
                    </div>
                  </div>

                  <div class="section-title">Worker Attendance & Wages</div>
                  <table cellpadding="0" cellspacing="0">
                    <thead>
                      <tr>
                        <th style="border-top-left-radius: 8px;">Worker</th>
                        <th style="text-align: center;">Days</th>
                        <th style="text-align: right;">Wage</th>
                        <th style="text-align: right;">Total</th>
                        <th style="text-align: right;">Paid</th>
                        <th style="text-align: right; border-top-right-radius: 8px;">Pending</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${workerRows.length > 0 ? workerRows : `<tr><td colspan="6" style="padding: 20px; text-align: center; color: #6b6375;">No work recorded this week.</td></tr>`}
                    </tbody>
                  </table>

                  <div class="section-title">Weekly Smart Highlights</div>
                  <div class="insights-card">
                    <div class="insight-item">
                      🌟 <strong>Most Regular:</strong> ${data.mostRegularWorker}
                    </div>
                    <div class="insight-item">
                      💰 <strong>Highest Paid:</strong> ${data.highestPaidWorker}
                    </div>
                    <div class="insight-item">
                      🚜 <strong>Biggest Expense:</strong> ${data.biggestExpenseCategory}
                    </div>
                  </div>

                </div>
                <div class="footer">
                  This report was compiled and sent from the Paramesh AgriBook Ledger.<br>
                  © 2026 Paramesh AgriBook. All rights reserved.
                </div>
              </div>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
};

// ----------------------------------------------------
// 3. Send Weekly Email Notification
// ----------------------------------------------------
export const sendWeeklyReport = async (
  reportData: WeeklyReportData
): Promise<{ success: boolean; message: string }> => {
  const config = getResendConfig();
  const html = generateEmailHtml(reportData);

  const recipients = [config.fatherEmail, config.familyEmail, config.adminEmail]
    .map(e => e.trim())
    .filter(e => e && e !== '' && e.includes('@'));

  if (recipients.length === 0) {
    return { success: false, message: 'No valid recipient email addresses configured.' };
  }

  // Create local logging of weekly email sent (so they can verify locally)
  const loggedEmails = JSON.parse(localStorage.getItem('paramesh_weekly_emails') || '[]');
  const newLog = {
    date: new Date().toISOString(),
    weekRange: reportData.weekRange,
    recipients,
    html,
    success: false,
    simulated: true
  };

  if (!config.apiKey) {
    console.log("No Resend API Key. Simulation mode enabled. Compiled HTML:\n", html);
    newLog.success = true;
    loggedEmails.push(newLog);
    localStorage.setItem('paramesh_weekly_emails', JSON.stringify(loggedEmails));
    return { 
      success: true, 
      message: 'Weekly report simulated. You can review the email draft in Profile -> Reports Sent.' 
    };
  }

  try {
    // Send request via Vite dev proxy
    const response = await fetch('/api/resend/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        from: `Paramesh AgriBook <${config.senderEmail}>`,
        to: recipients,
        subject: `🌾 Paramesh AgriBook: Weekly Farm Report - ${reportData.weekRange}`,
        html: html
      })
    });

    if (response.ok) {
      newLog.success = true;
      newLog.simulated = false;
      loggedEmails.push(newLog);
      localStorage.setItem('paramesh_weekly_emails', JSON.stringify(loggedEmails));
      return { success: true, message: 'Weekly report email sent successfully!' };
    } else {
      const errText = await response.text();
      throw new Error(errText || 'Resend API returned error status ' + response.status);
    }
  } catch (error: any) {
    console.error("Failed to send weekly report email:", error);
    
    let userFriendlyMessage = error.message;
    try {
      // Try parsing JSON error from Resend
      const parsedError = JSON.parse(error.message);
      if (parsedError.name === 'validation_error' && parsedError.message) {
        if (parsedError.message.includes('only send testing emails to your own email address')) {
          const match = parsedError.message.match(/\(([^)]+)\)/);
          const ownEmail = match ? match[1] : 'rishikanl143@gmail.com';
          userFriendlyMessage = `⚠️ Resend Sandbox Limit: You can only send emails to your registered Resend email address (${ownEmail}). Please update your weekly report recipients in the Profile page to this email.`;
        } else {
          userFriendlyMessage = parsedError.message;
        }
      }
    } catch (e) {
      // If not JSON, check substring
      if (error.message && error.message.includes('only send testing emails to your own email address')) {
        const match = error.message.match(/\(([^)]+)\)/);
        const ownEmail = match ? match[1] : 'rishikanl143@gmail.com';
        userFriendlyMessage = `⚠️ Resend Sandbox Limit: You can only send emails to your registered Resend email address (${ownEmail}). Please update your weekly report recipients in the Profile page to this email.`;
      }
    }

    loggedEmails.push(newLog);
    localStorage.setItem('paramesh_weekly_emails', JSON.stringify(loggedEmails));
    return { 
      success: false, 
      message: userFriendlyMessage 
    };
  }
};
