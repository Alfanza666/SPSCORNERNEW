import type { Request, Response } from 'express';

const SETTLED_STATUSES = ['paid', 'success'] as const;
const HISTORY_GROUPS = new Set(['settled', 'pending', 'failed']);
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 250;
const REPORT_FETCH_CHUNK = 500;
const WITA_OFFSET_MS = 8 * 60 * 60 * 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type HistoryGroup = 'settled' | 'pending' | 'failed';

interface HistoryFilters {
  group: HistoryGroup;
  page: number;
  pageSize: number;
  search: string;
  sellerId: string;
  paymentMethod: string;
  startIso: string | null;
  endIso: string | null;
}

interface NormalizedHistoryRow {
  id: string;
  source: 'transaction' | 'validation_attempt';
  buyer_name: string;
  buyer_id: string | null;
  amount: number;
  order_amount?: number;
  total_amount?: number;
  attempted_amount?: number;
  status: 'paid' | 'success' | 'pending' | 'failed';
  payment_method?: string | null;
  reason?: string | null;
  receipt_image?: string | null;
  created_at: string;
  metadata?: Record<string, unknown> | null;
}

class ReportingRequestError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'ReportingRequestError';
    this.statusCode = statusCode;
  }
}

class ReportingQueryError extends Error {
  code: string;

  constructor(context: string, code?: string) {
    super(`Reporting query failed: ${context}`);
    this.name = 'ReportingQueryError';
    this.code = code || 'QUERY_FAILED';
  }
}

function firstQueryValue(value: unknown): string {
  if (Array.isArray(value)) return String(value[0] ?? '');
  return typeof value === 'string' ? value : '';
}

function parsePositiveInteger(value: unknown, fallback: number, field: string): number {
  const raw = firstQueryValue(value).trim();
  if (!raw) return fallback;
  if (!/^\d+$/.test(raw) || Number(raw) < 1) {
    throw new ReportingRequestError(`${field} harus berupa bilangan bulat minimal 1.`);
  }
  return Number(raw);
}

function isValidCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return candidate.getUTCFullYear() === year
    && candidate.getUTCMonth() === month - 1
    && candidate.getUTCDate() === day;
}

function parseDateBound(value: unknown, endOfDay: boolean): string | null {
  const raw = firstQueryValue(value).trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    if (!isValidCalendarDate(raw)) {
      throw new ReportingRequestError(`Tanggal ${raw} tidak valid.`);
    }
    const time = endOfDay ? '23:59:59.999' : '00:00:00.000';
    return new Date(`${raw}T${time}+08:00`).toISOString();
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new ReportingRequestError(`Tanggal ${raw} tidak valid.`);
  }
  return parsed.toISOString();
}

export function parseHistoryQuery(query: Record<string, unknown>): HistoryFilters {
  const group = (firstQueryValue(query.group).trim().toLowerCase() || 'settled') as HistoryGroup;
  if (!HISTORY_GROUPS.has(group)) {
    throw new ReportingRequestError('group harus settled, pending, atau failed.');
  }

  const page = parsePositiveInteger(query.page, 1, 'page');
  const requestedPageSize = parsePositiveInteger(query.pageSize, DEFAULT_PAGE_SIZE, 'pageSize');
  const pageSize = Math.min(requestedPageSize, MAX_PAGE_SIZE);
  const search = firstQueryValue(query.search).trim().slice(0, 120);
  const sellerId = firstQueryValue(query.sellerId).trim();
  const paymentMethod = firstQueryValue(query.paymentMethod).trim().slice(0, 80);
  const startIso = parseDateBound(query.startDate, false);
  const endIso = parseDateBound(query.endDate, true);

  if (sellerId && !UUID_PATTERN.test(sellerId)) {
    throw new ReportingRequestError('sellerId tidak valid.');
  }
  if (startIso && endIso && startIso > endIso) {
    throw new ReportingRequestError('startDate tidak boleh melewati endDate.');
  }

  return { group, page, pageSize, search, sellerId, paymentMethod, startIso, endIso };
}

function asArray<T = any>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function asObject(value: unknown): Record<string, any> | null {
  if (Array.isArray(value)) return (value[0] as Record<string, any>) || null;
  return value && typeof value === 'object' ? value as Record<string, any> : null;
}

function money(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round((numeric + Number.EPSILON) * 100) / 100;
}

function itemGross(item: any): number {
  return money(money(item?.price) * Math.max(0, Number(item?.quantity) || 0));
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, character => `\\${character}`);
}

function applyCommonTransactionFilters(query: any, filters: HistoryFilters, joinedItemsAlias = ''): any {
  let filtered = query;
  if (filters.search) {
    if (UUID_PATTERN.test(filters.search)) {
      filtered = filtered.or(`id.eq.${filters.search},buyer_id.eq.${filters.search}`);
    } else {
      filtered = filtered.ilike('buyer_name', `%${escapeLike(filters.search)}%`);
    }
  }
  if (filters.paymentMethod) filtered = filtered.eq('payment_method', filters.paymentMethod);
  if (filters.startIso) filtered = filtered.gte('created_at', filters.startIso);
  if (filters.endIso) filtered = filtered.lte('created_at', filters.endIso);
  if (filters.sellerId && joinedItemsAlias) {
    filtered = filtered.eq(`${joinedItemsAlias}.seller_id`, filters.sellerId);
  }
  return filtered;
}

function applyValidationAttemptFilters(query: any, filters: HistoryFilters): any {
  let filtered = query;
  if (filters.search) {
    if (UUID_PATTERN.test(filters.search)) {
      filtered = filtered.or(`id.eq.${filters.search},buyer_id.eq.${filters.search}`);
    } else {
      filtered = filtered.ilike('buyer_name', `%${escapeLike(filters.search)}%`);
    }
  }
  if (filters.startIso) filtered = filtered.gte('created_at', filters.startIso);
  if (filters.endIso) filtered = filtered.lte('created_at', filters.endIso);
  return filtered;
}

function transactionSelect(filters: HistoryFilters): string {
  const base = 'id,buyer_name,buyer_id,total_amount,status,payment_method,receipt_image,created_at,metadata';
  return filters.sellerId
    ? `${base},matched_items:transaction_items!inner(seller_id,price,quantity,subtotal)`
    : base;
}

function transactionCountSelect(filters: HistoryFilters): string {
  return filters.sellerId ? 'id,matched_items:transaction_items!inner(seller_id)' : 'id';
}

function buildTransactionQuery(supabase: any, filters: HistoryFilters, statuses: readonly string[], countOnly = false): any {
  const joinedAlias = filters.sellerId ? 'matched_items' : '';
  let query = supabase
    .from('transactions')
    .select(countOnly ? transactionCountSelect(filters) : transactionSelect(filters), countOnly
      ? { count: 'exact', head: true }
      : undefined)
    .in('status', [...statuses]);
  query = applyCommonTransactionFilters(query, filters, joinedAlias);
  return query;
}

async function requireReportingAdmin(supabase: any, req: Request, res: Response): Promise<boolean> {
  const authHeader = req.headers.authorization;
  const match = typeof authHeader === 'string' ? /^Bearer\s+(.+)$/i.exec(authHeader.trim()) : null;
  if (!match?.[1]) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return false;
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(match[1]);
  if (authError || !authData?.user?.id) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return false;
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .single();

  if (profileError && profileError.code !== 'PGRST116') {
    throw new ReportingQueryError('admin role lookup', profileError.code);
  }
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) {
    res.status(403).json({ success: false, error: 'Forbidden' });
    return false;
  }
  return true;
}

function ensureQueryResult<T = any>(result: any, context: string): { data: T[]; count: number | null } {
  if (result?.error) throw new ReportingQueryError(context, result.error.code);
  return {
    data: Array.isArray(result?.data) ? result.data : [],
    count: typeof result?.count === 'number' ? result.count : null,
  };
}

async function countTransactions(supabase: any, filters: HistoryFilters, statuses: readonly string[]): Promise<number> {
  const result = await buildTransactionQuery(supabase, filters, statuses, true);
  if (result?.error) throw new ReportingQueryError('transaction history count', result.error.code);
  return Number(result?.count || 0);
}

async function countValidationAttempts(supabase: any, filters: HistoryFilters): Promise<number> {
  // Validation attempts do not carry seller/payment dimensions, so they cannot match those filters.
  if (filters.sellerId || filters.paymentMethod) return 0;
  let query = supabase.from('failed_transactions').select('id', { count: 'exact', head: true });
  query = applyValidationAttemptFilters(query, filters);
  const result = await query;
  if (result?.error) throw new ReportingQueryError('validation attempt count', result.error.code);
  return Number(result?.count || 0);
}

export function normalizeTransactionHistoryRow(row: any, sellerId = ''): NormalizedHistoryRow {
  const orderAmount = money(row?.total_amount);
  const sellerAmount = sellerId
    ? money(asArray(row?.matched_items).reduce((total, item) => total + itemGross(item), 0))
    : orderAmount;
  const normalizedStatus = String(row?.status || '').toLowerCase();
  const status = (['paid', 'success', 'pending', 'failed'].includes(normalizedStatus)
    ? normalizedStatus
    : 'failed') as NormalizedHistoryRow['status'];

  return {
    id: String(row?.id || ''),
    source: 'transaction',
    buyer_name: String(row?.buyer_name || 'Tidak diketahui'),
    buyer_id: row?.buyer_id || null,
    amount: sellerAmount,
    order_amount: orderAmount,
    total_amount: orderAmount,
    status,
    payment_method: row?.payment_method || null,
    receipt_image: row?.receipt_image || null,
    created_at: String(row?.created_at || ''),
    metadata: row?.metadata && typeof row.metadata === 'object' ? row.metadata : null,
  };
}

export function normalizeValidationAttemptRow(row: any): NormalizedHistoryRow {
  const amount = money(row?.attempted_amount);
  return {
    id: String(row?.id || ''),
    source: 'validation_attempt',
    buyer_name: String(row?.buyer_name || 'Tidak diketahui'),
    buyer_id: row?.buyer_id || null,
    amount,
    attempted_amount: amount,
    status: 'failed',
    reason: row?.reason || null,
    receipt_image: row?.receipt_image || null,
    created_at: String(row?.created_at || ''),
  };
}

export function compareHistoryRows(left: NormalizedHistoryRow, right: NormalizedHistoryRow): number {
  const timeDifference = (Date.parse(right.created_at) || 0) - (Date.parse(left.created_at) || 0);
  if (timeDifference !== 0) return timeDifference;
  const sourceDifference = left.source.localeCompare(right.source);
  if (sourceDifference !== 0) return sourceDifference;
  return left.id.localeCompare(right.id);
}

async function fetchTransactionPage(supabase: any, filters: HistoryFilters, statuses: readonly string[]) {
  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;
  const query = buildTransactionQuery(supabase, filters, statuses)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to);
  const result = ensureQueryResult(await query, 'transaction history page');
  return {
    rows: result.data.map(row => normalizeTransactionHistoryRow(row, filters.sellerId)),
    count: result.count,
  };
}

export async function fetchAllByRange<T = any>(queryFactory: () => any, chunkSize = REPORT_FETCH_CHUNK): Promise<T[]> {
  if (!Number.isInteger(chunkSize) || chunkSize < 1 || chunkSize > 1000) {
    throw new Error('chunkSize must be an integer between 1 and 1000');
  }

  const rows: T[] = [];
  for (let from = 0; ; from += chunkSize) {
    const result = await queryFactory().range(from, from + chunkSize - 1);
    const page = ensureQueryResult<T>(result, 'paginated reporting data').data;
    rows.push(...page);
    if (page.length < chunkSize) break;
  }
  return rows;
}

async function fetchAllFailedRows(supabase: any, filters: HistoryFilters): Promise<NormalizedHistoryRow[]> {
  const mainTransactionsPromise = fetchAllByRange<any>(() => buildTransactionQuery(
    supabase,
    filters,
    ['failed'],
  ).order('created_at', { ascending: false }).order('id', { ascending: false }));

  const validationAttemptsPromise = filters.sellerId || filters.paymentMethod
    ? Promise.resolve([])
    : fetchAllByRange<any>(() => {
      let query = supabase
        .from('failed_transactions')
        .select('id,buyer_name,buyer_id,attempted_amount,reason,receipt_image,created_at')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });
      query = applyValidationAttemptFilters(query, filters);
      return query;
    });

  const [mainTransactions, validationAttempts] = await Promise.all([
    mainTransactionsPromise,
    validationAttemptsPromise,
  ]);

  return [
    ...mainTransactions.map(row => normalizeTransactionHistoryRow(row, filters.sellerId)),
    ...validationAttempts.map(normalizeValidationAttemptRow),
  ].sort(compareHistoryRows);
}

async function loadHistory(supabase: any, filters: HistoryFilters) {
  const [settledCount, pendingCount, mainFailedCount, validationFailedCount] = await Promise.all([
    countTransactions(supabase, filters, SETTLED_STATUSES),
    countTransactions(supabase, filters, ['pending']),
    countTransactions(supabase, filters, ['failed']),
    countValidationAttempts(supabase, filters),
  ]);

  const counts = {
    settled: settledCount,
    pending: pendingCount,
    failed: mainFailedCount + validationFailedCount,
    failedTransactions: mainFailedCount,
    validationAttempts: validationFailedCount,
  };

  let rows: NormalizedHistoryRow[] = [];
  let total = counts[filters.group];

  if (filters.group === 'failed') {
    const combined = await fetchAllFailedRows(supabase, filters);
    counts.failed = combined.length;
    total = combined.length;
    const start = (filters.page - 1) * filters.pageSize;
    rows = combined.slice(start, start + filters.pageSize);
  } else {
    const statuses = filters.group === 'settled' ? SETTLED_STATUSES : ['pending'];
    const pageResult = await fetchTransactionPage(supabase, filters, statuses);
    rows = pageResult.rows;
    if (typeof pageResult.count === 'number') {
      total = pageResult.count;
      counts[filters.group] = pageResult.count;
    }
  }

  return {
    data: rows,
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / filters.pageSize),
    },
    counts,
  };
}

export function witaDateKey(value: string | Date): string | null {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getTime() + WITA_OFFSET_MS).toISOString().slice(0, 10);
}

function lastSevenWitaDateKeys(now: Date): string[] {
  const shifted = new Date(now.getTime() + WITA_OFFSET_MS);
  const todayUtc = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  return Array.from({ length: 7 }, (_, index) => (
    new Date(todayUtc - (6 - index) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  ));
}

function chartLabel(dateKey: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${dateKey}T00:00:00.000Z`));
}

function addBreakdownAmount(
  breakdown: Map<string, { id: string; name: string; total: number; kind: 'seller' | 'digital' | 'unallocated' }>,
  id: string,
  name: string,
  kind: 'seller' | 'digital' | 'unallocated',
  amount: number,
) {
  const current = breakdown.get(id) || { id, name, total: 0, kind };
  current.total = money(current.total + amount);
  breakdown.set(id, current);
}

export function buildOverviewData(input: {
  settledTransactions: any[];
  settledItems: any[];
  pendingTransactions: any[];
  pendingCount: number;
  failedTransactions: any[];
  validationFailedCount: number;
  totalSellers: number;
  activeSellers: number;
  pendingWithdrawals: number;
  now?: Date;
}) {
  const settledTransactions = [...input.settledTransactions].sort((left, right) => (
    (Date.parse(right.created_at) || 0) - (Date.parse(left.created_at) || 0)
      || String(left.id || '').localeCompare(String(right.id || ''))
  ));
  const grossSettled = money(settledTransactions.reduce(
    (total, transaction) => total + money(transaction.total_amount),
    0,
  ));
  const failedAmount = money(input.failedTransactions.reduce(
    (total, transaction) => total + money(transaction.total_amount),
    0,
  ));

  const breakdown = new Map<string, {
    id: string;
    name: string;
    total: number;
    kind: 'seller' | 'digital' | 'unallocated';
  }>();
  const fulfillmentFailedTransactions = new Set<string>();
  let fulfillmentFailedAmount = 0;
  let itemGrossTotal = 0;
  let netSettled = 0;
  let recordedFee = 0;
  let orphanItemGross = 0;
  const itemGrossByTransaction = new Map<string, number>();

  for (const item of input.settledItems) {
    const gross = itemGross(item);
    const net = money(item.subtotal);
    itemGrossTotal = money(itemGrossTotal + gross);
    netSettled = money(netSettled + net);
    if (item.transaction_id) {
      const transactionId = String(item.transaction_id);
      itemGrossByTransaction.set(
        transactionId,
        money((itemGrossByTransaction.get(transactionId) || 0) + gross),
      );
    } else {
      orphanItemGross = money(orphanItemGross + gross);
    }
    // Fee is derived only from item ledger rows that actually exist. Missing
    // legacy items are reported as an allocation gap, never disguised as fee.
    recordedFee = money(recordedFee + money(gross - net));
    const metadata = asObject(item.metadata) || {};
    if (String(metadata.status || '').toLowerCase() === 'failed') {
      if (item.transaction_id) fulfillmentFailedTransactions.add(String(item.transaction_id));
      fulfillmentFailedAmount = money(fulfillmentFailedAmount + gross);
    }

    const product = asObject(item.products);
    const directProfile = asObject(item.profiles);
    const productProfile = asObject(product?.profiles);
    const sellerId = item.seller_id || product?.seller_id || null;

    if (metadata.is_digital === true) {
      addBreakdownAmount(breakdown, 'digital', 'Produk Digital (PPOB)', 'digital', gross);
    } else if (sellerId) {
      addBreakdownAmount(
        breakdown,
        String(sellerId),
        String(directProfile?.name || productProfile?.name || 'Penjual tanpa nama'),
        'seller',
        gross,
      );
    } else {
      addBreakdownAmount(breakdown, 'unallocated', 'Belum teralokasi', 'unallocated', gross);
    }
  }

  // Reconcile each transaction independently so a missing ledger on one order
  // cannot be hidden by over-allocation on another order.
  const knownTransactionIds = new Set<string>();
  let unallocatedGross = 0;
  let overallocatedGross = orphanItemGross;
  for (const transaction of settledTransactions) {
    const transactionId = String(transaction.id || '');
    if (transactionId) knownTransactionIds.add(transactionId);
    const difference = money(
      money(transaction.total_amount) - (itemGrossByTransaction.get(transactionId) || 0),
    );
    if (difference > 0) unallocatedGross = money(unallocatedGross + difference);
    if (difference < 0) overallocatedGross = money(overallocatedGross + Math.abs(difference));
  }
  for (const [transactionId, gross] of itemGrossByTransaction) {
    if (!knownTransactionIds.has(transactionId)) {
      overallocatedGross = money(overallocatedGross + gross);
    }
  }
  const allocationDifference = money(unallocatedGross - overallocatedGross);
  if (unallocatedGross > 0) {
    addBreakdownAmount(
      breakdown,
      'unallocated',
      'Belum teralokasi',
      'unallocated',
      unallocatedGross,
    );
  }
  if (overallocatedGross > 0) {
    addBreakdownAmount(
      breakdown,
      'overallocated',
      'Koreksi alokasi berlebih',
      'unallocated',
      -overallocatedGross,
    );
  }

  const sellerBreakdown = [...breakdown.values()]
    .filter(entry => entry.total !== 0)
    .sort((left, right) => right.total - left.total || left.name.localeCompare(right.name));
  const finalBreakdownTotal = money(sellerBreakdown.reduce((total, entry) => total + entry.total, 0));
  const finalDifference = money(grossSettled - finalBreakdownTotal);
  if (finalDifference !== 0) {
    const existing = sellerBreakdown.find(entry => entry.id === 'unallocated');
    if (existing) existing.total = money(existing.total + finalDifference);
    else sellerBreakdown.push({
      id: 'unallocated',
      name: 'Belum teralokasi',
      total: finalDifference,
      kind: 'unallocated',
    });
  }

  const now = input.now || new Date();
  const chartKeys = lastSevenWitaDateKeys(now);
  const chartSales = Object.fromEntries(chartKeys.map(key => [key, 0]));
  for (const transaction of settledTransactions) {
    const key = witaDateKey(transaction.created_at);
    if (key && Object.prototype.hasOwnProperty.call(chartSales, key)) {
      chartSales[key] = money(chartSales[key] + money(transaction.total_amount));
    }
  }

  return {
    metrics: {
      grossSettled,
      recordedFee,
      netSettled,
      itemGrossSettled: itemGrossTotal,
      allocationDifference,
      unallocatedGross,
      overallocatedGross,
      ledgerComplete: unallocatedGross === 0 && overallocatedGross === 0,
      settledCount: settledTransactions.length,
      pendingCount: input.pendingCount,
      failedCount: input.failedTransactions.length,
      failedAmount,
      validationFailedCount: input.validationFailedCount,
      fulfillmentFailedCount: fulfillmentFailedTransactions.size,
      fulfillmentFailedAmount,
      totalSellers: input.totalSellers,
      activeSellers: input.activeSellers,
      pendingWithdrawals: input.pendingWithdrawals,
    },
    sellerBreakdown,
    salesChart: chartKeys.map(date => ({ date, label: chartLabel(date), sales: chartSales[date] })),
    recentSettled: settledTransactions.slice(0, 5).map(transaction => normalizeTransactionHistoryRow(transaction)),
    pendingTransactions: input.pendingTransactions.slice(0, 10).map(transaction => normalizeTransactionHistoryRow(transaction)),
  };
}

async function loadOverview(supabase: any) {
  const settledTransactionsPromise = fetchAllByRange<any>(() => supabase
    .from('transactions')
    .select('id,buyer_name,buyer_id,total_amount,status,payment_method,receipt_image,created_at,metadata')
    .in('status', [...SETTLED_STATUSES])
    .order('created_at', { ascending: true })
    .order('id', { ascending: true }));

  const settledItemsPromise = fetchAllByRange<any>(() => supabase
    .from('transaction_items')
    .select(`
      id,transaction_id,seller_id,quantity,price,subtotal,metadata,created_at,
      profiles:seller_id(name),
      products(seller_id,profiles:seller_id(name)),
      transactions!inner(status)
    `)
    .in('transactions.status', [...SETTLED_STATUSES])
    .order('created_at', { ascending: true })
    .order('id', { ascending: true }));

  const failedTransactionsPromise = fetchAllByRange<any>(() => supabase
    .from('transactions')
    .select('id,total_amount,created_at')
    .eq('status', 'failed')
    .order('created_at', { ascending: true })
    .order('id', { ascending: true }));

  const pendingQuery = supabase
    .from('transactions')
    .select('id,buyer_name,buyer_id,total_amount,status,payment_method,receipt_image,created_at,metadata', { count: 'exact' })
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(10);

  const validationFailedCountQuery = supabase
    .from('failed_transactions')
    .select('id', { count: 'exact', head: true });
  const totalSellersQuery = supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'seller');
  const activeSellersQuery = supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'seller')
    .eq('is_active', true);
  const pendingWithdrawalsQuery = supabase
    .from('withdrawals')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  const [
    settledTransactions,
    settledItems,
    failedTransactions,
    pendingResultRaw,
    validationResultRaw,
    totalSellersResultRaw,
    activeSellersResultRaw,
    pendingWithdrawalsResultRaw,
  ] = await Promise.all([
    settledTransactionsPromise,
    settledItemsPromise,
    failedTransactionsPromise,
    pendingQuery,
    validationFailedCountQuery,
    totalSellersQuery,
    activeSellersQuery,
    pendingWithdrawalsQuery,
  ]);

  const pendingResult = ensureQueryResult(pendingResultRaw, 'pending transaction overview');
  const validationResult = ensureQueryResult(validationResultRaw, 'validation failure count');
  const totalSellersResult = ensureQueryResult(totalSellersResultRaw, 'seller count');
  const activeSellersResult = ensureQueryResult(activeSellersResultRaw, 'active seller count');
  const pendingWithdrawalsResult = ensureQueryResult(pendingWithdrawalsResultRaw, 'pending withdrawal count');

  return buildOverviewData({
    settledTransactions,
    settledItems,
    pendingTransactions: pendingResult.data,
    pendingCount: Number(pendingResult.count || 0),
    failedTransactions,
    validationFailedCount: Number(validationResult.count || 0),
    totalSellers: Number(totalSellersResult.count || 0),
    activeSellers: Number(activeSellersResult.count || 0),
    pendingWithdrawals: Number(pendingWithdrawalsResult.count || 0),
  });
}

function logReportingFailure(endpoint: string, error: unknown) {
  // Only operational codes are logged; request filters and report rows can contain PII.
  const code = error instanceof ReportingQueryError ? error.code : 'UNEXPECTED_ERROR';
  console.error('[admin-reporting] request failed', { endpoint, code });
}

export function registerAdminReportingRoutes(app: any, { supabase }: { supabase: any }) {
  app.get('/api/admin/transactions/history', async (req: Request, res: Response) => {
    try {
      if (!await requireReportingAdmin(supabase, req, res)) return;
      const filters = parseHistoryQuery(req.query as Record<string, unknown>);
      const report = await loadHistory(supabase, filters);
      res.json({ success: true, ...report });
    } catch (error) {
      if (error instanceof ReportingRequestError) {
        res.status(error.statusCode).json({ success: false, error: error.message });
        return;
      }
      logReportingFailure('transactions/history', error);
      res.status(500).json({ success: false, error: 'Gagal memuat riwayat transaksi.' });
    }
  });

  app.get('/api/admin/dashboard/overview', async (req: Request, res: Response) => {
    try {
      if (!await requireReportingAdmin(supabase, req, res)) return;
      const data = await loadOverview(supabase);
      res.json({ success: true, data });
    } catch (error) {
      logReportingFailure('dashboard/overview', error);
      res.status(500).json({ success: false, error: 'Gagal memuat overview dashboard.' });
    }
  });
}
