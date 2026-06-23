import React, { useState, useEffect } from 'react';
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
  Sparkles
} from 'lucide-react';
import { 
  signInWithGoogle,
  signInWithEmail,
  subscribeToAuthChanges,
  AppUser, 
  isMockMode,
  fetchWorkers,
  fetchPayments,
  fetchAttendance,
  AttendanceRecord
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

  // Update pending wages count whenever database changes or view swaps
  useEffect(() => {
    if (currentUser) {
      updatePendingWagesCount();
    }
  }, [currentView, currentUser]);

  const updatePendingWagesCount = async () => {
    try {
      const workersData = await fetchWorkers();
      const paymentsData = await fetchPayments();
      const allAttendance = await fetchAttendance();

      let count = 0;
      workersData.forEach(w => {
        const workerAtt = allAttendance.filter(a => a.workerId === w.id);
        const days = workerAtt.reduce((sum, a) => {
          if (a.status === 'present') return sum + 1;
          if (a.status === 'half_day') return sum + 0.5;
          return sum;
        }, 0);
        const earned = days * w.dailyWage;
        const paid = paymentsData.filter(p => p.workerId === w.id).reduce((sum, p) => sum + p.amount, 0);
        if (earned - paid > 0) {
          count++;
        }
      });
      setPendingWagesCount(count);
    } catch (e) {
      console.error(e);
    }
  };

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
          />
        );
      case 'workers':
        return (
          <WorkersView
            lang={lang}
            bilingual={bilingual}
            showToast={showToast}
          />
        );
      case 'attendance':
        return (
          <AttendanceView
            lang={lang}
            bilingual={bilingual}
            showToast={showToast}
          />
        );
      case 'payments':
        return (
          <PaymentsView
            lang={lang}
            bilingual={bilingual}
            showToast={showToast}
          />
        );
      case 'expenses':
        return (
          <ExpensesView
            lang={lang}
            bilingual={bilingual}
            showToast={showToast}
          />
        );
      case 'reports':
        return (
          <ReportsView
            lang={lang}
            bilingual={bilingual}
            showToast={showToast}
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
            <header className="sticky top-0 left-0 right-0 z-50 glass-header px-4 py-3.5 flex items-center justify-between">
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
    </div>
  );
}
