export type Language = 'en' | 'te';

export const translations = {
  en: {
    // Navigation
    home: 'Home',
    workers: 'Workers',
    attendance: 'Attendance',
    payments: 'Payments',
    expenses: 'Expenses',
    reports: 'Reports',
    profile: 'Profile',

    // Dashboard
    title: 'Paramesh AgriBook',
    tagline: 'Smart Farm Ledger for Workers & Expenses',
    todaysWorkers: "Today's Workers",
    presentWorkers: 'Present Workers',
    totalLaborCost: '💰 Money Spent on Workers',
    totalExpenses: '💸 Money Spent on Expenses',
    moneyPaid: '✅ Amount Already Paid',
    pendingAmount: '⚠️ Still Need to Pay',
    weeklyReportStatus: 'Weekly Report Status',
    aiInsights: 'AI Insights',
    sent: 'Sent',
    notSent: 'Not Sent',
    checking: 'Checking...',

    // Workers Module
    addWorker: 'Add Worker',
    editWorker: 'Edit Worker',
    deleteWorker: 'Delete Worker',
    searchWorker: 'Search Worker...',
    workerDetails: 'Worker Details',
    name: 'Worker Name',
    phone: 'Phone Number',
    village: 'Village Name',
    dailyWage: 'Daily Wage (₹)',
    status: 'Status',
    notes: 'Notes / Description',
    active: 'Active',
    inactive: 'Inactive',
    save: 'Save',
    cancel: 'Cancel',
    emptyWorkers: 'No workers added yet',
    addWorkerPrompt: 'Press + Add Worker to get started',
    confirmDelete: 'Are you sure you want to delete this worker?',

    // Attendance Module
    attendancePage: 'Attendance Register',
    present: 'Present',
    absent: 'Absent',
    saveAttendance: 'Save Attendance',
    attendanceSaved: 'Attendance saved successfully!',
    totalWorkers: 'Total Workers',
    markedPresent: 'Marked Present',
    dateSelector: 'Change Date',

    // Payments Module
    paymentsPage: 'Payments Ledger',
    totalEarned: 'Total Earned',
    paidAmount: 'Paid',
    pendingWages: 'Pending Wages',
    payButton: 'Pay Worker',
    paymentHistory: 'Payment History',
    recordPayment: 'Record Payment',
    enterAmount: 'Amount (₹)',
    paymentDate: 'Payment Date',
    paymentNote: 'Note (Optional)',
    paymentSuccess: 'Payment recorded successfully!',
    noHistory: 'No payments recorded yet.',

    // Expenses Module
    expensesPage: 'Expenses Ledger',
    addExpense: 'Add Expense',
    category: 'Category',
    amount: 'Amount (₹)',
    description: 'Description',
    expenseDate: 'Date',
    expenseSuccess: 'Expense recorded successfully!',
    emptyExpenses: 'No expenses recorded yet.',
    
    // Expense Categories
    Labor: 'Labor / Wages',
    Seeds: 'Seeds',
    Fertilizer: 'Fertilizer',
    Diesel: 'Diesel / Fuel',
    Tractor: 'Tractor Rent',
    Transport: 'Transport / Auto',
    Equipment: 'Equipment / Tools',
    Others: 'Others',

    // AI & NLP Entry
    nlpPlaceholder: 'Type: "Paid Ramesh 2000" or "Diesel expense 1500"...',
    nlpSubmit: 'Record with AI',
    nlpExtracting: 'Analyzing entry...',
    nlpSuccess: 'Entry parsed! Please verify below:',
    nlpSaveConfirm: 'Confirm & Save Entry',
    aiObservationHeader: 'Smart Observations',
    aiLoading: 'Generating insights with Gemini...',
    aiError: 'Could not generate insights. Please check Gemini API Key.',

    // Reports Module
    reportsPage: 'Ledger Reports',
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
    workerWise: 'Worker-wise',
    expenseWise: 'Expense-wise',
    exportPdf: 'Download PDF',
    exportExcel: 'Download Excel',
    statistics: 'Farm Statistics',
    laborPercentage: 'Labor Percentage',
    biggestExpense: 'Biggest Expense',
    mostRegularWorker: 'Most Regular',
    highestPaidWorker: 'Highest Paid',

    // Profile Screen
    settings: 'App Settings',
    logout: 'Logout',
    firebaseConfigTitle: 'Firebase Configuration (Optional)',
    geminiKeyTitle: 'Gemini API Key',
    resendKeyTitle: 'Resend API Key',
    recipientsTitle: 'Weekly Email Recipients',
    fatherEmail: 'Father Email',
    familyEmail: 'Family Member Email',
    adminEmail: 'Admin Email',
    mockModeTitle: 'Developer Options',
    resetMockButton: 'Reset to Demo Data',
    resetSuccess: 'Mock database reset complete!',
    clearDataButton: 'Clear All Data (Start Fresh)',
    clearDataSuccess: 'All data cleared successfully!',
    clearDataConfirm: 'WARNING: This will permanently delete all workers, attendance, expenses, and payments. You cannot undo this. Continue?',
    languageSelect: 'Select Language',
    bilingualMode: 'Bilingual Labels (English + Telugu)',
    loginTitle: 'Farmer Login',
    googleLogin: 'Login with Google',
    emailLogin: 'Login with Email',
    emailInput: 'Email Address',
    passwordInput: 'Password',
    loginError: 'Authentication failed. Please try again.',
    
    // Crop Cycle & Variable Wages (English)
    currentCrop: 'Current Crop',
    allCrops: 'All Crops',
    legacyRecords: 'Legacy Records',
    addCropCycle: 'New Crop Cycle',
    cropName: 'Crop Name',
    variety: 'Variety',
    season: 'Season',
    landName: 'Land Name / Field',
    area: 'Area (Acres/Guntas)',
    startDate: 'Start Date',
    expectedHarvestDate: 'Expected Harvest Date',
    cropHistory: 'Crop History',
    copyWorkers: 'Copy Existing Workers',
    startEmptyAttendance: 'Start Empty Attendance',
    startEmptyPayments: 'Start Empty Payments',
    startEmptyExpenses: 'Start Empty Expenses',
    validationNegative: 'Negative values are not allowed.',
    validationPayExceedsPending: 'Payment amount exceeds pending wages.',
    validationCropDates: 'Start date cannot be after Expected Harvest date.',
    validationDuplicateCrop: 'A crop with this name already exists in this active season.',
    workType: 'Work Type',
    wageForDay: 'Wage for Day (₹)',
    cropSelectAlert: 'Please select a specific crop cycle from the header to register attendance.',
  },
  te: {
    // Navigation
    home: 'హోమ్',
    workers: 'పనివారు',
    attendance: 'హాజరు',
    payments: 'చెల్లింపులు',
    expenses: 'ఖర్చులు',
    reports: 'రిపోర్టులు',
    profile: 'ప్రొఫైల్',

    // Dashboard
    title: 'పరమేష్ అగ్రిబుక్',
    tagline: 'పనివారు, కూలీలు మరియు ఖర్చుల స్మార్ట్ డైరీ',
    todaysWorkers: 'ఈరోజు పనివారు',
    presentWorkers: 'హాజరైన పనివారు',
    totalLaborCost: '💰 పనివారికైన ఖర్చు',
    totalExpenses: '💸 ఇతర ఖర్చులు',
    moneyPaid: '✅ ఇప్పటికే చెల్లించినది',
    pendingAmount: '⚠️ ఇంకా చెల్లించవలసిన బాకీ',
    weeklyReportStatus: 'వారపు రిపోర్ట్ స్థితి',
    aiInsights: 'AI విశ్లేషణలు',
    sent: 'పంపబడింది',
    notSent: 'పంపలేదు',
    checking: 'చెక్ చేస్తున్నాము...',

    // Workers Module
    addWorker: 'పనివారిని చేర్చు',
    editWorker: 'సవరించు',
    deleteWorker: 'తొలగించు',
    searchWorker: 'పనివారి కోసం వెతకండి...',
    workerDetails: 'పనివారి వివరాలు',
    name: 'పనివారి పేరు',
    phone: 'ఫోన్ నెంబర్',
    village: 'ఊరు / గ్రామం',
    dailyWage: 'రోజువారీ కూలి (₹)',
    status: 'స్థితి',
    notes: 'గమనికలు / ఇతర వివరాలు',
    active: 'పనిలో ఉన్నారు',
    inactive: 'పనిలో లేరు',
    save: 'సేవ్ చేయి',
    cancel: 'రద్దు చేయి',
    emptyWorkers: 'పనివారెవరూ ఇంకా చేరలేదు',
    addWorkerPrompt: 'పనివారిని చేర్చడానికి + బటన్ నొక్కండి',
    confirmDelete: 'ఈ పనివారిని నిజంగానే తొలగించాలనుకుంటున్నారా?',

    // Attendance Module
    attendancePage: 'హాజరు పట్టిక',
    present: 'హాజరు',
    absent: 'ఆబ్సెంట్',
    saveAttendance: 'హాజరు సేవ్ చేయి',
    attendanceSaved: 'హాజరు విజయవంతంగా సేవ్ చేయబడింది!',
    totalWorkers: 'మొత్తం పనివారు',
    markedPresent: 'హాజరైన వారు',
    dateSelector: 'తేదీ మార్చండి',

    // Payments Module
    paymentsPage: 'చెల్లింపుల ఖతా',
    totalEarned: 'మొత్తం సంపాదన',
    paidAmount: 'చెల్లించినది',
    pendingWages: 'బాకీ ఉన్న కూలి',
    payButton: 'డబ్బులు చెల్లించు',
    paymentHistory: 'చెల్లింపుల చరిత్ర',
    recordPayment: 'చెల్లింపు నమోదు చేయి',
    enterAmount: 'డబ్బులు (₹)',
    paymentDate: 'చెల్లించిన తేదీ',
    paymentNote: 'గమనిక (ఐచ్ఛికం)',
    paymentSuccess: 'చెల్లింపు నమోదు విజయవంతమైంది!',
    noHistory: 'ఇంతవరకు ఎలాంటి చెల్లింపులు చేయలేదు.',

    // Expenses Module
    expensesPage: 'ఖర్చుల ఖతా',
    addExpense: 'ఖర్చును నమోదు చేయి',
    category: 'ఖర్చు రకం',
    amount: 'ఖర్చు అమౌంట్ (₹)',
    description: 'వివరణ',
    expenseDate: 'తేదీ',
    expenseSuccess: 'ఖర్చు విజయవంతంగా నమోదైంది!',
    emptyExpenses: 'ఇంతవరకు ఎలాంటి ఖర్చులు నమోదు చేయలేదు.',
    
    // Expense Categories
    Labor: 'కూలి ఖర్చులు',
    Seeds: 'విత్తనాలు',
    Fertilizer: 'ఎరువులు / మందులు',
    Diesel: 'డీజిల్ / ఆయిల్',
    Tractor: 'ట్రాక్టర్ అద్దె',
    Transport: 'రవాణా / ఆటో చార్జీలు',
    Equipment: 'పనిముట్లు / టూల్స్',
    Others: 'ఇతర ఖర్చులు',

    // AI & NLP Entry
    nlpPlaceholder: 'ఉదా: "Paid Ramesh 2000" లేదా "Diesel expense 1500"...',
    nlpSubmit: 'AI ద్వారా నమోదు చేయి',
    nlpExtracting: 'వివరాలు సేకరిస్తున్నాము...',
    nlpSuccess: 'వివరాలు సేకరించాము! సరిచూసుకోండి:',
    nlpSaveConfirm: 'నిజమే, సేవ్ చేయి',
    aiObservationHeader: 'స్మార్ట్ గమనికలు',
    aiLoading: 'జెమినీ (Gemini) ద్వారా విశ్లేషణలు సృష్టిస్తున్నాము...',
    aiError: 'విశ్లేషణలు సృష్టించలేకపోయాము. జెమినీ API కీని చెక్ చేయండి.',

    // Reports Module
    reportsPage: 'లెడ్జర్ రిపోర్టులు',
    daily: 'రోజువారీ',
    weekly: 'వారపు',
    monthly: 'నెలవారీ',
    workerWise: 'పనివారి వారీగా',
    expenseWise: 'ఖర్చుల వారీగా',
    exportPdf: 'PDF డౌన్లోడ్ చేయి',
    exportExcel: 'Excel డౌన్లోడ్ చేయి',
    statistics: 'వ్యవసాయ గణాంకాలు',
    laborPercentage: 'కూలీల ఖర్చు శాతం',
    biggestExpense: 'పెద్ద ఖర్చు కేటగిరీ',
    mostRegularWorker: 'క్రమం తప్పని పనివారు',
    highestPaidWorker: 'ఎక్కువ కూలి తీసుకున్నవారు',

    // Profile Screen
    settings: 'యాప్ సెట్టింగ్స్',
    logout: 'లాగౌట్',
    firebaseConfigTitle: 'ఫైర్‌బేస్ కాన్ఫిగరేషన్ (Firebase Config)',
    geminiKeyTitle: 'జెమినీ (Gemini) API కీ',
    resendKeyTitle: 'రీసెండ్ (Resend) API కీ',
    recipientsTitle: 'ఈమెయిల్ రిపోర్ట్ గ్రహీతలు',
    fatherEmail: 'తండ్రి ఈమెయిల్',
    familyEmail: 'కుటుంబ సభ్యుడి ఈమెయిల్',
    adminEmail: 'అడ్మిన్ ఈమెయిల్',
    mockModeTitle: 'డెవలపర్ ఆప్షన్స్',
    resetMockButton: 'డెమో డేటాను రీసెట్ చేయి',
    resetSuccess: 'డెమో డేటా రీసెట్ పూర్తయింది!',
    clearDataButton: 'డేటాన్ని క్లియర్ చేయి (కొత్తగా మొదలుపెట్టు)',
    clearDataSuccess: 'మొత్తం డేటా క్లియర్ చేయబడింది!',
    clearDataConfirm: 'హెచ్చరిక: ఇది మీ పనివారు, హాజరు, ఖర్చులు మరియు చెల్లింపుల డేటాను శాశ్వతంగా తొలగిస్తుంది. ఈ చర్యను వెనక్కి తీసుకోలేరు. కొనసాగించాలా?',
    languageSelect: 'భాషను ఎంచుకోండి',
    bilingualMode: 'ద్విభాషా లేబుల్‌లు (ఇంగ్లీష్ + తెలుగు)',
    loginTitle: 'వ్యవసాయదారుల లాగిన్',
    googleLogin: 'గూగుల్ ద్వారా లాగిన్',
    emailLogin: 'ఈమెయిల్ ద్వారా లాగిన్',
    emailInput: 'ఈమెయిల్ అడ్రస్',
    passwordInput: 'పాస్‌వర్డ్',
    loginError: 'లాగిన్ విఫలమైంది. మళ్ళీ ప్రయత్నించండి.',
    
    // New Profile Labels
    cloudBackupStatus: 'Cloud Backup Status',
    cloudBackupConnected: 'Connected to Cloud Sync',
    cloudBackupOffline: 'Offline Demo Ledger (No sync)',
    appVersionLabel: 'App Version',
    aboutLabel: 'About AgriBook',
    aboutText: 'Paramesh AgriBook is a smart farm account book. It makes tracking workers, daily attendance, payments, and farm expenses easy, with automated insights and weekly reporting.',
    aboutTextTe: 'పరమేష్ అగ్రిబుక్ అనేది వ్యవసాయదారుల కోసం తయారుచేసిన ఒక స్మార్ట్ డైరీ. దీని ద్వారా పనివారి హాజరు, కూలీలు మరియు ఖర్చుల లెక్కలను సులభంగా రికార్డ్ చేసుకోవచ్చు.',
    
    // Crop Cycle & Variable Wages (Telugu)
    currentCrop: 'ప్రస్తుత పంట',
    allCrops: 'అన్ని పంటలు',
    legacyRecords: 'పాత రికార్డులు',
    addCropCycle: 'కొత్త పంట కాలం',
    cropName: 'పంట పేరు',
    variety: 'రకం',
    season: 'సీజన్',
    landName: 'పొలం పేరు',
    area: 'వైశాల్యం (ఎకరాలు)',
    startDate: 'ప్రారంభ తేదీ',
    expectedHarvestDate: 'కోత అంచనా తేదీ',
    cropHistory: 'పంటల చరిత్ర',
    copyWorkers: 'పాత పనివారిని కాపీ చేయి',
    startEmptyAttendance: 'ఖాళీ హాజరు పట్టికతో మొదలుపెట్టు',
    startEmptyPayments: 'ఖాళీ చెల్లింపులతో మొదలుపెట్టు',
    startEmptyExpenses: 'ఖాళీ ఖర్చులతో మొదలుపెట్టు',
    validationNegative: 'రుణాత్మక విలువలు అనుమతించబడవు.',
    validationPayExceedsPending: 'ఆ రోజు కూలి కంటే చెల్లింపు ఎక్కువ ఉండకూడదు.',
    validationCropDates: 'ప్రారంభ తేదీ కోత అంచనా తేదీ కంటే తర్వాత ఉండకూడదు.',
    validationDuplicateCrop: 'ఈ సీజన్ లో ఈ పంట పేరుతో ఇప్పటికే ఒక పంట నమోదై ఉంది.',
    workType: 'పని రకం',
    wageForDay: 'ఆ రోజు కూలి (₹)',
    cropSelectAlert: 'హాజరు నమోదు చేయడానికి దయచేసి హెడర్ నుండి ఒక నిర్దిష్ట పంటను ఎంచుకోండి.',
  }
};

/**
 * t helper returns translated value or bilingual value if enabled
 */
export const t = (
  key: keyof typeof translations['en'] | string,
  lang: Language = 'en',
  bilingual = false
): string => {
  const enVal = (translations.en as any)[key] || key;
  const teVal = (translations.te as any)[key] || key;

  if (lang === 'te') {
    return bilingual ? `${enVal} / ${teVal}` : teVal;
  }
  return bilingual ? `${enVal} (${teVal})` : enVal;
};

/**
 * subT helper returns translation of the opposite language (for bilingual sub-labels)
 */
export const subT = (
  key: keyof typeof translations['en'] | string,
  lang: Language = 'en'
): string => {
  const oppositeLang: Language = lang === 'en' ? 'te' : 'en';
  return (translations[oppositeLang] as any)[key] || key;
};
