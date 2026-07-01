import React from 'react';
import { 
  Globe, 
  Mail, 
  RotateCcw, 
  LogOut, 
  Save, 
  User,
  Info,
  Database,
  CheckCircle2,
  AlertTriangle,
  Key,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { logoutUser, isMockMode, resetMockData, clearAllDatabaseData, fetchEmailRecipients, saveEmailRecipients } from '../firebase';
import { t, subT, Language } from '../utils/translation';

interface ProfileViewProps {
  lang: Language;
  bilingual: boolean;
  onLanguageChange: (lang: Language) => void;
  onBilingualChange: (val: boolean) => void;
  onLogout: () => void;
  showToast: (message: string, type: 'success' | 'error') => void;
  currentUser: { displayName: string; email: string } | null;
}

// Email Draft Preview Modal
const EmailPreviewModal: React.FC<{ html: string | null; onClose: () => void }> = ({ html, onClose }) => {
  return (
    <AnimatePresence>
      {html && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white w-full max-w-2xl h-[80vh] rounded-3xl p-6 shadow-premium relative flex flex-col gap-4 border border-[#E0DBC5]"
          >
            <div className="flex justify-between items-center shrink-0">
              <h3 className="text-lg font-bold text-text-dark">Email Draft Preview</h3>
              <button 
                onClick={onClose}
                className="p-1.5 bg-gray-100 rounded-full text-gray-500 active:scale-90 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 border border-[#E0DBC5]/50 rounded-2xl overflow-hidden bg-white">
              <iframe 
                srcDoc={html} 
                title="Email HTML Preview" 
                className="w-full h-full border-none"
              />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export const ProfileView: React.FC<ProfileViewProps> = ({
  lang,
  bilingual,
  onLanguageChange,
  onBilingualChange,
  onLogout,
  showToast,
  currentUser
}) => {
  // Weekly emails (read/write to settings)
  const [fatherEmail, setFatherEmail] = React.useState('');
  const [familyEmail, setFamilyEmail] = React.useState('');
  const [adminEmail, setAdminEmail] = React.useState('');
  const [senderEmail, setSenderEmail] = React.useState('onboarding@resend.dev');

  // API Keys configurations
  const [geminiKey, setGeminiKey] = React.useState('');
  const [resendKey, setResendKey] = React.useState('');

  // Firebase Config configurations
  const [firebaseApiKey, setFirebaseApiKey] = React.useState('');
  const [firebaseProjectId, setFirebaseProjectId] = React.useState('');
  const [firebaseAuthDomain, setFirebaseAuthDomain] = React.useState('');
  const [firebaseStorageBucket, setFirebaseStorageBucket] = React.useState('');
  const [firebaseMessagingSenderId, setFirebaseMessagingSenderId] = React.useState('');
  const [firebaseAppId, setFirebaseAppId] = React.useState('');

  // Weekly email logs
  interface EmailLog {
    date: string;
    weekRange: string;
    recipients: string[];
    html: string;
    success: boolean;
    simulated?: boolean;
  }
  const [emailLogs, setEmailLogs] = React.useState<EmailLog[]>([]);
  const [selectedLogHtml, setSelectedLogHtml] = React.useState<string | null>(null);

  React.useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const settingsStr = localStorage.getItem('paramesh_settings');
    let admin = '';
    let sender = 'onboarding@resend.dev';
    let gKey = '';
    let rKey = '';
    if (settingsStr) {
      try {
        const parsed = JSON.parse(settingsStr);
        admin = parsed.adminEmail || '';
        sender = parsed.senderEmail || 'onboarding@resend.dev';
        gKey = parsed.geminiKey || '';
        rKey = parsed.resendKey || '';
      } catch (e) {}
    }
    setAdminEmail(admin);
    setSenderEmail(sender);
    setGeminiKey(gKey);
    setResendKey(rKey);

    // Load Firebase Config from localStorage
    const configStr = localStorage.getItem('paramesh_firebase_config');
    if (configStr) {
      try {
        const parsed = JSON.parse(configStr);
        setFirebaseApiKey(parsed.apiKey || '');
        setFirebaseProjectId(parsed.projectId || '');
        setFirebaseAuthDomain(parsed.authDomain || '');
        setFirebaseStorageBucket(parsed.storageBucket || '');
        setFirebaseMessagingSenderId(parsed.messagingSenderId || '');
        setFirebaseAppId(parsed.appId || '');
      } catch (e) {}
    }

    const logs = JSON.parse(localStorage.getItem('paramesh_weekly_emails') || '[]');
    setEmailLogs(logs);

    try {
      const dbRecipients = await fetchEmailRecipients();
      const father = dbRecipients ? dbRecipients.fatherEmail : '';
      const family = dbRecipients ? dbRecipients.familyEmail : '';
      setFatherEmail(father);
      setFamilyEmail(family);

      // Sync local storage for resend service configuration
      const updatedLocal = settingsStr ? JSON.parse(settingsStr) : {};
      updatedLocal.fatherEmail = father;
      updatedLocal.familyEmail = family;
      localStorage.setItem('paramesh_settings', JSON.stringify(updatedLocal));
    } catch (e) {
      console.error("Failed to load recipients from Firestore:", e);
    }
  };

  const handleSaveRecipients = async () => {
    try {
      await saveEmailRecipients({
        fatherEmail: fatherEmail.trim(),
        familyEmail: familyEmail.trim()
      });

      const savedSettings = localStorage.getItem('paramesh_settings');
      let parsedSettings = {};
      if (savedSettings) {
        try {
          parsedSettings = JSON.parse(savedSettings);
        } catch (e) {}
      }

      const updated = {
        ...parsedSettings,
        fatherEmail: fatherEmail.trim(),
        familyEmail: familyEmail.trim(),
        adminEmail: adminEmail.trim(),
        senderEmail: senderEmail.trim()
      };

      localStorage.setItem('paramesh_settings', JSON.stringify(updated));
      showToast("Recipients updated successfully!", "success");
    } catch (e) {
      showToast("Failed to save recipients", "error");
    }
  };

  const handleSaveApiKeys = async () => {
    try {
      const savedSettings = localStorage.getItem('paramesh_settings');
      let parsedSettings = {};
      if (savedSettings) {
        try {
          parsedSettings = JSON.parse(savedSettings);
        } catch (e) {}
      }

      const updated = {
        ...parsedSettings,
        geminiKey: geminiKey.trim(),
        resendKey: resendKey.trim()
      };

      localStorage.setItem('paramesh_settings', JSON.stringify(updated));
      showToast("API keys updated successfully!", "success");
    } catch (e) {
      showToast("Failed to save API keys", "error");
    }
  };

  const handleLogoutAction = async () => {
    if (window.confirm("Logout from AgriBook?")) {
      await logoutUser();
      onLogout();
    }
  };

  const handleSaveFirebaseConfig = () => {
    if (!firebaseApiKey.trim() || !firebaseProjectId.trim()) {
      showToast("API Key and Project ID are required", "error");
      return;
    }
    const config = {
      apiKey: firebaseApiKey.trim(),
      projectId: firebaseProjectId.trim(),
      authDomain: firebaseAuthDomain.trim(),
      storageBucket: firebaseStorageBucket.trim(),
      messagingSenderId: firebaseMessagingSenderId.trim(),
      appId: firebaseAppId.trim()
    };
    localStorage.setItem('paramesh_firebase_config', JSON.stringify(config));
    showToast("Firebase Config saved! Reloading to connect...", "success");
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  const handleClearFirebaseConfig = () => {
    localStorage.removeItem('paramesh_firebase_config');
    setFirebaseApiKey('');
    setFirebaseProjectId('');
    setFirebaseAuthDomain('');
    setFirebaseStorageBucket('');
    setFirebaseMessagingSenderId('');
    setFirebaseAppId('');
    showToast("Reset to Mock Mode. Reloading page...", "success");
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  return (
    <div className="flex-1 p-4 pb-24 overflow-y-auto no-scrollbar space-y-5">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-extrabold text-text-dark">
          {bilingual ? `${t('profile', lang)} / ${subT('profile', lang)}` : t('profile', lang)}
        </h1>
        <p className="text-xs text-gray-400 font-semibold mt-1">
          App configuration and user settings
        </p>
      </div>

      {/* User Information */}
      <div className="bg-white p-5 rounded-3xl border border-[#E0DBC5]/40 shadow-soft flex items-center gap-4">
        <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center shrink-0">
          <User size={28} className="text-primary" />
        </div>
        <div className="overflow-hidden">
          <h2 className="text-lg font-bold text-text-dark leading-tight truncate">
            {currentUser?.displayName || 'Paramesh Kumar'}
          </h2>
          <span className="text-xs text-gray-400 font-semibold block mt-1 truncate">
            {currentUser?.email || 'paramesh@agribook.com'}
          </span>
        </div>
      </div>

      {/* Cloud Backup Status */}
      <div className="bg-white p-5 rounded-3xl border border-[#E0DBC5]/40 shadow-soft space-y-3">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1 flex items-center gap-1.5">
          <Database size={14} className="text-gray-400" />
          {t('cloudBackupStatus', lang)}
        </h3>
        
        <div className={`p-4 rounded-2xl border flex items-start gap-3 ${
          isMockMode 
            ? 'bg-amber-50/30 border-amber-200/50 text-amber-800' 
            : 'bg-success-green/5 border-success-green/20 text-primary'
        }`}>
          {isMockMode ? (
            <>
              <AlertTriangle className="shrink-0 text-accent mt-0.5" size={18} />
              <div>
                <span className="text-sm font-bold block">{t('cloudBackupOffline', lang)}</span>
                <span className="text-[10px] text-gray-500 font-medium block mt-1 leading-snug">
                  Running offline demo ledger. Set background configurations to sync to Cloud.
                </span>
              </div>
            </>
          ) : (
            <>
              <CheckCircle2 className="shrink-0 text-success-green mt-0.5" size={18} />
              <div>
                <span className="text-sm font-bold block">{t('cloudBackupConnected', lang)}</span>
                <span className="text-[10px] text-gray-500 font-medium block mt-1 leading-snug">
                  All farm records are automatically backed up securely to your Firestore database.
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Firebase Cloud Configuration */}
      <div className="bg-white p-5 rounded-3xl border border-[#E0DBC5]/45 shadow-soft space-y-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1 flex items-center gap-1.5">
          <Database size={14} className="text-primary" />
          {bilingual ? 'Firebase Setup / ఫైర్‌బేస్ కనెక్ట్' : 'Firebase Cloud Setup'}
        </h3>

        <div className="space-y-3">
          <p className="text-[10px] text-gray-400 font-semibold leading-normal pl-1">
            Enter your Firebase project credentials to sync your data live to the cloud. Leave blank to use offline Mock Mode.
          </p>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1 col-span-2">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider pl-1">API Key</label>
              <input
                type="password"
                value={firebaseApiKey}
                onChange={(e) => setFirebaseApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="form-input text-xs"
              />
            </div>
            
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider pl-1">Project ID</label>
              <input
                type="text"
                value={firebaseProjectId}
                onChange={(e) => setFirebaseProjectId(e.target.value)}
                placeholder="my-project-123"
                className="form-input text-xs"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider pl-1">Auth Domain</label>
              <input
                type="text"
                value={firebaseAuthDomain}
                onChange={(e) => setFirebaseAuthDomain(e.target.value)}
                placeholder="my-project-123.firebaseapp.com"
                className="form-input text-xs"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider pl-1">Storage Bucket</label>
              <input
                type="text"
                value={firebaseStorageBucket}
                onChange={(e) => setFirebaseStorageBucket(e.target.value)}
                placeholder="my-project-123.appspot.com"
                className="form-input text-xs"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider pl-1">Messaging Sender ID</label>
              <input
                type="text"
                value={firebaseMessagingSenderId}
                onChange={(e) => setFirebaseMessagingSenderId(e.target.value)}
                placeholder="8562145789"
                className="form-input text-xs"
              />
            </div>

            <div className="flex flex-col gap-1 col-span-2">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider pl-1">App ID</label>
              <input
                type="text"
                value={firebaseAppId}
                onChange={(e) => setFirebaseAppId(e.target.value)}
                placeholder="1:8562145789:web:a1b2c3d4e5"
                className="form-input text-xs"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleClearFirebaseConfig}
              className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-2xl active:scale-95 text-xs transition-all cursor-pointer"
            >
              Reset to Mock Mode
            </button>
            <button
              type="button"
              onClick={handleSaveFirebaseConfig}
              className="flex-1 py-3 bg-primary text-white font-bold rounded-2xl active:scale-95 text-xs shadow-soft transition-all cursor-pointer flex items-center justify-center gap-1"
            >
              <Save size={14} />
              Connect Cloud
            </button>
          </div>
        </div>
      </div>

      {/* Language Settings */}
      <div className="bg-white p-5 rounded-3xl border border-[#E0DBC5]/40 shadow-soft space-y-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1 flex items-center gap-1.5">
          <Globe size={14} className="text-gray-400" />
          {t('languageSelect', lang)}
        </h3>

        {/* English / Telugu Toggle */}
        <div className="flex bg-[#F8F5E9] p-1 rounded-2xl border border-[#E0DBC5]/50">
          <button
            onClick={() => onLanguageChange('en')}
            className={`flex-1 py-3 text-xs font-extrabold rounded-xl transition-all cursor-pointer ${
              lang === 'en' ? 'bg-primary text-white shadow-sm' : 'text-gray-500'
            }`}
          >
            English
          </button>
          <button
            onClick={() => onLanguageChange('te')}
            className={`flex-1 py-3 text-xs font-extrabold rounded-xl transition-all cursor-pointer ${
              lang === 'te' ? 'bg-primary text-white shadow-sm' : 'text-gray-500'
            }`}
          >
            తెలుగు (Telugu)
          </button>
        </div>

        {/* Bilingual Mode Toggle */}
        <div className="flex items-center justify-between pt-1 border-t border-gray-50">
          <div>
            <span className="text-xs font-bold text-text-dark block">
              Bilingual Labels
            </span>
            <span className="text-[10px] text-gray-400 font-semibold block mt-0.5">
              Show English + Telugu labels side-by-side
            </span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={bilingual}
              onChange={(e) => onBilingualChange(e.target.checked)}
              className="sr-only peer" 
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:height-5 after:width-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>
      </div>

      {/* API Key Configurations */}
      <div className="bg-white p-5 rounded-3xl border border-[#E0DBC5]/40 shadow-soft space-y-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1 flex items-center gap-1.5">
          <Key size={14} className="text-gray-400" />
          {bilingual ? 'API Configuration / API కాన్ఫిగరేషన్' : 'API Configuration'}
        </h3>

        <div className="space-y-3">
          {/* Gemini Key */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider pl-1">
              {t('geminiKeyTitle', lang)}
            </label>
            <input
              type="password"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder="Enter Gemini API Key"
              className="form-input"
            />
          </div>

          {/* Resend Key */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider pl-1">
              {t('resendKeyTitle', lang)}
            </label>
            <input
              type="password"
              value={resendKey}
              onChange={(e) => setResendKey(e.target.value)}
              placeholder="Enter Resend API Key"
              className="form-input"
            />
          </div>

          <button
            onClick={handleSaveApiKeys}
            className="w-full py-3.5 bg-primary text-white font-bold rounded-2xl active:scale-95 shadow-soft text-sm transition-all cursor-pointer flex items-center justify-center gap-1.5 mt-2"
          >
            <Save size={16} />
            Save API Keys
          </button>
        </div>
      </div>

      {/* Weekly Email Recipients */}
      <div className="bg-white p-5 rounded-3xl border border-[#E0DBC5]/40 shadow-soft space-y-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1 flex items-center gap-1.5">
          <Mail size={14} className="text-gray-400" />
          {t('recipientsTitle', lang)}
        </h3>

        <div className="space-y-3">
          {/* Father Email */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider pl-1">
              {t('fatherEmail', lang)}
            </label>
            <input
              type="email"
              value={fatherEmail}
              onChange={(e) => setFatherEmail(e.target.value)}
              placeholder="Enter email address"
              className="form-input"
            />
          </div>

          {/* Family Member Email */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider pl-1">
              {t('familyEmail', lang)}
            </label>
            <input
              type="email"
              value={familyEmail}
              onChange={(e) => setFamilyEmail(e.target.value)}
              placeholder="Enter email address"
              className="form-input"
            />
          </div>

          {/* Admin Email */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider pl-1">
              {t('adminEmail', lang)}
            </label>
            <input
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="Enter email address"
              className="form-input"
            />
          </div>

          <button
            onClick={handleSaveRecipients}
            className="w-full py-3.5 bg-primary text-white font-bold rounded-2xl active:scale-95 shadow-soft text-sm transition-all cursor-pointer flex items-center justify-center gap-1.5 mt-2"
          >
            <Save size={16} />
            Save Recipients
          </button>
        </div>
      </div>

      {/* Reports Sent Log */}
      <div className="bg-white p-5 rounded-3xl border border-[#E0DBC5]/40 shadow-soft space-y-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1 flex items-center gap-1.5">
          <Mail size={14} className="text-gray-400" />
          {bilingual ? 'Reports Sent / పంపిన నివేదికలు' : 'Reports Sent Log'}
        </h3>

        {emailLogs.length === 0 ? (
          <p className="text-xs text-gray-400 pl-1">No reports sent yet.</p>
        ) : (
          <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
            {emailLogs.map((log, idx) => (
              <div 
                key={idx}
                className="p-3 bg-[#F8F5E9]/50 border border-[#E0DBC5]/30 rounded-2xl flex items-center justify-between text-xs gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-text-dark truncate block leading-tight">
                      {log.weekRange}
                    </span>
                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${
                      log.success 
                        ? 'bg-success-green/10 text-success-green' 
                        : 'bg-danger-red/10 text-danger-red'
                    }`}>
                      {log.success ? (log.simulated ? 'Simulated' : 'Sent') : 'Failed'}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-400 font-semibold block mt-1">
                    To: {log.recipients.join(', ')} • {new Date(log.date).toLocaleDateString()}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedLogHtml(log.html)}
                  className="px-2.5 py-1.5 bg-primary/10 text-primary font-bold text-[10px] rounded-xl active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                >
                  View Draft
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* About Section */}
      <div className="bg-white p-5 rounded-3xl border border-[#E0DBC5]/40 shadow-soft space-y-2">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1 flex items-center gap-1.5">
          <Info size={14} className="text-gray-400" />
          {t('aboutLabel', lang)}
        </h3>
        <p className="text-xs text-gray-500 leading-snug font-medium">
          {t('aboutText', lang)}
        </p>
        {(lang === 'te' || bilingual) && (
          <p className="text-[11px] text-gray-400 leading-snug font-medium italic mt-1.5">
            {t('aboutTextTe', lang)}
          </p>
        )}
      </div>

      {/* App Version */}
      <div className="bg-white p-4 rounded-3xl border border-[#E0DBC5]/40 shadow-soft text-center flex flex-col justify-center">
        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
          {t('appVersionLabel', lang)}
        </span>
        <span className="text-sm font-extrabold text-text-dark block mt-1">
          v1.2.0 (Build 2026)
        </span>
      </div>

      {/* Logout */}
      <div className="pt-2">
        <button
          onClick={handleLogoutAction}
          className="w-full py-4.5 bg-danger-red/10 text-danger-red font-bold rounded-2xl active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 text-sm"
        >
          <LogOut size={18} />
          {t('logout', lang)}
        </button>
      </div>

      {/* Modal Draft Preview */}
      <EmailPreviewModal html={selectedLogHtml} onClose={() => setSelectedLogHtml(null)} />
    </div>
  );
};
