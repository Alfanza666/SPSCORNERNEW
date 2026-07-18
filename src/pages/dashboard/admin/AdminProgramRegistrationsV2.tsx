import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  TicketCheck,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/useAuthStore';

interface RegistrationPayment {
  id: string;
  status: string;
  payment_method?: string;
  expected_amount?: number | string;
  paid_amount?: number | string | null;
  proof_url?: string | null;
  created_at?: string;
}

interface RegistrationItem {
  id: string;
  item_name: string;
  item_type: string;
  beneficiary_type?: 'employee' | 'family';
  beneficiary_index?: number | null;
  quantity: number;
  unit_price: number | string;
  line_total?: number | string | null;
}

interface RegistrationCoupon {
  id: string;
  status: string;
  entitlement_code?: string | null;
  beneficiary_type?: 'employee' | 'family' | null;
  beneficiary_index?: number | null;
  name?: string | null;
  coupon_code?: string | null;
  qr_code?: string | null;
}

interface TicketIntegrity {
  expected_count: number;
  issued_count: number;
  missing_count: number;
  family_expected_count: number;
  family_issued_count: number;
  repairable: boolean;
}

interface ProgramOption {
  id: string;
  name: string;
}

interface RegistrationPagination {
  count: number;
  limit: number;
  offset: number;
}

interface ProgramRegistration {
  id: string;
  program_id: string;
  nik: string;
  attendee_name?: string | null;
  attendance_status: string;
  registration_status: string;
  payment_status: string;
  total_amount: number | string;
  family_count: number;
  shirt_size?: string | null;
  is_camping?: boolean | null;
  submitted_at?: string | null;
  created_at: string;
  program?: { id: string; name?: string } | null;
  programs?: { id: string; name?: string } | null;
  payments?: RegistrationPayment[];
  items?: RegistrationItem[];
  coupons?: RegistrationCoupon[];
  ticket_integrity?: TicketIntegrity | null;
}

type StatusFilter = 'under_review' | 'pending' | 'paid' | 'failed' | 'not_required' | 'all';

const PAGE_SIZE = 100;
const RECONCILIATION_REASON = 'Audit integritas tiket dari panel Verifikasi RSVP';

const STATUS_TABS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'Semua' },
  { value: 'under_review', label: 'Perlu diperiksa' },
  { value: 'pending', label: 'Belum unggah' },
  { value: 'paid', label: 'Disetujui' },
  { value: 'not_required', label: 'Tanpa pembayaran' },
  { value: 'failed', label: 'Ditolak' },
];

function formatMoney(value: number | string | null | undefined) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    under_review: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900',
    payment_review: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900',
    pending: 'bg-zinc-100 text-zinc-600 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700',
    payment_pending: 'bg-zinc-100 text-zinc-600 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700',
    paid: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900',
    confirmed: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900',
    not_required: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900',
    failed: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900',
    rejected: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900',
    payment_rejected: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900',
    draft: 'bg-zinc-100 text-zinc-600 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700',
    submitted: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900',
    pending_payment: 'bg-zinc-100 text-zinc-600 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700',
    locked: 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-900',
    declined: 'bg-zinc-100 text-zinc-600 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700',
  };
  const labels: Record<string, string> = {
    under_review: 'Perlu diperiksa',
    payment_review: 'Review pembayaran',
    pending: 'Menunggu bukti',
    payment_pending: 'Menunggu pembayaran',
    paid: 'Disetujui',
    confirmed: 'Terkonfirmasi',
    not_required: 'Tanpa pembayaran',
    failed: 'Ditolak',
    rejected: 'Ditolak',
    payment_rejected: 'Pembayaran ditolak',
    draft: 'Draf',
    submitted: 'Terkirim',
    pending_payment: 'Menunggu pembayaran',
    locked: 'Dikunci',
    declined: 'Tidak hadir',
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ring-inset ${styles[status] || styles.pending}`}>{labels[status] || status}</span>;
}

function hasMissingTickets(registration: ProgramRegistration) {
  return Number(registration.ticket_integrity?.missing_count || 0) > 0;
}

function couponBeneficiaryLabel(coupon: RegistrationCoupon) {
  if (coupon.beneficiary_type === 'family') return `Keluarga ${coupon.beneficiary_index || ''}`.trim();
  return 'Karyawan';
}

function itemBeneficiaryLabel(item: RegistrationItem) {
  if (item.beneficiary_type === 'family') return item.beneficiary_index ? `Keluarga ${item.beneficiary_index}` : 'Keluarga';
  return 'Karyawan';
}

function readableCode(value?: string | null) {
  return value ? value.replace(/_/g, ' ') : '—';
}

interface RegistrationAuditDetailsProps {
  registration: ProgramRegistration;
  actionBusy: boolean;
  reconciliationBusy: boolean;
  onReconcile: () => void;
}

function RegistrationAuditDetails({
  registration,
  actionBusy,
  reconciliationBusy,
  onReconcile,
}: RegistrationAuditDetailsProps) {
  const payment = registration.payments?.[0];
  const items = registration.items || [];
  const coupons = registration.coupons || [];
  const integrity = registration.ticket_integrity;
  const familyCoupons = coupons.filter(coupon => coupon.beneficiary_type === 'family');

  return (
    <div className="mt-5 space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-zinc-700 dark:bg-zinc-950/60">
        <h3 className="text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-zinc-400">Status workflow</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Registrasi</p>
            <div className="mt-1.5">{statusBadge(registration.registration_status)}</div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pembayaran</p>
            <div className="mt-1.5">{statusBadge(payment?.status || registration.payment_status)}</div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Metode / tagihan</p>
            <p className="mt-1 text-sm font-bold text-zinc-800 dark:text-zinc-100">
              {readableCode(payment?.payment_method)} · {formatMoney(payment?.expected_amount ?? registration.total_amount)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Nominal dibayar</p>
            <p className="mt-1 text-sm font-bold text-zinc-800 dark:text-zinc-100">{formatMoney(payment?.paid_amount)}</p>
          </div>
        </div>
        {payment?.proof_url && (
          <a
            href={payment.proof_url}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-indigo-200 bg-white px-3 text-xs font-bold text-indigo-700 hover:bg-indigo-50 dark:border-indigo-900 dark:bg-zinc-900 dark:text-indigo-300"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Buka bukti pembayaran
          </a>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 p-4 dark:border-zinc-700">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-zinc-400">Integritas tiket / QR</h3>
            <p className="mt-1 text-xs text-slate-400">{registration.family_count || 0} anggota keluarga terdaftar</p>
          </div>
          {integrity && (
            <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ring-inset ${integrity.missing_count > 0
              ? 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900'
              : 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900'}`}
            >
              {integrity.missing_count > 0 ? 'Belum lengkap' : 'Lengkap'}
            </span>
          )}
        </div>
        {integrity ? (
          <>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: 'Total seharusnya', value: integrity.expected_count },
                { label: 'Total terbit', value: integrity.issued_count },
                { label: 'Keluarga seharusnya', value: integrity.family_expected_count },
                { label: 'Keluarga terbit', value: integrity.family_issued_count },
              ].map(item => (
                <div key={item.label} className="rounded-xl bg-slate-50 p-3 dark:bg-zinc-950">
                  <p className="text-lg font-black tabular-nums text-zinc-900 dark:text-white">{item.value}</p>
                  <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">{item.label}</p>
                </div>
              ))}
            </div>
            {integrity.missing_count > 0 && (
              <div className="mt-3 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                <div>
                  <p className="text-xs font-black">QR belum lengkap: {integrity.missing_count} tiket belum terbit.</p>
                  <p className="mt-1 text-[11px] leading-5">Rekonsiliasi hanya menambahkan entitlement yang belum ada.</p>
                </div>
                {integrity.repairable && (
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={onReconcile}
                    className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-600 px-3 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    {reconciliationBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    Rekonsiliasi tiket
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500 dark:bg-zinc-950 dark:text-zinc-400">
            Ringkasan integritas tiket belum tersedia pada respons API ini.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 p-4 dark:border-zinc-700">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-zinc-400">Rincian biaya</h3>
          <span className="text-xs font-bold text-slate-400">{items.length} item</span>
        </div>
        {items.length > 0 ? (
          <div className="mt-3 divide-y divide-slate-100 dark:divide-zinc-800">
            {items.map(item => (
              <div key={item.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100">{item.item_name}</p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {itemBeneficiaryLabel(item)} · {item.quantity} × {formatMoney(item.unit_price)}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-black text-zinc-900 dark:text-white">
                  {formatMoney(item.line_total ?? Number(item.unit_price || 0) * Number(item.quantity || 0))}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs text-slate-400">Tidak ada biaya tambahan pada registrasi ini.</p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 p-4 dark:border-zinc-700">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-zinc-400">Tiket & kupon terbit</h3>
          <span className="text-xs font-bold text-slate-400">{coupons.length} total · {familyCoupons.length} keluarga</span>
        </div>
        {coupons.length > 0 ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {coupons.map(coupon => (
              <div key={coupon.id} className="min-w-0 rounded-xl bg-slate-50 p-3 dark:bg-zinc-950">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-black text-zinc-800 dark:text-zinc-100">{coupon.name || couponBeneficiaryLabel(coupon)}</p>
                  {statusBadge(coupon.status)}
                </div>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">
                  {couponBeneficiaryLabel(coupon)} · {readableCode(coupon.entitlement_code)}
                </p>
                <p className="mt-2 break-all font-mono text-[10px] text-slate-400">{coupon.coupon_code || coupon.qr_code || 'Kode QR tidak tersedia'}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs text-slate-400">Belum ada tiket atau kupon yang diterbitkan.</p>
        )}
      </section>
    </div>
  );
}

export default function AdminProgramRegistrationsV2() {
  const { user } = useAuthStore();
  const [registrations, setRegistrations] = useState<ProgramRegistration[]>([]);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [loading, setLoading] = useState(true);
  const [programsLoading, setProgramsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [offset, setOffset] = useState(0);
  const [pagination, setPagination] = useState<RegistrationPagination>({ count: 0, limit: PAGE_SIZE, offset: 0 });
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ProgramRegistration | null>(null);
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const registrationRequestSequence = useRef(0);

  const loadPrograms = useCallback(async () => {
    setProgramsLoading(true);
    try {
      const { data, error } = await supabase
        .from('union_programs')
        .select('id, name')
        .eq('program_type', 'gathering')
        .order('name');
      if (error) throw error;
      setPrograms(data || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Daftar program belum dapat dimuat.');
    } finally {
      setProgramsLoading(false);
    }
  }, []);

  const loadRegistrations = useCallback(async () => {
    const requestSequence = ++registrationRequestSequence.current;
    setLoading(true);
    setLoadError(null);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (requestSequence !== registrationRequestSequence.current) return;
      if (!token) throw new Error('Sesi admin berakhir. Silakan masuk kembali.');
      const query = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
      if (filter !== 'all') query.set('paymentStatus', filter);
      if (selectedProgramId) query.set('programId', selectedProgramId);
      const response = await fetch(`/api/admin/program-registrations-v2?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (requestSequence !== registrationRequestSequence.current) return;
      if (!response.ok) throw new Error(payload.error || payload.message || 'Data registrasi belum dapat dimuat.');
      const responsePagination = payload.pagination || {};
      const responseCount = Math.max(0, Number(responsePagination.count || 0));
      const responseLimit = Math.max(1, Number(responsePagination.limit || PAGE_SIZE));
      const lastValidOffset = responseCount === 0
        ? 0
        : Math.floor((responseCount - 1) / responseLimit) * responseLimit;
      if (offset > lastValidOffset) {
        setOffset(lastValidOffset);
        setPagination({ count: responseCount, limit: responseLimit, offset: lastValidOffset });
        return;
      }
      setRegistrations(Array.isArray(payload.data) ? payload.data : payload.data?.registrations || []);
      setPagination({
        count: responseCount,
        limit: responseLimit,
        offset: Math.max(0, Number(responsePagination.offset ?? offset)),
      });
    } catch (error) {
      if (requestSequence !== registrationRequestSequence.current) return;
      setLoadError(error instanceof Error ? error.message : 'Data registrasi belum dapat dimuat.');
    } finally {
      if (requestSequence === registrationRequestSequence.current) setLoading(false);
    }
  }, [filter, offset, selectedProgramId]);

  useEffect(() => { void loadPrograms(); }, [loadPrograms]);
  useEffect(() => { void loadRegistrations(); }, [loadRegistrations]);

  const handleFilterChange = (nextFilter: StatusFilter) => {
    setOffset(0);
    setFilter(nextFilter);
  };

  const handleProgramChange = (programId: string) => {
    setOffset(0);
    setSelectedProgramId(programId);
  };

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('id-ID');
    if (!query) return registrations;
    return registrations.filter(registration => {
      const programName = registration.program?.name || registration.programs?.name || '';
      return `${registration.nik} ${registration.attendee_name || ''} ${programName}`.toLocaleLowerCase('id-ID').includes(query);
    });
  }, [registrations, search]);

  const stats = useMemo(() => ({
    review: registrations.filter(item => item.payment_status === 'under_review').length,
    paid: registrations.filter(item => item.payment_status === 'paid').length,
    family: registrations.reduce((total, item) => total + Number(item.family_count || 0), 0),
  }), [registrations]);

  const pageLimit = Math.max(1, pagination.limit || PAGE_SIZE);
  const currentPage = Math.floor(pagination.offset / pageLimit) + 1;
  const totalPages = Math.max(1, Math.ceil(pagination.count / pageLimit));
  const pageStart = pagination.count === 0 ? 0 : pagination.offset + 1;
  const pageEnd = Math.min(pagination.offset + registrations.length, pagination.count);

  const submitDecision = async () => {
    if (!selected || !decision) return;
    const payment = selected.payments?.[0];
    if (!payment?.id) return toast.error('Data pembayaran tidak ditemukan.');
    if (decision === 'reject' && decisionNote.trim().length < 3) return toast.error('Tuliskan alasan penolakan.');
    setActionLoading(payment.id);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) throw new Error('Sesi admin berakhir.');
      const endpoint = `/api/admin/program-registrations-v2/${selected.id}/payments/${payment.id}/${decision}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(decision === 'approve'
          ? { paidAmount: Number(payment.expected_amount || selected.total_amount), note: decisionNote.trim() || undefined }
          : { reason: decisionNote.trim() }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || payload.message || 'Keputusan belum berhasil disimpan.');
      toast.success(decision === 'approve' ? 'Pembayaran disetujui dan QR diterbitkan.' : 'Bukti pembayaran ditolak.');
      setSelected(null);
      setDecision(null);
      setDecisionNote('');
      await loadRegistrations();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Keputusan belum berhasil disimpan.');
    } finally {
      setActionLoading(null);
    }
  };

  const reconcileEntitlements = async (registration: ProgramRegistration) => {
    const loadingKey = `reconcile:${registration.id}`;
    setActionLoading(loadingKey);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) throw new Error('Sesi admin berakhir.');
      const response = await fetch(`/api/admin/program-registrations-v2/${registration.id}/reconcile-entitlements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: RECONCILIATION_REASON }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || payload.message || 'Rekonsiliasi tiket belum berhasil.');
      toast.success(payload.message || 'Integritas tiket berhasil direkonsiliasi.');
      setSelected(null);
      setDecision(null);
      await loadRegistrations();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Rekonsiliasi tiket belum berhasil.');
    } finally {
      setActionLoading(null);
    }
  };

  const unlockRegistration = async (registration: ProgramRegistration) => {
    const reason = window.prompt('Alasan membuka kembali registrasi untuk diedit peserta:')?.trim();
    if (!reason) return;
    setActionLoading(registration.id);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) throw new Error('Sesi admin berakhir.');
      const response = await fetch(`/api/admin/program-registrations-v2/${registration.id}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || payload.message || 'Registrasi belum dapat dibuka.');
      toast.success('Registrasi dibuka kembali untuk diedit peserta.');
      await loadRegistrations();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Registrasi belum dapat dibuka.');
    } finally {
      setActionLoading(null);
    }
  };

  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) return <div className="p-8 text-center font-bold text-rose-600">Akses ditolak.</div>;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8 dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl">
        <header className="overflow-hidden rounded-[2rem] bg-zinc-950 p-6 text-white shadow-2xl sm:p-8 dark:bg-zinc-900">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-200"><ShieldCheck className="h-3.5 w-3.5" /> Payment control center</span>
              <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Verifikasi RSVP & pembayaran</h1>
              <p className="mt-3 max-w-xl text-sm leading-7 text-zinc-400">Setujui bukti manual sebelum tiket kehadiran dan kupon makan diterbitkan untuk karyawan serta keluarga.</p>
            </div>
            <button type="button" onClick={() => void loadRegistrations()} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-2xl border border-white/15 bg-white/10 px-4 text-xs font-bold text-white transition hover:bg-white/15 disabled:opacity-50 lg:self-auto"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Muat ulang</button>
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            {[{ label: 'Perlu diperiksa (halaman ini)', value: stats.review, icon: Clock3 }, { label: 'Disetujui (halaman ini)', value: stats.paid, icon: TicketCheck }, { label: 'Keluarga (halaman ini)', value: stats.family, icon: Users }].map(item => <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-4"><item.icon className="h-5 w-5 text-indigo-300" /><p className="mt-3 text-2xl font-black tabular-nums">{item.value}</p><p className="mt-1 text-xs font-semibold text-zinc-500">{item.label}</p></div>)}
          </div>
        </header>

        <div className="mt-6 rounded-[1.75rem] border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="grid gap-4 border-b border-slate-100 p-4 sm:p-5 xl:grid-cols-[minmax(14rem,0.6fr)_minmax(0,1.4fr)_minmax(16rem,0.75fr)] xl:items-end dark:border-zinc-800">
            <label className="block min-w-0">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Program gathering</span>
              <select
                value={selectedProgramId}
                onChange={event => handleProgramChange(event.target.value)}
                disabled={programsLoading}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-zinc-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
              >
                <option value="">{programsLoading ? 'Memuat program…' : 'Semua program gathering'}</option>
                {programs.map(program => <option key={program.id} value={program.id}>{program.name}</option>)}
              </select>
            </label>
            <div className="min-w-0">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Status pembayaran</p>
              <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-zinc-800">
                {STATUS_TABS.map(tab => (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => handleFilterChange(tab.value)}
                    className={`whitespace-nowrap rounded-lg px-3 py-2 text-[11px] font-bold transition ${filter === tab.value ? 'bg-white text-indigo-700 shadow-sm dark:bg-zinc-700 dark:text-indigo-300' : 'text-slate-500 dark:text-zinc-400'}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="relative block w-full">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Pencarian halaman ini</span>
              <Search className="pointer-events-none absolute bottom-3.5 left-3 h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                placeholder="Cari nama, NIK, atau program…"
              />
            </label>
          </div>

          {loading ? (
            <div className="flex min-h-72 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>
          ) : loadError ? (
            <div className="m-5 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
              <p className="font-bold">Workflow V2 belum dapat dimuat</p>
              <p className="mt-1 leading-6">{loadError}</p>
              <button type="button" onClick={() => void loadRegistrations()} className="mt-4 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white">Coba lagi</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-300" />
              <h2 className="mt-4 font-bold text-zinc-800 dark:text-white">{search.trim() ? 'Tidak ada peserta yang cocok' : 'Tidak ada registrasi pada filter ini'}</h2>
              <p className="mt-1 text-sm text-zinc-400">{search.trim() ? 'Coba kata kunci lain pada halaman data ini.' : 'Data baru akan muncul otomatis setelah peserta mengirim RSVP.'}</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-zinc-800">
              {filtered.map(registration => {
                const payment = registration.payments?.[0];
                const programName = registration.program?.name || registration.programs?.name || 'Program kerja';
                const integrity = registration.ticket_integrity;
                const reconciliationKey = `reconcile:${registration.id}`;
                return (
                  <article key={registration.id} className="grid gap-4 p-4 transition hover:bg-slate-50/60 sm:p-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(10rem,0.5fr)_minmax(11rem,0.55fr)_auto] lg:items-center dark:hover:bg-zinc-800/30">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {statusBadge(payment?.status || registration.payment_status)}
                        {hasMissingTickets(registration) && (
                          <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900">
                            QR belum lengkap ({integrity?.missing_count})
                          </span>
                        )}
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{programName}</span>
                      </div>
                      <h3 className="mt-2 truncate text-base font-bold text-zinc-900 dark:text-white">{registration.attendee_name || 'Peserta tanpa nama'}</h3>
                      <p className="mt-1 text-xs text-zinc-500">
                        NIK {registration.nik} · {registration.family_count || 0} keluarga · {registration.shirt_size ? `Baju ${registration.shirt_size.toUpperCase()}` : 'Tanpa baju'}
                      </p>
                      {integrity && (
                        <p className={`mt-1 text-[11px] font-bold ${integrity.missing_count > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {integrity.issued_count}/{integrity.expected_count} tiket terbit · keluarga {integrity.family_issued_count}/{integrity.family_expected_count}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Total tambahan</p>
                      <p className="mt-1 text-lg font-black text-zinc-900 dark:text-white">{formatMoney(registration.total_amount)}</p>
                      <p className="mt-1 text-[10px] text-slate-400">{formatDate(registration.submitted_at || registration.created_at)}</p>
                    </div>
                    <div>
                      {payment?.proof_url ? (
                        <a href={payment.proof_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-300">
                          <ExternalLink className="h-3.5 w-3.5" /> Lihat bukti
                        </a>
                      ) : (
                        <span className="text-xs font-semibold text-slate-400">Belum ada bukti</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <button
                        type="button"
                        onClick={() => { setSelected(registration); setDecision(null); setDecisionNote(''); }}
                        className="h-10 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        Detail
                      </button>
                      {payment?.status === 'under_review' && (
                        <>
                          <button type="button" onClick={() => { setSelected(registration); setDecision('reject'); setDecisionNote(''); }} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-rose-200 px-3 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:border-rose-900">
                            <XCircle className="h-4 w-4" /> Tolak
                          </button>
                          <button type="button" onClick={() => { setSelected(registration); setDecision('approve'); setDecisionNote(''); }} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white shadow-sm hover:bg-emerald-700">
                            <CheckCircle2 className="h-4 w-4" /> Setujui
                          </button>
                        </>
                      )}
                      {integrity?.repairable && integrity.missing_count > 0 && (
                        <button
                          type="button"
                          disabled={Boolean(actionLoading)}
                          onClick={() => void reconcileEntitlements(registration)}
                          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-amber-600 px-3 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"
                        >
                          {actionLoading === reconciliationKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                          Perbaiki QR
                        </button>
                      )}
                      {registration.registration_status === 'confirmed' && registration.payment_status === 'not_required' && (
                        <button
                          type="button"
                          disabled={Boolean(actionLoading)}
                          onClick={() => void unlockRegistration(registration)}
                          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-amber-200 px-3 text-xs font-bold text-amber-700 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-900 dark:text-amber-300"
                        >
                          {actionLoading === registration.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                          Buka edit
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {!loading && !loadError && (
            <div className="flex flex-col gap-3 border-t border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5 dark:border-zinc-800">
              <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                Data {pageStart}–{pageEnd} dari {pagination.count} · Halaman {currentPage}/{totalPages}
                {search.trim() && ` · ${filtered.length} cocok di halaman ini`}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <button
                  type="button"
                  disabled={pagination.offset <= 0 || loading}
                  onClick={() => setOffset(Math.max(0, pagination.offset - pageLimit))}
                  className="min-h-10 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Sebelumnya
                </button>
                <button
                  type="button"
                  disabled={pagination.offset + pageLimit >= pagination.count || loading}
                  onClick={() => setOffset(pagination.offset + pageLimit)}
                  className="min-h-10 rounded-xl bg-zinc-900 px-4 text-xs font-bold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  Berikutnya
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={decision ? 'Keputusan pembayaran' : 'Detail registrasi'}
        >
          <button type="button" aria-label="Tutup" onClick={() => { setSelected(null); setDecision(null); }} className="absolute inset-0" />
          <div className="relative max-h-[calc(100dvh-0.75rem)] w-full max-w-3xl overflow-y-auto rounded-t-[2rem] border border-slate-200 bg-white p-5 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-[2rem] sm:p-7 dark:border-zinc-700 dark:bg-zinc-900">
            <button
              type="button"
              aria-label="Tutup detail"
              onClick={() => { setSelected(null); setDecision(null); }}
              className="absolute right-4 top-4 rounded-full bg-white/90 p-2 text-slate-400 shadow-sm hover:bg-slate-100 dark:bg-zinc-900/90 dark:hover:bg-zinc-800"
            >
              <X className="h-4 w-4" />
            </button>
            <p className="pr-10 text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-600">Audit registrasi & entitlement</p>
            <h2 className="mt-2 pr-10 text-xl font-black text-zinc-900 dark:text-white">
              {decision === 'approve' ? 'Setujui pembayaran?' : decision === 'reject' ? 'Tolak bukti pembayaran?' : 'Detail registrasi'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {selected.attendee_name || selected.nik} · NIK {selected.nik} · {formatMoney(selected.total_amount)}
            </p>

            <RegistrationAuditDetails
              registration={selected}
              actionBusy={Boolean(actionLoading)}
              reconciliationBusy={actionLoading === `reconcile:${selected.id}`}
              onReconcile={() => void reconcileEntitlements(selected)}
            />

            {decision && (
              <>
                <label className="mt-5 block">
                  <span className="mb-2 block text-xs font-bold text-slate-600 dark:text-zinc-300">
                    {decision === 'reject' ? 'Alasan penolakan (wajib)' : 'Catatan admin (opsional)'}
                  </span>
                  <textarea
                    rows={3}
                    value={decisionNote}
                    onChange={event => setDecisionNote(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                    placeholder={decision === 'reject' ? 'Contoh: nominal pada bukti tidak sesuai' : 'Catatan verifikasi'}
                  />
                </label>
                <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-xs leading-5 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                  {decision === 'approve'
                    ? 'Persetujuan akan menerbitkan QR kehadiran dan kupon makan secara terpisah untuk karyawan serta setiap anggota keluarga.'
                    : 'Penolakan tidak menerbitkan QR. Peserta dapat mengunggah bukti pengganti sesuai kebijakan program.'}
                </div>
                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
                  <button type="button" onClick={() => { setSelected(null); setDecision(null); }} className="min-h-11 flex-1 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 dark:border-zinc-700 dark:text-zinc-300">
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={() => void submitDecision()}
                    disabled={Boolean(actionLoading)}
                    className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-bold text-white disabled:opacity-50 ${decision === 'approve' ? 'bg-emerald-600' : 'bg-rose-600'}`}
                  >
                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : decision === 'approve' ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    {decision === 'approve' ? 'Setujui & terbitkan QR' : 'Tolak bukti'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
