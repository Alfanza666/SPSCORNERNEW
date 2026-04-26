import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, ShieldCheck, Lock, Eye, Trash2, Phone, Mail, Server, UserCheck } from 'lucide-react';
import SPSLogo from '../components/SPSLogo';

interface PolicySection {
  icon: React.ElementType;
  title: string;
  content: string[];
}

const sections: PolicySection[] = [
  {
    icon: Eye,
    title: 'Data yang Kami Kumpulkan',
    content: [
      'Nama lengkap dan informasi profil yang Anda berikan saat mendaftar.',
      'Alamat email untuk keperluan otentikasi dan notifikasi transaksi.',
      'Nomor handphone (opsional) yang Anda berikan untuk notifikasi status pesanan.',
      'Nomor Induk Kependudukan (NIK) untuk keperluan verifikasi identitas akun (khusus akun staf dan penjual).',
      'Riwayat transaksi pembelian, termasuk item yang dibeli dan total pembayaran.',
      'Data teknis seperti alamat IP dan jenis perangkat untuk keamanan akun.',
    ],
  },
  {
    icon: Server,
    title: 'Bagaimana Kami Menggunakan Data Anda',
    content: [
      'Memproses dan mengkonfirmasi transaksi pembelian Anda.',
      'Mengirimkan notifikasi status pesanan secara real-time melalui sistem kami.',
      'Memverifikasi identitas Anda saat Anda mengajukan permintaan reset password.',
      'Meningkatkan pengalaman berbelanja dan layanan kami secara keseluruhan.',
      'Mencegah penipuan dan aktivitas yang tidak sah di platform kami.',
      'Mematuhi kewajiban hukum yang berlaku di Republik Indonesia.',
    ],
  },
  {
    icon: Lock,
    title: 'Keamanan Data',
    content: [
      'Seluruh data disimpan secara aman di server Supabase yang tersertifikasi SOC 2 Type II.',
      'Komunikasi antara browser Anda dan server kami dienkripsi menggunakan protokol HTTPS/TLS.',
      'Kata sandi tidak pernah disimpan dalam bentuk teks biasa — kami menggunakan hashing yang kuat.',
      'Kami menerapkan Row Level Security (RLS) sehingga pengguna hanya dapat mengakses data mereka sendiri.',
      'API Key dan kredensial sensitif disimpan di variabel lingkungan server dan tidak pernah diekspos ke klien.',
      'Kami tidak pernah menyimpan data kartu kredit atau informasi perbankan secara langsung.',
    ],
  },
  {
    icon: Phone,
    title: 'Nomor Handphone',
    content: [
      'Nomor handphone sepenuhnya bersifat opsional dan hanya digunakan untuk mengirimkan notifikasi status pesanan dalam aplikasi.',
      'Nomor handphone Anda TIDAK digunakan untuk keperluan pemasaran atau promosi tanpa izin eksplisit Anda.',
      'Nomor handphone Anda TIDAK akan dibagikan kepada pihak ketiga manapun untuk tujuan komersial.',
      'Anda dapat memperbarui atau menghapus nomor handphone Anda kapan saja melalui halaman Profil.',
    ],
  },
  {
    icon: UserCheck,
    title: 'Hak Pengguna',
    content: [
      'Anda berhak mengakses dan memperbarui data pribadi Anda melalui halaman Profil.',
      'Anda berhak meminta penghapusan akun dan seluruh data terkait dengan menghubungi admin.',
      'Anda berhak menolak penggunaan data Anda untuk tujuan tertentu dengan menghubungi tim kami.',
      'Anda berhak mendapatkan salinan data pribadi Anda dalam format yang dapat dibaca.',
    ],
  },
  {
    icon: Trash2,
    title: 'Retensi & Penghapusan Data',
    content: [
      'Data akun aktif disimpan selama akun Anda masih aktif.',
      'Riwayat transaksi disimpan selama minimal 5 tahun untuk keperluan audit dan akuntansi.',
      'Setelah penghapusan akun, data identitas dianonimkan dalam 30 hari kerja.',
      'Data yang dikecualikan dari penghapusan adalah data yang diwajibkan hukum untuk disimpan.',
    ],
  },
  {
    icon: Mail,
    title: 'Hubungi Kami',
    content: [
      'Jika Anda memiliki pertanyaan atau kekhawatiran mengenai kebijakan privasi ini, silakan hubungi kami.',
      'Email: admin@spscorner.store',
      'Kebijakan ini dapat diperbarui sewaktu-waktu. Perubahan signifikan akan diberitahukan melalui notifikasi dalam aplikasi.',
      'Dengan menggunakan layanan SPS Corner, Anda menyetujui kebijakan privasi ini.',
    ],
  },
];

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#f0f2f5] dark:bg-zinc-950 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="flex justify-center mb-6">
            <SPSLogo variant="stack" className="h-14" />
          </div>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-[10px] font-bold mb-4 border border-blue-100 dark:border-blue-900/30 uppercase tracking-widest">
            <ShieldCheck className="w-3.5 h-3.5" />
            Kebijakan Privasi & Keamanan Data
          </div>
          <h1 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight mb-3">
            Privasi Anda Adalah Prioritas Kami
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm max-w-xl mx-auto leading-relaxed font-medium">
            Dokumen ini menjelaskan bagaimana SPS Corner mengumpulkan, menggunakan, dan melindungi informasi pribadi Anda.
            Terakhir diperbarui: <strong>April 2026</strong>.
          </p>
        </motion.div>

        {/* Sections */}
        <div className="space-y-4 mb-8">
          {sections.map((section, index) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.07 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden"
            >
              <div className="flex items-center gap-3 p-5 border-b border-zinc-50 dark:border-zinc-800">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                  <section.icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="font-black text-zinc-900 dark:text-white text-sm tracking-tight">
                  {section.title}
                </h2>
              </div>
              <ul className="p-5 space-y-2.5">
                {section.content.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 dark:bg-blue-600 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Back Button */}
        <div className="text-center">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-bold text-xs uppercase tracking-widest group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Kembali
          </button>
        </div>
      </div>
    </div>
  );
}
