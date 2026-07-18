import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { 
  Calendar, ChevronLeft, CheckCircle, FileText, Loader2, 
  QrCode as QrCodeIcon, Salad, Gift, Users, X, Plus, Minus, CreditCard
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motion } from 'motion/react';
import QRCode from 'react-qr-code';
import { richTextToPlainText, sanitizeRichTextHtml } from '../../utils/richText';
import TicketQrFrame from '../../components/portal/TicketQrFrame';
import WhatsAppShare from '../../components/ui/WhatsAppShare';

interface ProgramMetadata {
  enable_meal?: boolean;
  enable_doorprize?: boolean;
  enable_family?: boolean;
  family_base_price?: number;
  family_meal_price?: number;
  max_participants?: number;
  kurban_type?: string;
  distribution_date?: string;
  target_level?: string;
}

interface Program {
  id: string;
  name: string;
  description: string;
  program_type: string;
  start_date: string;
  end_date: string;
  form_config: any;
  metadata?: ProgramMetadata;
  dynamic_form_id?: string | null;
  banner_url?: string | null;
  is_active?: boolean;
}

interface Coupon {
  id: string;
  gate_type: string;
  status: string;
  coupon_code: string;
  qr_code?: string;
  barcode?: string;
  coupon_type?: string;
  name?: string;
  nik?: string;
  claimed_at: string;
  entitlement_code?: string;
  beneficiary_type?: 'employee' | 'family';
  beneficiary_index?: number | null;
  entitlement_metadata?: { beneficiary_label?: string; beneficiary_name?: string };
  metadata?: { family_count?: number; beneficiary_label?: string; beneficiary_name?: string };
}

interface TicketModalData {
  coupon: Coupon;
  beneficiary: string;
  ticketTitle: string;
  beneficiaryLabel: string;
}

function getCouponQrValue(coupon: Coupon): string {
  return coupon.coupon_code || coupon.qr_code || coupon.barcode || coupon.id;
}

function normalizeProgramCoupon(row: any): Coupon {
  const rawEntitlement = String(row?.gate_type || row?.coupon_type || row?.entitlement_code || '').toLowerCase();
  const gateType = rawEntitlement === 'food' || rawEntitlement.includes('meal')
    ? 'meal'
    : rawEntitlement.includes('attendance') ? 'attendance' : rawEntitlement;
  const inferredFamily = rawEntitlement.includes('family');
  return {
    ...row,
    coupon_code: row?.coupon_code || row?.qr_code || row?.barcode || row?.id,
    gate_type: gateType,
    beneficiary_type: row?.beneficiary_type || (inferredFamily ? 'family' : 'employee'),
    entitlement_metadata: row?.entitlement_metadata || {},
    metadata: row?.metadata || {},
  };
}

function getCouponBeneficiary(coupon: Coupon, fallbackName?: string, index = 0): string {
  return coupon.entitlement_metadata?.beneficiary_name
    || coupon.metadata?.beneficiary_name
    || coupon.name
    || (coupon.beneficiary_type === 'family' ? `Keluarga ${coupon.beneficiary_index || index + 1}` : fallbackName || 'Karyawan');
}

function getCouponStatusLabel(status?: string): string {
  if (status === 'active') return 'Aktif';
  if (status === 'claimed' || status === 'redeemed') return 'Sudah digunakan';
  if (status === 'expired') return 'Kedaluwarsa';
  if (status === 'revoked') return 'Dibatalkan';
  return status || '-';
}

export default function PortalProgram() {
  const { user, isLoading: isAuthLoading } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const requestedProgramId = new URLSearchParams(location.search).get('programId')
    || (location.state as { programId?: string } | null)?.programId;
  
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [restoredProgramId, setRestoredProgramId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State Form & Payment
  const [formData, setFormData] = useState<any>({});
  const [submitting, setSubmitting] = useState(false);

  // Family/Add-ons Payment State
  const [addonSelections, setAddonSelections] = useState<Record<string, number>>({});
  const [wantsExtra, setWantsExtra] = useState(false);
  const getPaidAddons = () => selectedProgram?.metadata?.paid_addons || [];
  const isFamilyEnabled = () => selectedProgram?.metadata?.enable_family === true;

  const toggleAddon = (addonId: string) => {
    setAddonSelections(prev => {
      const newSel = { ...prev };
      if (newSel[addonId] > 0) {
        delete newSel[addonId];
      } else {
        newSel[addonId] = 1;
      }
      return newSel;
    });
  };

  const updateAddonQty = (addonId: string, qty: number) => {
    if (qty < 0) return;
    setAddonSelections(prev => ({
      ...prev,
      [addonId]: qty
    }));
  };

  const calculateTotal = () => {
    const addons = getPaidAddons();
    let total = 0;
    addons.forEach(addon => {
      const qty = addonSelections[addon.id] || 0;
      total += qty * addon.price;
    });
    return total;
  };

  // Modal State
  const [showQrisModal, setShowQrisModal] = useState(false);
  const [qrisImage, setQrisImage] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);

  const [myCoupons, setMyCoupons] = useState<Coupon[]>([]);
  const [activeTab, setActiveTab] = useState<'attendance' | 'meal'>('attendance');
  const [ticketModal, setTicketModal] = useState<TicketModalData | null>(null);

  // --- EFFECTS ---
  useEffect(() => {
    if (isAuthLoading) return;
    if (user) {
        fetchPrograms();
    } else {
        setLoading(false);
    }
  }, [user, isAuthLoading]);

  useEffect(() => {
    if (!requestedProgramId || restoredProgramId === requestedProgramId || programs.length === 0) return;
    const program = programs.find(candidate => candidate.id === requestedProgramId);
    if (!program) return;
    setRestoredProgramId(requestedProgramId);
    void handleSelectProgram(program);
  }, [programs, requestedProgramId, restoredProgramId]);

  // --- HANDLERS ---
  const fetchPrograms = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: activePrograms, error } = await supabase
        .from('union_programs')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Also fetch programs where user has coupons (for history)
      const { data: userCoupons } = await supabase
        .from('program_coupons')
        .select('program_id')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      let historyPrograms: any[] = [];
      if (userCoupons && userCoupons.length > 0) {
        const historyIds = [...new Set(userCoupons.map(c => c.program_id))];
        const activeIds = new Set((activePrograms || []).map(p => p.id));
        const inactiveIds = historyIds.filter(id => !activeIds.has(id));
        
        if (inactiveIds.length > 0) {
          const { data: histData } = await supabase
            .from('union_programs')
            .select('*')
            .in('id', inactiveIds)
            .order('created_at', { ascending: false });
          if (histData) historyPrograms = histData;
        }
      }

      if (activePrograms) setPrograms([...activePrograms, ...historyPrograms]);
      else setPrograms(historyPrograms);
    } catch (err: any) {
      console.error("Error fetching programs:", err);
      setError(err.message || "Gagal memuat program");
      toast.error("Gagal memuat program");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProgram = async (program: Program) => {
    setSelectedProgram(program);
    
    // V2: Try to get registration status from V2 endpoint
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const response = await fetch(`/api/portal/programs/${program.id}/registration-v2`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const result = await response.json();
      
      const registration = result.data || result.registration;
      if (response.ok && result.success && registration) {
        // V2 registration found - map to coupon format for backward compatibility
        const v2Coupons = (registration.coupons || result.entitlements || []).map(normalizeProgramCoupon);
        setMyCoupons(v2Coupons);
      } else {
        // Fallback to legacy query
        const { data } = await supabase.from('program_coupons').select('*').eq('program_id', program.id).or(`nik.eq.${user?.nik},user_id.eq.${user?.id}`);
        if (data) setMyCoupons(data.map(normalizeProgramCoupon));
      }
    } catch (e) {
      // Fallback to legacy query
      const { data } = await supabase.from('program_coupons').select('*').eq('program_id', program.id).or(`nik.eq.${user?.nik},user_id.eq.${user?.id}`);
      if (data) setMyCoupons(data.map(normalizeProgramCoupon));
    }
    
    setFormData({});
    setAddonSelections({});
  };

  const handleConfirmAttendance = () => {
    setSubmitting(true);
    setTimeout(() => {
        toast.success("Konfirmasi kehadiran dikirim! QR Kehadiran Aktif.");
        setSubmitting(false);
    }, 1000);
  };

  const handleSubmitForm = () => {
    setSubmitting(true);
    setTimeout(() => { toast.success("Data polling berhasil disimpan!"); setSubmitting(false); }, 1000);
  };

  const handlePayFamily = async () => {
    if (calculateTotal() < 1 || !user) return;
    setPaymentLoading(true);

    // Calculate total family count from addons
    const familyCount = Object.values(addonSelections).reduce((acc: any, qty: any) => acc + qty, 0);

    try {
        const response = await fetch(`/api/portal/programs/${selectedProgram?.id}/checkout-family`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                userId: user.id, 
                familyCount: familyCount,
                totalAmount: calculateTotal(),
                userEmail: user.email,
                userName: (user as any).user_metadata?.name || user.email,
                userPhone: (user as any).user_metadata?.phone || '0812000000'
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || `Error: ${response.status}`);
        }
        
        const data = await response.json();
        if (data.success) {
            setQrisImage(data.qris_string);
            setShowQrisModal(true);
            toast.success("Silakan lakukan pembayaran via QRIS");
        } else {
            throw new Error(data.error || 'Gagal');
        }
    } catch (error: any) {
        toast.error("Gagal: " + error.message);
    } finally {
        setPaymentLoading(false);
    }
  };

  const handleConfirmPaid = () => {
    setShowQrisModal(false);
    toast.success("Pembayaran dikonfirmasi!");
    if (selectedProgram) handleSelectProgram(selectedProgram);
  };

  const openTicketModal = (coupon: Coupon, ticketTitle: string, index = 0) => {
    setTicketModal({
      coupon,
      ticketTitle,
      beneficiary: getCouponBeneficiary(coupon, user?.name, index),
      beneficiaryLabel: coupon.beneficiary_type === 'family' ? `Keluarga ${coupon.beneficiary_index || index + 1}` : 'Karyawan',
    });
  };

  // --- RENDER ---
  if (!user && !isAuthLoading) return <Navigate to="/login" />;
  if (isAuthLoading || loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
        <p className="text-zinc-500 font-medium animate-pulse">Memuat...</p>
      </div>
    );
  }
  if (error) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center p-4">
              <p className="text-red-500 mb-4">{error}</p>
              <button onClick={fetchPrograms} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Coba Lagi</button>
          </div>
      )
  }

  const visiblePrograms = Object.values((programs || []).reduce((groups: Record<string, any>, program: any) => {
    const group = String(program?.metadata?.parent_event_code || program?.metadata?.parent_event_name || program?.name || program.id).replace(/\s*[—-]\s*(Utama|Susulan|Pendaftaran.*)$/i, '').trim();
    if (!groups[group]) groups[group] = { ...program, _candidates: [program] };
    else { groups[group]._candidates.push(program); if (!groups[group].is_active && program.is_active) Object.assign(groups[group], program); }
    return groups;
  }, {}));

  const handleSelectGroupedProgram = async (group: any) => {
    const candidates = [...(group._candidates || [group])].sort((a, b) => Number(b.is_active) - Number(a.is_active));
    for (const candidate of candidates) {
      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token;
        const response = await fetch(`/api/portal/programs/${candidate.id}/registration-v2`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (response.ok) { await handleSelectProgram(candidate); return; }
      } catch { /* try the next cohort */ }
    }
    await handleSelectProgram(candidates[0]);
  };

  // LIST VIEW
  if (!selectedProgram) {
    return (
        <div className="space-y-5 pb-24 sm:space-y-8">
            <div className="flex items-center gap-3 sm:gap-4">
                <button onClick={() => navigate('/portal')} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-100 bg-white dark:border-zinc-700 dark:bg-zinc-800"><ChevronLeft className="w-5 h-5 text-zinc-600" /></button>
                <div className="min-w-0">
                    <h1 className="truncate text-xl font-black text-zinc-900 sm:text-2xl dark:text-white">Program Serikat</h1>
                    <p className="text-sm text-zinc-500">Pilih program untuk detail</p>
                </div>
            </div>

            {programs.length === 0 ? (
                <div className="text-center py-12 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700">
                    <Calendar className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
                    <p className="text-zinc-500 font-bold">Tidak ada program aktif saat ini</p>
                    <p className="text-xs text-zinc-400 mt-1">Silakan hubungi admin untuk info lebih lanjut</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {visiblePrograms.map((prog: any) => {
                        const isExpired = !prog.is_active || (prog.end_date && new Date(prog.end_date) < new Date());
                        const programType = (prog.program_type || 'program').toLowerCase();
                        const fallbackBannerClass = programType.includes('kurban')
                          ? 'from-amber-500 via-orange-500 to-rose-600'
                          : programType.includes('turnamen')
                            ? 'from-orange-500 via-red-500 to-rose-700'
                            : programType.includes('bingkisan')
                              ? 'from-pink-500 via-fuchsia-500 to-violet-700'
                              : 'from-sky-500 via-indigo-500 to-violet-700';
                        const description = richTextToPlainText(prog.description) || 'Tidak ada deskripsi tambahan.';
                        return (
                        <motion.article
                          key={prog.id}
                          whileHover={{ scale: 1.01 }}
                          onClick={() => void handleSelectGroupedProgram(prog)}
                          className="group cursor-pointer overflow-hidden rounded-[1.5rem] border border-zinc-200 bg-white shadow-sm transition-all hover:border-blue-300 hover:shadow-xl sm:rounded-3xl dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-blue-800"
                        >
                          <div className="grid md:min-h-[13rem] md:grid-cols-[minmax(220px,32%)_1fr]">
                            <div className="relative min-h-40 overflow-hidden bg-zinc-100 sm:min-h-44 dark:bg-zinc-800">
                              {prog.banner_url ? (
                                <img
                                  src={prog.banner_url}
                                  alt={prog.name}
                                  className="h-full min-h-40 w-full object-cover transition duration-500 group-hover:scale-105 sm:min-h-44"
                                />
                              ) : (
                                <div className={`absolute inset-0 bg-gradient-to-br ${fallbackBannerClass}`}>
                                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.35),transparent_28%),radial-gradient(circle_at_80%_25%,rgba(255,255,255,0.18),transparent_30%)]" />
                                  <div className="relative flex h-full min-h-44 flex-col justify-end p-5 text-white">
                                    <Gift className="mb-4 h-10 w-10 opacity-80" />
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/75">Program SPS</p>
                                    <p className="mt-1 text-sm font-black capitalize">{prog.program_type || 'Program Serikat'}</p>
                                  </div>
                                </div>
                              )}
                              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/65 to-transparent" />
                              <span className={`absolute left-4 top-4 rounded-full px-3 py-1 text-[10px] font-black uppercase shadow-lg backdrop-blur ${isExpired ? 'bg-zinc-950/70 text-zinc-200' : 'bg-emerald-100 text-emerald-700'}`}>
                                {isExpired ? 'Selesai' : 'Aktif'}
                              </span>
                            </div>

                            <div className="flex min-w-0 flex-col justify-between gap-4 p-4 sm:gap-5 sm:p-6">
                              <div>
                                <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-zinc-400 sm:text-xs">
                                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">{prog.program_type || 'program'}</span>
                                  <span className="inline-flex items-center gap-1.5">
                                    <Calendar className="h-3.5 w-3.5" />
                                    {new Date(prog.start_date).toLocaleDateString()} - {new Date(prog.end_date).toLocaleDateString()}
                                  </span>
                                </div>
                                <h3 className="text-lg font-black leading-tight text-zinc-900 sm:text-xl dark:text-white">{prog.name}</h3>
                                <p className="mt-2 text-sm leading-6 text-zinc-500 line-clamp-3 sm:mt-3 dark:text-zinc-400">{description}</p>
                              </div>
                              <div className="flex items-center justify-between gap-3 border-t border-zinc-100 pt-4 text-[11px] font-black text-zinc-400 sm:text-xs dark:border-zinc-800">
                                <span>Program Serikat</span>
                                <div className="flex items-center gap-2">
                                  <WhatsAppShare
                                    title={prog.name}
                                    compact
                                    path={`/portal/program?programId=${prog.id}`}
                                    category="Program Serikat SPS Corner"
                                    description={description}
                                    className="h-9 w-9 p-2"
                                  />
                                  <span className="text-blue-600 dark:text-blue-300">Lihat detail</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.article>
                        );
                    })}
                </div>
            )}
        </div>
    );
  }

  // DETAIL VIEW
  const isKurban = selectedProgram.program_type?.toLowerCase().includes('kurban');
  const isGathering = selectedProgram.program_type?.toLowerCase().includes('gathering');
  const isProgramExpired = !selectedProgram.is_active || (selectedProgram.end_date && new Date(selectedProgram.end_date) < new Date());
  const couponAttendance = myCoupons.find(c => c.gate_type === 'attendance');
  const couponMeal = myCoupons.find(c => c.gate_type === 'meal');
  const couponDoorprize = myCoupons.find(c => c.gate_type === 'doorprize');
  const familyCoupon = myCoupons.find(c => c.gate_type === 'attendance_family');
  const familyMealCoupon = myCoupons.find(c => c.gate_type === 'meal_family');

  // === DETAIL VIEW ===
  const programBannerUrl = selectedProgram.banner_url;
  const programDescriptionHtml = sanitizeRichTextHtml(selectedProgram.description);
  
  return (
    <div className="space-y-5 pb-24 sm:space-y-8 sm:pb-20">
      {/* SECTION 1: PROGRAM INFORMATION - CLAYMORPHISM CARD */}
      <div className="mx-0 sm:mx-4">
        <div className="overflow-hidden rounded-[1.5rem] bg-white shadow-[8px_8px_16px_rgba(0,0,0,0.08),-8px_-8px_16px_rgba(255,255,255,0.05)] sm:rounded-3xl dark:bg-zinc-900 dark:shadow-[8px_8px_16px_rgba(0,0,0,0.3),-8px_-8px_16px_rgba(255,255,255,0.02)]">
          {/* REAL BANNER or PLACEHOLDER */}
          {programBannerUrl ? (
            <div className="relative h-44 w-full overflow-hidden bg-zinc-950 sm:h-56">
              <img 
                src={programBannerUrl} 
                alt="" 
                aria-hidden="true"
                className="absolute inset-0 h-full w-full scale-110 object-cover opacity-45 blur-2xl"
              />
              <img 
                src={programBannerUrl} 
                alt={selectedProgram.name}
                className="relative z-10 h-full w-full object-contain"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
            </div>
          ) : (
            <div className={`h-40 ${isKurban ? 'bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600' : isGathering ? 'bg-gradient-to-br from-blue-400 via-indigo-500 to-purple-600' : 'bg-gradient-to-br from-zinc-400 via-zinc-500 to-zinc-600'} flex items-center justify-center relative overflow-hidden`}>
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIgZmlsbD0iI2ZmZiI+PC9jaXJjbGU+PC9zdmc+')] opacity-20"></div>
              <Gift className="w-20 h-20 text-white/40 relative z-10" />
            </div>
          )}
          
          <div className="p-4 sm:p-6">
            {/* Back & Share */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={() => setSelectedProgram(null)}
                className="flex items-center gap-2 text-sm font-bold text-zinc-500 transition-colors hover:text-zinc-700"
              >
                <ChevronLeft className="w-4 h-4" /> KEMBALI
              </button>
              <WhatsAppShare
                title={selectedProgram.name}
                compact
                path={`/portal/program?programId=${selectedProgram.id}`}
                category="Program Serikat SPS Corner"
                description={richTextToPlainText(selectedProgram.description)}
              />
            </div>
            
            {/* Type & Date Badge */}
            <div className="mb-4 flex flex-wrap items-center gap-2 sm:gap-3">
              <span className={`text-[10px] font-bold px-3 py-1.5 rounded-full uppercase shadow-inner ${
                selectedProgram.program_type === 'kurban' ? 'bg-amber-100 text-amber-700' :
                selectedProgram.program_type === 'bingkisan' ? 'bg-pink-100 text-pink-700' :
                selectedProgram.program_type === 'turnamen' ? 'bg-orange-100 text-orange-700' :
                'bg-blue-100 text-blue-700'
              }`}>
                {selectedProgram.program_type}
              </span>
              <span className="text-xs text-zinc-400">•</span>
              <span className="text-xs text-zinc-500 font-medium">
                {new Date(selectedProgram.start_date).toLocaleDateString()} - {new Date(selectedProgram.end_date).toLocaleDateString()}
              </span>
            </div>
            
            {/* Title */}
            <h1 className="mb-4 text-2xl font-black leading-tight text-zinc-900 sm:text-3xl dark:text-white">
              {selectedProgram.name}
            </h1>
            
            {/* Full Description */}
            <div className="prose prose-sm max-w-none overflow-hidden break-words text-zinc-500 dark:prose-invert dark:text-zinc-400">
              {programDescriptionHtml ? (
                <div
                  className="leading-relaxed [&_blockquote]:border-l-4 [&_blockquote]:border-blue-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
                  dangerouslySetInnerHTML={{ __html: programDescriptionHtml }}
                />
              ) : (
                <p className="leading-relaxed">Tidak ada deskripsi tambahan.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: DYNAMIC INTERACTION - CLAYMORPHISM CARDS */}
      <div className="space-y-4 sm:space-y-6 sm:px-4">
        {selectedProgram.dynamic_form_id && (
          <section className="overflow-hidden rounded-[1.5rem] bg-zinc-950 text-white shadow-2xl sm:rounded-[2rem] dark:bg-zinc-900">
            <div className="grid gap-5 p-4 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-indigo-200"><FileText className="h-3.5 w-3.5" /> Konfirmasi digital</span>
                <h2 className="mt-4 text-xl font-black tracking-tight sm:text-2xl">Lengkapi RSVP program</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">Jawaban mengikuti alur yang relevan, biaya dihitung otomatis, dan QR diterbitkan hanya setelah status valid.</p>
              </div>
              <button
                type="button"
                disabled={isProgramExpired}
                onClick={() => navigate(`/portal/forms/${selectedProgram.dynamic_form_id}?programId=${selectedProgram.id}`)}
                className="inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 text-sm font-black text-white shadow-xl shadow-indigo-950/30 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-14 sm:w-auto sm:px-6"
              >
                <FileText className="h-5 w-5" /> {isProgramExpired ? 'Program sudah selesai' : 'Buka formulir RSVP'}
              </button>
            </div>
          </section>
        )}

        {selectedProgram.dynamic_form_id && myCoupons.length > 0 && (
          <section className="rounded-[1.5rem] border border-zinc-200 bg-white p-4 shadow-sm sm:rounded-[2rem] sm:p-7 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-5 flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 sm:h-11 sm:w-11 dark:bg-emerald-950/40 dark:text-emerald-300"><QrCodeIcon className="h-5 w-5" /></span>
              <div><h2 className="font-black text-zinc-900 dark:text-white">Tiket & kupon Anda</h2><p className="mt-1 text-xs leading-5 text-zinc-500">Setiap penerima dan setiap manfaat menggunakan QR terpisah.</p></div>
            </div>

            {/* Tabs: Attendance / Meal */}
            <div className="mb-5 flex gap-2 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
              <button
                onClick={() => setActiveTab('attendance')}
                className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'attendance'
                    ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 inline mr-1.5" />
                Kehadiran
              </button>
              <button
                onClick={() => setActiveTab('meal')}
                className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'meal'
                    ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                <Salad className="w-3.5 h-3.5 inline mr-1.5" />
                Makan
              </button>
            </div>

            {/* Tab Content: Attendance */}
            {activeTab === 'attendance' && (
              <div className="space-y-3">
                {myCoupons.filter(c => c.gate_type === 'attendance').length === 0 ? (
                  <div className="text-center py-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700">
                    <Calendar className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                    <p className="text-xs text-zinc-400">Belum ada tiket kehadiran</p>
                  </div>
                ) : (
                  myCoupons.filter(c => c.gate_type === 'attendance').map((coupon, idx) => {
                    const beneficiary = getCouponBeneficiary(coupon, user?.name, idx);
                    const isEmployee = coupon.beneficiary_type !== 'family';
                    return (
                      <button type="button" key={coupon.id} onClick={() => openTicketModal(coupon, 'TIKET MASUK', idx)} className="flex w-full flex-col gap-3 rounded-2xl border border-zinc-100 bg-zinc-50 p-3 text-left transition hover:border-emerald-300 hover:bg-emerald-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 sm:flex-row sm:items-center sm:gap-4 sm:p-4 dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/20">
                        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
                          <div className="shrink-0 rounded-xl bg-white p-2 shadow-sm dark:bg-zinc-900">
                            <QRCode value={getCouponQrValue(coupon)} size={64} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              {isEmployee && <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[9px] font-bold rounded uppercase">Karyawan</span>}
                              {!isEmployee && <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-[9px] font-bold rounded uppercase">Keluarga</span>}
                            </div>
                            <p className="truncate text-sm font-bold text-zinc-900 dark:text-white">{beneficiary}</p>
                            <p className="mt-0.5 truncate font-mono text-[10px] text-zinc-400">{coupon.coupon_code}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2 border-t border-zinc-200/70 pt-3 sm:block sm:border-0 sm:pt-0 sm:text-right">
                          <p className="text-[10px] font-bold text-emerald-600 sm:hidden dark:text-emerald-300">Tap untuk memperbesar</p>
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${
                            coupon.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : coupon.status === 'claimed' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400'
                          }`}>
                            {coupon.status === 'active' ? 'Aktif' : coupon.status === 'claimed' ? 'Digunakan' : coupon.status}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}

            {/* Tab Content: Meal */}
            {activeTab === 'meal' && (
              <div className="space-y-3">
                {myCoupons.filter(c => c.gate_type === 'meal').length === 0 ? (
                  <div className="text-center py-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700">
                    <Salad className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                    <p className="text-xs text-zinc-400">Belum ada kupon makan</p>
                  </div>
                ) : (
                  myCoupons.filter(c => c.gate_type === 'meal').map((coupon, idx) => {
                    const beneficiary = getCouponBeneficiary(coupon, user?.name, idx);
                    const isEmployee = coupon.beneficiary_type !== 'family';
                    return (
                      <button type="button" key={coupon.id} onClick={() => openTicketModal(coupon, 'KUPON MAKAN', idx)} className="flex w-full flex-col gap-3 rounded-2xl border border-zinc-100 bg-zinc-50 p-3 text-left transition hover:border-amber-300 hover:bg-amber-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 sm:flex-row sm:items-center sm:gap-4 sm:p-4 dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:border-amber-800 dark:hover:bg-amber-950/20">
                        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
                          <div className="shrink-0 rounded-xl bg-white p-2 shadow-sm dark:bg-zinc-900">
                            <QRCode value={getCouponQrValue(coupon)} size={64} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              {isEmployee && <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[9px] font-bold rounded uppercase">Karyawan</span>}
                              {!isEmployee && <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-[9px] font-bold rounded uppercase">Keluarga</span>}
                            </div>
                            <p className="truncate text-sm font-bold text-zinc-900 dark:text-white">{beneficiary}</p>
                            <p className="mt-0.5 truncate font-mono text-[10px] text-zinc-400">{coupon.coupon_code}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2 border-t border-zinc-200/70 pt-3 sm:block sm:border-0 sm:pt-0 sm:text-right">
                          <p className="text-[10px] font-bold text-amber-600 sm:hidden dark:text-amber-300">Tap untuk memperbesar</p>
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${
                            coupon.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : coupon.status === 'claimed' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400'
                          }`}>
                            {coupon.status === 'active' ? 'Aktif' : coupon.status === 'claimed' ? 'Digunakan' : coupon.status}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </section>
        )}
        
        {/* === TYPE: KURBAN / BINGKISAN === */}
        {(isKurban || selectedProgram.program_type === 'bingkisan') && (
          <div className="mx-0 sm:mx-4">
            <div className="rounded-[1.5rem] bg-white p-4 shadow-[6px_6px_12px_rgba(0,0,0,0.08),-6px_-6px_12px_rgba(255,255,255,0.05)] sm:rounded-3xl sm:p-6 dark:bg-zinc-900">
              <div className="flex items-center gap-2 mb-6">
                <Gift className="w-5 h-5 text-amber-500" />
                <h2 className="font-bold text-lg text-zinc-800 dark:text-zinc-200">Kupon {isKurban ? 'Pengambilan Daging' : 'Bingkisan'}</h2>
              </div>
              
              {/* Check if user has coupon (eligible) */}
              {couponAttendance ? (
                <div className="text-center">
                  {couponAttendance.status === 'expired' ? (
                    <div className="p-4 sm:p-6">
                      <div className="bg-zinc-100 dark:bg-zinc-800 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <X className="w-10 h-10 text-zinc-400" />
                      </div>
                      <p className="text-sm font-bold text-zinc-500 mb-1">Kupon已 Expired</p>
                      <p className="text-xs text-zinc-400">Program ini sudah berakhir</p>
                    </div>
                  ) : (
                  <>
                  <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-2xl mb-4 inline-block shadow-inner">
                    <CheckCircle className="w-10 h-10 text-amber-500 mx-auto" />
                  </div>
                  <p className="text-sm font-bold text-amber-600 mb-2">Anda Berhak Mengambil</p>
                  <p className="text-xs text-zinc-400 mb-6">{isKurban ? '1 paket daging kurban' : '1 paket bingkisan'}</p>
                  
                  <div className="bg-white dark:bg-zinc-800 p-4 rounded-2xl border border-amber-100 dark:border-amber-900 inline-block mb-4 shadow-inner">
                    <QRCode value={couponAttendance.coupon_code} size={180} />
                  </div>

                  <p className="text-xs text-zinc-400 font-medium">Tunjukkan QR ini ke petugas distribusi</p>
                  
                  {couponAttendance.status === 'claimed' && (
                    <div className="mt-6 p-4 bg-green-100 dark:bg-green-900/30 rounded-2xl">
                      <p className="text-sm font-bold text-green-700">✓ Sudah Diambil</p>
                    </div>
                  )}
                  </>
                  )}
                </div>
              ) : (
                /* NOT ELIGIBLE */
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-center sm:p-8 dark:border-zinc-700 dark:bg-zinc-800/50">
                  <Gift className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
                  <p className="font-bold text-zinc-600 dark:text-zinc-300 mb-2">Belum Ada Kupon</p>
                  <p className="text-sm text-zinc-400">
                    Program ini dikhususkan untuk rekan-rekan tingkat tertentu.<br/>
                    Silakan hubungi admin untuk info lebih lanjut.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* === TYPE: GATHERING / TURNAMEN === */}
        {(isGathering || selectedProgram.program_type === 'turnamen') && !selectedProgram.dynamic_form_id && (
          <div className="mx-0 space-y-4 sm:mx-4 sm:space-y-6">
            {/* Form Config */}
            {selectedProgram.form_config?.fields?.length > 0 && (
                <div className="rounded-[1.5rem] bg-white p-4 shadow-[6px_6px_12px_rgba(0,0,0,0.08),-6px_-6px_12px_rgba(255,255,255,0.05)] sm:rounded-3xl sm:p-6 dark:bg-zinc-900">
                    <button onClick={handleSubmitForm} disabled={submitting} className="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all">Simpan Data</button>
                </div>
            )}

            {/* --- DYNAMIC ADD-ONS SECTION WITH TOGGLE --- */}
            {(!familyCoupon) && isFamilyEnabled() && getPaidAddons().length > 0 && (
                <div className="rounded-[1.5rem] bg-white p-4 shadow-[6px_6px_12px_rgba(0,0,0,0.08),-6px_-6px_12px_rgba(255,255,255,0.05)] sm:rounded-3xl sm:p-6 dark:bg-zinc-900">
                    
                    {/* TOGGLE SWITCH */}
                    <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-indigo-800 dark:bg-indigo-900/20">
                        <div className="flex items-center gap-3">
                            <Users className="w-6 h-6 text-indigo-600" />
                            <div className="text-left">
                                <p className="font-bold text-indigo-900 dark:text-indigo-100 text-sm">Bawa Anggota Keluarga?</p>
                                <p className="text-xs text-indigo-600 dark:text-indigo-400">Tambah fasilitas/orang tambahan</p>
                            </div>
                        </div>
                        <button 
                            type="button"
                            onClick={() => setWantsExtra(!wantsExtra)}
                            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${wantsExtra ? 'bg-indigo-600' : 'bg-zinc-300 dark:bg-zinc-600'}`}
                        >
                            <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-sm transition-transform ${wantsExtra ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>

                    {/* SHOW ADD-ONS ONLY IF WANT EXTRA IS TRUE */}
                    {wantsExtra && (
                        <>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6">Pilih item yang ingin Anda tambahkan:</p>
                            
                            <div className="space-y-3 mb-6">
                                {getPaidAddons().map(addon => (
                                    <div key={addon.id} className="flex flex-col gap-3 rounded-2xl border border-zinc-100 bg-zinc-50 p-4 shadow-inner sm:flex-row sm:items-center sm:justify-between dark:border-zinc-700 dark:bg-zinc-800">
                                        <label className="flex flex-1 cursor-pointer items-center gap-3">
                                            <input 
                                                type="checkbox" 
                                                checked={(addonSelections[addon.id] || 0) > 0}
                                                onChange={() => toggleAddon(addon.id)}
                                                className="w-5 h-5 rounded accent-indigo-600"
                                            />
                                            <div className="min-w-0">
                                                <span className="block text-sm font-semibold text-zinc-700 dark:text-zinc-200">{addon.name}</span>
                                                <span className="text-xs text-indigo-600 dark:text-indigo-400">Rp {addon.price.toLocaleString()}</span>
                                            </div>
                                        </label>
                                        
                                        {(addonSelections[addon.id] || 0) > 0 && (
                                            <div className="flex items-center justify-between gap-2 rounded-xl bg-white p-1.5 shadow-sm sm:justify-start dark:bg-zinc-900">
                                                <button 
                                                    type="button" 
                                                    onClick={() => updateAddonQty(addon.id, (addonSelections[addon.id] || 1) - 1)}
                                                    className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                                                >
                                                    <Minus className="w-3 h-3" />
                                                </button>
                                                <span className="w-6 text-center text-sm font-bold">{addonSelections[addon.id]}</span>
                                                <button 
                                                    type="button" 
                                                    onClick={() => updateAddonQty(addon.id, (addonSelections[addon.id] || 0) + 1)}
                                                    className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                                                >
                                                    <Plus className="w-3 h-3" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            
                            {calculateTotal() > 0 && (
                                <>
                                    <div className="flex justify-between items-center pt-4 border-t border-indigo-200 dark:border-indigo-800 mb-6">
                                        <span className="font-bold text-zinc-700 dark:text-zinc-200">Total Bayar:</span>
                                        <span className="font-black text-2xl text-indigo-600">Rp {calculateTotal().toLocaleString()}</span>
                                    </div>

                                    <button 
                                        type="button"
                                        onClick={handlePayFamily} 
                                        disabled={paymentLoading}
                                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 py-4 text-sm font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:from-indigo-600 hover:to-purple-700 hover:shadow-xl"
                                    >
                                        {paymentLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CreditCard className="w-4 h-4" /> Bayar via QRIS (iPaymu)</>}
                                    </button>
                                </>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Ticket View - Only show if user has confirmed */}
            {!couponAttendance ? (
                <div className="rounded-[1.5rem] border border-yellow-100 bg-white p-5 text-center shadow-[8px_8px_16px_rgba(0,0,0,0.08),-8px_-8px_16px_rgba(255,255,255,0.05)] sm:rounded-3xl sm:p-8 dark:border-yellow-900/30 dark:bg-zinc-900">
                    <div className="bg-yellow-100 dark:bg-yellow-900/30 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                        <Calendar className="w-10 h-10 text-yellow-600" />
                    </div>
                    <p className="text-zinc-600 dark:text-zinc-300 mb-2 text-base font-bold">Anda belum melakukan konfirmasi kehadiran.</p>
                    <p className="text-sm text-zinc-400 mb-8">Klik tombol di bawah untuk mendapatkan QR Code kehadiran.</p>
                    <button onClick={handleConfirmAttendance} disabled={submitting || isProgramExpired} className="flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 px-4 py-4 text-base font-black text-white shadow-lg shadow-green-500/30 transition-all hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 sm:py-5 sm:text-lg">
                        {submitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <><CheckCircle className="w-6 h-6" /> KONFIRMASI HADIR</>}
                    </button>
                    {isProgramExpired && <p className="text-xs text-red-500 mt-2">Program sudah berakhir, tidak bisa konfirmasi</p>}
                </div>
            ) : couponAttendance.status === 'active' && !isProgramExpired ? (
                 <div className="rounded-[1.5rem] border-2 border-green-500 bg-white p-5 text-center shadow-[8px_8px_16px_rgba(0,0,0,0.08),-8px_-8px_16px_rgba(255,255,255,0.05)] sm:rounded-3xl sm:p-8 dark:bg-zinc-900">
                    <button type="button" onClick={() => openTicketModal(couponAttendance, 'TIKET MASUK')} className="inline-flex rounded-2xl bg-white p-4 shadow-lg transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                      <QRCode value={getCouponQrValue(couponAttendance)} size={180} />
                    </button>
                    <p className="mt-6 text-sm font-medium text-zinc-500">Tunjukkan ke Panitia</p>
                    <p className="mt-2 text-xs font-bold text-emerald-600">Klik QR untuk memperbesar tiket</p>
                 </div>
            ) : couponAttendance.status === 'claimed' ? (
                // SUDAH CLAIM
                <div className="rounded-[1.5rem] border border-zinc-800 bg-zinc-900 p-5 shadow-[8px_8px_16px_rgba(0,0,0,0.3),-8px_-8px_16px_rgba(255,255,255,0.05)] sm:rounded-3xl sm:p-8 dark:bg-black">
                    <h3 className="text-white font-bold text-lg mb-6">Tiket Anda</h3>
                    <div className="flex justify-center mb-8">
                        <button type="button" onClick={() => openTicketModal(couponAttendance, 'TIKET MASUK')} className="bg-white p-4 rounded-2xl shadow-lg transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                            <QRCode value={getCouponQrValue(couponAttendance)} size={140} />
                        </button>
                    </div>
                    {/* Family Ticket Display */}
                    {familyCoupon && (
                        <div className="mt-6 pt-6 border-t border-zinc-800">
                            <h4 className="text-zinc-400 text-xs font-bold uppercase mb-4">Tiket Keluarga</h4>
                            <div className="flex gap-3 overflow-x-auto pb-2 px-2">
                                <button type="button" onClick={() => openTicketModal(familyCoupon, 'TIKET MASUK')} className="bg-white p-3 rounded-xl shrink-0 shadow-lg transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500">
                                    <QRCode value={getCouponQrValue(familyCoupon)} size={80} />
                                    <p className="text-[10px] mt-2 text-center font-bold">Keluarga ({familyCoupon.metadata?.family_count})</p>
                                </button>
                            </div>
                        </div>
                    )}
                    {/* Benefits */}
                    <div className="grid grid-cols-1 gap-3 border-t border-zinc-800 pt-6 sm:grid-cols-2 sm:gap-4">
                        <div className="bg-orange-900/30 p-4 rounded-2xl text-center border border-orange-800/50">
                             <Salad className="w-6 h-6 mx-auto text-orange-500 mb-2" />
                             <p className="text-xs text-orange-200 font-bold">Makan</p>
                             {couponMeal && <button type="button" onClick={() => openTicketModal(couponMeal, 'KUPON MAKAN')} className="mx-auto mt-3 block rounded-lg bg-white p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"><QRCode value={getCouponQrValue(couponMeal)} size={50} /></button>}
                             {familyMealCoupon && <p className="text-xs mt-2 text-orange-300 font-medium">+ {familyMealCoupon.metadata?.qty} Keluarga</p>}
                        </div>
                        <div className="bg-purple-900/30 p-4 rounded-2xl text-center border border-purple-800/50">
                             <Gift className="w-6 h-6 mx-auto text-purple-500 mb-2" />
                             <p className="text-xs text-purple-200 font-bold">Undian</p>
                             {couponDoorprize && <p className="text-2xl font-black text-white mt-3">{couponDoorprize.coupon_code.split('-').pop()}</p>}
                        </div>
                    </div>
                </div>
            ) : (
                // EXPIRED
                <div className="rounded-[1.5rem] border border-zinc-200 bg-zinc-100 p-5 text-center sm:rounded-3xl sm:p-8 dark:border-zinc-700 dark:bg-zinc-800">
                    <div className="bg-zinc-200 dark:bg-zinc-700 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <X className="w-10 h-10 text-zinc-400" />
                    </div>
                    <p className="text-zinc-500 font-bold mb-1">Kupon Expired</p>
                    <p className="text-xs text-zinc-400">Program ini sudah berakhir dan kupon tidak bisa digunakan lagi</p>
                </div>
            )}
          </div>
        )}
      </div>

      {ticketModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${ticketModal.ticketTitle} ${ticketModal.beneficiary}`}
          className="fixed inset-0 z-[80] flex items-end justify-center bg-zinc-950/85 p-0 backdrop-blur-md sm:items-center sm:p-6"
          onClick={() => setTicketModal(null)}
        >
          <div className="max-h-[96dvh] w-full max-w-2xl overflow-y-auto rounded-t-[2rem] bg-zinc-950/40 p-3 shadow-2xl sm:max-h-[92vh] sm:rounded-none sm:bg-transparent sm:p-0" onClick={event => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-zinc-900/90 px-4 py-3 text-white shadow-2xl">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">Scan QR tiket</p>
                <p className="mt-0.5 truncate text-sm font-bold">{ticketModal.beneficiary} - {ticketModal.ticketTitle}</p>
              </div>
              <button type="button" onClick={() => setTicketModal(null)} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <TicketQrFrame
              programName={selectedProgram.name}
              ticketTitle={ticketModal.ticketTitle}
              qrValue={getCouponQrValue(ticketModal.coupon)}
              name={ticketModal.beneficiary}
              nik={ticketModal.coupon.nik || user?.nik}
              beneficiaryLabel={ticketModal.beneficiaryLabel}
              code={ticketModal.coupon.coupon_code}
              status={getCouponStatusLabel(ticketModal.coupon.status)}
            />
            <p className="mt-3 rounded-2xl bg-white/10 px-4 py-3 text-center text-xs font-semibold leading-5 text-white/80">
              Tunjukkan layar ini ke panitia. QR sengaja dibuat besar agar scanner lebih mudah membaca.
            </p>
          </div>
        </div>
      )}

      {/* QRIS MODAL */}
      {showQrisModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 sm:items-center sm:p-4">
            <div className="relative w-full max-w-sm overflow-hidden rounded-t-[2rem] bg-white p-5 text-center shadow-2xl sm:rounded-3xl sm:p-8 dark:bg-zinc-900">
                <button onClick={() => setShowQrisModal(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600"><X className="w-6 h-6" /></button>
                
                <h2 className="text-xl font-black mb-2 text-zinc-900 dark:text-white">Pembayaran Keluarga</h2>
                <p className="text-sm text-zinc-500 mb-6">Total: <span className="font-bold text-indigo-600">Rp {calculateTotal().toLocaleString()}</span></p>
                
                {/* REAL QR CODE RENDER */}
                <div className="bg-white p-4 rounded-xl border border-zinc-200 mb-6 inline-block">
                    <QRCode value={qrisImage || "PAYMENT_PENDING"} size={220} level="H" />
                </div>
                
                <p className="text-xs text-zinc-400 mb-6">
                    Silakan scan kode QRIS di atas melalui aplikasi <b>Bank / M-Banking / e-Wallet</b> Anda.
                </p>
                
                {/* Manual Confirm Button (Karena polling otomatis kompleks, kita kasih tombol manual dulu) */}
                <button 
                    onClick={handleConfirmPaid}
                    className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 mb-3"
                >
                    <CheckCircle className="w-5 h-5" />
                    Saya Sudah Bayar
                </button>

                <button onClick={() => setShowQrisModal(false)} className="w-full py-2 text-zinc-400 text-sm font-medium hover:text-zinc-600">
                    Tutup
                </button>
            </div>
        </div>
      )}
    </div>
  );
}
