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
  ownerId?: string;
  ownerEmail?: string;
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
  ownerId?: string;
  ownerEmail?: string;
  workerId: string;
  date: string; // YYYY-MM-DD
  status: 'present' | 'absent' | 'half_day';
  createdAt?: string;
}

export interface Payment {
  id: string;
  ownerId?: string;
  ownerEmail?: string;
  workerId: string;
  amount: number;
  date: string; // YYYY-MM-DD
  note: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  ownerId?: string;
  ownerEmail?: string;
  category: 'Labor' | 'Seeds' | 'Fertilizer' | 'Diesel' | 'Tractor' | 'Transport' | 'Equipment' | 'Others';
  amount: number;
  description: string;
  notes: string;
  date: string; // YYYY-MM-DD;
  createdAt: string;
}

export interface EmailRecipients {
  fatherEmail: string;
  familyEmail: string;
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
  const saved = localStorage.getItem('paramesh_firebase_config');
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
// 2. Mock Data Seeding (Empty for production)
// ----------------------------------------------------
const INITIAL_WORKERS: Worker[] = [];
const INITIAL_EXPENSES: Expense[] = [];
const INITIAL_PAYMENTS: Payment[] = [];

// Seed initial mock data if not exists
const initializeLocalStorage = () => {
  if (!localStorage.getItem('paramesh_workers')) {
    localStorage.setItem('paramesh_workers', JSON.stringify([]));
  }
  if (!localStorage.getItem('paramesh_expenses')) {
    localStorage.setItem('paramesh_expenses', JSON.stringify([]));
  }
  if (!localStorage.getItem('paramesh_payments')) {
    localStorage.setItem('paramesh_payments', JSON.stringify([]));
  }
  if (!localStorage.getItem('paramesh_attendance')) {
    localStorage.setItem('paramesh_attendance', JSON.stringify([]));
  }
};

initializeLocalStorage();

// Reset all mock data to empty values
export const resetMockData = () => {
  localStorage.setItem('paramesh_workers', JSON.stringify([]));
  localStorage.setItem('paramesh_expenses', JSON.stringify([]));
  localStorage.setItem('paramesh_payments', JSON.stringify([]));
  localStorage.setItem('paramesh_attendance', JSON.stringify([]));
  localStorage.removeItem('paramesh_weekly_emails');
};

// Clear all database data completely
export const clearAllDatabaseData = async (): Promise<void> => {
  if (isMockMode) {
    localStorage.setItem('paramesh_skip_seed', 'true');
    localStorage.setItem('paramesh_workers', JSON.stringify([]));
    localStorage.setItem('paramesh_expenses', JSON.stringify([]));
    localStorage.setItem('paramesh_payments', JSON.stringify([]));
    localStorage.setItem('paramesh_attendance', JSON.stringify([]));
    localStorage.removeItem('paramesh_weekly_emails');
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

// Helpers to get active user details
export const getCurrentUserId = (): string => {
  if (isMockMode) {
    const user = getMockCurrentUser();
    return user ? user.uid : 'mock_farmer_uid';
  }
  return auth?.currentUser?.uid || 'mock_farmer_uid';
};

export const getCurrentUserEmail = (): string => {
  if (isMockMode) {
    const user = getMockCurrentUser();
    return user ? user.email : 'farmer@agribook.com';
  }
  return auth?.currentUser?.email || 'farmer@agribook.com';
};

// Workers CRUD
export const fetchWorkers = async (): Promise<Worker[]> => {
  const uid = getCurrentUserId();
  if (isMockMode) {
    return getMockData('paramesh_workers').filter((w: any) => w.ownerId === uid);
  }
  const q = query(collection(db, 'workers'), where('ownerId', '==', uid));
  const querySnapshot = await getDocs(q);
  const workers: Worker[] = [];
  querySnapshot.forEach((doc) => {
    workers.push({ id: doc.id, ...doc.data() } as Worker);
  });
  return workers;
};

export const createWorker = async (worker: Omit<Worker, 'id' | 'createdAt'>): Promise<string> => {
  const createdAt = new Date().toISOString();
  const uid = getCurrentUserId();
  const email = getCurrentUserEmail();
  if (isMockMode) {
    const workers = getMockData('paramesh_workers');
    const newId = 'w_' + Math.random().toString(36).substr(2, 9);
    const newWorker = { id: newId, ...worker, createdAt, ownerId: uid, ownerEmail: email } as any;
    workers.push(newWorker);
    setMockData('paramesh_workers', workers);
    return newId;
  }
  const docRef = await addDoc(collection(db, 'workers'), { ...worker, createdAt, ownerId: uid, ownerEmail: email });
  return docRef.id;
};

export const editWorker = async (id: string, worker: Partial<Worker>): Promise<void> => {
  if (isMockMode) {
    const workers = getMockData('paramesh_workers');
    const index = workers.findIndex(w => w.id === id);
    if (index !== -1) {
      workers[index] = { ...workers[index], ...worker };
      setMockData('paramesh_workers', workers);
    }
    return;
  }
  const docRef = doc(db, 'workers', id);
  await updateDoc(docRef, worker as DocumentData);
};

export const removeWorker = async (id: string): Promise<void> => {
  if (isMockMode) {
    const workers = getMockData('paramesh_workers');
    const updated = workers.filter(w => w.id !== id);
    setMockData('paramesh_workers', updated);
    
    // Clean up attendance and payments
    const att = getMockData('paramesh_attendance').filter((a: any) => a.workerId !== id);
    setMockData('paramesh_attendance', att);
    const pay = getMockData('paramesh_payments').filter((p: any) => p.workerId !== id);
    setMockData('paramesh_payments', pay);
    return;
  }
  await deleteDoc(doc(db, 'workers', id));
};

// Attendance
export const fetchAttendanceByDate = async (date: string): Promise<AttendanceRecord[]> => {
  const uid = getCurrentUserId();
  if (isMockMode) {
    const att = getMockData('paramesh_attendance');
    return att.filter((a: AttendanceRecord) => a.date === date && (a as any).ownerId === uid);
  }
  const q = query(
    collection(db, 'attendance'), 
    where('date', '==', date),
    where('ownerId', '==', uid)
  );
  const querySnapshot = await getDocs(q);
  const records: AttendanceRecord[] = [];
  querySnapshot.forEach((doc) => {
    records.push({ id: doc.id, ...doc.data() } as AttendanceRecord);
  });
  return records;
};

export const fetchAttendance = async (): Promise<AttendanceRecord[]> => {
  const uid = getCurrentUserId();
  if (isMockMode) {
    return getMockData('paramesh_attendance').filter((a: any) => a.ownerId === uid);
  }
  const q = query(collection(db, 'attendance'), where('ownerId', '==', uid));
  const querySnapshot = await getDocs(q);
  const records: AttendanceRecord[] = [];
  querySnapshot.forEach((doc) => {
    records.push({ id: doc.id, ...doc.data() } as AttendanceRecord);
  });
  return records;
};

export const saveAttendanceList = async (date: string, records: Omit<AttendanceRecord, 'id'>[]): Promise<void> => {
  const uid = getCurrentUserId();
  const email = getCurrentUserEmail();
  if (isMockMode) {
    const att = getMockData('paramesh_attendance');
    for (const r of records) {
      const docId = `att_${r.workerId}_${date}`;
      const index = att.findIndex((a: any) => a.id === docId || (a.workerId === r.workerId && a.date === date));
      if (index !== -1) {
        att[index] = { ...att[index], status: r.status };
      } else {
        att.push({ ...r, id: docId, ownerId: uid, ownerEmail: email });
      }
    }
    setMockData('paramesh_attendance', att);
    return;
  }
  
  // For Firestore, we can do setDoc with custom id (workerId_date) to ensure uniqueness and overwrite status
  for (const r of records) {
    const docId = `${r.workerId}_${date}`;
    const docRef = doc(db, 'attendance', docId);
    await setDoc(docRef, { ...r, ownerId: uid, ownerEmail: email });
  }
};

// Payments
export const fetchPayments = async (): Promise<Payment[]> => {
  const uid = getCurrentUserId();
  if (isMockMode) {
    return getMockData('paramesh_payments').filter((p: any) => p.ownerId === uid);
  }
  const q = query(collection(db, 'payments'), where('ownerId', '==', uid));
  const querySnapshot = await getDocs(q);
  const payments: Payment[] = [];
  querySnapshot.forEach((doc) => {
    payments.push({ id: doc.id, ...doc.data() } as Payment);
  });
  return payments;
};

export const createPayment = async (payment: Omit<Payment, 'id' | 'createdAt'>): Promise<string> => {
  const createdAt = new Date().toISOString();
  const uid = getCurrentUserId();
  const email = getCurrentUserEmail();
  if (isMockMode) {
    const payments = getMockData('paramesh_payments');
    const newId = 'p_' + Math.random().toString(36).substr(2, 9);
    const newPayment = { id: newId, ...payment, createdAt, ownerId: uid, ownerEmail: email } as any;
    payments.push(newPayment);
    setMockData('paramesh_payments', payments);
    return newId;
  }
  const docRef = await addDoc(collection(db, 'payments'), { ...payment, createdAt, ownerId: uid, ownerEmail: email });
  return docRef.id;
};

export const editPayment = async (id: string, payment: Partial<Payment>): Promise<void> => {
  if (isMockMode) {
    const payments = getMockData('paramesh_payments');
    const index = payments.findIndex(p => p.id === id);
    if (index !== -1) {
      payments[index] = { ...payments[index], ...payment };
      setMockData('paramesh_payments', payments);
    }
    return;
  }
  const docRef = doc(db, 'payments', id);
  await updateDoc(docRef, payment as DocumentData);
};

export const removePayment = async (id: string): Promise<void> => {
  if (isMockMode) {
    const payments = getMockData('paramesh_payments');
    const updated = payments.filter(p => p.id !== id);
    setMockData('paramesh_payments', updated);
    return;
  }
  await deleteDoc(doc(db, 'payments', id));
};

// Expenses
export const fetchExpenses = async (): Promise<Expense[]> => {
  const uid = getCurrentUserId();
  if (isMockMode) {
    return getMockData('paramesh_expenses').filter((e: any) => e.ownerId === uid);
  }
  const q = query(collection(db, 'expenses'), where('ownerId', '==', uid));
  const querySnapshot = await getDocs(q);
  const expenses: Expense[] = [];
  querySnapshot.forEach((doc) => {
    expenses.push({ id: doc.id, ...doc.data() } as Expense);
  });
  return expenses;
};

export const createExpense = async (expense: Omit<Expense, 'id' | 'createdAt'>): Promise<string> => {
  const createdAt = new Date().toISOString();
  const uid = getCurrentUserId();
  const email = getCurrentUserEmail();
  if (isMockMode) {
    const expenses = getMockData('paramesh_expenses');
    const newId = 'e_' + Math.random().toString(36).substr(2, 9);
    const newExpense = { id: newId, ...expense, createdAt, ownerId: uid, ownerEmail: email } as any;
    expenses.push(newExpense);
    setMockData('paramesh_expenses', expenses);
    return newId;
  }
  const docRef = await addDoc(collection(db, 'expenses'), { ...expense, createdAt, ownerId: uid, ownerEmail: email });
  return docRef.id;
};

export const editExpense = async (id: string, expense: Partial<Expense>): Promise<void> => {
  if (isMockMode) {
    const expenses = getMockData('paramesh_expenses');
    const index = expenses.findIndex(e => e.id === id);
    if (index !== -1) {
      expenses[index] = { ...expenses[index], ...expense };
      setMockData('paramesh_expenses', expenses);
    }
    return;
  }
  const docRef = doc(db, 'expenses', id);
  await updateDoc(docRef, expense as DocumentData);
};

export const removeExpense = async (id: string): Promise<void> => {
  if (isMockMode) {
    const expenses = getMockData('paramesh_expenses');
    const updated = expenses.filter(e => e.id !== id);
    setMockData('paramesh_expenses', updated);
    return;
  }
  await deleteDoc(doc(db, 'expenses', id));
};

// Attendance CRUD addition
export const editAttendance = async (id: string, record: Partial<AttendanceRecord>): Promise<void> => {
  if (isMockMode) {
    const att = getMockData('paramesh_attendance');
    const index = att.findIndex((a: any) => a.id === id || a.id === `att_${id}` || (id.includes('_') && a.workerId === id.split('_')[0] && a.date === id.split('_')[1]));
    if (index !== -1) {
      att[index] = { ...att[index], ...record };
      setMockData('paramesh_attendance', att);
    }
    return;
  }
  const docRef = doc(db, 'attendance', id);
  await updateDoc(docRef, record as DocumentData);
};

export const removeAttendance = async (id: string): Promise<void> => {
  if (isMockMode) {
    const att = getMockData('paramesh_attendance');
    const updated = att.filter((a: any) => a.id !== id);
    setMockData('paramesh_attendance', updated);
    return;
  }
  await deleteDoc(doc(db, 'attendance', id));
};

// Email Recipients Firestore Helpers
export const fetchEmailRecipients = async (): Promise<EmailRecipients | null> => {
  const uid = getCurrentUserId();
  if (isMockMode) {
    const list = JSON.parse(localStorage.getItem('paramesh_email_recipients') || '[]');
    const found = list.find((item: any) => item.ownerId === uid);
    return found ? { fatherEmail: found.fatherEmail, familyEmail: found.familyEmail } : null;
  }
  const q = query(collection(db, 'emailRecipients'), where('ownerId', '==', uid));
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    return null;
  }
  const docData = snapshot.docs[0].data();
  return {
    fatherEmail: docData.fatherEmail || '',
    familyEmail: docData.familyEmail || ''
  };
};

export const saveEmailRecipients = async (recipients: EmailRecipients): Promise<void> => {
  const uid = getCurrentUserId();
  const email = getCurrentUserEmail();
  if (isMockMode) {
    const list = JSON.parse(localStorage.getItem('paramesh_email_recipients') || '[]');
    const index = list.findIndex((item: any) => item.ownerId === uid);
    const newItem = { ownerId: uid, ownerEmail: email, ...recipients };
    if (index !== -1) {
      list[index] = newItem;
    } else {
      list.push(newItem);
    }
    localStorage.setItem('paramesh_email_recipients', JSON.stringify(list));
    return;
  }
  
  const q = query(collection(db, 'emailRecipients'), where('ownerId', '==', uid));
  const snapshot = await getDocs(q);
  if (!snapshot.empty) {
    const docRef = doc(db, 'emailRecipients', snapshot.docs[0].id);
    await updateDoc(docRef, { ...recipients, ownerEmail: email });
  } else {
    await addDoc(collection(db, 'emailRecipients'), {
      ownerId: uid,
      ownerEmail: email,
      ...recipients
    });
  }
};

// ----------------------------------------------------
// 4. Mock & Real Authentication Helpers
// ----------------------------------------------------
export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
}

export const mockSignIn = async (email: string, isGoogle = false): Promise<AppUser> => {
  const cleanedEmail = (email || '').trim();
  const namePart = cleanedEmail ? cleanedEmail.split('@')[0] : 'farmer';
  const capitalizedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
  
  const user: AppUser = {
    uid: isGoogle ? 'google_' + Math.random().toString(36).substr(2, 9) : 'email_' + Math.random().toString(36).substr(2, 9),
    email: cleanedEmail || 'farmer@agribook.com',
    displayName: isGoogle ? 'Google Farmer' : capitalizedName,
    photoURL: isGoogle ? 'https://lh3.googleusercontent.com/a/default-user' : undefined
  };
  localStorage.setItem('paramesh_mock_user', JSON.stringify(user));
  return user;
};

export const mockSignOut = async (): Promise<void> => {
  localStorage.removeItem('paramesh_mock_user');
};

export const getMockCurrentUser = (): AppUser | null => {
  const saved = localStorage.getItem('paramesh_mock_user');
  return saved ? JSON.parse(saved) : null;
};

export const signInWithGoogle = async (): Promise<AppUser> => {
  if (isMockMode) {
    return mockSignIn('paramesh@agribook.com', true);
  }
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: 'select_account'
  });
  const result = await signInWithPopup(auth, provider);
  return {
    uid: result.user.uid,
    email: result.user.email || '',
    displayName: result.user.displayName || 'Google User',
    photoURL: result.user.photoURL || undefined
  };
};

export const signInWithEmail = async (email: string, password: string): Promise<AppUser> => {
  if (isMockMode) {
    return mockSignIn(email, false);
  }
  const result = await signInWithEmailAndPassword(auth, email, password);
  return {
    uid: result.user.uid,
    email: result.user.email || '',
    displayName: result.user.displayName || email.split('@')[0],
    photoURL: result.user.photoURL || undefined
  };
};

export const logoutUser = async (): Promise<void> => {
  if (isMockMode) {
    await mockSignOut();
    return;
  }
  await signOut(auth);
};

export const subscribeToAuthChanges = (callback: (user: AppUser | null) => void) => {
  if (isMockMode) {
    callback(getMockCurrentUser());
    return () => {};
  }
  return onAuthStateChanged(auth, (firebaseUser) => {
    if (firebaseUser) {
      callback({
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName || 'Google User',
        photoURL: firebaseUser.photoURL || undefined
      });
    } else {
      callback(null);
    }
  });
};

