import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  GoogleAuthProvider, 
  signInWithPopup, 
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  setDoc,
  orderBy,
  limit,
  DocumentData
} from 'firebase/firestore';

export interface Worker {
  id: string;
  name: string;
  phone: string;
  village: string;
  dailyWage: number;
  status: 'active' | 'inactive';
  notes: string;
  createdAt: string;
}

export interface AttendanceRecord {
  id?: string;
  workerId: string;
  date: string; // YYYY-MM-DD
  status: 'present' | 'absent';
}

export interface Payment {
  id: string;
  workerId: string;
  amount: number;
  date: string; // YYYY-MM-DD
  note: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  category: 'Labor' | 'Seeds' | 'Fertilizer' | 'Diesel' | 'Tractor' | 'Transport' | 'Equipment' | 'Others';
  amount: number;
  description: string;
  date: string; // YYYY-MM-DD;
  createdAt: string;
}

// ----------------------------------------------------
// 1. Firebase Initialization & Detection
// ----------------------------------------------------
const envConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const getSavedFirebaseConfig = () => {
  const saved = localStorage.getItem('pramesh_firebase_config');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      return null;
    }
  }
  return null;
};

const savedConfig = getSavedFirebaseConfig();
const hasEnvConfig = envConfig.apiKey && envConfig.projectId;
const hasSavedConfig = savedConfig && savedConfig.apiKey && savedConfig.projectId;

let firebaseApp;
let db: any = null;
let auth: any = null;
let isMockMode = true;

if (hasEnvConfig) {
  try {
    firebaseApp = getApps().length === 0 ? initializeApp(envConfig) : getApp();
    db = getFirestore(firebaseApp);
    auth = getAuth(firebaseApp);
    isMockMode = false;
  } catch (e) {
    console.error("Firebase env initialization failed:", e);
  }
} else if (hasSavedConfig) {
  try {
    firebaseApp = getApps().length === 0 ? initializeApp(savedConfig) : getApp();
    db = getFirestore(firebaseApp);
    auth = getAuth(firebaseApp);
    isMockMode = false;
  } catch (e) {
    console.error("Firebase saved config initialization failed:", e);
  }
}

export { isMockMode, auth, db };

// ----------------------------------------------------
// 2. Mock Data Initial Seed
// ----------------------------------------------------
const INITIAL_WORKERS: Worker[] = [
  { id: 'w1', name: 'Ramesh', phone: '9848022338', village: 'Undi', dailyWage: 500, status: 'active', notes: 'Very reliable worker', createdAt: '2026-06-01T10:00:00.000Z' },
  { id: 'w2', name: 'Suresh', phone: '9848099887', village: 'Palakol', dailyWage: 600, status: 'active', notes: 'Tractor driver', createdAt: '2026-06-02T11:00:00.000Z' },
  { id: 'w3', name: 'Ravi', phone: '9900112233', village: 'Bhimavaram', dailyWage: 500, status: 'active', notes: 'Fertilizer expert', createdAt: '2026-06-03T12:00:00.000Z' },
  { id: 'w4', name: 'Lakshmi', phone: '9123456789', village: 'Undi', dailyWage: 450, status: 'active', notes: 'Sowing and harvesting', createdAt: '2026-06-04T09:00:00.000Z' },
  { id: 'w5', name: 'Anitha', phone: '9876543210', village: 'Kalla', dailyWage: 450, status: 'active', notes: 'Sowing expert', createdAt: '2026-06-05T09:30:00.000Z' }
];

const INITIAL_EXPENSES: Expense[] = [
  { id: 'e1', category: 'Diesel', amount: 1500, description: 'Tractor fuel', date: '2026-06-23', createdAt: '2026-06-23T08:00:00.000Z' },
  { id: 'e2', category: 'Seeds', amount: 4500, description: 'Paddy seeds for season', date: '2026-06-15', createdAt: '2026-06-15T09:00:00.000Z' },
  { id: 'e3', category: 'Fertilizer', amount: 3500, description: 'Urea bags', date: '2026-06-18', createdAt: '2026-06-18T10:00:00.000Z' },
  { id: 'e4', category: 'Tractor', amount: 2500, description: 'Field levelling charges', date: '2026-06-20', createdAt: '2026-06-20T14:00:00.000Z' },
];

const INITIAL_PAYMENTS: Payment[] = [
  { id: 'p1', workerId: 'w1', amount: 2000, date: '2026-06-15', note: 'Paid advance', createdAt: '2026-06-15T18:00:00.000Z' },
  { id: 'p2', workerId: 'w2', amount: 3000, date: '2026-06-16', note: 'Paid for tractor driving', createdAt: '2026-06-16T18:30:00.000Z' },
];

// Seed initial mock data if not exists
const initializeLocalStorage = () => {
  if (localStorage.getItem('pramesh_skip_seed') === 'true') {
    if (!localStorage.getItem('pramesh_workers')) {
      localStorage.setItem('pramesh_workers', JSON.stringify([]));
    }
    if (!localStorage.getItem('pramesh_expenses')) {
      localStorage.setItem('pramesh_expenses', JSON.stringify([]));
    }
    if (!localStorage.getItem('pramesh_payments')) {
      localStorage.setItem('pramesh_payments', JSON.stringify([]));
    }
    if (!localStorage.getItem('pramesh_attendance')) {
      localStorage.setItem('pramesh_attendance', JSON.stringify([]));
    }
    return;
  }

  if (!localStorage.getItem('pramesh_workers')) {
    localStorage.setItem('pramesh_workers', JSON.stringify(INITIAL_WORKERS));
  }
  if (!localStorage.getItem('pramesh_expenses')) {
    localStorage.setItem('pramesh_expenses', JSON.stringify(INITIAL_EXPENSES));
  }
  if (!localStorage.getItem('pramesh_payments')) {
    localStorage.setItem('pramesh_payments', JSON.stringify(INITIAL_PAYMENTS));
  }
  if (!localStorage.getItem('pramesh_attendance')) {
    // Generate some mock attendance records for the past few days
    const attendance: AttendanceRecord[] = [];
    const dates = ['2026-06-20', '2026-06-21', '2026-06-22'];
    dates.forEach(d => {
      INITIAL_WORKERS.forEach(w => {
        // 80% presence rate
        attendance.push({
          workerId: w.id,
          date: d,
          status: Math.random() > 0.2 ? 'present' : 'absent'
        });
      });
    });
    localStorage.setItem('pramesh_attendance', JSON.stringify(attendance));
  }
};

initializeLocalStorage();

// Reset all mock data to initial values
export const resetMockData = () => {
  localStorage.removeItem('pramesh_skip_seed');
  localStorage.setItem('pramesh_workers', JSON.stringify(INITIAL_WORKERS));
  localStorage.setItem('pramesh_expenses', JSON.stringify(INITIAL_EXPENSES));
  localStorage.setItem('pramesh_payments', JSON.stringify(INITIAL_PAYMENTS));
  // Re-seed attendance
  const attendance: AttendanceRecord[] = [];
  const dates = ['2026-06-20', '2026-06-21', '2026-06-22'];
  dates.forEach(d => {
    INITIAL_WORKERS.forEach(w => {
      attendance.push({
        workerId: w.id,
        date: d,
        status: Math.random() > 0.2 ? 'present' : 'absent'
      });
    });
  });
  localStorage.setItem('pramesh_attendance', JSON.stringify(attendance));
  localStorage.removeItem('pramesh_weekly_emails');
};

// Clear all database data completely
export const clearAllDatabaseData = async (): Promise<void> => {
  if (isMockMode) {
    localStorage.setItem('pramesh_skip_seed', 'true');
    localStorage.setItem('pramesh_workers', JSON.stringify([]));
    localStorage.setItem('pramesh_expenses', JSON.stringify([]));
    localStorage.setItem('pramesh_payments', JSON.stringify([]));
    localStorage.setItem('pramesh_attendance', JSON.stringify([]));
    localStorage.removeItem('pramesh_weekly_emails');
    return;
  }

  // Delete all docs in Firestore collections
  const deleteCollectionDocs = async (colName: string) => {
    try {
      const colRef = collection(db, colName);
      const snapshot = await getDocs(colRef);
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
    } catch (e) {
      console.error(`Failed to clear Firestore collection ${colName}:`, e);
      throw e;
    }
  };

  await Promise.all([
    deleteCollectionDocs('workers'),
    deleteCollectionDocs('expenses'),
    deleteCollectionDocs('payments'),
    deleteCollectionDocs('attendance')
  ]);
};

// Helper to get raw mock datasets
const getMockData = (key: string): any[] => {
  return JSON.parse(localStorage.getItem(key) || '[]');
};

const setMockData = (key: string, data: any[]) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// ----------------------------------------------------
// 3. Database Operations Wrapper Interface
// ----------------------------------------------------

// Workers CRUD
export const fetchWorkers = async (): Promise<Worker[]> => {
  if (isMockMode) {
    return getMockData('pramesh_workers');
  }
  const querySnapshot = await getDocs(collection(db, 'workers'));
  const workers: Worker[] = [];
  querySnapshot.forEach((doc) => {
    workers.push({ id: doc.id, ...doc.data() } as Worker);
  });
  return workers;
};

export const createWorker = async (worker: Omit<Worker, 'id' | 'createdAt'>): Promise<string> => {
  const createdAt = new Date().toISOString();
  if (isMockMode) {
    const workers = getMockData('pramesh_workers');
    const newId = 'w_' + Math.random().toString(36).substr(2, 9);
    const newWorker = { id: newId, ...worker, createdAt } as Worker;
    workers.push(newWorker);
    setMockData('pramesh_workers', workers);
    return newId;
  }
  const docRef = await addDoc(collection(db, 'workers'), { ...worker, createdAt });
  return docRef.id;
};

export const editWorker = async (id: string, worker: Partial<Worker>): Promise<void> => {
  if (isMockMode) {
    const workers = getMockData('pramesh_workers');
    const index = workers.findIndex(w => w.id === id);
    if (index !== -1) {
      workers[index] = { ...workers[index], ...worker };
      setMockData('pramesh_workers', workers);
    }
    return;
  }
  const docRef = doc(db, 'workers', id);
  await updateDoc(docRef, worker as DocumentData);
};

export const removeWorker = async (id: string): Promise<void> => {
  if (isMockMode) {
    const workers = getMockData('pramesh_workers');
    const updated = workers.filter(w => w.id !== id);
    setMockData('pramesh_workers', updated);
    
    // Clean up attendance and payments
    const att = getMockData('pramesh_attendance').filter((a: any) => a.workerId !== id);
    setMockData('pramesh_attendance', att);
    const pay = getMockData('pramesh_payments').filter((p: any) => p.workerId !== id);
    setMockData('pramesh_payments', pay);
    return;
  }
  await deleteDoc(doc(db, 'workers', id));
};

// Attendance
export const fetchAttendanceByDate = async (date: string): Promise<AttendanceRecord[]> => {
  if (isMockMode) {
    const att = getMockData('pramesh_attendance');
    return att.filter((a: AttendanceRecord) => a.date === date);
  }
  const q = query(collection(db, 'attendance'), where('date', '==', date));
  const querySnapshot = await getDocs(q);
  const records: AttendanceRecord[] = [];
  querySnapshot.forEach((doc) => {
    records.push({ id: doc.id, ...doc.data() } as AttendanceRecord);
  });
  return records;
};

export const saveAttendanceList = async (date: string, records: Omit<AttendanceRecord, 'id'>[]): Promise<void> => {
  if (isMockMode) {
    let att = getMockData('pramesh_attendance');
    // Remove existing for this date
    att = att.filter((a: AttendanceRecord) => a.date !== date);
    // Add new ones
    records.forEach(r => {
      att.push({ ...r, id: `att_${r.workerId}_${date}` });
    });
    setMockData('pramesh_attendance', att);
    return;
  }
  
  // For Firestore, we can do batch writes or setDoc with custom id (workerId_date) to ensure uniqueness
  for (const r of records) {
    const docId = `${r.workerId}_${date}`;
    const docRef = doc(db, 'attendance', docId);
    await setDoc(docRef, r);
  }
};

// Payments
export const fetchPayments = async (): Promise<Payment[]> => {
  if (isMockMode) {
    return getMockData('pramesh_payments');
  }
  const querySnapshot = await getDocs(collection(db, 'payments'));
  const payments: Payment[] = [];
  querySnapshot.forEach((doc) => {
    payments.push({ id: doc.id, ...doc.data() } as Payment);
  });
  return payments;
};

export const createPayment = async (payment: Omit<Payment, 'id' | 'createdAt'>): Promise<string> => {
  const createdAt = new Date().toISOString();
  if (isMockMode) {
    const payments = getMockData('pramesh_payments');
    const newId = 'p_' + Math.random().toString(36).substr(2, 9);
    const newPayment = { id: newId, ...payment, createdAt } as Payment;
    payments.push(newPayment);
    setMockData('pramesh_payments', payments);
    return newId;
  }
  const docRef = await addDoc(collection(db, 'payments'), { ...payment, createdAt });
  return docRef.id;
};

// Expenses
export const fetchExpenses = async (): Promise<Expense[]> => {
  if (isMockMode) {
    return getMockData('pramesh_expenses');
  }
  const querySnapshot = await getDocs(collection(db, 'expenses'));
  const expenses: Expense[] = [];
  querySnapshot.forEach((doc) => {
    expenses.push({ id: doc.id, ...doc.data() } as Expense);
  });
  return expenses;
};

export const createExpense = async (expense: Omit<Expense, 'id' | 'createdAt'>): Promise<string> => {
  const createdAt = new Date().toISOString();
  if (isMockMode) {
    const expenses = getMockData('pramesh_expenses');
    const newId = 'e_' + Math.random().toString(36).substr(2, 9);
    const newExpense = { id: newId, ...expense, createdAt } as Expense;
    expenses.push(newExpense);
    setMockData('pramesh_expenses', expenses);
    return newId;
  }
  const docRef = await addDoc(collection(db, 'expenses'), { ...expense, createdAt });
  return docRef.id;
};

// ----------------------------------------------------
// 4. Mock Authentication Helper
// ----------------------------------------------------
export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
}

export const mockSignIn = async (email: string, isGoogle = false): Promise<AppUser> => {
  const user: AppUser = {
    uid: isGoogle ? 'google_farmer_123' : 'email_farmer_456',
    email: email || 'pramesh@agribook.com',
    displayName: isGoogle ? 'Pramesh Kumar' : 'Pramesh AgriAdmin',
    photoURL: isGoogle ? 'https://lh3.googleusercontent.com/a/default-user' : undefined
  };
  localStorage.setItem('pramesh_mock_user', JSON.stringify(user));
  return user;
};

export const mockSignOut = async (): Promise<void> => {
  localStorage.removeItem('pramesh_mock_user');
};

export const getMockCurrentUser = (): AppUser | null => {
  const saved = localStorage.getItem('pramesh_mock_user');
  return saved ? JSON.parse(saved) : null;
};
