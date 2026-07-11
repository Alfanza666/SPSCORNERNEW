import { useCallback, useEffect, useMemo, useState } from 'react';
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
}

type StatusFilter = 'under_review' | 'pending' | 'paid' | 'failed' | 'all';

const STATUS_TABS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'under_review', label: 'Perlu diperiksa' },
  { value: 'pending', label: 'Belum unggah' },
  { value: 'paid', label: 'Disetujui' },
  { value: 'failed', label: 'Ditolak' },
  { value: 'all', label: 'Semua' },
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
    pending: 'bg-zinc-100 text-zinc-600 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700',
    paid: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900',
    rejected: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900',
  };
  const labels: Record<string, string> = { under_review: 'Perlu diperiksa', pending: 'Menunggu bukti', paid: 'Disetujui', rejected: 'Ditolak' };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ring-inset ${styles[status] || styles.pending}`}>{labels[status] || status}</span>;
}

export default function AdminProgramRegistrationsV2() {
  const { user } = useAuthStore();
  const [registrations, setRegistrations] = useState<ProgramRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('under_review');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ProgramRegistration | null>(null);
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadRegistrations = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) throw new Error('Sesi admin berakhir. Silakan masuk kembali.');
      const query = new URLSearchParams({ limit: '200', offset: '0' });
      if (filter !== 'all') query.set('paymentStatus', filter);
      const response = await fetch(`/api/admin/program-registrations-v2?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || payload.message || 'Data registrasi belum dapat dimuat.');
      setRegistrations(Array.isArray(payload.data) ? payload.data : payload.data?.registrations || []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Data registrasi belum dapat dimuat.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { void loadRegistrations(); }, [loadRegistrations]);

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
            {[{ label: 'Perlu diperiksa', value: stats.review, icon: Clock3 }, { label: 'Sudah disetujui', value: stats.paid, icon: TicketCheck }, { label: 'Anggota keluarga', value: stats.family, icon: Users }].map(item => <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-4"><item.icon className="h-5 w-5 text-indigo-300" /><p className="mt-3 text-2xl font-black tabular-nums">{item.value}</p><p className="mt-1 text-xs font-semibold text-zinc-500">{item.label}</p></div>)}
          </div>
        </header>

        <div className="mt-6 rounded-[1.75rem] border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between dark:border-zinc-800">
            <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-zinc-800">
              {STATUS_TABS.map(tab => <button key={tab.value} type="button" onClick={() => setFilter(tab.value)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-[11px] font-bold transition ${filter === tab.value ? 'bg-white text-indigo-700 shadow-sm dark:bg-zinc-700 dark:text-indigo-300' : 'text-slate-500 dark:text-zinc-400'}`}>{tab.label}</button>)}
            </div>
            <label className="relative block w-full lg:max-w-sm"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><span className="sr-only">Cari peserta</span><input value={search} onChange={event => setSearch(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white" placeholder="Cari nama, NIK, atau program…" /></label>
          </div>

          {loading ? <div className="flex min-h-72 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>
            : loadError ? <div className="m-5 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300"><p className="font-bold">Workflow V2 belum dapat dimuat</p><p className="mt-1 leading-6">{loadError}</p><button type="button" onClick={() => void loadRegistrations()} className="mt-4 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white">Coba lagi</button></div>
            : filtered.length === 0 ? <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center"><CheckCircle2 className="h-12 w-12 text-emerald-300" /><h2 className="mt-4 font-bold text-zinc-800 dark:text-white">Tidak ada antrean pada status ini</h2><p className="mt-1 text-sm text-zinc-400">Bukti pembayaran baru akan muncul otomatis.</p></div>
            : <div className="divide-y divide-slate-100 dark:divide-zinc-800">{filtered.map(registration => {
                const payment = registration.payments?.[0];
                const programName = registration.program?.name || registration.programs?.name || 'Program kerja';
                return <article key={registration.id} className="grid gap-4 p-4 transition hover:bg-slate-50/60 sm:p-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(11rem,0.55fr)_minmax(12rem,0.55fr)_auto] lg:items-center dark:hover:bg-zinc-800/30">
                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-2">{statusBadge(payment?.status || registration.payment_status)}<span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{programName}</span></div><h3 className="mt-2 truncate text-base font-bold text-zinc-900 dark:text-white">{registration.attendee_name || 'Peserta tanpa nama'}</h3><p className="mt-1 text-xs text-zinc-500">NIK {registration.nik} · {registration.family_count || 0} keluarga · {registration.shirt_size ? `Baju ${registration.shirt_size.toUpperCase()}` : 'Tanpa baju'}</p></div>
                  <div><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Total tambahan</p><p className="mt-1 text-lg font-black text-zinc-900 dark:text-white">{formatMoney(registration.total_amount)}</p><p className="mt-1 text-[10px] text-slate-400">{formatDate(registration.submitted_at || registration.created_at)}</p></div>
                  <div>{payment?.proof_url ? <a href={payment.proof_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-300"><ExternalLink className="h-3.5 w-3.5" /> Lihat bukti</a> : <span className="text-xs font-semibold text-slate-400">Belum ada bukti</span>}</div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">{payment?.status === 'under_review' ? <><button type="button" onClick={() => { setSelected(registration); setDecision('reject'); setDecisionNote(''); }} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-rose-200 px-3 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:border-rose-900"><XCircle className="h-4 w-4" /> Tolak</button><button type="button" onClick={() => { setSelected(registration); setDecision('approve'); setDecisionNote(''); }} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"><CheckCircle2 className="h-4 w-4" /> Setujui</button></> : <><button type="button" onClick={() => { setSelected(registration); setDecision(null); }} className="h-10 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-600 dark:border-zinc-700 dark:text-zinc-300">Detail</button>{registration.registration_status === 'confirmed' && registration.payment_status === 'not_required' && <button type="button" disabled={actionLoading === registration.id} onClick={() => void unlockRegistration(registration)} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-amber-200 px-3 text-xs font-bold text-amber-700 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-900 dark:text-amber-300">{actionLoading === registration.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Buka edit</button>}</>}</div>
                </article>;
              })}</div>}
        </div>
      </div>

      {selected && <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Keputusan pembayaran"><button type="button" aria-label="Tutup" onClick={() => { setSelected(null); setDecision(null); }} className="absolute inset-0" /><div className="relative w-full max-w-lg rounded-t-[2rem] border border-slate-200 bg-white p-5 shadow-2xl sm:rounded-[2rem] sm:p-7 dark:border-zinc-700 dark:bg-zinc-900"><button type="button" onClick={() => { setSelected(null); setDecision(null); }} className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800"><X className="h-4 w-4" /></button><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-600">Keputusan admin</p><h2 className="mt-2 text-xl font-black text-zinc-900 dark:text-white">{decision === 'approve' ? 'Setujui pembayaran?' : decision === 'reject' ? 'Tolak bukti pembayaran?' : 'Detail registrasi'}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{selected.attendee_name || selected.nik} · {formatMoney(selected.total_amount)}</p>{decision && <><label className="mt-5 block"><span className="mb-2 block text-xs font-bold text-slate-600 dark:text-zinc-300">{decision === 'reject' ? 'Alasan penolakan (wajib)' : 'Catatan admin (opsional)'}</span><textarea rows={3} value={decisionNote} onChange={event => setDecisionNote(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white" placeholder={decision === 'reject' ? 'Contoh: nominal pada bukti tidak sesuai' : 'Catatan verifikasi'} /></label><div className="mt-5 rounded-2xl bg-amber-50 p-4 text-xs leading-5 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">{decision === 'approve' ? 'Persetujuan akan menerbitkan QR kehadiran dan kupon makan secara terpisah untuk karyawan serta setiap anggota keluarga.' : 'Penolakan tidak menerbitkan QR. Peserta dapat mengunggah bukti pengganti sesuai kebijakan program.'}</div><div className="mt-6 flex gap-3"><button type="button" onClick={() => { setSelected(null); setDecision(null); }} className="min-h-11 flex-1 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 dark:border-zinc-700 dark:text-zinc-300">Batal</button><button type="button" onClick={() => void submitDecision()} disabled={Boolean(actionLoading)} className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-bold text-white disabled:opacity-50 ${decision === 'approve' ? 'bg-emerald-600' : 'bg-rose-600'}`}>{actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : decision === 'approve' ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}{decision === 'approve' ? 'Setujui & terbitkan QR' : 'Tolak bukti'}</button></div></>}</div></div>}
    </div>
  );
}
