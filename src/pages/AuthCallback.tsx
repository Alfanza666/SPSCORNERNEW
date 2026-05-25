import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore, isEmployeeNik } from '../store/useAuthStore';
import { Loader2, AlertCircle, User, Phone, CreditCard, ShieldCheck, CheckCircle2, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import SPSLogo from '../components/SPSLogo';
import toast from 'react-hot-toast';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { fetchProfile } = useAuthStore();

  type Step = 'loading' | 'complete_profile' | 'error';
  const [step, setStep] = useState<Step>('loading');
  const [status, setStatus] = useState('Memverifikasi akun Anda...');
  const [errorMsg, setErrorMsg] = useState('');

  const [sessionUser, setSessionUser] = useState<any>(null);
  const [name, setName] = useState('');
  const [nik, setNik] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const handleCallback = async () => {
      try {
        setStatus('Memproses login Google...');

        let { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

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

        let profile: any = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          const result = await supabase
            .from('profiles')
            .select('id, role, name, nik, phone, balance, loyalty_points')
            .eq('id', session.user.id)
            .single();
          if (!result.error && result.data) {
            profile = result.data;
            break;
          }
          if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
        }

        if (!profile) {
          const googleEmail = session.user.email?.toLowerCase();
          const googleNik = session.user.user_metadata?.nik?.toLowerCase();
          let existingProfile: any = null;
          
          // Try matching by email (if column exists)
          if (googleEmail) {
            try {
              const { data: emailMatch } = await supabase
                .from('profiles')
                .select('id, role, name, nik, phone, balance, loyalty_points')
                .ilike('email', googleEmail)
                .single();
              
              if (emailMatch) existingProfile = emailMatch;
            } catch (e) {
              // Email column might not exist yet
              console.log('Email matching not available, trying NIK');
            }
          }
          
          // Try matching by NIK from metadata
          if (!existingProfile && googleNik) {
            const { data: nikMatch } = await supabase
              .from('profiles')
              .select('id, role, name, nik, phone, balance, loyalty_points')
              .eq('nik', googleNik)
              .single();
            
            if (nikMatch) existingProfile = nikMatch;
          }

          // If found existing profile (e.g., from seller registration), update ID to match Google Auth
          if (existingProfile) {
            const { error: updateIdError } = await supabase
              .from('profiles')
              .update({ id: session.user.id, email: googleEmail })
              .eq('id', existingProfile.id);

            if (!updateIdError) {
              profile = { ...existingProfile, id: session.user.id };
            }
          }

          // If still no profile, create new one
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
                email: googleEmail,
                nik: googleNik,
              })
              .select('id, role, name, nik, phone, balance, loyalty_points')
              .single();

            if (insertError || !insertedProfile) {
              throw new Error('Gagal membuat profil. Silakan hubungi admin.');
            }
            profile = insertedProfile;
          }
        }

        // Ambil data pending dari pre-Google form (Login.tsx)
        const pendingNik = sessionStorage.getItem('pendingGoogleNik');
        const pendingPhone = sessionStorage.getItem('pendingGooglePhone');
        const pendingName = sessionStorage.getItem('pendingGoogleName');

        // Jika ada data pending dari pre-Google form, simpan ke profil
        if (pendingNik || pendingPhone || pendingName) {
          const updates: Record<string, string> = {};
          if (pendingName) updates.name = pendingName;
          if (pendingNik) updates.nik = pendingNik;
          if (pendingPhone) updates.phone = pendingPhone;

          const { error: savePendingError } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', session.user.id);

          if (!savePendingError) {
            Object.assign(profile, updates);
          }

          sessionStorage.removeItem('pendingGoogleNik');
          sessionStorage.removeItem('pendingGooglePhone');
          sessionStorage.removeItem('pendingGoogleName');
        }

        const googleName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || '';
        const googleEmail = session.user.email || '';

        setSessionUser(session.user);
        setName(profile.name || pendingName || googleName);
        setEmail(googleEmail);
        setPhone(profile.phone || pendingPhone || '');
        setNik(profile.nik || pendingNik || '');

        const needsCompletion = !(profile.nik || pendingNik) || !(profile.phone || pendingPhone);

        if (needsCompletion) {
          setStep('complete_profile');
          return;
        }

        await proceedWithLogin(session.user.id, profile.role);

      } catch (err: any) {
        console.error('Auth callback error:', err);
        setErrorMsg(err.message || 'Terjadi kesalahan saat proses login.');
        setStep('error');
      }
    };

    handleCallback();
  }, []);

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
      const profile = useAuthStore.getState().user;
      const isEmployee = isEmployeeNik(profile?.nik);
      navigate(isEmployee ? '/portal' : '/kiosk', { replace: true });
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});

    const errors: Record<string, string> = {};
    const cleanNik = nik.trim().replace(/[\s\-.]/g, '');

    if (!name.trim()) errors.name = 'Nama lengkap wajib diisi';
    if (cleanNik.length < 3 || cleanNik.length > 9) errors.nik = 'NIK tidak valid (minimal 3, maksimal 9 karakter)';
    if (!phone.trim() || phone.trim().length < 10) errors.phone = 'Nomor HP tidak valid (minimal 10 digit)';

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSaving(true);
    try {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0f2f5] via-blue-50/30 to-amber-50/20 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-[5%] left-[5%] w-64 h-64 bg-blue-200/40 dark:bg-blue-900/20 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-[5%] right-[5%] w-80 h-80 bg-amber-200/30 dark:bg-amber-900/10 rounded-full blur-3xl -z-10" />

      <AnimatePresence mode="wait">
        {step === 'loading' && (
          <motion.div
            key="loading"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white dark:bg-zinc-900 rounded-3xl shadow-xl p-10 text-center max-w-sm w-full border border-zinc-100 dark:border-zinc-800"
          >
            <div className="flex justify-center mb-6">
              <SPSLogo variant="stack" className="h-16" />
            </div>
            <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-500 animate-spin" />
            </div>
            <h2 className="text-lg font-black text-zinc-900 dark:text-white mb-2">Memproses Login</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed">{status}</p>
          </motion.div>
        )}

        {step === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white dark:bg-zinc-900 rounded-3xl shadow-xl p-10 text-center max-w-sm w-full border border-zinc-100 dark:border-zinc-800"
          >
            <div className="flex justify-center mb-6">
              <SPSLogo variant="stack" className="h-16" />
            </div>
            <div className="w-14 h-14 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-lg font-black text-zinc-900 dark:text-white mb-2">Login Gagal</h2>
            <p className="text-sm text-red-600 dark:text-red-400 font-medium mb-6 leading-relaxed">{errorMsg}</p>
            <button
              onClick={() => navigate('/login', { replace: true })}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-colors"
            >
              Kembali ke Login
            </button>
          </motion.div>
        )}

        {step === 'complete_profile' && (
          <motion.div
            key="complete_profile"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ type: 'spring', bounce: 0.3, duration: 0.6 }}
            className="w-full max-w-sm"
          >
            <div className="text-center mb-6">
              <div className="flex justify-center mb-4">
                <SPSLogo variant="stack" className="h-14" />
              </div>
              <h1 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">Lengkapi Profil Anda</h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 font-medium leading-relaxed max-w-[280px] mx-auto">
                Akun Google Anda berhasil terhubung! Harap lengkapi data berikut untuk aktivasi penuh.
              </p>
            </div>

            <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/50 rounded-2xl mb-5">
              <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-emerald-800 dark:text-emerald-200 truncate">Akun Google Terverifikasi</p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium truncate">{email}</p>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-xl p-6">
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 mb-1.5 uppercase tracking-widest">
                    Nama Lengkap
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
                    <input
                      type="text"
                      placeholder="Sesuai KTP"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className={`w-full pl-10 pr-4 py-3 rounded-xl border text-sm font-medium outline-none transition-all bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white ${fieldErrors.name
                        ? 'border-red-300 dark:border-red-500/50 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900/30'
                        : 'border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900/30 focus:border-blue-400 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-900'
                        }`}
                      required
                    />
                  </div>
                  {fieldErrors.name && <p className="text-[10px] text-red-500 mt-1 ml-1">{fieldErrors.name}</p>}
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 mb-1.5 uppercase tracking-widest">
                    NIK (Nomor Induk Karyawan)
                  </label>
                  <div className="relative">
                    <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
                    <input
                      type="text"
                      placeholder="Masukkan NIK Anda"
                      value={nik}
                      onChange={e => setNik(e.target.value)}
                      className={`w-full pl-10 pr-4 py-3 rounded-xl border text-sm font-medium outline-none transition-all bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white ${fieldErrors.nik
                        ? 'border-red-300 dark:border-red-500/50 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900/30'
                        : 'border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900/30 focus:border-blue-400 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-900'
                        }`}
                      required
                    />
                  </div>
                  {fieldErrors.nik && <p className="text-[10px] text-red-500 mt-1 ml-1">{fieldErrors.nik}</p>}
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 mb-1.5 uppercase tracking-widest">
                    Nomor Handphone
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
                    <input
                      type="tel"
                      placeholder="Contoh: 08123456789"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className={`w-full pl-10 pr-4 py-3 rounded-xl border text-sm font-medium outline-none transition-all bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white ${fieldErrors.phone
                        ? 'border-red-300 dark:border-red-500/50 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-900/30'
                        : 'border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900/30 focus:border-blue-400 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-900'
                        }`}
                      required
                    />
                  </div>
                  {fieldErrors.phone && <p className="text-[10px] text-red-500 mt-1 ml-1">{fieldErrors.phone}</p>}
                </div>

                <div className="flex items-start gap-2.5 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/50 rounded-xl">
                  <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[9px] text-amber-800 dark:text-amber-200 font-medium leading-relaxed">
                    Data ini digunakan untuk verifikasi transaksi dan komunikasi di lingkungan Koperasi SPS. Kami menjamin kerahasiaan data Anda.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/25 active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none"
                >
                  {saving ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</>
                  ) : (
                    <>Simpan & Lanjutkan <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>
            </div>
            <p className="text-center text-[10px] text-zinc-400 dark:text-zinc-500 mt-4 font-medium">
              Langkah ini hanya perlu dilakukan sekali saat pertama kali masuk.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}