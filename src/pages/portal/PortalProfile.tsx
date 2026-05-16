import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { 
  User, 
  Lock, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  ArrowLeft, 
  Eye, 
  EyeOff,
  KeyRound,
  Fingerprint,
  Mail,
  Phone,
  Save,
  Camera,
  Loader2,
  Settings,
  Info,
  ChevronLeft
} from 'lucide-react';

export default function PortalProfile() {
  const { user, fetchProfile } = useAuthStore();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // States for Personal Data
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [nik, setNik] = useState(user?.nik || '');
  const [updatingProfile, setUpdatingProfile] = useState(false);

  // States for Avatar
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // States for Password
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
      setNik(user.nik || '');
    }
  }, [user]);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 2MB');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar');
      return;
    }

    setUploadingAvatar(true);
    try {
      // Ensure session is valid before making authenticated requests
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error('Session expired. Please login again.');
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload to Supabase Storage (Bucket: 'avatars')
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update Profile Table
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id)
        .select()
        .single();

      if (updateError) throw updateError;

      await fetchProfile(user.id);
      toast.success('Foto profil berhasil diperbarui!');
    } catch (err: any) {
      console.error('Avatar upload error:', err);
      toast.error(err.message || 'Gagal mengunggah foto');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setUpdatingProfile(true);
    try {
      // 1. Update Profiles table - use UPDATE instead of UPSERT
      // Reason: profile should already exist, upsert can cause FK constraint errors if auth.users doesn't exist
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          name: name.trim(),
          phone: phone.trim(),
          nik: nik.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // 2. Update Auth metadata/email if changed and it's not a dummy email
      if (email.trim() !== user.email && !email.endsWith('@sps.local')) {
        const { error: authError } = await supabase.auth.updateUser({
          email: email.trim(),
          data: { name: name.trim() }
        });
        if (authError) throw authError;
        toast.success('Permintaan perubahan email dikirim ke email baru Anda.');
      }

      await fetchProfile(user.id);
      toast.success('Profil berhasil diperbarui!');
    } catch (err: any) {
      console.error('Profile update error:', err);
      toast.error(err.message || 'Gagal memperbarui profil');
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setUpdatingPassword(true);

    if (newPassword !== confirmPassword) {
      toast.error('Password konfirmasi tidak cocok');
      setUpdatingPassword(false);
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password minimal 6 karakter');
      setUpdatingPassword(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast.success('Password berhasil diperbarui!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error('Password update error:', err);
      toast.error(err.message || 'Gagal memperbarui password');
    } finally {
      setUpdatingPassword(false);
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
        <p className="text-zinc-500 font-bold">Memuat data profil...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-1">
          <button 
            onClick={() => navigate('/portal')}
            className="flex items-center gap-2 text-zinc-500 hover:text-blue-600 transition-colors font-bold text-sm mb-4 group"
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Kembali ke Dashboard
          </button>
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <Settings className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-widest">Pengaturan Akun</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-zinc-900 dark:text-white tracking-tighter">Profil Saya</h1>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium text-sm">Kelola informasi identitas dan keamanan portal Anda</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left Column: Avatar & Summary */}
        <div className="space-y-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 border border-zinc-200 dark:border-zinc-800 shadow-xl shadow-zinc-200/50 dark:shadow-black/50 text-center relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-blue-600 to-blue-400 opacity-10 dark:opacity-20" />
            
            <div className="relative z-10 pt-4">
              <div className="relative inline-block group mb-6">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept="image/*" 
                  className="hidden" 
                />
                <div className="w-32 h-32 rounded-[2.5rem] bg-blue-600 flex items-center justify-center text-white text-4xl font-black shadow-2xl shadow-blue-500/30 overflow-hidden ring-4 ring-white dark:ring-zinc-800">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    user.name?.charAt(0) || 'U'
                  )}
                  {uploadingAvatar && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center">
                      <Loader2 className="w-8 h-8 text-white animate-spin" />
                    </div>
                  )}
                </div>
                <button 
                  onClick={handleAvatarClick}
                  disabled={uploadingAvatar}
                  className="absolute -bottom-2 -right-2 w-10 h-10 bg-white dark:bg-zinc-800 rounded-2xl shadow-lg border border-zinc-100 dark:border-zinc-700 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all hover:scale-110 active:scale-95"
                >
                  <Camera className="w-5 h-5" />
                </button>
              </div>

              <h2 className="text-2xl font-black text-zinc-900 dark:text-white mb-1 tracking-tight">{user.name}</h2>
              <p className="text-sm font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-6">{user.role}</p>

              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 shadow-sm flex items-center justify-center text-zinc-400">
                    <Fingerprint className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">NIK Anggota</p>
                    <p className="text-sm font-black text-zinc-900 dark:text-white">{user.nik || 'Not Verified'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 shadow-sm flex items-center justify-center text-zinc-400">
                    <ShieldCheck className="w-5 h-5 text-green-500" />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Status Akun</p>
                    <p className="text-sm font-black text-zinc-900 dark:text-white">Terverifikasi</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <div className="bg-amber-50 dark:bg-amber-900/10 rounded-[2rem] p-6 border border-amber-100 dark:border-amber-900/30">
            <div className="flex gap-4">
              <Info className="w-6 h-6 text-amber-600 dark:text-amber-500 shrink-0 mt-1" />
              <div className="space-y-1">
                <p className="text-sm font-black text-amber-900 dark:text-amber-400">Informasi Penting</p>
                <p className="text-xs font-bold text-amber-800 dark:text-amber-500/80 leading-relaxed">
                  NIK dan Nama Lengkap disesuaikan dengan database keanggotaan serikat. Hubungi Admin jika terdapat ketidaksesuaian data.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Forms */}
        <div className="lg:col-span-2 space-y-8">
          {/* Personal Info Form */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 sm:p-10 border border-zinc-200 dark:border-zinc-800 shadow-xl"
          >
            <div className="flex items-center gap-4 mb-8 guide-profile-info">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <User className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">Data Pribadi</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Informasi kontak yang terdaftar di sistem</p>
              </div>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Nama Lengkap</label>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
                    <input 
                      type="text" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-zinc-800/50 border-2 border-zinc-100 dark:border-zinc-800 rounded-2xl focus:border-blue-500 dark:focus:border-blue-400 outline-none font-bold text-zinc-900 dark:text-white transition-all shadow-inner"
                      placeholder="Masukkan nama lengkap"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1">NIK (Nomor Induk Karyawan)</label>
                  <div className="relative group">
                    <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
                    <input 
                      type="text" 
                      value={nik}
                      onChange={(e) => setNik(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-zinc-800/50 border-2 border-zinc-100 dark:border-zinc-800 rounded-2xl focus:border-blue-500 dark:focus:border-blue-400 outline-none font-bold text-zinc-900 dark:text-white transition-all shadow-inner"
                      placeholder="Masukkan NIK"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Email Aktif</label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
                    <input 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-zinc-800/50 border-2 border-zinc-100 dark:border-zinc-800 rounded-2xl focus:border-blue-500 dark:focus:border-blue-400 outline-none font-bold text-zinc-900 dark:text-white transition-all shadow-inner"
                      placeholder="email@contoh.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Nomor WhatsApp</label>
                  <div className="relative group">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
                    <input 
                      type="tel" 
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-zinc-800/50 border-2 border-zinc-100 dark:border-zinc-800 rounded-2xl focus:border-blue-500 dark:focus:border-blue-400 outline-none font-bold text-zinc-900 dark:text-white transition-all shadow-inner"
                      placeholder="08xxxxxxxxxx"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1">NIK (Permanent)</label>
                  <div className="relative">
                    <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-300" />
                    <input 
                      type="text" 
                      value={user.nik || ''} 
                      disabled
                      className="w-full pl-12 pr-4 py-4 bg-zinc-100 dark:bg-zinc-900/50 border-2 border-transparent rounded-2xl font-bold text-zinc-400 cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={updatingProfile}
                  className="flex items-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-400 text-white rounded-2xl font-black transition-all shadow-lg shadow-blue-600/20 active:scale-95"
                >
                  {updatingProfile ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </motion.div>

          {/* Security Form */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 sm:p-10 border border-zinc-200 dark:border-zinc-800 shadow-xl"
          >
            <div className="flex items-center gap-4 mb-8 guide-profile-security">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">Keamanan Akun</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Ganti password secara berkala</p>
              </div>
            </div>

            <form onSubmit={handleUpdatePassword} className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Password Baru</label>
                  <div className="relative group">
                    <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-amber-500 transition-colors" />
                    <input 
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pl-12 pr-12 py-4 bg-zinc-50 dark:bg-zinc-800/50 border-2 border-zinc-100 dark:border-zinc-800 rounded-2xl focus:border-amber-500 dark:focus:border-amber-400 outline-none font-bold text-zinc-900 dark:text-white transition-all shadow-inner"
                      placeholder="Min. 6 karakter"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Konfirmasi Password</label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-amber-500 transition-colors" />
                    <input 
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-zinc-800/50 border-2 border-zinc-100 dark:border-zinc-800 rounded-2xl focus:border-amber-500 dark:focus:border-amber-400 outline-none font-bold text-zinc-900 dark:text-white transition-all shadow-inner"
                      placeholder="Ulangi password"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={updatingPassword}
                  className="flex items-center gap-3 px-8 py-4 bg-amber-600 hover:bg-amber-700 disabled:bg-zinc-400 text-white rounded-2xl font-black transition-all shadow-lg shadow-amber-600/20 active:scale-95"
                >
                  {updatingPassword ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                  Update Password
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
