import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Home, 
  Users, 
  CheckSquare, 
  DollarSign, 
  Fuel, 
  BarChart3, 
  User, 
  Sprout, 
  Lock, 
  Mail, 
  Globe,
  ChevronDown,
  Plus,
  Check,
  Search,
  X
} from 'lucide-react';
import { 
  signInWithGoogle,
  signInWithEmail,
  subscribeToAuthChanges,
  AppUser, 
  Worker,
  WorkerCrop,
  fetchWorkers,
  fetchPayments,
  fetchAttendance,
  AttendanceRecord,
  CropCycle,
  fetchCropCycles,
  createCropCycle,
  editCropCycle,
  removeCropCycle,
  canDeleteCropCycle,
  assignWorkerToCrop,
  unassignWorkerFromCrop,
  fetchWorkerCrops,
  filterByCrop,
  migrateLegacyRecords,
  saveAttendanceList,
  createPayment,
  createExpense,
  fetchExpenses
} from './firebase';
import { t, subT, Language } from './utils/translation';

// Import Views
import { DashboardView } from './views/DashboardView';
import { WorkersView } from './views/WorkersView';
import { AttendanceView } from './views/AttendanceView';
import { PaymentsView } from './views/PaymentsView';
import { ExpensesView } from './views/ExpensesView';
import { ReportsView } from './views/ReportsView';
import { ProfileView } from './views/ProfileView';

export default function App() {
  // Global States
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [currentView, setCurrentView] = useState<string>('home');
  const [lang, setLang] = useState<Language>('en');
  const [bilingual, setBilingual] = useState<boolean>(true);
  
  // Badge notification count state
  const [pendingWagesCount, setPendingWagesCount] = useState(0);
  
  // Crop Cycle States
  const [selectedCropCycleId, setSelectedCropCycleId] = useState<string>(
    () => {
      const saved = localStorage.getItem('paramesh_selected_crop_cycle_id');
      if (!saved || saved === 'all') {
        return 'legacy_crop_2025_2026';
      }
      return saved;
    }
  );
  const [cropCycles, setCropCycles] = useState<CropCycle[]>([]);
  const [showNewCropModal, setShowNewCropModal] = useState(false);
  const [showManageCropsModal, setShowManageCropsModal] = useState(false);
  const [editingCropCycle, setEditingCropCycle] = useState<CropCycle | null>(null);
  const [showWorkerAssignmentsCrop, setShowWorkerAssignmentsCrop] = useState<CropCycle | null>(null);
  const [allWorkers, setAllWorkers] = useState<any[]>([]);
  const [workerCrops, setWorkerCrops] = useState<any[]>([]);
  const [isCropDropdownOpen, setIsCropDropdownOpen] = useState(false);

  // New Crop Form States
  const [newCropName, setNewCropName] = useState('');
  const [newCropSeason, setNewCropSeason] = useState('');
  const [newCropVariety, setNewCropVariety] = useState('');
  const [newCropLandName, setNewCropLandName] = useState('');
  const [newCropArea, setNewCropArea] = useState('');
  const [newCropIrrigationType, setNewCropIrrigationType] = useState<'Drip' | 'Sprinkler' | 'Flow' | 'Rainfed' | 'Other'>('Other');
  const [newCropStartDate, setNewCropStartDate] = useState('');
  const [newCropExpectedHarvestDate, setNewCropExpectedHarvestDate] = useState('');
  const [newCropActualHarvestDate, setNewCropActualHarvestDate] = useState('');
  const [newCropNotes, setNewCropNotes] = useState('');
  const [newCropStatus, setNewCropStatus] = useState<'active' | 'completed' | 'archived'>('active');
  const [newCropHarvestRevenue, setNewCropHarvestRevenue] = useState('');
  const [newCropHarvestYield, setNewCropHarvestYield] = useState('');
  
  const [copyWorkersFlag, setCopyWorkersFlag] = useState(true);
  const [copyAttendanceFlag, setCopyAttendanceFlag] = useState(false);
  const [copyPaymentsFlag, setCopyPaymentsFlag] = useState(false);
  const [copyExpensesFlag, setCopyExpensesFlag] = useState(false);
  const [savingCrop, setSavingCrop] = useState(false);
  
  // Toast notifications state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Auth Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [pageSwapping, setPageSwapping] = useState(false);

  // Load preferences from local storage on mount
  useEffect(() => {
    // 1. Language
    const savedLang = localStorage.getItem('paramesh_lang') as Language;
    if (savedLang) setLang(savedLang);

    // 2. Bilingual
    const savedBilingual = localStorage.getItem('paramesh_bilingual');
    if (savedBilingual !== null) setBilingual(savedBilingual === 'true');

    // 3. User Session
    const unsubscribe = subscribeToAuthChanges((user) => {
      setCurrentUser(user);
    });

    return () => unsubscribe();
  }, []);

  const loadCropCycles = useCallback(async () => {
    try {
      await migrateLegacyRecords();
      const list = await fetchCropCycles();
      setCropCycles(list);

      const workersList = await fetchWorkers();
      setAllWorkers(workersList);

      const wcList = await fetchWorkerCrops();
      setWorkerCrops(wcList);
      
      const savedSelectedId = localStorage.getItem('paramesh_selected_crop_cycle_id');
      
      if (!savedSelectedId || savedSelectedId === 'all' || !list.some(c => c.id === savedSelectedId)) {
        const legacyCrop = list.find(c => c.id === 'legacy_crop_2025_2026');
        if (legacyCrop) {
          setSelectedCropCycleId(legacyCrop.id);
          localStorage.setItem('paramesh_selected_crop_cycle_id', legacyCrop.id);
        } else {
          const firstActive = list.find(c => c.status === 'active');
          if (firstActive) {
            setSelectedCropCycleId(firstActive.id);
            localStorage.setItem('paramesh_selected_crop_cycle_id', firstActive.id);
          } else if (list.length > 0) {
            setSelectedCropCycleId(list[0].id);
            localStorage.setItem('paramesh_selected_crop_cycle_id', list[0].id);
          } else {
            setSelectedCropCycleId('all');
            localStorage.setItem('paramesh_selected_crop_cycle_id', 'all');
          }
        }
      }
    } catch (e) {
      console.error("Error loading crop cycles:", e);
    }
  }, []);

  const updatePendingWagesCount = useCallback(async () => {
    try {
      const workersData = await fetchWorkers();
      let paymentsData = await fetchPayments();
      let allAttendance = await fetchAttendance();

      // Filter by active crop cycle
      paymentsData = filterByCrop(paymentsData, selectedCropCycleId);
      allAttendance = filterByCrop(allAttendance, selectedCropCycleId);

      let count = 0;
      workersData.forEach(w => {
        const workerAtt = allAttendance.filter(a => a.workerId === w.id);
        const earned = workerAtt.reduce((sum, a) => {
          const wage = a.wageForDay !== undefined ? a.wageForDay : w.dailyWage;
          if (a.status === 'present') return sum + wage;
          if (a.status === 'half_day') return sum + wage * 0.5;
          return sum;
        }, 0);
        const paid = paymentsData.filter(p => p.workerId === w.id).reduce((sum, p) => sum + p.amount, 0);
        if (earned - paid > 0) {
          count++;
        }
      });
      setPendingWagesCount(count);
    } catch (e) {
      console.error(e);
    }
  }, [selectedCropCycleId]);

  // Load Crop Cycles on login
  useEffect(() => {
    if (currentUser) {
      loadCropCycles();
    }
  }, [currentUser, loadCropCycles]);

  // Update pending wages count whenever database changes, view swaps, or crop selection changes
  useEffect(() => {
    if (currentUser) {
      updatePendingWagesCount();
    }
  }, [currentView, currentUser, updatePendingWagesCount]);

  const handleLanguageChange = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem('paramesh_lang', newLang);
  };

  const handleBilingualChange = (val: boolean) => {
    setBilingual(val);
    localStorage.setItem('paramesh_bilingual', String(val));
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  };

  // Dismiss toast after 3s
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Auth Handlers
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      showToast("Please enter email and password", "error");
      return;
    }

    setAuthLoading(true);
    try {
      const user = await signInWithEmail(email.trim(), password.trim());
      setCurrentUser(user);
      showToast("Logged in successfully!", "success");
    } catch (err: any) {
      console.error("Email login failed:", err);
      showToast(err?.message || t('loginError', lang), "error");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleCreateCropCycle = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newCropName.trim() || !newCropSeason.trim() || !newCropStartDate.trim() || !newCropExpectedHarvestDate.trim()) {
      showToast("Please fill in all required fields", "error");
      return;
    }

    // Validation 1: Date check
    if (new Date(newCropStartDate) > new Date(newCropExpectedHarvestDate)) {
      showToast(t('validationCropDates', lang), "error");
      return;
    }

    // Validation 2: Duplicate check
    const duplicate = cropCycles.find(
      c => c.cropName.trim().toLowerCase() === newCropName.trim().toLowerCase() &&
           c.season.trim().toLowerCase() === newCropSeason.trim().toLowerCase() &&
           c.status === 'active'
    );
    if (duplicate) {
      showToast(t('validationDuplicateCrop', lang), "error");
      return;
    }

    setSavingCrop(true);
    try {
      let workerIds: string[] = [];
      if (copyWorkersFlag) {
        const workers = await fetchWorkers();
        workerIds = workers.map(w => w.id);
      }

      const newCycle: Omit<CropCycle, 'id' | 'createdAt'> = {
        cropName: newCropName.trim(),
        season: newCropSeason.trim(),
        variety: newCropVariety.trim(),
        landName: newCropLandName.trim(),
        area: newCropArea.trim(),
        irrigationType: newCropIrrigationType,
        startDate: newCropStartDate,
        expectedHarvestDate: newCropExpectedHarvestDate,
        status: 'active',
        notes: newCropNotes.trim(),
        workerIds
      };

      const newId = await createCropCycle(newCycle);

      // Create WorkerCrop relationships
      if (copyWorkersFlag) {
        for (const wId of workerIds) {
          await assignWorkerToCrop(wId, newId);
        }
      }

      // Copy Attendance if selected
      if (copyAttendanceFlag) {
        try {
          const allAtt = await fetchAttendance();
          const cropAtt = filterByCrop(allAtt, selectedCropCycleId);
          const attByDate: Record<string, Omit<AttendanceRecord, 'id'>[]> = {};
          cropAtt.forEach(a => {
            if (!attByDate[a.date]) {
              attByDate[a.date] = [];
            }
            attByDate[a.date].push({
              workerId: a.workerId,
              date: a.date,
              status: a.status,
              wageForDay: a.wageForDay,
              workType: a.workType,
              notes: a.notes,
              cropCycleId: newId
            });
          });
          for (const [date, records] of Object.entries(attByDate)) {
            await saveAttendanceList(date, records);
          }
        } catch (e) {
          console.error("Failed to copy attendance:", e);
        }
      }

      // Copy Payments if selected
      if (copyPaymentsFlag) {
        try {
          const allPayments = await fetchPayments();
          const cropPayments = filterByCrop(allPayments, selectedCropCycleId);
          for (const p of cropPayments) {
            await createPayment({
              workerId: p.workerId,
              amount: p.amount,
              date: p.date,
              note: p.note,
              cropCycleId: newId
            });
          }
        } catch (e) {
          console.error("Failed to copy payments:", e);
        }
      }

      // Copy Expenses if selected
      if (copyExpensesFlag) {
        try {
          const allExpenses = await fetchExpenses();
          const cropExpenses = filterByCrop(allExpenses, selectedCropCycleId);
          for (const e of cropExpenses) {
            await createExpense({
              category: e.category,
              amount: e.amount,
              description: e.description,
              notes: e.notes,
              date: e.date,
              cropCycleId: newId
            });
          }
        } catch (e) {
          console.error("Failed to copy expenses:", e);
        }
      }

      showToast("Crop cycle created successfully!", "success");
      
      // Refresh list
      await loadCropCycles();
      // Select the new crop automatically
      setSelectedCropCycleId(newId);
      localStorage.setItem('paramesh_selected_crop_cycle_id', newId);
      
      setShowNewCropModal(false);
    } catch (err: any) {
      console.error(err);
      showToast("Failed to create crop cycle", "error");
    } finally {
      setSavingCrop(false);
    }
  };

  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    try {
      const user = await signInWithGoogle();
      setCurrentUser(user);
      showToast("Logged in with Google!", "success");
    } catch (err: any) {
      console.error("Google Sign-In failed:", err);
      showToast(err?.message || t('loginError', lang), "error");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleNavigateView = (view: string) => {
    setPageSwapping(true);
    setCurrentView(view);
    setTimeout(() => {
      setPageSwapping(false);
    }, 300); // 300ms transition skeleton
  };

  // Render View Selector
  const renderActiveView = () => {
    if (pageSwapping) {
      return (
        /* Loading Skeletons layout */
        <div className="flex-1 p-5 space-y-6">
          <div className="h-10 bg-gray-200/50 rounded-2xl animate-pulse w-2/3"></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-28 bg-gray-200/50 rounded-3xl animate-pulse"></div>
            <div className="h-28 bg-gray-200/50 rounded-3xl animate-pulse"></div>
          </div>
          <div className="h-40 bg-gray-200/50 rounded-3xl animate-pulse"></div>
          <div className="h-20 bg-gray-200/50 rounded-3xl animate-pulse"></div>
        </div>
      );
    }

    switch (currentView) {
      case 'home':
        return (
          <DashboardView
            lang={lang}
            bilingual={bilingual}
            onNavigate={handleNavigateView}
            showToast={showToast}
            selectedCropCycleId={selectedCropCycleId}
            cropCycles={cropCycles}
            onRefreshCropCycles={loadCropCycles}
          />
        );
      case 'workers':
        return (
          <WorkersView
            lang={lang}
            bilingual={bilingual}
            showToast={showToast}
            selectedCropCycleId={selectedCropCycleId}
            cropCycles={cropCycles}
            onRefreshCropCycles={loadCropCycles}
          />
        );
      case 'attendance':
        return (
          <AttendanceView
            lang={lang}
            bilingual={bilingual}
            showToast={showToast}
            selectedCropCycleId={selectedCropCycleId}
            cropCycles={cropCycles}
          />
        );
      case 'payments':
        return (
          <PaymentsView
            lang={lang}
            bilingual={bilingual}
            showToast={showToast}
            selectedCropCycleId={selectedCropCycleId}
            cropCycles={cropCycles}
          />
        );
      case 'expenses':
        return (
          <ExpensesView
            lang={lang}
            bilingual={bilingual}
            showToast={showToast}
            selectedCropCycleId={selectedCropCycleId}
            cropCycles={cropCycles}
          />
        );
      case 'reports':
        return (
          <ReportsView
            lang={lang}
            bilingual={bilingual}
            showToast={showToast}
            selectedCropCycleId={selectedCropCycleId}
            cropCycles={cropCycles}
          />
        );
      case 'profile':
        return (
          <ProfileView
            lang={lang}
            bilingual={bilingual}
            onLanguageChange={handleLanguageChange}
            onBilingualChange={handleBilingualChange}
            onLogout={() => {
              localStorage.removeItem('paramesh_mock_user');
              localStorage.removeItem('paramesh_settings');
              setEmail('');
              setPassword('');
              setCurrentUser(null);
              setCurrentView('home');
            }}
            showToast={showToast}
            currentUser={currentUser}
          />
        );
      default:
        return <div className="p-4 text-center">View not found</div>;
    }
  };

  // Page Header Title helper
  const getHeaderTitle = () => {
    switch (currentView) {
      case 'home': return 'home';
      case 'workers': return 'workers';
      case 'attendance': return 'attendance';
      case 'payments': return 'payments';
      case 'expenses': return 'expenses';
      case 'reports': return 'reports';
      case 'profile': return 'profile';
      default: return '';
    }
  };

  return (
    <div className="w-full min-h-screen flex flex-col justify-between select-none relative font-sans">
      {/* Toast Notifications */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 16 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed left-4 right-4 max-w-sm mx-auto z-50 p-4 rounded-2xl shadow-premium border flex items-center justify-between ${
              toast.type === 'success' 
                ? 'bg-success-green/10 border-success-green/30 text-success-green' 
                : 'bg-danger-red/10 border-danger-red/30 text-danger-red'
            }`}
          >
            <span className="text-sm font-bold">{toast.message}</span>
            <button onClick={() => setToast(null)} className="text-xs font-bold underline ml-2 cursor-pointer">
              dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {!currentUser ? (
          /* Authentication Screen */
          <motion.div
            key="login"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col justify-center px-6 py-12 bg-[#F8F5E9]"
          >
            {/* Logo Header */}
            <div className="text-center mb-8">
              <div className="mx-auto w-20 h-20 bg-primary/10 text-primary rounded-3xl flex items-center justify-center shadow-soft mb-4 animate-pulse-soft">
                <Sprout size={48} className="fill-primary/5" />
              </div>
              <h1 className="text-3xl font-black text-text-dark tracking-tight leading-none">
                🌾 Paramesh AgriBook
              </h1>
              <p className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest mt-2.5">
                Smart Farm Ledger
              </p>
            </div>

            {/* Login Card */}
            <div className="bg-white p-6 rounded-3xl border border-[#E0DBC5]/50 shadow-premium space-y-6">
              <h2 className="text-xl font-bold text-text-dark text-center">
                {t('loginTitle', lang)}
              </h2>

              <form onSubmit={handleEmailLogin} className="space-y-4">
                {/* Email */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase pl-1 tracking-wider">
                    {t('emailInput', lang)}
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="farmer@agribook.com"
                      className="form-input w-full pl-11"
                    />
                    <Mail className="absolute left-4 top-4 text-gray-400" size={16} />
                  </div>
                </div>

                {/* Password */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase pl-1 tracking-wider">
                    {t('passwordInput', lang)}
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="form-input w-full pl-11"
                    />
                    <Lock className="absolute left-4 top-4 text-gray-400" size={16} />
                  </div>
                </div>

                {/* Log In Button */}
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-4.5 bg-primary hover:bg-primary-light text-white font-bold rounded-2xl shadow-soft btn-active-scale cursor-pointer transition-all flex items-center justify-center gap-2 text-base mt-2"
                >
                  {authLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    "Login to AgriBook"
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="flex items-center justify-center gap-3 py-1">
                <div className="h-[1px] bg-gray-100 flex-1"></div>
                <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest">or</span>
                <div className="h-[1px] bg-gray-100 flex-1"></div>
              </div>

              {/* Google Login */}
              <div className="space-y-2.5">
                <button
                  onClick={handleGoogleLogin}
                  disabled={authLoading}
                  className="w-full py-3.5 bg-white border border-[#E0DBC5] text-gray-700 font-bold rounded-2xl active:scale-98 cursor-pointer flex items-center justify-center gap-2 text-sm transition-all"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#EA4335" d="M12 5.04c1.62 0 3.08.56 4.22 1.66l3.15-3.15C17.47 1.83 14.93 1 12 1 7.37 1 3.4 3.63 1.43 7.43l3.87 3C6.23 7.4 8.89 5.04 12 5.04z"/>
                    <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.47h6.46c-.28 1.47-1.11 2.71-2.36 3.55l3.87 3c2.26-2.09 3.52-5.17 3.52-8.66z"/>
                    <path fill="#FBBC05" d="M5.3 14.43c-.24-.73-.38-1.5-.38-2.3s.14-1.57.38-2.3L1.43 7.43C.52 9.24 0 11.26 0 13.43s.52 4.19 1.43 6l3.87-3z"/>
                    <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.87-3c-1.1.74-2.51 1.18-4.09 1.18-3.11 0-5.77-2.36-6.7-5.39l-3.87 3C3.4 20.37 7.37 23 12 23z"/>
                  </svg>
                  {t('googleLogin', lang)}
                </button>
              </div>
            </div>

            {/* Footer switcher */}
            <div className="mt-8 flex justify-center items-center gap-2 text-xs font-bold text-gray-400">
              <Globe size={14} />
              <button 
                onClick={() => handleLanguageChange('en')} 
                className={`hover:underline cursor-pointer ${lang === 'en' ? 'text-primary' : ''}`}
              >
                English
              </button>
              <span>•</span>
              <button 
                onClick={() => handleLanguageChange('te')} 
                className={`hover:underline cursor-pointer ${lang === 'te' ? 'text-primary' : ''}`}
              >
                తెలుగు
              </button>
            </div>
          </motion.div>
        ) : (
          /* Main Application Layout Shell */
          <motion.div
            key="app"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col justify-between min-h-screen relative"
          >
            {/* Header */}
            <header className="sticky top-0 left-0 right-0 z-50 glass-header px-4 py-2 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                    <Sprout size={18} />
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider block">
                      Paramesh AgriBook
                    </span>
                    <span className="text-sm font-extrabold text-text-dark block leading-none">
                      {bilingual 
                        ? `${t(getHeaderTitle(), lang)} / ${subT(getHeaderTitle(), lang)}` 
                        : t(getHeaderTitle(), lang)
                      }
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleLanguageChange(lang === 'en' ? 'te' : 'en')}
                  className="px-3 py-1.5 bg-primary/15 text-primary text-xs font-bold rounded-xl active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Globe size={12} />
                  {lang === 'en' ? 'తెలుగు' : 'English'}
                </button>
              </div>

              {/* Crop Selector Bar */}
              <div className="relative">
                <button
                  onClick={() => setIsCropDropdownOpen(!isCropDropdownOpen)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-[#F8F5E9]/80 border border-[#E0DBC5]/50 text-text-dark font-bold text-xs rounded-xl active:scale-[0.99] transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-gray-400 font-semibold">{t('currentCrop', lang)}:</span>
                    <span className="text-primary truncate">
                      {selectedCropCycleId === 'all' 
                        ? t('allCrops', lang) 
                        : (() => {
                            const c = cropCycles.find(c => c.id === selectedCropCycleId);
                            return c ? `${c.cropName} (${c.season})` : 'All Crops';
                          })()
                      }
                    </span>
                  </div>
                  <ChevronDown size={14} className={`text-gray-400 transition-transform ${isCropDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Crop Dropdown Menu */}
                <AnimatePresence>
                  {isCropDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="absolute left-0 right-0 mt-1 bg-white border border-[#E0DBC5]/60 rounded-xl shadow-premium z-50 overflow-hidden"
                    >
                      <div className="max-h-60 overflow-y-auto py-1">


                        {cropCycles.map(crop => (
                          <button
                            key={crop.id}
                            onClick={() => {
                              setSelectedCropCycleId(crop.id);
                              localStorage.setItem('paramesh_selected_crop_cycle_id', crop.id);
                              setIsCropDropdownOpen(false);
                            }}
                            className={`w-full text-left px-4 py-2.5 text-xs font-semibold flex items-center justify-between hover:bg-gray-50 ${selectedCropCycleId === crop.id ? 'text-primary bg-primary/5' : 'text-text-dark'}`}
                          >
                            <div className="min-w-0 flex-1">
                              <span className="block font-bold truncate">{crop.cropName} ({crop.season})</span>
                              <span className="block text-[9px] text-gray-400 font-semibold">{crop.area || '0 Acres'} • {crop.status === 'completed' ? 'Completed' : 'Active'}</span>
                            </div>
                            {selectedCropCycleId === crop.id && <Check size={12} className="text-primary" />}
                          </button>
                        ))}
                      </div>

                      <div className="border-t border-gray-100 p-1 space-y-1">
                        <button
                          onClick={() => {
                            setIsCropDropdownOpen(false);
                            setNewCropName('');
                            setNewCropSeason('');
                            setNewCropVariety('');
                            setNewCropLandName('');
                            setNewCropArea('');
                            setNewCropStartDate('');
                            setNewCropExpectedHarvestDate('');
                            setNewCropNotes('');
                            setCopyWorkersFlag(true);
                            setCopyAttendanceFlag(false);
                            setCopyPaymentsFlag(false);
                            setCopyExpensesFlag(false);
                            setShowNewCropModal(true);
                          }}
                          className="w-full py-2 bg-primary/10 text-primary font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 hover:bg-primary/15 transition-all cursor-pointer"
                        >
                          <Plus size={12} />
                          {t('addCropCycle', lang)}
                        </button>
                        
                        <button
                          onClick={() => {
                            setIsCropDropdownOpen(false);
                            setShowManageCropsModal(true);
                          }}
                          className="w-full py-2 bg-[#F9A825]/10 text-[#8B6E30] font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 hover:bg-[#F9A825]/15 transition-all cursor-pointer"
                        >
                          <Sprout size={12} />
                          {t('manageCropCycles', lang)}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </header>

            {/* Content Area */}
            <main className="flex-1 flex flex-col relative bg-[#F8F5E9]/30">
              {renderActiveView()}
            </main>

            {/* Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto z-40 glass-nav px-2.5 py-2 flex justify-around">
              {/* Home */}
              <button
                onClick={() => handleNavigateView('home')}
                className={`flex-1 py-1.5 flex flex-col items-center gap-0.5 cursor-pointer relative transition-all ${
                  currentView === 'home' ? 'text-primary scale-105' : 'text-gray-400'
                }`}
              >
                <Home size={20} className={currentView === 'home' ? 'fill-primary/5' : ''} />
                <span className="text-[10px] font-extrabold">{t('home', lang)}</span>
                {currentView === 'home' && (
                  <motion.div layoutId="nav-dot" className="absolute bottom-0 w-1.5 h-1.5 bg-accent rounded-full"></motion.div>
                )}
              </button>

              {/* Workers */}
              <button
                onClick={() => handleNavigateView('workers')}
                className={`flex-1 py-1.5 flex flex-col items-center gap-0.5 cursor-pointer relative transition-all ${
                  currentView === 'workers' ? 'text-primary scale-105' : 'text-gray-400'
                }`}
              >
                <Users size={20} />
                <span className="text-[10px] font-extrabold">{t('workers', lang)}</span>
                {currentView === 'workers' && (
                  <motion.div layoutId="nav-dot" className="absolute bottom-0 w-1.5 h-1.5 bg-accent rounded-full"></motion.div>
                )}
              </button>

              {/* Attendance */}
              <button
                onClick={() => handleNavigateView('attendance')}
                className={`flex-1 py-1.5 flex flex-col items-center gap-0.5 cursor-pointer relative transition-all ${
                  currentView === 'attendance' ? 'text-primary scale-105' : 'text-gray-400'
                }`}
              >
                <CheckSquare size={20} />
                <span className="text-[10px] font-extrabold">{t('attendance', lang)}</span>
                {currentView === 'attendance' && (
                  <motion.div layoutId="nav-dot" className="absolute bottom-0 w-1.5 h-1.5 bg-accent rounded-full"></motion.div>
                )}
              </button>

              {/* Payments with dynamic badge */}
              <button
                onClick={() => handleNavigateView('payments')}
                className={`flex-1 py-1.5 flex flex-col items-center gap-0.5 cursor-pointer relative transition-all ${
                  currentView === 'payments' ? 'text-primary scale-105' : 'text-gray-400'
                }`}
              >
                <div className="relative">
                  <DollarSign size={20} />
                  {pendingWagesCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-danger-red text-white text-[8px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border border-white shadow-sm">
                      {pendingWagesCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-extrabold">{t('payments', lang)}</span>
                {currentView === 'payments' && (
                  <motion.div layoutId="nav-dot" className="absolute bottom-0 w-1.5 h-1.5 bg-accent rounded-full"></motion.div>
                )}
              </button>

              {/* Expenses */}
              <button
                onClick={() => handleNavigateView('expenses')}
                className={`flex-1 py-1.5 flex flex-col items-center gap-0.5 cursor-pointer relative transition-all ${
                  currentView === 'expenses' ? 'text-primary scale-105' : 'text-gray-400'
                }`}
              >
                <Fuel size={20} />
                <span className="text-[10px] font-extrabold">{t('expenses', lang)}</span>
                {currentView === 'expenses' && (
                  <motion.div layoutId="nav-dot" className="absolute bottom-0 w-1.5 h-1.5 bg-accent rounded-full"></motion.div>
                )}
              </button>

              {/* Reports */}
              <button
                onClick={() => handleNavigateView('reports')}
                className={`flex-1 py-1.5 flex flex-col items-center gap-0.5 cursor-pointer relative transition-all ${
                  currentView === 'reports' ? 'text-primary scale-105' : 'text-gray-400'
                }`}
              >
                <BarChart3 size={20} />
                <span className="text-[10px] font-extrabold">{t('reports', lang)}</span>
                {currentView === 'reports' && (
                  <motion.div layoutId="nav-dot" className="absolute bottom-0 w-1.5 h-1.5 bg-accent rounded-full"></motion.div>
                )}
              </button>

              {/* Settings / Profile */}
              <button
                onClick={() => handleNavigateView('profile')}
                className={`flex-1 py-1.5 flex flex-col items-center gap-0.5 cursor-pointer relative transition-all ${
                  currentView === 'profile' ? 'text-primary scale-105' : 'text-gray-400'
                }`}
              >
                <User size={20} />
                <span className="text-[10px] font-extrabold">{t('profile', lang)}</span>
                {currentView === 'profile' && (
                  <motion.div layoutId="nav-dot" className="absolute bottom-0 w-1.5 h-1.5 bg-accent rounded-full"></motion.div>
                )}
              </button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Crop Modal */}
      <AnimatePresence>
        {showNewCropModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-3xl p-6 shadow-premium relative border border-[#E0DBC5] max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              <button 
                onClick={() => setShowNewCropModal(false)}
                className="absolute top-4 right-4 p-1.5 bg-gray-100 rounded-full text-gray-500 active:scale-90"
              >
                <X size={18} />
              </button>

              <h3 className="text-lg font-bold text-text-dark mb-1 flex items-center gap-2">
                <Sprout className="text-primary" size={20} />
                {t('addCropCycle', lang)}
              </h3>
              <p className="text-xs text-gray-400 font-semibold mb-5">
                Create a new crop cycle to organize workers, attendance, and expenses.
              </p>

              <form onSubmit={handleCreateCropCycle} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase pl-1">{t('cropName', lang)} *</label>
                    <input
                      type="text"
                      required
                      value={newCropName}
                      onChange={(e) => setNewCropName(e.target.value)}
                      placeholder="e.g. Tomato, Paddy, Cotton"
                      className="form-input text-xs"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase pl-1">{t('variety', lang)}</label>
                    <input
                      type="text"
                      value={newCropVariety}
                      onChange={(e) => setNewCropVariety(e.target.value)}
                      placeholder="e.g. US 440, Hybrid"
                      className="form-input text-xs"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase pl-1">{t('season', lang)} *</label>
                    <input
                      type="text"
                      required
                      value={newCropSeason}
                      onChange={(e) => setNewCropSeason(e.target.value)}
                      placeholder="e.g. Kharif 2026, Rabi"
                      className="form-input text-xs"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase pl-1">{t('landName', lang)}</label>
                    <input
                      type="text"
                      value={newCropLandName}
                      onChange={(e) => setNewCropLandName(e.target.value)}
                      placeholder="e.g. West Field"
                      className="form-input text-xs"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase pl-1">{t('area', lang)}</label>
                    <input
                      type="text"
                      value={newCropArea}
                      onChange={(e) => setNewCropArea(e.target.value)}
                      placeholder="e.g. 5 Acres"
                      className="form-input text-xs"
                    />
                  </div>

                  <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase pl-1">{t('irrigationType', lang)}</label>
                    <select
                      value={newCropIrrigationType}
                      onChange={(e) => setNewCropIrrigationType(e.target.value as any)}
                      className="form-input text-xs"
                    >
                      <option value="Drip">{t('irrigationType_Drip', lang)}</option>
                      <option value="Sprinkler">{t('irrigationType_Sprinkler', lang)}</option>
                      <option value="Flow">{t('irrigationType_Flow', lang)}</option>
                      <option value="Rainfed">{t('irrigationType_Rainfed', lang)}</option>
                      <option value="Other">{t('irrigationType_Other', lang)}</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase pl-1">{t('startDate', lang)} *</label>
                    <input
                      type="date"
                      required
                      value={newCropStartDate}
                      onChange={(e) => setNewCropStartDate(e.target.value)}
                      className="form-input text-xs"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase pl-1">{t('expectedHarvestDate', lang)} *</label>
                    <input
                      type="date"
                      required
                      value={newCropExpectedHarvestDate}
                      onChange={(e) => setNewCropExpectedHarvestDate(e.target.value)}
                      className="form-input text-xs"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase pl-1">{t('notes', lang)}</label>
                  <textarea
                    value={newCropNotes}
                    onChange={(e) => setNewCropNotes(e.target.value)}
                    placeholder="Any notes..."
                    rows={2}
                    className="form-input text-xs"
                  />
                </div>

                {/* Checkboxes */}
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-text-dark select-none">
                    <input
                      type="checkbox"
                      checked={copyWorkersFlag}
                      onChange={(e) => setCopyWorkersFlag(e.target.checked)}
                      className="rounded text-primary focus:ring-primary w-4 h-4"
                    />
                    <span>{t('importWorkers', lang)}</span>
                  </label>
                  
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-text-dark select-none">
                    <input
                      type="checkbox"
                      checked={copyAttendanceFlag}
                      onChange={(e) => setCopyAttendanceFlag(e.target.checked)}
                      className="rounded text-primary focus:ring-primary w-4 h-4"
                    />
                    <span>{t('copyAttendance', lang)}</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-text-dark select-none">
                    <input
                      type="checkbox"
                      checked={copyPaymentsFlag}
                      onChange={(e) => setCopyPaymentsFlag(e.target.checked)}
                      className="rounded text-primary focus:ring-primary w-4 h-4"
                    />
                    <span>{t('copyPayments', lang)}</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-text-dark select-none">
                    <input
                      type="checkbox"
                      checked={copyExpensesFlag}
                      onChange={(e) => setCopyExpensesFlag(e.target.checked)}
                      className="rounded text-primary focus:ring-primary w-4 h-4"
                    />
                    <span>{t('copyExpenses', lang)}</span>
                  </label>
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowNewCropModal(false)}
                    className="flex-1 py-3.5 bg-gray-100 text-gray-600 font-bold rounded-2xl active:scale-95 text-xs transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingCrop}
                    className="flex-1 py-3.5 bg-primary text-white font-bold rounded-2xl active:scale-95 shadow-soft text-xs transition-all flex items-center justify-center gap-1.5"
                  >
                    {savingCrop ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      t('save', lang)
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Manage Crop Cycles Modal */}
      <AnimatePresence>
        {showManageCropsModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-premium relative border border-[#E0DBC5] max-h-[85vh] overflow-y-auto no-scrollbar"
            >
              <button 
                onClick={() => {
                  setShowManageCropsModal(false);
                  setEditingCropCycle(null);
                  setShowWorkerAssignmentsCrop(null);
                }}
                className="absolute top-4 right-4 p-1.5 bg-gray-100 rounded-full text-gray-500 active:scale-90"
              >
                <X size={18} />
              </button>

              <h3 className="text-lg font-bold text-text-dark mb-4 flex items-center gap-2">
                <Sprout className="text-primary" size={20} />
                {bilingual ? 'Manage Crop Cycles / పంటల నిర్వహణ' : 'Manage Crop Cycles'}
              </h3>

              {showWorkerAssignmentsCrop ? (
                <WorkerAssignmentsManager
                  crop={showWorkerAssignmentsCrop}
                  onBack={() => setShowWorkerAssignmentsCrop(null)}
                  lang={lang}
                  bilingual={bilingual}
                  allWorkers={allWorkers}
                  workerCrops={workerCrops}
                  onRefresh={loadCropCycles}
                  showToast={showToast}
                />
              ) : editingCropCycle ? (
                <EditCropForm
                  crop={editingCropCycle}
                  onBack={() => setEditingCropCycle(null)}
                  lang={lang}
                  bilingual={bilingual}
                  onRefresh={loadCropCycles}
                  showToast={showToast}
                />
              ) : (
                <CropsList
                  cropCycles={cropCycles}
                  onEdit={(c) => setEditingCropCycle(c)}
                  onDuplicate={(c) => {
                    setNewCropName(c.cropName);
                    setNewCropSeason(c.season);
                    setNewCropVariety(c.variety || '');
                    setNewCropLandName(c.landName || '');
                    setNewCropArea(c.area || '');
                    setNewCropIrrigationType(c.irrigationType || 'Other');
                    setNewCropStartDate(c.startDate || '');
                    setNewCropExpectedHarvestDate(c.expectedHarvestDate || '');
                    setNewCropNotes(c.notes || '');
                    
                    setShowManageCropsModal(false);
                    setShowNewCropModal(true);
                    showToast("Crop details duplicated! Review and save.", "success");
                  }}
                  onDelete={async (cropId) => {
                    const check = await canDeleteCropCycle(cropId);
                    if (!check.canDelete) {
                      const msg = bilingual 
                        ? `పంటను తొలగించలేము. ఈ పంటకు ${check.attendanceCount} హాజరు, ${check.paymentCount} చెల్లింపులు, మరియు ${check.expenseCount} ఖర్చులు ఉన్నాయి.`
                        : `Cannot delete crop cycle. It has ${check.attendanceCount} attendance records, ${check.paymentCount} payments, and ${check.expenseCount} expenses linked to it.`;
                      alert(msg);
                      return;
                    }
                    if (window.confirm("Are you sure you want to delete this crop cycle? This action is permanent and cannot be undone.")) {
                      try {
                        await removeCropCycle(cropId);
                        showToast(t('cropDeleteSuccess', lang), "success");
                        await loadCropCycles();
                      } catch (e) {
                        showToast("Failed to delete crop cycle", "error");
                      }
                    }
                  }}
                  onManageWorkers={(c) => setShowWorkerAssignmentsCrop(c)}
                  lang={lang}
                  bilingual={bilingual}
                />
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ----------------------------------------------------
// Sub-components for Crop CRUD & Worker Assignments
// ----------------------------------------------------

interface CropsListProps {
  cropCycles: CropCycle[];
  onEdit: (crop: CropCycle) => void;
  onDuplicate: (crop: CropCycle) => void;
  onDelete: (cropId: string) => void;
  onManageWorkers: (crop: CropCycle) => void;
  lang: Language;
  bilingual: boolean;
}

const CropsList: React.FC<CropsListProps> = ({
  cropCycles,
  onEdit,
  onDuplicate,
  onDelete,
  onManageWorkers,
  lang,
  bilingual
}) => {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed' | 'archived'>('all');

  const filtered = cropCycles
    .filter(c => {
      const matchSearch = c.cropName.toLowerCase().includes(search.toLowerCase()) || 
                          c.season.toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === 'all' || c.status === filterStatus;
      return matchSearch && matchStatus;
    });

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search crop name or season..."
          className="flex-1 bg-gray-50 border border-[#E0DBC5] text-text-dark rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-primary placeholder-gray-400"
        />
        <select
          value={filterStatus}
          onChange={(e: any) => setFilterStatus(e.target.value)}
          className="bg-gray-50 border border-[#E0DBC5] text-text-dark rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-primary"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active Only</option>
          <option value="completed">Completed Only</option>
          <option value="archived">Archived Only</option>
        </select>
      </div>

      <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1 no-scrollbar">
        {filtered.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6 font-semibold">No crop cycles found.</p>
        ) : (
          filtered.map(c => (
            <div key={c.id} className="bg-gray-50 p-3.5 border border-[#E0DBC5]/40 rounded-2xl flex flex-col gap-2.5">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-sm text-text-dark leading-tight">{c.cropName} ({c.season})</h4>
                  <span className="text-[10px] text-gray-400 font-semibold block mt-1">
                    Variety: {c.variety || 'N/A'} • Irrigation: {c.irrigationType || 'Other'} • Land: {c.landName || 'N/A'} ({c.area || '0'} acres)
                  </span>
                </div>
                <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${
                  c.status === 'active' 
                    ? 'bg-success-green/10 text-success-green' 
                    : c.status === 'completed'
                      ? 'bg-primary/10 text-primary'
                      : 'bg-gray-200 text-gray-500'
                }`}>
                  {c.status}
                </span>
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-end border-t border-gray-200/50 pt-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onManageWorkers(c)}
                  className="px-2.5 py-1.5 bg-primary/10 text-primary rounded-lg text-[10px] font-bold active:scale-95 cursor-pointer"
                >
                  Manage Workers
                </button>
                <button
                  type="button"
                  onClick={() => onEdit(c)}
                  className="px-2.5 py-1.5 bg-accent/10 text-accent rounded-lg text-[10px] font-bold active:scale-95 cursor-pointer"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => onDuplicate(c)}
                  className="px-2.5 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-[10px] font-bold active:scale-95 cursor-pointer"
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(c.id)}
                  className="px-2.5 py-1.5 bg-danger-red/10 text-danger-red rounded-lg text-[10px] font-bold active:scale-95 cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

interface EditCropFormProps {
  crop: CropCycle;
  onBack: () => void;
  lang: Language;
  bilingual: boolean;
  onRefresh: () => Promise<void>;
  showToast: (message: string, type: 'success' | 'error') => void;
}

const EditCropForm: React.FC<EditCropFormProps> = ({
  crop,
  onBack,
  lang,
  bilingual,
  onRefresh,
  showToast
}) => {
  const [name, setName] = useState(crop.cropName);
  const [season, setSeason] = useState(crop.season);
  const [variety, setVariety] = useState(crop.variety || '');
  const [land, setLand] = useState(crop.landName || '');
  const [area, setArea] = useState(crop.area || '');
  const [irrigation, setIrrigation] = useState(crop.irrigationType || 'Other');
  const [start, setStart] = useState(crop.startDate || '');
  const [end, setEnd] = useState(crop.expectedHarvestDate || '');
  const [actualEnd, setActualEnd] = useState(crop.actualHarvestDate || '');
  const [status, setStatus] = useState(crop.status || 'active');
  const [notes, setNotes] = useState(crop.notes || '');
  const [revenue, setRevenue] = useState(crop.harvestRevenue !== undefined ? crop.harvestRevenue.toString() : '');
  const [yieldQty, setYieldQty] = useState(crop.harvestYield || '');
  const [saving, setSaving] = useState(false);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !season.trim() || !start.trim() || !end.trim()) {
      showToast("Please fill in all required fields", "error");
      return;
    }

    setSaving(true);
    try {
      const updatedData: Partial<CropCycle> = {
        cropName: name.trim(),
        season: season.trim(),
        variety: variety.trim(),
        landName: land.trim(),
        area: area.trim(),
        irrigationType: irrigation as any,
        startDate: start,
        expectedHarvestDate: end,
        actualHarvestDate: status === 'completed' ? (actualEnd || new Date().toISOString().split('T')[0]) : '',
        status: status as any,
        notes: notes.trim(),
        harvestRevenue: revenue ? parseFloat(revenue) : 0,
        harvestYield: yieldQty.trim(),
        updatedAt: new Date().toISOString()
      };

      await editCropCycle(crop.id, updatedData);
      showToast("Crop cycle updated successfully!", "success");
      await onRefresh();
      onBack();
    } catch (err) {
      showToast("Failed to update crop cycle", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleUpdate} className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <button type="button" onClick={onBack} className="text-xs text-gray-500 font-bold hover:underline cursor-pointer">
          &larr; Back to List
        </button>
        <span className="text-gray-300">|</span>
        <span className="text-xs font-bold text-gray-400">Editing Crop Details</span>
      </div>

      <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto p-1 no-scrollbar">
        <div className="flex flex-col gap-1 col-span-2">
          <label className="text-[10px] font-bold text-gray-400 uppercase pl-1">{t('cropName', lang)} *</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="form-input text-xs"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase pl-1">{t('variety', lang)}</label>
          <input
            type="text"
            value={variety}
            onChange={(e) => setVariety(e.target.value)}
            className="form-input text-xs"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase pl-1">{t('season', lang)} *</label>
          <input
            type="text"
            required
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            className="form-input text-xs"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase pl-1">{t('landName', lang)}</label>
          <input
            type="text"
            value={land}
            onChange={(e) => setLand(e.target.value)}
            className="form-input text-xs"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase pl-1">{t('area', lang)}</label>
          <input
            type="text"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className="form-input text-xs"
          />
        </div>

        <div className="flex flex-col gap-1 col-span-2">
          <label className="text-[10px] font-bold text-gray-400 uppercase pl-1">{t('irrigationType', lang)}</label>
          <select
            value={irrigation}
            onChange={(e: any) => setIrrigation(e.target.value)}
            className="form-input text-xs"
          >
            <option value="Drip">{t('irrigationType_Drip', lang)}</option>
            <option value="Sprinkler">{t('irrigationType_Sprinkler', lang)}</option>
            <option value="Flow">{t('irrigationType_Flow', lang)}</option>
            <option value="Rainfed">{t('irrigationType_Rainfed', lang)}</option>
            <option value="Other">{t('irrigationType_Other', lang)}</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase pl-1">{t('startDate', lang)} *</label>
          <input
            type="date"
            required
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="form-input text-xs"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase pl-1">{t('expectedHarvestDate', lang)} *</label>
          <input
            type="date"
            required
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="form-input text-xs"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase pl-1">{t('harvestRevenue', lang)}</label>
          <input
            type="number"
            value={revenue}
            onChange={(e) => setRevenue(e.target.value)}
            placeholder="e.g. 150000"
            className="form-input text-xs"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase pl-1">{t('harvestYield', lang)}</label>
          <input
            type="text"
            value={yieldQty}
            onChange={(e) => setYieldQty(e.target.value)}
            placeholder="e.g. 50 Bags, 3 Tons"
            className="form-input text-xs"
          />
        </div>

        <div className="flex flex-col gap-1 col-span-2">
          <label className="text-[10px] font-bold text-gray-400 uppercase pl-1">Status</label>
          <select
            value={status}
            onChange={(e: any) => setStatus(e.target.value)}
            className="form-input text-xs"
          >
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {status === 'completed' && (
          <div className="flex flex-col gap-1 col-span-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase pl-1">Actual Harvest Date</label>
            <input
              type="date"
              value={actualEnd}
              onChange={(e) => setActualEnd(e.target.value)}
              className="form-input text-xs"
            />
          </div>
        )}

        <div className="flex flex-col gap-1 col-span-2">
          <label className="text-[10px] font-bold text-gray-400 uppercase pl-1">{t('notes', lang)}</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="form-input text-xs"
            rows={2}
          />
        </div>
      </div>

      <div className="flex gap-2 pt-2 border-t border-gray-100">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 py-2.5 bg-gray-100 text-gray-600 font-bold rounded-xl active:scale-95 text-xs cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 py-2.5 bg-primary text-white font-bold rounded-xl active:scale-95 text-xs flex items-center justify-center gap-1.5 cursor-pointer"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            'Save Changes'
          )}
        </button>
      </div>
    </form>
  );
};

interface WorkerAssignmentsManagerProps {
  crop: CropCycle;
  onBack: () => void;
  lang: Language;
  bilingual: boolean;
  allWorkers: Worker[];
  workerCrops: WorkerCrop[];
  onRefresh: () => Promise<void>;
  showToast: (message: string, type: 'success' | 'error') => void;
}

const WorkerAssignmentsManager: React.FC<WorkerAssignmentsManagerProps> = ({
  crop,
  onBack,
  lang,
  bilingual,
  allWorkers,
  workerCrops,
  onRefresh,
  showToast
}) => {
  const [search, setSearch] = useState('');
  const [assigning, setAssigning] = useState(false);

  // Find workers currently assigned to this crop cycle
  const assignedWorkerIds = workerCrops
    .filter(wc => wc.cropCycleId === crop.id)
    .map(wc => wc.workerId);

  const assignedWorkersList = allWorkers.filter(w => assignedWorkerIds.includes(w.id));
  const unassignedWorkersList = allWorkers.filter(w => !assignedWorkerIds.includes(w.id) && w.status === 'active');

  const filteredAssigned = assignedWorkersList.filter(w => 
    w.name.toLowerCase().includes(search.toLowerCase()) || 
    (w.village && w.village.toLowerCase().includes(search.toLowerCase()))
  );

  const handleAssign = async (workerId: string) => {
    setAssigning(true);
    try {
      await assignWorkerToCrop(workerId, crop.id);
      showToast("Worker assigned successfully", "success");
      await onRefresh();
    } catch (e) {
      showToast("Failed to assign worker", "error");
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassign = async (workerId: string) => {
    if (!window.confirm("Are you sure you want to unassign this worker from this crop cycle?")) {
      return;
    }
    setAssigning(true);
    try {
      await unassignWorkerFromCrop(workerId, crop.id);
      showToast("Worker unassigned successfully", "success");
      await onRefresh();
    } catch (e) {
      showToast("Failed to unassign worker", "error");
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2 border-b border-gray-100 pb-2">
        <button type="button" onClick={onBack} className="text-xs text-gray-500 font-bold hover:underline cursor-pointer">
          &larr; Back to Crops
        </button>
        <span className="text-gray-300">|</span>
        <span className="text-xs font-bold text-gray-400">Worker Assignments for: <strong className="text-text-dark">{crop.cropName}</strong></span>
      </div>

      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchAssignedWorkers', lang)}
          className="w-full bg-gray-50 border border-[#E0DBC5] text-text-dark rounded-xl py-2 px-3 pl-8 text-xs focus:outline-none focus:border-primary placeholder-gray-400"
        />
        <Search className="absolute left-2.5 top-2.5 text-gray-400" size={13} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Assigned Workers Column */}
        <div className="border border-gray-100 rounded-2xl p-3 bg-gray-50/50">
          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 border-b border-gray-100 pb-1">
            Assigned Workers ({filteredAssigned.length})
          </h4>
          <div className="space-y-1.5 max-h-60 overflow-y-auto no-scrollbar">
            {filteredAssigned.length === 0 ? (
              <p className="text-[10px] text-gray-400 italic py-4 text-center">No assigned workers.</p>
            ) : (
              filteredAssigned.map(w => (
                <div key={w.id} className="bg-white p-2 rounded-xl border border-gray-100 flex items-center justify-between text-xs font-medium">
                  <div className="min-w-0 flex-1 pr-2">
                    <span className="block font-bold text-text-dark truncate leading-tight">{w.name}</span>
                    <span className="block text-[8px] text-gray-400 truncate">{w.village || 'No Village'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUnassign(w.id)}
                    disabled={assigning}
                    className="p-1 text-danger-red hover:bg-danger-red/10 rounded-lg active:scale-90 cursor-pointer shrink-0"
                    title="Unassign"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Unassigned Workers Column */}
        <div className="border border-gray-100 rounded-2xl p-3 bg-gray-50/50">
          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 border-b border-gray-100 pb-1">
            Available Workers ({unassignedWorkersList.length})
          </h4>
          <div className="space-y-1.5 max-h-60 overflow-y-auto no-scrollbar">
            {unassignedWorkersList.length === 0 ? (
              <p className="text-[10px] text-gray-400 italic py-4 text-center">All workers assigned.</p>
            ) : (
              unassignedWorkersList.map(w => (
                <div key={w.id} className="bg-white p-2 rounded-xl border border-gray-100 flex items-center justify-between text-xs font-medium">
                  <div className="min-w-0 flex-1 pr-2">
                    <span className="block font-bold text-text-dark truncate leading-tight">{w.name}</span>
                    <span className="block text-[8px] text-gray-400 truncate">{w.village || 'No Village'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAssign(w.id)}
                    disabled={assigning}
                    className="p-1 text-success-green hover:bg-success-green/10 rounded-lg active:scale-90 cursor-pointer shrink-0"
                    title="Assign"
                  >
                    <Plus size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
