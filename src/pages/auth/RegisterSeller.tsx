import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  Store, ArrowLeft, Eye, EyeOff, Loader2, AlertCircle, 
  CheckCircle2, CreditCard, Phone, Mail, User, Hash, ShieldCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import SPSLogo from '../../components/SPSLogo';

export default function RegisterSeller() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [step, setStep] = useState<'verify' | 'form' | 'success'>('verify');
  const [verifying, setVerifying] = useState(true);
  const [linkValid, setLinkValid] = useState(false);
  const [expireDate, setExpireDate] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    nik: '',
    email: '',
    phone: '',
    bankName: '',
    bankAccountNumber: '',
    bankAccountName: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setErrorMsg('Link pendaftaran tidak valid');
      setVerifying(false);
      return;
    }

    verifyLink();
  }, [token]);

  const verifyLink = async () => {
    try {
      const response = await fetch(`/api/seller-registration/verify?token=${token}`);
      const result = await response.json();

      if (!response.ok || !result.valid) {
        setErrorMsg(result.error || 'Link tidak valid');
        setVerifying(false);
        return;
      }

      setLinkValid(true);
      setExpireDate(new Date(result.expiresAt).toLocaleDateString('id-ID', {
        day: 'numeric', month: 'long', year: 'numeric'
      }));
      setStep('form');
    } catch (err) {
      setErrorMsg('Gagal memverifikasi link');
    } finally {
      setVerifying(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast.error('Password tidak cocok');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Password minimal 6 karakter');
      return;
    }

    if (formData.nik.length < 6) {
      toast.error('NIK minimal 6 digit');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/seller-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          ...formData,
          nik: formData.nik.trim(),
          name: formData.name.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim()
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Gagal mendaftar');
      }

      setStep('success');
      toast.success('Pendaftaran berhasil!');

    } catch (err: any) {
      console.error('Register error:', err);
      toast.error(err.message || 'Gagal mendaftar');
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-zinc-500 font-bold">Memverifikasi link...</p>
        </div>
      </div>
    );
  }

  if (!linkValid) {
    return (
      <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm"
        >
          <div className="clay-card p-8 text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-zinc-900 mb-2">Link Tidak Valid</h2>
            <p className="text-sm text-zinc-500 mb-6">{errorMsg}</p>
            <Link to="/login" className="btn-clay-primary w-full">
              Kembali ke Login
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm"
        >
          <div className="clay-card p-8 text-center">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-zinc-900 mb-2">Pendaftaran Berhasil!</h2>
            <p className="text-sm text-zinc-500 mb-6">
              Selamat! Anda sekarang adalah seller di SPS Corner. Silakan login untuk mulai berjualan.
            </p>
            <Link to="/login" className="btn-clay-primary w-full">
              Login Sekarang
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full -z-10 opacity-40">
        <div className="absolute top-[10%] left-[5%] w-48 h-48 sm:w-64 sm:h-64 bg-amber-200 rounded-full blur-3xl" />
        <div className="absolute bottom-[10%] right-[5%] w-64 h-64 sm:w-96 sm:h-96 bg-blue-200 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <SPSLogo variant="stack" className="h-12 sm:h-16" />
          </div>
          <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-700 px-4 py-2 rounded-full text-xs font-bold mb-3">
            <Store className="w-4 h-4" />
            Pendaftaran Seller
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-zinc-900">Buat Akun Seller</h1>
          <p className="text-[10px] sm:text-xs text-zinc-500 mt-2 font-bold">
            Link berlaku hingga: {expireDate}
          </p>
        </div>

        <div className="clay-card p-5 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
              <p className="text-[10px] text-amber-800 font-bold leading-relaxed">
                Data Anda akan diverifikasi. Pastikan NIK, nama, dan nomor rekening benar.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-[10px] font-black text-zinc-400 mb-1.5 uppercase tracking-widest">
                  Nama Lengkap
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Nama sesuai KTP"
                    required
                    className="input-clay pl-10"
                  />
                </div>
              </div>

              <div className="col-span-2">
                <label className="block text-[10px] font-black text-zinc-400 mb-1.5 uppercase tracking-widest">
                  NIK (Nomor KTP)
                </label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    name="nik"
                    value={formData.nik}
                    onChange={handleChange}
                    placeholder="16 digit nomor KTP"
                    required
                    maxLength={16}
                    className="input-clay pl-10"
                  />
                </div>
              </div>

              <div className="col-span-2">
                <label className="block text-[10px] font-black text-zinc-400 mb-1.5 uppercase tracking-widest">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="email@example.com"
                    required
                    className="input-clay pl-10"
                  />
                </div>
              </div>

              <div className="col-span-2">
                <label className="block text-[10px] font-black text-zinc-400 mb-1.5 uppercase tracking-widest">
                  No. Handphone
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="0812 3456 7890"
                    required
                    className="input-clay pl-10"
                  />
                </div>
              </div>

              <div className="col-span-2 border-t border-zinc-100 pt-4 mt-2">
                <p className="text-xs font-black text-zinc-900 mb-3 flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Data Rekening (untuk penarikan saldo)
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-black text-zinc-400 mb-1.5 uppercase tracking-widest">
                  Bank
                </label>
                <select
                  name="bankName"
                  value={formData.bankName}
                  onChange={handleChange}
                  required
                  className="input-clay"
                >
                  <option value="">Pilih Bank</option>
                  <option value="BCA">BCA</option>
                  <option value="Mandiri">Mandiri</option>
                  <option value="BNI">BNI</option>
                  <option value="BTN">BTN</option>
                  <option value="BRI">BRI</option>
                  <option value="Danamon">Danamon</option>
                  <option value="CIMB">CIMB</option>
                  <option value="Maybank">Maybank</option>
                  <option value="Permata">Permata</option>
                  <option value=" Lainnya">Lainnya</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-zinc-400 mb-1.5 uppercase tracking-widest">
                  No. Rekening
                </label>
                <input
                  name="bankAccountNumber"
                  value={formData.bankAccountNumber}
                  onChange={handleChange}
                  placeholder="1234567890"
                  required
                  className="input-clay"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-[10px] font-black text-zinc-400 mb-1.5 uppercase tracking-widest">
                  Nama Pemilik Rekening
                </label>
                <input
                  name="bankAccountName"
                  value={formData.bankAccountName}
                  onChange={handleChange}
                  placeholder="Sesuai di buku rekening"
                  required
                  className="input-clay"
                />
              </div>

              <div className="col-span-2 border-t border-zinc-100 pt-4 mt-2">
                <label className="block text-[10px] font-black text-zinc-400 mb-1.5 uppercase tracking-widest">
                  Password Login
                </label>
                <div className="relative">
                  <input
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Minimal 6 karakter"
                    required
                    minLength={6}
                    className="input-clay pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="col-span-2">
                <label className="block text-[10px] font-black text-zinc-400 mb-1.5 uppercase tracking-widest">
                  Konfirmasi Password
                </label>
                <input
                  name="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Masukkan ulang password"
                  required
                  className="input-clay"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-clay-primary w-full mt-6"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Mendaftarkan...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Store className="w-4 h-4" />
                  Daftar Sebagai Seller
                </span>
              )}
            </button>
          </form>
        </div>

        <div className="mt-6 text-center">
          <Link to="/login" className="text-zinc-500 hover:text-blue-600 text-sm font-bold flex items-center justify-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Kembali ke Login
          </Link>
        </div>
      </motion.div>
    </div>
  );
}