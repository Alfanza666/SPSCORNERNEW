import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';
import { Save, Plus, Trash2, Edit2, Check, X, ShieldAlert, Info } from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';

export default function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [faq, setFaq] = useState<any[]>([
    {
      question: "Apa itu SPS Corner?",
      answer: "SPS Corner adalah platform pusat belanja internal untuk karyawan Sariroti, menyediakan berbagai kebutuhan mulai dari produk digital, produk Sariroti, hingga makanan dan minuman."
    },
    {
      question: "Bagaimana cara melakukan pembayaran?",
      answer: "Kami menyediakan berbagai metode pembayaran, termasuk QRIS (Otomatis & Manual), Virtual Account (BCA & Mandiri), dan pemotongan saldo bagi karyawan yang telah mendaftar."
    },
    {
      question: "Apakah saya perlu login untuk berbelanja?",
      answer: "Anda dapat berbelanja dan menggunakan metode pembayaran QRIS Manual atau Redirect Payment tanpa login. Namun, untuk menggunakan metode pembayaran otomatis (QRIS Otomatis, VA) dan melihat riwayat transaksi, Anda diwajibkan untuk login."
    },
    {
      question: "Bagaimana cara kerja QRIS Manual?",
      answer: "Pilih metode QRIS Manual saat checkout, scan kode QR yang ditampilkan menggunakan aplikasi pembayaran Anda, masukkan nominal yang sesuai, lalu unggah bukti transfer. Sistem AI kami akan memverifikasi bukti transfer Anda secara otomatis."
    },
    {
      question: "Berapa lama proses verifikasi pembayaran?",
      answer: "Untuk pembayaran otomatis (QRIS Otomatis & VA), verifikasi dilakukan secara instan. Untuk QRIS Manual, verifikasi oleh AI biasanya memakan waktu kurang dari 1 menit setelah bukti transfer diunggah."
    },
    {
      question: "Bagaimana jika pembayaran saya gagal atau bermasalah?",
      answer: "Jika Anda mengalami kendala pembayaran, silakan hubungi tim dukungan kami melalui halaman 'Hubungi Kami' dengan menyertakan ID Transaksi dan bukti pembayaran."
    }
  ]);
  
  const [refundPolicy, setRefundPolicy] = useState(`
<h3 class="text-xl font-bold text-zinc-900 dark:text-white mt-8 mb-4">1. Ketentuan Umum Pengembalian Dana</h3>
<p class="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
  Pengembalian dana (refund) hanya dapat dilakukan dalam kondisi-kondisi tertentu yang sepenuhnya merupakan kesalahan dari pihak sistem atau penjual di SPS Corner.
</p>

<h3 class="text-xl font-bold text-zinc-900 dark:text-white mt-8 mb-4">2. Kondisi yang Memenuhi Syarat Refund</h3>
<ul class="list-disc pl-6 text-zinc-600 dark:text-zinc-400 space-y-2 mb-6">
  <li>Produk digital (seperti pulsa, token listrik) gagal dikirimkan atau transaksi dibatalkan oleh sistem setelah pembayaran berhasil.</li>
  <li>Produk fisik yang dipesan ternyata kehabisan stok setelah pembayaran berhasil dilakukan.</li>
  <li>Terjadi kesalahan sistem yang menyebabkan nominal pembayaran terpotong lebih dari yang seharusnya (double charge).</li>
</ul>

<h3 class="text-xl font-bold text-zinc-900 dark:text-white mt-8 mb-4">3. Kondisi yang Tidak Memenuhi Syarat Refund</h3>
<ul class="list-disc pl-6 text-zinc-600 dark:text-zinc-400 space-y-2 mb-6">
  <li>Kesalahan input nomor tujuan (untuk produk digital) oleh pembeli.</li>
  <li>Pembeli berubah pikiran setelah transaksi berhasil diproses.</li>
  <li>Keterlambatan pengiriman produk digital yang disebabkan oleh gangguan pada pihak operator atau provider.</li>
</ul>

<h3 class="text-xl font-bold text-zinc-900 dark:text-white mt-8 mb-4">4. Proses Pengajuan Refund</h3>
<p class="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
  Untuk mengajukan pengembalian dana, pembeli harus menghubungi tim dukungan kami melalui halaman "Hubungi Kami" atau WhatsApp resmi dengan menyertakan:
</p>
<ul class="list-disc pl-6 text-zinc-600 dark:text-zinc-400 space-y-2 mb-6">
  <li>ID Transaksi</li>
  <li>Bukti pembayaran yang sah</li>
  <li>Penjelasan singkat mengenai alasan pengajuan refund</li>
</ul>

<h3 class="text-xl font-bold text-zinc-900 dark:text-white mt-8 mb-4">5. Waktu Proses Refund</h3>
<p class="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
  Proses verifikasi dan pengembalian dana akan memakan waktu 1-3 hari kerja terhitung sejak laporan diterima dan disetujui oleh tim kami. Dana akan dikembalikan ke metode pembayaran awal atau ke saldo akun pengguna (jika disepakati).
</p>
  `.trim());
  
  const [contactInfo, setContactInfo] = useState({
    phone: '0818222604',
    email: 'Harmonis.bjm@sariroti.com',
    address: 'Bizpark Commercial Estate Blok C2 No.6.\nJl. Gubernur Soebardjo, Kec. Gambut, Kabupaten Banjar\nKalimantan Selatan, Kode Pos 70652\nIndonesia'
  });

  const [loyaltyEnabled, setLoyaltyEnabled] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState({
    qrisDynamic: true,
    qrisManual: true,
    vaBca: false,
    vaMandiri: false,
    redirect: true
  });
  const { user } = useAuthStore();
  const isSuperadmin = user?.role === 'superadmin';

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .in('key', [
          'faq_content', 'refund_policy_content', 'contact_info_content', 'loyalty_enabled',
          'payment_method_qris_dynamic', 'payment_method_qris_manual', 'payment_method_va_bca', 
          'payment_method_va_mandiri', 'payment_method_redirect'
        ]);

      if (error) throw error;

      if (data) {
        const faqData = data.find(d => d.key === 'faq_content');
        if (faqData) setFaq(JSON.parse(faqData.value));

        const refundData = data.find(d => d.key === 'refund_policy_content');
        if (refundData) setRefundPolicy(refundData.value);

        const contactData = data.find(d => d.key === 'contact_info_content');
        if (contactData) setContactInfo(JSON.parse(contactData.value));
        
        const loyaltyData = data.find(d => d.key === 'loyalty_enabled');
        if (loyaltyData) setLoyaltyEnabled(loyaltyData.value === 'true');

        const getBool = (key: string, def: boolean) => {
          const found = data.find(d => d.key === key);
          return found ? found.value === 'true' : def;
        };

        setPaymentSettings({
          qrisDynamic: getBool('payment_method_qris_dynamic', true),
          qrisManual: getBool('payment_method_qris_manual', true),
          vaBca: getBool('payment_method_va_bca', false),
          vaMandiri: getBool('payment_method_va_mandiri', false),
          redirect: getBool('payment_method_redirect', true)
        });
      }
    } catch (error: any) {
      console.error('Error fetching settings:', error);
      toast.error('Gagal memuat pengaturan');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (key: string, value: string) => {
    try {
      setSaving(true);
      const { error } = await supabase
        .from('settings')
        .upsert({ key, value, updated_at: new Date().toISOString() });

      if (error) throw error;
      toast.success('Pengaturan berhasil disimpan');
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast.error('Gagal menyimpan pengaturan');
    } finally {
      setSaving(false);
    }
  };

  const addFaq = () => {
    setFaq([...faq, { question: '', answer: '' }]);
  };

  const updateFaq = (index: number, field: string, value: string) => {
    const newFaq = [...faq];
    newFaq[index][field] = value;
    setFaq(newFaq);
  };

  const removeFaq = (index: number) => {
    const newFaq = faq.filter((_, i) => i !== index);
    setFaq(newFaq);
  };

  if (loading) {
    return <div className="p-8 text-center">Memuat pengaturan...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black text-zinc-900 dark:text-white mb-2 tracking-tight">Pengaturan Konten</h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">Kelola konten halaman FAQ, Kebijakan Pengembalian, dan Hubungi Kami.</p>
      </div>

      {/* FAQ Section */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">FAQ (Pertanyaan Umum)</h2>
          <button
            onClick={() => handleSave('faq_content', JSON.stringify(faq))}
            disabled={saving}
            className="btn-clay-primary px-4 py-2 text-sm flex items-center gap-2"
          >
            <Save className="w-4 h-4" /> Simpan FAQ
          </button>
        </div>
        
        <div className="space-y-4">
          {faq.map((item, index) => (
            <div key={index} className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-700 relative group">
              <button
                onClick={() => removeFaq(index)}
                className="absolute top-4 right-4 text-red-500 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-5 h-5" />
              </button>
              <div className="space-y-3 pr-8">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 mb-1">Pertanyaan</label>
                  <input
                    type="text"
                    value={item.question}
                    onChange={(e) => updateFaq(index, 'question', e.target.value)}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Contoh: Apa itu SPS Corner?"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-500 mb-1">Jawaban</label>
                  <textarea
                    value={item.answer}
                    onChange={(e) => updateFaq(index, 'answer', e.target.value)}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none min-h-[80px]"
                    placeholder="Jawaban dari pertanyaan di atas..."
                  />
                </div>
              </div>
            </div>
          ))}
          <button
            onClick={addFaq}
            className="w-full py-3 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl text-zinc-500 hover:text-blue-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all flex items-center justify-center gap-2 font-bold text-sm"
          >
            <Plus className="w-4 h-4" /> Tambah Pertanyaan
          </button>
        </div>
      </div>

      {/* Refund Policy Section */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Kebijakan Pengembalian Dana</h2>
          <button
            onClick={() => handleSave('refund_policy_content', refundPolicy)}
            disabled={saving}
            className="btn-clay-primary px-4 py-2 text-sm flex items-center gap-2"
          >
            <Save className="w-4 h-4" /> Simpan Kebijakan
          </button>
        </div>
        <p className="text-xs text-zinc-500 mb-4">Mendukung format HTML dasar (seperti &lt;h3&gt;, &lt;p&gt;, &lt;ul&gt;, &lt;li&gt;).</p>
        <textarea
          value={refundPolicy}
          onChange={(e) => setRefundPolicy(e.target.value)}
          className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl px-4 py-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none min-h-[300px] font-mono"
          placeholder="Masukkan konten kebijakan pengembalian dana dalam format HTML..."
        />
      </div>

      {/* Contact Info Section */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Informasi Kontak</h2>
          <button
            onClick={() => handleSave('contact_info_content', JSON.stringify(contactInfo))}
            disabled={saving}
            className="btn-clay-primary px-4 py-2 text-sm flex items-center gap-2"
          >
            <Save className="w-4 h-4" /> Simpan Kontak
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-zinc-500 mb-1">Telepon / WhatsApp</label>
            <input
              type="text"
              value={contactInfo.phone}
              onChange={(e) => setContactInfo({ ...contactInfo, phone: e.target.value })}
              className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Contoh: 0818222604"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 mb-1">Email</label>
            <input
              type="email"
              value={contactInfo.email}
              onChange={(e) => setContactInfo({ ...contactInfo, email: e.target.value })}
              className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Contoh: Harmonis.bjm@sariroti.com"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 mb-1">Alamat Lengkap</label>
            <textarea
              value={contactInfo.address}
              onChange={(e) => setContactInfo({ ...contactInfo, address: e.target.value })}
              className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px]"
              placeholder="Contoh: Bizpark Commercial Estate..."
            />
          </div>
        </div>
      </div>
      {/* Superadmin Only: Loyalty Points Toggle */}
      {isSuperadmin && (
        <>
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
               <ShieldAlert className="w-24 h-24 text-amber-500" />
            </div>
            <div className="flex items-center justify-between mb-6 relative z-10">
              <div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  Metode Pembayaran (Superadmin)
                </h2>
                <p className="text-xs text-zinc-500 mt-1 max-w-xl">
                  Atur metode pembayaran apa saja yang muncul di halaman Pembayaran / Kiosk.
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 relative z-10">
              {[
                { key: 'qrisDynamic', label: 'QRIS Dinamis', desc: 'Sistem QR Otomatis (Gopay dll)' },
                { key: 'qrisManual', label: 'QRIS Statis', desc: 'Upload Bukti Transfer Manual' },
                { key: 'vaBca', label: 'VA BCA', desc: 'Virtual Account BCA' },
                { key: 'vaMandiri', label: 'VA Mandiri', desc: 'Virtual Account Mandiri' },
                { key: 'redirect', label: 'Metode Lainnya', desc: 'Redirect ke iPaymu' }
              ].map(method => (
                <div key={method.key} className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white">{method.label}</h3>
                    <p className="text-[10px] text-zinc-500 mt-0.5">{method.desc}</p>
                  </div>
                  <button
                    onClick={() => {
                      const newVal = !paymentSettings[method.key as keyof typeof paymentSettings];
                      setPaymentSettings(prev => ({ ...prev, [method.key]: newVal }));
                      
                      const dbKey = 
                        method.key === 'qrisDynamic' ? 'payment_method_qris_dynamic' :
                        method.key === 'qrisManual' ? 'payment_method_qris_manual' :
                        method.key === 'vaBca' ? 'payment_method_va_bca' :
                        method.key === 'vaMandiri' ? 'payment_method_va_mandiri' :
                        'payment_method_redirect';

                      handleSave(dbKey, String(newVal));
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${paymentSettings[method.key as keyof typeof paymentSettings] ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-600'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${paymentSettings[method.key as keyof typeof paymentSettings] ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-4 border border-blue-100 dark:border-blue-900/30">
            <p className="text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0" />
              Pengaturan Loyalty Point tersedia di menu{" "}
              <a href="/dashboard/admin/loyalty" className="font-bold underline hover:no-underline">Loyalty Point</a>
            </p>
          </div>
        </>
      )}
    </div>
  );
}
