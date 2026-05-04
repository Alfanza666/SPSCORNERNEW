import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { Loader2, AlertCircle, User, Phone, CreditCard, ShieldCheck, CheckCircle2, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import SPSLogo from '../components/SPSLogo';
import toast from 'react-hot-toast';

/**
 * AuthCallback — Handles Google OAuth redirect after login.
 *
 * Flow:
 * 1. Exchange Google token → get session
 * 2. Fetch profile from Supabase
 * 3a. If profile has NIK + phone → redirect to correct role page
 * 3b. If profile is MISSING nik/phone → show "Lengkapi Profil" inline form
 * 4. After completing profile form → redirect to role page
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const { fetchProfile } = useAuthStore();

  type Step = 'loading' | 'complete_profile' | 'error';
  const [step, setStep] = useState<Step>('loading');
  const [status, setStatus] = useState('Memverifikasi akun Anda...');
  const [errorMsg, setErrorMsg] = useState('');

  // Profile completion form state
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [name, setName] = useState('');
  const [nik, setNik] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // ── Step 1: Exchange token & fetch profile ──────────────────────────────────
  useEffect(() => {
    const handleCallback = async () => {
      try {
        setStatus('Memproses login Google...');

        // Supabase automatically handles the token from URL hash
        let { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        // Sometimes session is not yet set — try exchanging the code from URL
        if (!session?.user) {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(
            window.location.href
          );
          if (exchangeError || !data?.session) {
            throw new Error('Gagal mendapatkan sesi login. Silakan coba lagi.');
          }
          session = data.session;
        }

        if (!session?.user) throw new Error('Sesi tidak valid setelah autentikasi.');

        setStatus('Memeriksa kelengkapan profil...');

        // Fetch the profile record (created by DB trigger on first Google sign-in)
        // [QA FIX] Retry up to 3x — trigger may have race condition on very first sign-in
        let profile: any = null;
        let profileError: any = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          const result = await supabase
            .from('profiles')
            .select('id, role, name, nik, phone, email, balance, loyalty_points')
            .eq('id', session.user.id)
            .single();
          if (!result.error && result.data) {
            profile = result.data;
            break;
          }
          profileError = result.error;
          if (attempt < 2) await new Promise(r => setTimeout(r, 1000)); // wait 1s before retry
        }

        // If still not found after retries, create a base profile so user isn't blocked
        if (!profile) {
          const googleName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || 'Pengguna Baru';
          const { data: insertedProfile, error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: session.user.id,
              name: googleName,
              role: 'buyer',
              balance: 0,
              loyalty_points: 0,
            })
            .select('id, role, name, nik, phone, email, balance, loyalty_points')
            .single();

          if (insertError || !insertedProfile) {
            throw new Error('Gagal membuat profil. Silakan hubungi admin.');
          }
          profile = insertedProfile;
        }

        // Pre-fill form from Google data
        const googleName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || '';
        const googleEmail = session.user.email || '';

        setSessionUser(session.user);
        setName(profile.name || googleName);
        setEmail(googleEmail);
        setPhone(profile.phone || '');
        setNik(profile.nik || '');

        // ── Check if profile is complete (has NIK + phone) ──────────────────
        const needsCompletion = !profile.nik || !profile.phone;

        if (needsCompletion) {
          setStep('complete_profile');
          return;
        }

        // Profile is complete — proceed with login
        await proceedWithLogin(session.user.id, profile.role);

      } catch (err: any) {
        console.error('Auth callback error:', err);
        setErrorMsg(err.message || 'Terjadi kesalahan saat proses login.');
        setStep('error');
      }
    };

    handleCallback();
  }, []);

  // ── Step 2 (optional): Proceed to dashboard after profile check/save ────────
  const proceedWithLogin = async (userId: string, role: string) => {
    await fetchProfile(userId);

    const returnUrl = sessionStorage.getItem('returnUrl');
    sessionStorage.removeItem('returnUrl');

    if (returnUrl && returnUrl !== '/' && returnUrl !== '/login') {
      navigate(returnUrl, { replace: true });
    } else if (role === 'admin' || role === 'superadmin') {
      navigate('/dashboard/admin', { replace: true });
    } else if (role === 'seller') {
      navigate('/dashboard/seller', { replace: true });
    } else {
      navigate('/kiosk', { replace: true });
    }
  };

  // ── Step 3: Save completed profile ─────────────────────────────────────────
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});

    // Validation
    const errors: Record<string, string> = {};
    const cleanNik = nik.trim().replace(/[\s\-.]/g, '');

    if (!name.trim()) errors.name = 'Nama lengkap wajib diisi';
    if (cleanNik.length < 3) errors.nik = 'NIK tidak valid (minimal 3 karakter)';
    if (!phone.trim() || phone.trim().length < 10) errors.phone = 'Nomor HP tidak valid (minimal 10 digit)';

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSaving(true);
    try {
      // Check if NIK already used by another user
      const { data: existingNik } = await supabase
        .from('profiles')
        .select('id')
        .eq('nik', cleanNik)
        .neq('id', sessionUser.id)
        .maybeSingle();

      if (existingNik) {
        setFieldErrors({ nik: 'NIK ini sudah terdaftar oleh akun lain.' });
        setSaving(false);
        return;
      }

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          name: name.trim(),
          nik: cleanNik,
          phone: phone.trim(),
        })
        .eq('id', sessionUser.id);

      if (updateError) throw updateError;

      toast.success('Profil berhasil dilengkapi!');

      // Re-fetch profile to get role
      const { data: updatedProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', sessionUser.id)
        .single();

      await proceedWithLogin(sessionUser.id, updatedProfile?.role || 'buyer');

    } catch (err: any) {
      console.error('Profile save error:', err);
      toast.error(err.message || 'Gagal menyimpan profil. Coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  // ── UI ──────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0f2f5] via-blue-50/30 to-amber-50/20 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-[5%] left-[5%] w-64 h-64 bg-blue-200/40 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-[5%] right-[5%] w-80 h-80 bg-amber-200/30 rounded-full blur-3xl -z-10" />

      <AnimatePresence mode="wait">

        {/* ── LOADING ── */}
        {step === 'loading' && (
          <motion.div
            key="loading"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white rounded-3xl shadow-xl p-10 text-center max-w-sm w-full border border-zinc-100"
          >
            <div className="flex justify-center mb-6">
              <SPSLogo variant="stack" className="h-16" />
            </div>
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
            <h2 className="text-lg font-black text-zinc-900 mb-2">Memproses Login</h2>
            <p className="text-sm text-zinc-500 font-medium leading-relaxed">{status}</p>
            <div className="mt-6 flex justify-center gap-1.5">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-2 h-2 rounded-full bg-blue-400 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </motion.div>
        )}

        {/* ── ERROR ── */}
        {step === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white rounded-3xl shadow-xl p-10 text-center max-w-sm w-full border border-zinc-100"
          >
            <div className="flex justify-center mb-6">
              <SPSLogo variant="stack" className="h-16" />
            </div>
            <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-lg font-black text-zinc-900 mb-2">Login Gagal</h2>
            <p className="text-sm text-red-600 font-medium mb-6 leading-relaxed">{errorMsg}</p>
            <button
              onClick={() => navigate('/login', { replace: true })}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-colors"
            >
              Kembali ke Login
            </button>
          </motion.div>
        )}

        {/* ── COMPLETE PROFILE FORM ── */}
        {step === 'complete_profile' && (
          <motion.div
            key="complete_profile"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ type: 'spring', bounce: 0.3, duration: 0.6 }}
            className="w-full max-w-sm"
          >
            {/* Header */}
            <div className="text-center mb-6">
              <div className="flex justify-center mb-4">
                <SPSLogo variant="stack" className="h-14" />
              </div>
              <h1 className="text-xl font-black text-zinc-900 tracking-tight">Lengkapi Profil Anda</h1>
              <p className="text-xs text-zinc-500 mt-1.5 font-medium leading-relaxed max-w-[280px] mx-auto">
                Akun Google Anda berhasil terhubung! Harap lengkapi data berikut untuk aktivasi penuh.
              </p>
            </div>

            {/* Google account badge */}
            <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-2xl mb-5">
              <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-emerald-800 truncate">Akun Google Terverifikasi</p>
                <p className="text-[10px] text-emerald-600 font-medium truncate">{email}</p>
              </div>
            </div>

            {/* Form */}
            <div className="bg-white rounded-3xl border border-zinc-100 shadow-xl p-6">
              <form onSubmit={handleSaveProfile} className="space-y-4">

                {/* Nama Lengkap */}
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 mb-1.5 uppercase tracking-widest">
                    Nama Lengkap
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
                    <input
                      id="cb-name"
                      type="text"
                      placeholder="Sesuai KTP"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className={`w-full pl-10 pr-4 py-3 rounded-xl border text-sm font-medium bg-zinc-50 outline-none focus:ring-2 focus:bg-white transition-all ${
                        fieldErrors.name
                          ? 'border-red-300 focus:ring-red-200'
                          : 'border-zinc-200 focus:ring-blue-200 focus:border-blue-400'
                      }`}
                      required
                    />
                  </div>
                  {fieldErrors.name && (
                    <p className="text-[10px] text-red-500 font-medium mt-1 ml-1">{fieldErrors.name}</p>
                  )}
                </div>

                {/* NIK */}
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 mb-1.5 uppercase tracking-widest">
                    NIK (Nomor Induk Karyawan)
                  </label>
                  <div className="relative">
                    <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
                    <input
                      id="cb-nik"
                      type="text"
                      placeholder="Masukkan NIK Anda"
                      value={nik}
                      onChange={e => setNik(e.target.value)}
                      className={`w-full pl-10 pr-4 py-3 rounded-xl border text-sm font-medium bg-zinc-50 outline-none focus:ring-2 focus:bg-white transition-all ${
                        fieldErrors.nik
                          ? 'border-red-300 focus:ring-red-200'
                          : 'border-zinc-200 focus:ring-blue-200 focus:border-blue-400'
                      }`}
                      required
                    />
                  </div>
                  {fieldErrors.nik && (
                    <p className="text-[10px] text-red-500 font-medium mt-1 ml-1">{fieldErrors.nik}</p>
                  )}
                </div>

                {/* Nomor HP */}
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 mb-1.5 uppercase tracking-widest">
                    Nomor Handphone
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
                    <input
                      id="cb-phone"
                      type="tel"
                      placeholder="Contoh: 08123456789"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className={`w-full pl-10 pr-4 py-3 rounded-xl border text-sm font-medium bg-zinc-50 outline-none focus:ring-2 focus:bg-white transition-all ${
                        fieldErrors.phone
                          ? 'border-red-300 focus:ring-red-200'
                          : 'border-zinc-200 focus:ring-blue-200 focus:border-blue-400'
                      }`}
                      required
                    />
                  </div>
                  {fieldErrors.phone && (
                    <p className="text-[10px] text-red-500 font-medium mt-1 ml-1">{fieldErrors.phone}</p>
                  )}
                </div>

                {/* Info disclaimer */}
                <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                  <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[9px] text-amber-800 font-medium leading-relaxed">
                    Data ini digunakan untuk verifikasi transaksi dan komunikasi di lingkungan Koperasi SPS. Kami menjamin kerahasiaan data Anda.
                  </p>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/25 active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      Simpan & Lanjutkan
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>

            <p className="text-center text-[10px] text-zinc-400 mt-4 font-medium">
              Langkah ini hanya perlu dilakukan sekali saat pertama kali masuk.
            </p>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
