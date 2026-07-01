import { 
  Worker, 
  Payment, 
  AttendanceRecord,
  calculateWorkerEarnings,
  calculateWorkerPayments,
  calculateWorkerPending,
  filterByCrop
} from '../firebase';

export interface TestCaseResult {
  id: number;
  name: string;
  category: string;
  status: 'passed' | 'failed';
  error?: string;
}

export const runSystemTests = async (): Promise<TestCaseResult[]> => {
  const results: TestCaseResult[] = [];
  let testId = 1;

  const assert = (name: string, category: string, assertion: () => boolean) => {
    try {
      const passed = assertion();
      results.push({
        id: testId++,
        name,
        category,
        status: passed ? 'passed' : 'failed',
        error: passed ? undefined : 'Assertion returned false'
      });
    } catch (e: any) {
      results.push({
        id: testId++,
        name,
        category,
        status: 'failed',
        error: e.message || String(e)
      });
    }
  };

  const mockWorker: Worker = {
    id: 'w_test_1',
    name: 'Ramesh Kumar',
    phone: '9876543210',
    village: 'Peddapuram',
    dailyWage: 500,
    status: 'active',
    notes: 'Test worker',
    createdAt: '2026-07-01T00:00:00Z'
  };

  // ----------------------------------------------------
  // Category 1: Wage Calculations (Basic attendance status)
  // ----------------------------------------------------
  assert('Worker earning: present for 1 day = 500', 'Basic Wages', () => {
    const att: AttendanceRecord[] = [{ id: 'a1', workerId: 'w_test_1', date: '2026-07-01', status: 'present', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' }];
    return calculateWorkerEarnings(mockWorker, att) === 500;
  });

  assert('Worker earning: present for 3 days = 1500', 'Basic Wages', () => {
    const att: AttendanceRecord[] = [
      { id: 'a1', workerId: 'w_test_1', date: '2026-07-01', status: 'present', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' },
      { id: 'a2', workerId: 'w_test_1', date: '2026-07-02', status: 'present', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-02' },
      { id: 'a3', workerId: 'w_test_1', date: '2026-07-03', status: 'present', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-03' }
    ];
    return calculateWorkerEarnings(mockWorker, att) === 1500;
  });

  assert('Worker earning: half_day present = 250', 'Basic Wages', () => {
    const att: AttendanceRecord[] = [{ id: 'a1', workerId: 'w_test_1', date: '2026-07-01', status: 'half_day', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' }];
    return calculateWorkerEarnings(mockWorker, att) === 250;
  });

  assert('Worker earning: absent = 0', 'Basic Wages', () => {
    const att: AttendanceRecord[] = [{ id: 'a1', workerId: 'w_test_1', date: '2026-07-01', status: 'absent', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' }];
    return calculateWorkerEarnings(mockWorker, att) === 0;
  });

  assert('Worker earning: mix of present, half_day, absent = 750', 'Basic Wages', () => {
    const att: AttendanceRecord[] = [
      { id: 'a1', workerId: 'w_test_1', date: '2026-07-01', status: 'present', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' },
      { id: 'a2', workerId: 'w_test_1', date: '2026-07-02', status: 'half_day', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-02' },
      { id: 'a3', workerId: 'w_test_1', date: '2026-07-03', status: 'absent', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-03' }
    ];
    return calculateWorkerEarnings(mockWorker, att) === 750;
  });

  assert('Worker earning: empty attendance list = 0', 'Basic Wages', () => {
    return calculateWorkerEarnings(mockWorker, []) === 0;
  });

  assert('Worker earning: other worker attendance ignored = 0', 'Basic Wages', () => {
    const att: AttendanceRecord[] = [{ id: 'a1', workerId: 'w_test_2', date: '2026-07-01', status: 'present', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' }];
    return calculateWorkerEarnings(mockWorker, att) === 0;
  });

  assert('Worker earning: zero DailyWage defaults present = 0', 'Basic Wages', () => {
    const zeroWageWorker = { ...mockWorker, dailyWage: 0 };
    const att: AttendanceRecord[] = [{ id: 'a1', workerId: 'w_test_1', date: '2026-07-01', status: 'present', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' }];
    return calculateWorkerEarnings(zeroWageWorker, att) === 0;
  });

  assert('Worker earning: string dailyWage is successfully parsed = 500', 'Basic Wages', () => {
    const strWageWorker = { ...mockWorker, dailyWage: '500' as any };
    const att: AttendanceRecord[] = [{ id: 'a1', workerId: 'w_test_1', date: '2026-07-01', status: 'present', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' }];
    return calculateWorkerEarnings(strWageWorker, att) === 500;
  });

  assert('Worker earning: undefined dailyWage defaults = 0', 'Basic Wages', () => {
    const undefWorker = { ...mockWorker, dailyWage: undefined as any };
    const att: AttendanceRecord[] = [{ id: 'a1', workerId: 'w_test_1', date: '2026-07-01', status: 'present', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' }];
    return calculateWorkerEarnings(undefWorker, att) === 0;
  });

  // ----------------------------------------------------
  // Category 2: Wage Overrides (wageForDay override checks)
  // ----------------------------------------------------
  assert('Override: present day overridden to 600 = 600', 'Wage Overrides', () => {
    const att: AttendanceRecord[] = [{ id: 'a1', workerId: 'w_test_1', date: '2026-07-01', status: 'present', wageForDay: 600, cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' }];
    return calculateWorkerEarnings(mockWorker, att) === 600;
  });

  assert('Override: present day override null falls back to default = 500', 'Wage Overrides', () => {
    const att: AttendanceRecord[] = [{ id: 'a1', workerId: 'w_test_1', date: '2026-07-01', status: 'present', wageForDay: null as any, cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' }];
    return calculateWorkerEarnings(mockWorker, att) === 500;
  });

  assert('Override: present day override empty string falls back = 500', 'Wage Overrides', () => {
    const att: AttendanceRecord[] = [{ id: 'a1', workerId: 'w_test_1', date: '2026-07-01', status: 'present', wageForDay: '' as any, cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' }];
    return calculateWorkerEarnings(mockWorker, att) === 500;
  });

  assert('Override: half_day overridden to 600 = 300', 'Wage Overrides', () => {
    const att: AttendanceRecord[] = [{ id: 'a1', workerId: 'w_test_1', date: '2026-07-01', status: 'half_day', wageForDay: 600, cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' }];
    return calculateWorkerEarnings(mockWorker, att) === 300;
  });

  assert('Override: absent day override has no financial effect = 0', 'Wage Overrides', () => {
    const att: AttendanceRecord[] = [{ id: 'a1', workerId: 'w_test_1', date: '2026-07-01', status: 'absent', wageForDay: 600, cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' }];
    return calculateWorkerEarnings(mockWorker, att) === 0;
  });

  assert('Override: overridden string daily wage is parsed = 600', 'Wage Overrides', () => {
    const att: AttendanceRecord[] = [{ id: 'a1', workerId: 'w_test_1', date: '2026-07-01', status: 'present', wageForDay: '600' as any, cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' }];
    return calculateWorkerEarnings(mockWorker, att) === 600;
  });

  assert('Override: invalid override characters default to 0 = 0', 'Wage Overrides', () => {
    const att: AttendanceRecord[] = [{ id: 'a1', workerId: 'w_test_1', date: '2026-07-01', status: 'present', wageForDay: 'abc' as any, cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' }];
    return calculateWorkerEarnings(mockWorker, att) === 0;
  });

  assert('Override: present day override negative daily rate = -100', 'Wage Overrides', () => {
    const att: AttendanceRecord[] = [{ id: 'a1', workerId: 'w_test_1', date: '2026-07-01', status: 'present', wageForDay: -100, cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' }];
    return calculateWorkerEarnings(mockWorker, att) === -100;
  });

  assert('Override: present day override zero daily rate = 0', 'Wage Overrides', () => {
    const att: AttendanceRecord[] = [{ id: 'a1', workerId: 'w_test_1', date: '2026-07-01', status: 'present', wageForDay: 0, cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' }];
    return calculateWorkerEarnings(mockWorker, att) === 0;
  });

  assert('Override: multiple overrides added correctly = 1100', 'Wage Overrides', () => {
    const att: AttendanceRecord[] = [
      { id: 'a1', workerId: 'w_test_1', date: '2026-07-01', status: 'present', wageForDay: 600, cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' },
      { id: 'a2', workerId: 'w_test_1', date: '2026-07-02', status: 'present', wageForDay: 500, cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-02' }
    ];
    return calculateWorkerEarnings(mockWorker, att) === 1100;
  });

  // ----------------------------------------------------
  // Category 3: Payment Calculations (basic sums)
  // ----------------------------------------------------
  assert('Payments: single payout = 1000', 'Payments Logic', () => {
    const pay: Payment[] = [{ id: 'p1', workerId: 'w_test_1', date: '2026-07-01', amount: 1000, note: 'Wage', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' }];
    return calculateWorkerPayments(mockWorker, pay) === 1000;
  });

  assert('Payments: multiple payouts = 2500', 'Payments Logic', () => {
    const pay: Payment[] = [
      { id: 'p1', workerId: 'w_test_1', date: '2026-07-01', amount: 1000, note: 'Wage', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' },
      { id: 'p2', workerId: 'w_test_1', date: '2026-07-02', amount: 1500, note: 'Wage', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-02' }
    ];
    return calculateWorkerPayments(mockWorker, pay) === 2500;
  });

  assert('Payments: empty payments list = 0', 'Payments Logic', () => {
    return calculateWorkerPayments(mockWorker, []) === 0;
  });

  assert('Payments: other worker payments ignored = 0', 'Payments Logic', () => {
    const pay: Payment[] = [{ id: 'p1', workerId: 'w_test_2', date: '2026-07-01', amount: 1000, note: 'Wage', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' }];
    return calculateWorkerPayments(mockWorker, pay) === 0;
  });

  assert('Payments: string amount is successfully parsed = 1000', 'Payments Logic', () => {
    const pay: Payment[] = [{ id: 'p1', workerId: 'w_test_1', date: '2026-07-01', amount: '1000' as any, note: 'Wage', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' }];
    return calculateWorkerPayments(mockWorker, pay) === 1000;
  });

  assert('Payments: negative payment amount is summed = -500', 'Payments Logic', () => {
    const pay: Payment[] = [{ id: 'p1', workerId: 'w_test_1', date: '2026-07-01', amount: -500, note: 'Correction', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' }];
    return calculateWorkerPayments(mockWorker, pay) === -500;
  });

  assert('Payments: invalid characters amount defaults = 0', 'Payments Logic', () => {
    const pay: Payment[] = [{ id: 'p1', workerId: 'w_test_1', date: '2026-07-01', amount: 'abc' as any, note: 'Wage', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' }];
    return calculateWorkerPayments(mockWorker, pay) === 0;
  });

  assert('Payments: undefined amount defaults = 0', 'Payments Logic', () => {
    const pay: Payment[] = [{ id: 'p1', workerId: 'w_test_1', date: '2026-07-01', amount: undefined as any, note: 'Wage', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' }];
    return calculateWorkerPayments(mockWorker, pay) === 0;
  });

  assert('Payments: null amount defaults = 0', 'Payments Logic', () => {
    const pay: Payment[] = [{ id: 'p1', workerId: 'w_test_1', date: '2026-07-01', amount: null as any, note: 'Wage', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' }];
    return calculateWorkerPayments(mockWorker, pay) === 0;
  });

  assert('Payments: zero amount = 0', 'Payments Logic', () => {
    const pay: Payment[] = [{ id: 'p1', workerId: 'w_test_1', date: '2026-07-01', amount: 0, note: 'Wage', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' }];
    return calculateWorkerPayments(mockWorker, pay) === 0;
  });

  // ----------------------------------------------------
  // Category 4: Pending Wage Ledger Calculations
  // ----------------------------------------------------
  assert('Pending: Earned (1500) - Paid (1000) = 500 pending', 'Pending Ledger', () => {
    const att: AttendanceRecord[] = [
      { id: 'a1', workerId: 'w_test_1', date: '2026-07-01', status: 'present', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' },
      { id: 'a2', workerId: 'w_test_1', date: '2026-07-02', status: 'present', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-02' },
      { id: 'a3', workerId: 'w_test_1', date: '2026-07-03', status: 'present', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-03' }
    ];
    const pay: Payment[] = [{ id: 'p1', workerId: 'w_test_1', date: '2026-07-01', amount: 1000, note: 'Wage', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' }];
    return calculateWorkerPending(mockWorker, att, pay) === 500;
  });

  assert('Pending: Earned (500) - Paid (1000) = -500 (Advance)', 'Pending Ledger', () => {
    const att: AttendanceRecord[] = [{ id: 'a1', workerId: 'w_test_1', date: '2026-07-01', status: 'present', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' }];
    const pay: Payment[] = [{ id: 'p1', workerId: 'w_test_1', date: '2026-07-01', amount: 1000, note: 'Wage', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' }];
    return calculateWorkerPending(mockWorker, att, pay) === -500;
  });

  assert('Pending: Earned (1000) - Paid (1000) = 0 balance', 'Pending Ledger', () => {
    const att: AttendanceRecord[] = [
      { id: 'a1', workerId: 'w_test_1', date: '2026-07-01', status: 'present', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' },
      { id: 'a2', workerId: 'w_test_1', date: '2026-07-02', status: 'present', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-02' }
    ];
    const pay: Payment[] = [{ id: 'p1', workerId: 'w_test_1', date: '2026-07-01', amount: 1000, note: 'Wage', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' }];
    return calculateWorkerPending(mockWorker, att, pay) === 0;
  });

  assert('Pending: No attendance + No payment = 0 balance', 'Pending Ledger', () => {
    return calculateWorkerPending(mockWorker, [], []) === 0;
  });

  assert('Pending: Earned overridden (600) - Paid (400) = 200 pending', 'Pending Ledger', () => {
    const att: AttendanceRecord[] = [{ id: 'a1', workerId: 'w_test_1', date: '2026-07-01', status: 'present', wageForDay: 600, cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' }];
    const pay: Payment[] = [{ id: 'p1', workerId: 'w_test_1', date: '2026-07-01', amount: 400, note: 'Wage', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' }];
    return calculateWorkerPending(mockWorker, att, pay) === 200;
  });

  assert('Pending: Earned present/half_day mix (750) - Paid (500) = 250 pending', 'Pending Ledger', () => {
    const att: AttendanceRecord[] = [
      { id: 'a1', workerId: 'w_test_1', date: '2026-07-01', status: 'present', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' },
      { id: 'a2', workerId: 'w_test_1', date: '2026-07-02', status: 'half_day', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-02' }
    ];
    const pay: Payment[] = [{ id: 'p1', workerId: 'w_test_1', date: '2026-07-01', amount: 500, note: 'Wage', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' }];
    return calculateWorkerPending(mockWorker, att, pay) === 250;
  });

  assert('Pending: other worker records are completely excluded = 0', 'Pending Ledger', () => {
    const att: AttendanceRecord[] = [{ id: 'a1', workerId: 'w_test_2', date: '2026-07-01', status: 'present', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' }];
    const pay: Payment[] = [{ id: 'p1', workerId: 'w_test_2', date: '2026-07-01', amount: 500, note: 'Wage', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' }];
    return calculateWorkerPending(mockWorker, att, pay) === 0;
  });

  assert('Pending: Earned (0) - Paid string (300) = -300', 'Pending Ledger', () => {
    const pay: Payment[] = [{ id: 'p1', workerId: 'w_test_1', date: '2026-07-01', amount: '300' as any, note: 'Wage', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' }];
    return calculateWorkerPending(mockWorker, [], pay) === -300;
  });

  assert('Pending: Earned string (500) - Paid (0) = 500', 'Pending Ledger', () => {
    const strWageWorker = { ...mockWorker, dailyWage: '500' as any };
    const att: AttendanceRecord[] = [{ id: 'a1', workerId: 'w_test_1', date: '2026-07-01', status: 'present', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' }];
    return calculateWorkerPending(strWageWorker, att, []) === 500;
  });

  assert('Pending: Earned (500) - Paid invalid (0) = 500', 'Pending Ledger', () => {
    const att: AttendanceRecord[] = [{ id: 'a1', workerId: 'w_test_1', date: '2026-07-01', status: 'present', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' }];
    const pay: Payment[] = [{ id: 'p1', workerId: 'w_test_1', date: '2026-07-01', amount: 'abc' as any, note: 'Wage', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' }];
    return calculateWorkerPending(mockWorker, att, pay) === 500;
  });

  // ----------------------------------------------------
  // Category 5: Crop Cycle Isolation Filters
  // ----------------------------------------------------
  const mockCropItems: any[] = [
    { id: 'i1', amount: 100, cropCycleId: 'crop_2026' },
    { id: 'i2', amount: 200, cropCycleId: 'crop_2027' },
    { id: 'i3', amount: 300, cropCycleId: 'legacy_crop_2025_2026' },
    { id: 'i4', amount: 400, cropCycleId: 'legacy' },
    { id: 'i5', amount: 500, cropCycleId: undefined }
  ];

  assert('Crop Filter: selected "all" returns all items', 'Crop Isolation', () => {
    return filterByCrop(mockCropItems, 'all').length === 5;
  });

  assert('Crop Filter: selected specific crop returns exact match', 'Crop Isolation', () => {
    const res = filterByCrop(mockCropItems, 'crop_2026');
    return res.length === 1 && res[0].id === 'i1';
  });

  assert('Crop Filter: selected legacy crop returns legacy matching + undefined crop cycles', 'Crop Isolation', () => {
    const res = filterByCrop(mockCropItems, 'legacy_crop_2025_2026');
    return res.length === 3 && res.some(x => x.id === 'i3') && res.some(x => x.id === 'i4') && res.some(x => x.id === 'i5');
  });

  assert('Crop Filter: empty cropId defaults to all items', 'Crop Isolation', () => {
    return filterByCrop(mockCropItems, '').length === 5;
  });

  assert('Crop Filter: items list with no cropCycleId returns empty on specific crop', 'Crop Isolation', () => {
    const items: any[] = [{ id: 'x1' }, { id: 'x2' }];
    return filterByCrop(items, 'crop_2026').length === 0;
  });

  assert('Crop Filter: items list with no cropCycleId returns all on "all"', 'Crop Isolation', () => {
    const items: any[] = [{ id: 'x1' }, { id: 'x2' }];
    return filterByCrop(items, 'all').length === 2;
  });

  assert('Crop Filter: items list with no cropCycleId returns all on legacy_crop_2025_2026', 'Crop Isolation', () => {
    const items: any[] = [{ id: 'x1' }, { id: 'x2' }];
    return filterByCrop(items, 'legacy_crop_2025_2026').length === 2;
  });

  assert('Crop Filter: query matches correctly for another specific crop', 'Crop Isolation', () => {
    const res = filterByCrop(mockCropItems, 'crop_2027');
    return res.length === 1 && res[0].id === 'i2';
  });

  assert('Crop Filter: handles empty list input gracefully', 'Crop Isolation', () => {
    return filterByCrop([], 'crop_2026').length === 0;
  });

  assert('Crop Filter: handles list with diverse cropCycleId formats', 'Crop Isolation', () => {
    const items: any[] = [
      { id: 'd1', cropCycleId: 'crop_2026' },
      { id: 'd2', cropCycleId: 'legacy_crop_2025_2026' }
    ];
    return filterByCrop(items, 'crop_2026').length === 1;
  });

  // ----------------------------------------------------
  // Category 6: Boundary Values, Edge Cases, & Types
  // ----------------------------------------------------
  assert('Edge: Large positive daily wage earnings = 50,000,000', 'Edge Cases', () => {
    const wealthyWorker = { ...mockWorker, dailyWage: 10000000 };
    const att: AttendanceRecord[] = [
      { id: 'a1', workerId: 'w_test_1', date: '2026-07-01', status: 'present', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' },
      { id: 'a2', workerId: 'w_test_1', date: '2026-07-02', status: 'present', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-02' },
      { id: 'a3', workerId: 'w_test_1', date: '2026-07-03', status: 'present', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-03' },
      { id: 'a4', workerId: 'w_test_1', date: '2026-07-04', status: 'present', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-04' },
      { id: 'a5', workerId: 'w_test_1', date: '2026-07-05', status: 'present', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-05' }
    ];
    return calculateWorkerEarnings(wealthyWorker, att) === 50000000;
  });

  assert('Edge: Fractional daily wage (e.g. ₹333.33) is supported = 333.33', 'Edge Cases', () => {
    const fractWorker = { ...mockWorker, dailyWage: 333.33 };
    const att: AttendanceRecord[] = [{ id: 'a1', workerId: 'w_test_1', date: '2026-07-01', status: 'present', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' }];
    return calculateWorkerEarnings(fractWorker, att) === 333.33;
  });

  assert('Edge: Fractional daily wage half_day present = 166.665', 'Edge Cases', () => {
    const fractWorker = { ...mockWorker, dailyWage: 333.33 };
    const att: AttendanceRecord[] = [{ id: 'a1', workerId: 'w_test_1', date: '2026-07-01', status: 'half_day', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' }];
    return calculateWorkerEarnings(fractWorker, att) === 166.665;
  });

  assert('Edge: Fractional payment amount = 499.55', 'Edge Cases', () => {
    const pay: Payment[] = [{ id: 'p1', workerId: 'w_test_1', date: '2026-07-01', amount: 499.55, note: 'Wage', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' }];
    return calculateWorkerPayments(mockWorker, pay) === 499.55;
  });

  assert('Edge: Present attendance status type-check case insensitivity fallback', 'Edge Cases', () => {
    const att: AttendanceRecord[] = [{ id: 'a1', workerId: 'w_test_1', date: '2026-07-01', status: 'PRESENT' as any, cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' }];
    return calculateWorkerEarnings(mockWorker, att) === 0;
  });

  assert('Edge: Negative daily wage worker handles presents = -500', 'Edge Cases', () => {
    const negWageWorker = { ...mockWorker, dailyWage: -500 };
    const att: AttendanceRecord[] = [{ id: 'a1', workerId: 'w_test_1', date: '2026-07-01', status: 'present', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' }];
    return calculateWorkerEarnings(negWageWorker, att) === -500;
  });

  assert('Edge: Negative daily wage worker half_day = -250', 'Edge Cases', () => {
    const negWageWorker = { ...mockWorker, dailyWage: -500 };
    const att: AttendanceRecord[] = [{ id: 'a1', workerId: 'w_test_1', date: '2026-07-01', status: 'half_day', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' }];
    return calculateWorkerEarnings(negWageWorker, att) === -250;
  });

  assert('Edge: Attendance statuses other than present/half_day return 0', 'Edge Cases', () => {
    const att: AttendanceRecord[] = [
      { id: 'a1', workerId: 'w_test_1', date: '2026-07-01', status: 'leave' as any, cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' },
      { id: 'a2', workerId: 'w_test_1', date: '2026-07-02', status: 'holiday' as any, cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-02' }
    ];
    return calculateWorkerEarnings(mockWorker, att) === 0;
  });

  assert('Edge: Payouts with mix of number and string types = 1500', 'Edge Cases', () => {
    const pay: Payment[] = [
      { id: 'p1', workerId: 'w_test_1', date: '2026-07-01', amount: 500, note: 'Wage', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' },
      { id: 'p2', workerId: 'w_test_1', date: '2026-07-02', amount: '1000' as any, note: 'Wage', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-02' }
    ];
    return calculateWorkerPayments(mockWorker, pay) === 1500;
  });

  assert('Edge: Total paid calculated for non-existent worker = 0', 'Edge Cases', () => {
    const dummyWorker = { ...mockWorker, id: 'w_non_existent' };
    const pay: Payment[] = [{ id: 'p1', workerId: 'w_test_1', date: '2026-07-01', amount: 500, note: 'Wage', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' }];
    return calculateWorkerPayments(dummyWorker, pay) === 0;
  });

  assert('Edge: Total earned calculated for non-existent worker = 0', 'Edge Cases', () => {
    const dummyWorker = { ...mockWorker, id: 'w_non_existent' };
    const att: AttendanceRecord[] = [{ id: 'a1', workerId: 'w_test_1', date: '2026-07-01', status: 'present', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' }];
    return calculateWorkerEarnings(dummyWorker, att) === 0;
  });

  assert('Edge: Pending balance handles fractional numbers correctly = 0.05', 'Edge Cases', () => {
    const att: AttendanceRecord[] = [{ id: 'a1', workerId: 'w_test_1', date: '2026-07-01', status: 'present', wageForDay: 500.10, cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' }];
    const pay: Payment[] = [{ id: 'p1', workerId: 'w_test_1', date: '2026-07-01', amount: 500.05, note: 'Wage', cropCycleId: 'c1', ownerId: 'uid', createdAt: '2026-07-01' }];
    return Math.round(calculateWorkerPending(mockWorker, att, pay) * 100) / 100 === 0.05;
  });

  return results;
};
