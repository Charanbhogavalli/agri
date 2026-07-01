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
  getDoc,
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  setDoc,
  orderBy,
  limit,
  writeBatch,
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
  updatedAt?: string;
}

export interface AttendanceRecord {
  id?: string;
  ownerId?: string;
  ownerEmail?: string;
  workerId: string;
  date: string; // YYYY-MM-DD
  status: 'present' | 'absent' | 'half_day';
  wageForDay?: number;
  workType?: string;
  notes?: string;
  cropCycleId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Payment {
  id: string;
  ownerId?: string;
  ownerEmail?: string;
  workerId: string;
  amount: number;
  date: string; // YYYY-MM-DD
  note: string;
  cropCycleId: string;
  createdAt: string;
  updatedAt?: string;
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
  cropCycleId: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CropCycle {
  id: string;
  cropName: string;
  variety: string;
  season: string;
  landName: string;
  area: string;
  irrigationType?: 'Drip' | 'Sprinkler' | 'Flow' | 'Rainfed' | 'Other';
  startDate: string;
  expectedHarvestDate: string;
  actualHarvestDate?: string;
  status: 'active' | 'completed' | 'archived';
  notes: string;
  harvestRevenue?: number;
  harvestYield?: string;
  workerIds?: string[];
  ownerId?: string;
  ownerEmail?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface WorkerCrop {
  id: string;
  workerId: string;
  cropCycleId: string;
  ownerId?: string;
  ownerEmail?: string;
  createdAt: string;
  updatedAt?: string;
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
  if (!localStorage.getItem('paramesh_crop_cycles')) {
    localStorage.setItem('paramesh_crop_cycles', JSON.stringify([]));
  }
  if (!localStorage.getItem('paramesh_worker_crops')) {
    localStorage.setItem('paramesh_worker_crops', JSON.stringify([]));
  }
};

initializeLocalStorage();

// Reset all mock data to empty values
export const resetMockData = () => {
  localStorage.setItem('paramesh_workers', JSON.stringify([]));
  localStorage.setItem('paramesh_expenses', JSON.stringify([]));
  localStorage.setItem('paramesh_payments', JSON.stringify([]));
  localStorage.setItem('paramesh_attendance', JSON.stringify([]));
  localStorage.setItem('paramesh_crop_cycles', JSON.stringify([]));
  localStorage.setItem('paramesh_worker_crops', JSON.stringify([]));
  localStorage.removeItem('paramesh_weekly_emails');
  localStorage.removeItem('paramesh_migration_completed_v3');
};

// Clear all database data completely
export const clearAllDatabaseData = async (): Promise<void> => {
  const uid = getCurrentUserId();
  if (isMockMode) {
    localStorage.setItem('paramesh_skip_seed', 'true');
    localStorage.setItem('paramesh_workers', JSON.stringify([]));
    localStorage.setItem('paramesh_expenses', JSON.stringify([]));
    localStorage.setItem('paramesh_payments', JSON.stringify([]));
    localStorage.setItem('paramesh_attendance', JSON.stringify([]));
    localStorage.setItem('paramesh_crop_cycles', JSON.stringify([]));
    localStorage.setItem('paramesh_worker_crops', JSON.stringify([]));
    localStorage.removeItem('paramesh_weekly_emails');
    localStorage.removeItem('paramesh_migration_completed_v3');
    return;
  }

  // Delete all docs in Firestore collections matching this user's ownerId
  const deleteCollectionDocs = async (colName: string) => {
    try {
      const colRef = collection(db, colName);
      const q = query(colRef, where('ownerId', '==', uid));
      const snapshot = await getDocs(q);
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
    deleteCollectionDocs('attendance'),
    deleteCollectionDocs('cropCycles'),
    deleteCollectionDocs('workerCrops'),
    deleteCollectionDocs('migrations')
  ]);
};

// Helper to get raw mock datasets
const getMockData = (key: string): any[] => {
  return JSON.parse(localStorage.getItem(key) || '[]');
};

const setMockData = (key: string, data: any[]) => {
  localStorage.setItem(key, JSON.stringify(data));
};

export const filterByCrop = <T extends { cropCycleId?: string }>(items: T[], cropId: string): T[] => {
  if (!cropId || cropId === 'all') return items;
  if (cropId === 'legacy' || cropId === 'legacy_crop_2025_2026') return items.filter(item => !item.cropCycleId || item.cropCycleId === 'legacy' || item.cropCycleId === 'legacy_crop_2025_2026');
  return items.filter(item => item.cropCycleId === cropId);
};

// Centralized Wage Calculations
export const calculateWorkerEarnings = (worker: Worker, attendance: AttendanceRecord[]): number => {
  const workerAtt = attendance.filter(a => a.workerId === worker.id);
  const defaultWage = worker ? (typeof worker.dailyWage === 'number' ? worker.dailyWage : parseFloat(worker.dailyWage as any) || 0) : 0;
  return workerAtt.reduce((sum, a) => {
    const rawWage = (a.wageForDay !== undefined && a.wageForDay !== null && (a.wageForDay as any) !== '') ? a.wageForDay : defaultWage;
    const wage = typeof rawWage === 'number' ? rawWage : parseFloat(rawWage as any) || 0;
    if (a.status === 'present') return sum + wage;
    if (a.status === 'half_day') return sum + wage * 0.5;
    return sum;
  }, 0);
};

export const calculateWorkerPayments = (worker: Worker, payments: Payment[]): number => {
  return payments.filter(p => p.workerId === worker.id).reduce((sum, p) => {
    const amt = typeof p.amount === 'number' ? p.amount : parseFloat(p.amount as any) || 0;
    return sum + amt;
  }, 0);
};

export const calculateWorkerPending = (worker: Worker, attendance: AttendanceRecord[], payments: Payment[]): number => {
  const earned = calculateWorkerEarnings(worker, attendance);
  const paid = calculateWorkerPayments(worker, payments);
  return earned - paid;
};

// WorkerCrops CRUD
export const fetchWorkerCrops = async (): Promise<WorkerCrop[]> => {
  const uid = getCurrentUserId();
  if (isMockMode) {
    return getMockData('paramesh_worker_crops').filter((wc: any) => wc.ownerId === uid);
  }
  const q = query(collection(db, 'workerCrops'), where('ownerId', '==', uid));
  const querySnapshot = await getDocs(q);
  const workerCrops: WorkerCrop[] = [];
  querySnapshot.forEach((doc) => {
    workerCrops.push({ id: doc.id, ...doc.data() } as WorkerCrop);
  });
  return workerCrops;
};

export const createWorkerCrop = async (workerId: string, cropCycleId: string): Promise<string> => {
  const createdAt = new Date().toISOString();
  const uid = getCurrentUserId();
  const email = getCurrentUserEmail();
  const id = `wc_${workerId}_${cropCycleId}`;
  const workerCrop: WorkerCrop = {
    id,
    workerId,
    cropCycleId,
    ownerId: uid,
    ownerEmail: email,
    createdAt
  };
  if (isMockMode) {
    const list = getMockData('paramesh_worker_crops');
    if (!list.some((item: any) => item.workerId === workerId && item.cropCycleId === cropCycleId)) {
      list.push(workerCrop);
      setMockData('paramesh_worker_crops', list);
    }
    return id;
  }
  await setDoc(doc(db, 'workerCrops', id), workerCrop);
  return id;
};

export const removeWorkerCrop = async (id: string): Promise<void> => {
  if (isMockMode) {
    const list = getMockData('paramesh_worker_crops');
    const updated = list.filter((wc: any) => wc.id !== id);
    setMockData('paramesh_worker_crops', updated);
    return;
  }
  await deleteDoc(doc(db, 'workerCrops', id));
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
  return auth?.currentUser?.uid || '';
};

export const getCurrentUserEmail = (): string => {
  if (isMockMode) {
    const user = getMockCurrentUser();
    return user ? user.email : 'farmer@agribook.com';
  }
  return auth?.currentUser?.email || '';
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

export const canDeleteWorker = async (workerId: string): Promise<{ canDelete: boolean; attendanceCount: number; paymentCount: number }> => {
  const uid = getCurrentUserId();
  if (isMockMode) {
    const attendanceCount = getMockData('paramesh_attendance').filter((a: any) => a.workerId === workerId && a.ownerId === uid).length;
    const paymentCount = getMockData('paramesh_payments').filter((p: any) => p.workerId === workerId && p.ownerId === uid).length;
    return {
      canDelete: attendanceCount === 0 && paymentCount === 0,
      attendanceCount,
      paymentCount
    };
  }
  
  const aSnap = await getDocs(query(collection(db, 'attendance'), where('ownerId', '==', uid), where('workerId', '==', workerId)));
  const pSnap = await getDocs(query(collection(db, 'payments'), where('ownerId', '==', uid), where('workerId', '==', workerId)));
  
  return {
    canDelete: aSnap.empty && pSnap.empty,
    attendanceCount: aSnap.size,
    paymentCount: pSnap.size
  };
};

export const removeWorker = async (id: string): Promise<void> => {
  const uid = getCurrentUserId();
  const validation = await canDeleteWorker(id);
  if (!validation.canDelete) {
    throw new Error(`Cannot delete worker. They have ${validation.attendanceCount} attendance entries and ${validation.paymentCount} payments recorded. Please mark them as Inactive instead.`);
  }

  if (isMockMode) {
    const workers = getMockData('paramesh_workers');
    const updated = workers.filter(w => w.id !== id);
    setMockData('paramesh_workers', updated);
    
    // Clean up worker crops relations
    const wc = getMockData('paramesh_worker_crops').filter((w: any) => w.workerId !== id);
    setMockData('paramesh_worker_crops', wc);
    return;
  }

  // Live Firestore workerCrops cleanup
  const wcSnap = await getDocs(query(collection(db, 'workerCrops'), where('ownerId', '==', uid), where('workerId', '==', id)));
  const batch = writeBatch(db);
  wcSnap.forEach(d => batch.delete(d.ref));
  await batch.commit();

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
      const docId = r.cropCycleId 
        ? `att_${r.workerId}_${r.cropCycleId}_${date}`
        : `att_${r.workerId}_${date}`;
      const index = att.findIndex((a: any) => a.id === docId || (a.workerId === r.workerId && a.date === date && a.cropCycleId === r.cropCycleId));
      if (index !== -1) {
        att[index] = { ...att[index], ...r };
      } else {
        att.push({ ...r, id: docId, ownerId: uid, ownerEmail: email });
      }
    }
    setMockData('paramesh_attendance', att);
    return;
  }
  
  // For Firestore, we can do setDoc with custom id (workerId_cropCycleId_date) to ensure uniqueness and overwrite status
  for (const r of records) {
    const docId = r.cropCycleId
      ? `${r.workerId}_${r.cropCycleId}_${date}`
      : `${r.workerId}_${date}`;
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
    const duplicate = payments.find(p => p.workerId === payment.workerId && p.date === payment.date && p.ownerId === uid);
    if (duplicate) {
      throw new Error("A payment has already been recorded for this worker on this date.");
    }
    const newId = 'p_' + Math.random().toString(36).substr(2, 9);
    const newPayment = { id: newId, ...payment, createdAt, ownerId: uid, ownerEmail: email } as any;
    payments.push(newPayment);
    setMockData('paramesh_payments', payments);
    return newId;
  }

  // Firestore uniqueness check
  const q = query(
    collection(db, 'payments'),
    where('ownerId', '==', uid),
    where('workerId', '==', payment.workerId),
    where('date', '==', payment.date)
  );
  const qSnap = await getDocs(q);
  if (!qSnap.empty) {
    throw new Error("A payment has already been recorded for this worker on this date.");
  }

  const docRef = await addDoc(collection(db, 'payments'), { ...payment, createdAt, ownerId: uid, ownerEmail: email });
  return docRef.id;
};

export const editPayment = async (id: string, payment: Partial<Payment>): Promise<void> => {
  const uid = getCurrentUserId();
  if (isMockMode) {
    const payments = getMockData('paramesh_payments');
    const index = payments.findIndex(p => p.id === id);
    if (index !== -1) {
      const merged = { ...payments[index], ...payment };
      const duplicate = payments.find(p => p.id !== id && p.workerId === merged.workerId && p.date === merged.date && p.ownerId === uid);
      if (duplicate) {
        throw new Error("A payment has already been recorded for this worker on this date.");
      }
      payments[index] = merged;
      setMockData('paramesh_payments', payments);
    }
    return;
  }

  const docRef = doc(db, 'payments', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const currentData = docSnap.data();
    const targetWorkerId = payment.workerId !== undefined ? payment.workerId : currentData.workerId;
    const targetDate = payment.date !== undefined ? payment.date : currentData.date;

    const q = query(
      collection(db, 'payments'),
      where('ownerId', '==', uid),
      where('workerId', '==', targetWorkerId),
      where('date', '==', targetDate)
    );
    const qSnap = await getDocs(q);
    const duplicates = qSnap.docs.filter(d => d.id !== id);
    if (duplicates.length > 0) {
      throw new Error("A payment has already been recorded for this worker on this date.");
    }
  }

  await updateDoc(docRef, { ...payment, updatedAt: new Date().toISOString() });
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
    const updated = att.filter((a: any) => 
      a.id !== id && 
      a.id !== `att_${id}` && 
      !(id.includes('_') && a.workerId === id.replace('att_', '').split('_')[0] && a.date === id.replace('att_', '').split('_')[1])
    );
    setMockData('paramesh_attendance', updated);
    return;
  }
  const docId = id.startsWith('att_') ? id.replace('att_', '') : id;
  await deleteDoc(doc(db, 'attendance', docId));
};

// Crop Cycles CRUD
export const fetchCropCycles = async (): Promise<CropCycle[]> => {
  const uid = getCurrentUserId();
  if (isMockMode) {
    return getMockData('paramesh_crop_cycles').filter((c: any) => c.ownerId === uid);
  }
  const q = query(collection(db, 'cropCycles'), where('ownerId', '==', uid));
  const querySnapshot = await getDocs(q);
  const cycles: CropCycle[] = [];
  querySnapshot.forEach((doc) => {
    cycles.push({ id: doc.id, ...doc.data() } as CropCycle);
  });
  return cycles;
};

export const createCropCycle = async (cropCycle: Omit<CropCycle, 'id' | 'createdAt'>): Promise<string> => {
  const createdAt = new Date().toISOString();
  const uid = getCurrentUserId();
  const email = getCurrentUserEmail();
  if (isMockMode) {
    const cycles = getMockData('paramesh_crop_cycles');
    const newId = 'c_' + Math.random().toString(36).substr(2, 9);
    const newCycle = { id: newId, ...cropCycle, createdAt, ownerId: uid, ownerEmail: email } as any;
    cycles.push(newCycle);
    setMockData('paramesh_crop_cycles', cycles);
    return newId;
  }
  const docRef = await addDoc(collection(db, 'cropCycles'), { ...cropCycle, createdAt, ownerId: uid, ownerEmail: email });
  return docRef.id;
};

export const editCropCycle = async (id: string, cropCycle: Partial<CropCycle>): Promise<void> => {
  if (isMockMode) {
    const cycles = getMockData('paramesh_crop_cycles');
    const index = cycles.findIndex(c => c.id === id);
    if (index !== -1) {
      cycles[index] = { ...cycles[index], ...cropCycle };
      setMockData('paramesh_crop_cycles', cycles);
    }
    return;
  }
  const docRef = doc(db, 'cropCycles', id);
  await updateDoc(docRef, cropCycle as DocumentData);
};

export const removeCropCycle = async (id: string): Promise<void> => {
  if (isMockMode) {
    const cycles = getMockData('paramesh_crop_cycles');
    const updated = cycles.filter(c => c.id !== id);
    setMockData('paramesh_crop_cycles', updated);
    return;
  }
  await deleteDoc(doc(db, 'cropCycles', id));
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

export const migrateLegacyRecords = async (): Promise<void> => {
  const uid = getCurrentUserId();
  if (!isMockMode && !uid) {
    return;
  }
  const email = getCurrentUserEmail();
  const legacyCropId = 'legacy_crop_2025_2026';

  // Check completion flag
  if (isMockMode) {
    if (localStorage.getItem('paramesh_migration_completed_v3') === 'true') {
      return;
    }
  } else {
    try {
      const migSnap = await getDoc(doc(db, 'migrations', `v3_${uid}`));
      if (migSnap.exists() && migSnap.data()?.completed === true) {
        return;
      }
    } catch (e) {
      console.warn("Migration check error:", e);
    }
  }

  console.log("Starting safe legacy data migration to v3.0...");

  // Create backup
  let backupWorkers: any[] = [];
  let backupAttendance: any[] = [];
  let backupPayments: any[] = [];
  let backupExpenses: any[] = [];
  let backupCropCycles: any[] = [];
  let backupWorkerCrops: any[] = [];

  if (isMockMode) {
    backupWorkers = getMockData('paramesh_workers');
    backupAttendance = getMockData('paramesh_attendance');
    backupPayments = getMockData('paramesh_payments');
    backupExpenses = getMockData('paramesh_expenses');
    backupCropCycles = getMockData('paramesh_crop_cycles');
    backupWorkerCrops = getMockData('paramesh_worker_crops');
  } else {
    try {
      const wSnap = await getDocs(query(collection(db, 'workers'), where('ownerId', '==', uid)));
      wSnap.forEach(d => backupWorkers.push({ id: d.id, ...d.data() }));

      const aSnap = await getDocs(query(collection(db, 'attendance'), where('ownerId', '==', uid)));
      aSnap.forEach(d => backupAttendance.push({ id: d.id, ...d.data() }));

      const pSnap = await getDocs(query(collection(db, 'payments'), where('ownerId', '==', uid)));
      pSnap.forEach(d => backupPayments.push({ id: d.id, ...d.data() }));

      const eSnap = await getDocs(query(collection(db, 'expenses'), where('ownerId', '==', uid)));
      eSnap.forEach(d => backupExpenses.push({ id: d.id, ...d.data() }));

      const cSnap = await getDocs(query(collection(db, 'cropCycles'), where('ownerId', '==', uid)));
      cSnap.forEach(d => backupCropCycles.push({ id: d.id, ...d.data() }));

      const wcSnap = await getDocs(query(collection(db, 'workerCrops'), where('ownerId', '==', uid)));
      wcSnap.forEach(d => backupWorkerCrops.push({ id: d.id, ...d.data() }));
    } catch (err) {
      console.error("Backup fetch failed:", err);
      throw new Error("Migration failed at backup fetch phase. No data modified.");
    }
  }

  if (backupCropCycles.length > 0) {
    console.log("Valid crop cycles already exist. Skipping legacy data migration.");
    if (isMockMode) {
      localStorage.setItem('paramesh_migration_completed_v3', 'true');
    } else {
      try {
        await setDoc(doc(db, 'migrations', `v3_${uid}`), { completed: true, timestamp: new Date().toISOString(), ownerId: uid });
      } catch (e) {}
    }
    return;
  }

  const legacyCrop: CropCycle = {
    id: legacyCropId,
    cropName: 'Legacy Crop',
    variety: 'Legacy',
    season: '2025–2026',
    landName: 'Legacy Land',
    area: 'Various',
    irrigationType: 'Other',
    startDate: '2025-06-01',
    expectedHarvestDate: '2026-03-31',
    actualHarvestDate: '2026-03-31',
    status: 'completed',
    notes: 'Auto-generated for legacy records.',
    ownerId: uid,
    ownerEmail: email,
    createdAt: new Date().toISOString()
  };

  // Find all unique worker IDs to associate them
  const workerIdsSet = new Set<string>();
  backupAttendance.forEach(a => workerIdsSet.add(a.workerId));
  backupPayments.forEach(p => workerIdsSet.add(p.workerId));
  backupWorkers.forEach(w => workerIdsSet.add(w.id));
  const uniqueWorkerIds = Array.from(workerIdsSet);

  try {
    if (isMockMode) {
      // 1. Create crop cycle (replacing temporary ones)
      setMockData('paramesh_crop_cycles', [legacyCrop]);

      // 2. Create WorkerCrop relationships
      const newWorkerCrops = uniqueWorkerIds.map(wId => ({
        id: `wc_${wId}_${legacyCropId}`,
        workerId: wId,
        cropCycleId: legacyCropId,
        ownerId: uid,
        ownerEmail: email,
        createdAt: new Date().toISOString()
      }));
      setMockData('paramesh_worker_crops', newWorkerCrops);

      // 3. Update attendance
      const newAttendance = backupAttendance.map(a => ({
        ...a,
        cropCycleId: legacyCropId
      }));
      setMockData('paramesh_attendance', newAttendance);

      // 4. Update payments
      const newPayments = backupPayments.map(p => ({
        ...p,
        cropCycleId: legacyCropId
      }));
      setMockData('paramesh_payments', newPayments);

      // 5. Update expenses
      const newExpenses = backupExpenses.map(e => ({
        ...e,
        cropCycleId: legacyCropId
      }));
      setMockData('paramesh_expenses', newExpenses);

      // Mark migration complete
      localStorage.setItem('paramesh_migration_completed_v3', 'true');
      console.log("Migration completed successfully in Mock Mode.");
    } else {
      // Firestore batch migration
      const batches: any[] = [];
      let currentBatch = writeBatch(db);
      let opCount = 0;

      const addOp = (action: 'set' | 'update' | 'delete', ref: any, data?: any) => {
        if (opCount >= 400) {
          batches.push(currentBatch);
          currentBatch = writeBatch(db);
          opCount = 0;
        }
        if (action === 'set') {
          currentBatch.set(ref, data);
        } else if (action === 'update') {
          currentBatch.update(ref, data);
        } else if (action === 'delete') {
          currentBatch.delete(ref);
        }
        opCount++;
      };

      // 1. Set Legacy Crop Cycle
      addOp('set', doc(db, 'cropCycles', legacyCropId), legacyCrop);

      // 2. Delete all other crop cycles
      backupCropCycles.forEach(c => {
        if (c.id !== legacyCropId) {
          addOp('delete', doc(db, 'cropCycles', c.id));
        }
      });

      // 3. Create WorkerCrop relationships
      uniqueWorkerIds.forEach(wId => {
        const wcId = `wc_${wId}_${legacyCropId}`;
        addOp('set', doc(db, 'workerCrops', wcId), {
          id: wcId,
          workerId: wId,
          cropCycleId: legacyCropId,
          ownerId: uid,
          ownerEmail: email,
          createdAt: new Date().toISOString()
        });
      });

      // 4. Update attendance
      backupAttendance.forEach(a => {
        const aId = a.id || `${a.workerId}_${a.date}`;
        addOp('update', doc(db, 'attendance', aId), { cropCycleId: legacyCropId });
      });

      // 5. Update payments
      backupPayments.forEach(p => {
        addOp('update', doc(db, 'payments', p.id), { cropCycleId: legacyCropId });
      });

      // 6. Update expenses
      backupExpenses.forEach(e => {
        addOp('update', doc(db, 'expenses', e.id), { cropCycleId: legacyCropId });
      });

      // 7. Write migration record
      addOp('set', doc(db, 'migrations', `v3_${uid}`), {
        completed: true,
        timestamp: new Date().toISOString(),
        ownerId: uid
      });

      batches.push(currentBatch);

      // Commit all batches
      for (const batch of batches) {
        await batch.commit();
      }
      console.log("Migration completed successfully in Firestore Mode.");
    }
  } catch (err: any) {
    if (err && (err.code === 'permission-denied' || (err.message && err.message.includes('permission')))) {
      console.warn("CRITICAL WARNING: Firestore security rules returned 'permission-denied'. Please check your Firebase Console rules. Ensure authenticated users have read/write access.");
    }
    console.error("Migration failed, rolling back to backup state...", err);
    // Rollback logic
    if (isMockMode) {
      setMockData('paramesh_workers', backupWorkers);
      setMockData('paramesh_attendance', backupAttendance);
      setMockData('paramesh_payments', backupPayments);
      setMockData('paramesh_expenses', backupExpenses);
      setMockData('paramesh_crop_cycles', backupCropCycles);
      setMockData('paramesh_worker_crops', backupWorkerCrops);
      localStorage.removeItem('paramesh_migration_completed_v3');
    } else {
      try {
        const rollbackBatches: any[] = [];
        let currentRollbackBatch = writeBatch(db);
        let rollbackOpCount = 0;

        const addRollbackOp = (action: 'set' | 'delete', ref: any, data?: any) => {
          if (rollbackOpCount >= 400) {
            rollbackBatches.push(currentRollbackBatch);
            currentRollbackBatch = writeBatch(db);
            rollbackOpCount = 0;
          }
          if (action === 'set') {
            currentRollbackBatch.set(ref, data);
          } else if (action === 'delete') {
            currentRollbackBatch.delete(ref);
          }
          rollbackOpCount++;
        };

        // Delete newly created migration docs
        addRollbackOp('delete', doc(db, 'cropCycles', legacyCropId));
        uniqueWorkerIds.forEach(wId => {
          addRollbackOp('delete', doc(db, 'workerCrops', `wc_${wId}_${legacyCropId}`));
        });
        addRollbackOp('delete', doc(db, 'migrations', `v3_${uid}`));

        // Overwrite and restore attendance
        backupAttendance.forEach(a => {
          const aId = a.id || `${a.workerId}_${a.date}`;
          addRollbackOp('set', doc(db, 'attendance', aId), a);
        });

        // Overwrite and restore payments
        backupPayments.forEach(p => {
          addRollbackOp('set', doc(db, 'payments', p.id), p);
        });

        // Overwrite and restore expenses
        backupExpenses.forEach(e => {
          addRollbackOp('set', doc(db, 'expenses', e.id), e);
        });

        // Restore original crop cycles
        backupCropCycles.forEach(c => {
          addRollbackOp('set', doc(db, 'cropCycles', c.id), c);
        });

        rollbackBatches.push(currentRollbackBatch);

        for (const rBatch of rollbackBatches) {
          await rBatch.commit();
        }
        console.log("Database successfully rolled back to pre-migration state.");
      } catch (rollbackErr) {
        console.error("CRITICAL ERROR: Migration rollback failed!", rollbackErr);
      }
    }
  }
};

export const assignWorkerToCrop = async (workerId: string, cropCycleId: string): Promise<void> => {
  await createWorkerCrop(workerId, cropCycleId);
  
  // Sync CropCycle workerIds array for backward compatibility
  const list = await fetchCropCycles();
  const crop = list.find(c => c.id === cropCycleId);
  if (crop) {
    const workerIds = Array.from(new Set([...(crop.workerIds || []), workerId]));
    await editCropCycle(cropCycleId, { workerIds });
  }
};

export const unassignWorkerFromCrop = async (workerId: string, cropCycleId: string): Promise<void> => {
  const wcId = `wc_${workerId}_${cropCycleId}`;
  await removeWorkerCrop(wcId);
  
  // Sync CropCycle workerIds array for backward compatibility
  const list = await fetchCropCycles();
  const crop = list.find(c => c.id === cropCycleId);
  if (crop) {
    const workerIds = (crop.workerIds || []).filter(id => id !== workerId);
    await editCropCycle(cropCycleId, { workerIds });
  }
};

export const canDeleteCropCycle = async (cropId: string): Promise<{ canDelete: boolean; attendanceCount: number; paymentCount: number; expenseCount: number }> => {
  const uid = getCurrentUserId();
  if (isMockMode) {
    const attendanceCount = getMockData('paramesh_attendance').filter((a: any) => a.cropCycleId === cropId && a.ownerId === uid).length;
    const paymentCount = getMockData('paramesh_payments').filter((p: any) => p.cropCycleId === cropId && p.ownerId === uid).length;
    const expenseCount = getMockData('paramesh_expenses').filter((e: any) => e.cropCycleId === cropId && e.ownerId === uid).length;
    return {
      canDelete: attendanceCount === 0 && paymentCount === 0 && expenseCount === 0,
      attendanceCount,
      paymentCount,
      expenseCount
    };
  }
  const qAtt = query(collection(db, 'attendance'), where('cropCycleId', '==', cropId), where('ownerId', '==', uid));
  const qPay = query(collection(db, 'payments'), where('cropCycleId', '==', cropId), where('ownerId', '==', uid));
  const qExp = query(collection(db, 'expenses'), where('cropCycleId', '==', cropId), where('ownerId', '==', uid));
  
  const [snapAtt, snapPay, snapExp] = await Promise.all([
    getDocs(qAtt),
    getDocs(qPay),
    getDocs(qExp)
  ]);
  
  const attendanceCount = snapAtt.size;
  const paymentCount = snapPay.size;
  const expenseCount = snapExp.size;
  
  return {
    canDelete: attendanceCount === 0 && paymentCount === 0 && expenseCount === 0,
    attendanceCount,
    paymentCount,
    expenseCount
  };
};

