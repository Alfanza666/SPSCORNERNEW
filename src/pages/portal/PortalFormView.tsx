import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate, Navigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import {
  ClipboardList, ChevronLeft, Loader2, Send,
  CheckCircle2, AlertCircle, Calendar, Info, UploadCloud, X, Plus, Trash2, Star, Image, Lock, Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { FormConfig, FormField, AddonItem } from '../../types/form';
import { calculateVisibleFormTotal, getVisibleFields } from '../../utils/formLogic';
import {
  applyProgramWorkflowPricing,
  type ProgramWorkflowPricingPayload,
} from '../../utils/programWorkflowPricing';
import PremiumFormExperience, {
  type PremiumFormSubmitPayload,
  type PremiumFormSubmitResult,
} from '../../components/forms/PremiumFormExperience';

interface DynamicForm extends FormConfig {
  id: string;
  description: string;
  target_niks?: string[];
  target_departments?: string[];
}

interface PremiumPaymentInstructions {
  method?: string;
  payment_methods?: Array<'bank_transfer' | 'manual_qris'>;
  qris_image_url?: string;
  bank_name?: string;
  account_name?: string;
  account_number?: string;
  instructions?: string;
  proof_required?: boolean;
  verify_with_ai?: boolean;
}

function mapPremiumRegistrationResult(registration: any): PremiumFormSubmitResult {
  const declined = registration?.attendance_status === 'declined';
  const pending = ['pending', 'under_review'].includes(registration?.payment_status)
    || registration?.registration_status === 'pending_payment';
  return {
    status: declined ? 'declined' : pending ? 'pending' : 'success',
    title: declined
      ? 'Konfirmasi tidak hadir tersimpan'
      : pending
        ? 'Bukti pembayaran sedang diperiksa'
        : 'Kehadiran berhasil dikonfirmasi',
    message: declined
      ? 'Terima kasih. Konfirmasi Anda telah disimpan dan formulir sudah dikunci.'
      : pending
        ? 'Seluruh tiket dan kupon akan diterbitkan setelah pembayaran disetujui admin.'
        : 'Tiket kehadiran dan kupon makan Anda sudah diproses.',
    reference: registration?.id ? String(registration.id).slice(0, 8).toUpperCase() : undefined,
    total: Number(registration?.total_amount || 0),
  };
}

interface AddonOrder {
  item_id: string;
  size: string;
  quantity: number;
}

export default function PortalFormView() {
  const { formId } = useParams<{ formId: string }>();
  const [searchParams] = useSearchParams();
  const programId = searchParams.get('programId');
  const searchParamsKey = searchParams.toString();
  
  const { user } = useAuthStore();
  const navigate = useNavigate();
  
  const [form, setForm] = useState<DynamicForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  
  // State khusus untuk Addon Group (multiple rows)
  const [addonOrders, setAddonOrders] = useState<Record<string, AddonOrder[]>>({});
  // State untuk file uploads ( menyimpan public URL setelah upload)
  const [fileUploads, setFileUploads] = useState<Record<string, string>>({});
  // State untuk image uploads
  const [imageUploads, setImageUploads] = useState<Record<string, string>>({});
  // State untuk payment
  const [paymentProofs, setPaymentProofs] = useState<Record<string, string>>({});
  const [paymentVerified, setPaymentVerified] = useState<Record<string, boolean>>({});
  const [aiVerifying, setAiVerifying] = useState<Record<string, boolean>>({});

  // Department and cutoff targeting
  const [userDepartment, setUserDepartment] = useState<string>('');
  const [userTanggalMasuk, setUserTanggalMasuk] = useState<string>('');
  const [premiumStatusLoading, setPremiumStatusLoading] = useState(false);
  const [premiumInitialAnswers, setPremiumInitialAnswers] = useState<Record<string, unknown>>({});
  const [premiumInitialResult, setPremiumInitialResult] = useState<PremiumFormSubmitResult | null>(null);
  const [premiumPaymentInstructions, setPremiumPaymentInstructions] = useState<PremiumPaymentInstructions | null>(null);
  const [premiumWorkflowPricing, setPremiumWorkflowPricing] = useState<ProgramWorkflowPricingPayload | null>(null);
  const [premiumWorkflowPricingProgramId, setPremiumWorkflowPricingProgramId] = useState<string | null>(null);
  const [premiumProgramResolutionLoading, setPremiumProgramResolutionLoading] = useState(true);
  const [premiumSetupError, setPremiumSetupError] = useState<string | null>(null);

  // Card layout navigation state
  const [currentCardIndex, setCurrentCardIndex] = useState(0);

  // Keep card navigation valid when conditional answers add/remove questions.
  // Without this, changing a parent answer can leave the renderer pointing at
  // an index that no longer exists (an apparently blank form).
  const visibleFields = form ? getVisibleFields(form.fields || [], answers) : [];
  const activePremiumWorkflowPricing = premiumWorkflowPricingProgramId === programId
    ? premiumWorkflowPricing
    : null;
  const premiumPricedFields = useMemo(
    () => form && activePremiumWorkflowPricing
      ? applyProgramWorkflowPricing(
          Array.isArray(activePremiumWorkflowPricing.form_snapshot?.fields)
            ? activePremiumWorkflowPricing.form_snapshot.fields
            : form.fields || [],
          activePremiumWorkflowPricing,
        )
      : form?.fields || [],
    [form?.fields, activePremiumWorkflowPricing],
  );

  useEffect(() => {
    if (!form || (form as any).layout_type !== 'card') return;
    setCurrentCardIndex(index => Math.min(Math.max(index, 0), visibleFields.length));
  }, [form, visibleFields.length]);

  useEffect(() => {
    if (formId) {
      fetchForm();
      fetchUserEmployeeData();
    }
  }, [formId]);

  useEffect(() => {
    if (!formId) {
      setPremiumProgramResolutionLoading(false);
      return;
    }
    if (programId) {
      setPremiumProgramResolutionLoading(false);
      return;
    }

    let cancelled = false;
    let redirecting = false;
    const resolveLinkedProgram = async () => {
      setPremiumProgramResolutionLoading(true);
      setPremiumWorkflowPricing(null);
      setPremiumWorkflowPricingProgramId(null);
      setPremiumPaymentInstructions(null);
      setPremiumSetupError(null);
      try {
        const { data, error } = await supabase
          .from('union_programs')
          .select('id')
          .eq('dynamic_form_id', formId)
          .eq('program_type', 'gathering')
          .eq('is_active', true)
          .eq('publication_status', 'published')
          .limit(2);
        if (error) throw error;
        if (cancelled) return;

        const linkedPrograms = data || [];
        if (linkedPrograms.length > 1) {
          setPremiumSetupError('Formulir ini terhubung ke lebih dari satu program aktif. Hubungi admin agar tautan program diperbaiki.');
          return;
        }
        if (linkedPrograms.length === 1) {
          const nextParams = new URLSearchParams(searchParamsKey);
          nextParams.set('programId', linkedPrograms[0].id);
          redirecting = true;
          navigate({
            pathname: `/portal/forms/${encodeURIComponent(formId)}`,
            search: `?${nextParams.toString()}`,
          }, { replace: true });
        }
      } catch (resolutionError) {
        console.warn('[Form V2] Program resolution:', resolutionError);
        if (!cancelled) {
          setPremiumSetupError('Program untuk formulir ini belum dapat dipastikan. Muat ulang halaman atau hubungi admin.');
        }
      } finally {
        if (!cancelled && !redirecting) setPremiumProgramResolutionLoading(false);
      }
    };

    void resolveLinkedProgram();
    return () => { cancelled = true; };
  }, [formId, navigate, programId, searchParamsKey]);

  useEffect(() => {
    if (!formId || !programId || !user) return;
    let cancelled = false;
    const fetchRegistrationStatus = async () => {
      setPremiumStatusLoading(true);
      setPremiumWorkflowPricing(null);
      setPremiumWorkflowPricingProgramId(null);
      setPremiumPaymentInstructions(null);
      setPremiumInitialAnswers({});
      setPremiumInitialResult(null);
      setPremiumSetupError(null);
      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token;
        if (!token) throw new Error('Sesi login tidak tersedia.');
        const response = await fetch(`/api/portal/programs/${encodeURIComponent(programId)}/registration-v2`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Status registrasi belum dapat dimuat.');
        if (cancelled) return;
        if (!payload.workflow_pricing || typeof payload.workflow_pricing !== 'object') {
          throw new Error('Konfigurasi harga workflow tidak tersedia.');
        }
        const authoritativeFormId = String(payload.workflow_pricing.dynamic_form_id || '');
        if (!authoritativeFormId || authoritativeFormId !== formId) {
          throw new Error('Tautan formulir tidak sesuai dengan program yang dipilih.');
        }
        if (!Array.isArray(payload.workflow_pricing.form_snapshot?.fields)) {
          throw new Error('Snapshot formulir program belum tersedia.');
        }
        setPremiumWorkflowPricing(payload.workflow_pricing as ProgramWorkflowPricingPayload);
        setPremiumWorkflowPricingProgramId(programId);
        setPremiumPaymentInstructions(payload.payment_instructions || null);
        const registration = payload.data;
        if (!registration) return;
        const payment = registration.payments?.[0];
        const proofRecorded = Boolean(payment?.proof_url || payment?.proof_path);
        if (registration.registration_status === 'draft' || (registration.payment_status === 'pending' && !proofRecorded)) {
          setPremiumInitialAnswers(registration.answers_snapshot || {});
          return;
        }
        setPremiumInitialAnswers(registration.answers_snapshot || {});
        setPremiumInitialResult(mapPremiumRegistrationResult(registration));
      } catch (statusError) {
        console.warn('[Form V2] Registration status:', statusError);
        if (!cancelled) {
          setPremiumSetupError('Konfigurasi program belum dapat dimuat dengan aman. Muat ulang halaman atau hubungi admin.');
        }
      } finally {
        if (!cancelled) setPremiumStatusLoading(false);
      }
    };
    void fetchRegistrationStatus();
    return () => { cancelled = true; };
  }, [form?.experience_version, formId, programId, user?.id]);

  const fetchUserEmployeeData = async () => {
    if (!user?.nik) return;
    try {
      const { data } = await supabase
        .from('employees')
        .select('department, tanggal_masuk')
        .eq('nik', user.nik)
        .maybeSingle();
      if (data) {
          setUserDepartment(data.department || '');
          setUserTanggalMasuk(data.tanggal_masuk || '');
      }
    } catch {}
  };

  const fetchForm = async () => {
    setLoading(true);
    setPremiumProgramResolutionLoading(true);
    setPremiumSetupError(null);
    setPremiumWorkflowPricing(null);
    setPremiumWorkflowPricingProgramId(null);
    setPremiumPaymentInstructions(null);
    setSubmitted(false);
    setCurrentCardIndex(0);
    setAddonOrders({});
    setFileUploads({});
    setImageUploads({});
    setPaymentProofs({});
    setPaymentVerified({});
    setAiVerifying({});
    try {
      const { data, error } = await supabase
        .from('dynamic_forms')
        .select('*')
        .eq('id', formId)
        .eq('is_active', true)
        .single();
      
      if (error) throw error;

      let desc = data.description;
      let theme = '#673AB7';
      let banner = '';
      let layout_type = 'classic';
      let font_family = 'Inter';
      let input_style = 'rounded';
      let bg_image_url = '';
      let card_glassmorphism = false;
      let experience_version: 1 | 2 = 1;
      let theme_config: FormConfig['theme'];
      let outcomes: FormConfig['outcomes'];
      let default_outcome_id: string | undefined;
      let review_enabled = true;
      let autosave_draft = false;
      let program_automation: FormConfig['program_automation'];
      let welcome_screen: FormConfig['welcome_screen'];
      try {
        const parsed = JSON.parse(data.description);
        if (parsed.text !== undefined) {
          desc = parsed.text;
          theme = parsed.theme || '#673AB7';
          banner = parsed.banner || '';
          layout_type = parsed.layout_type || 'classic';
          font_family = parsed.font_family || 'Inter';
          input_style = parsed.input_style || 'rounded';
          bg_image_url = parsed.bg_image_url || '';
          card_glassmorphism = parsed.card_glassmorphism || false;
          experience_version = parsed.experience_version === 2 ? 2 : 1;
          theme_config = parsed.theme_config;
          outcomes = parsed.outcomes;
          default_outcome_id = parsed.default_outcome_id;
          review_enabled = parsed.review_enabled ?? true;
          autosave_draft = parsed.autosave_draft ?? false;
          program_automation = parsed.program_automation;
          welcome_screen = parsed.welcome_screen;
        }
      } catch(e) {}
      
      data.description = desc;
      (data as any).theme_color = theme;
      (data as any).banner_url = banner;
      (data as any).layout_type = layout_type;
      (data as any).font_family = font_family;
      (data as any).input_style = input_style;
      (data as any).bg_image_url = bg_image_url;
      (data as any).card_glassmorphism = card_glassmorphism;
      (data as any).experience_version = experience_version;
      (data as any).theme = theme_config;
      (data as any).outcomes = outcomes;
      (data as any).default_outcome_id = default_outcome_id;
      (data as any).review_enabled = review_enabled;
      (data as any).autosave_draft = autosave_draft;
      (data as any).program_automation = program_automation;
      (data as any).welcome_screen = welcome_screen;

      setForm(data);
      
      const initialAnswers: Record<string, any> = {};
      data.fields.forEach((f: FormField) => {
        if (f.type === 'checkbox') initialAnswers[f.id] = [];
        if (f.type === 'addon_group') initialAnswers[f.id] = null; // Tidak digunakan langsung
      });
      setAnswers(initialAnswers);
    } catch (error: any) {
      toast.error('Formulir tidak ditemukan');
      navigate('/portal/program');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (fieldId: string, file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${user?.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('program-files')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          metadata: { owner: user?.id } // Penting untuk RLS policy
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('program-files')
        .getPublicUrl(filePath);

      setFileUploads(prev => ({ ...prev, [fieldId]: publicUrl }));
      toast.success('File berhasil diunggah');
    } catch (error: any) {
      console.error(error);
      toast.error('Gagal mengunggah file');
    }
  };

  const handleImageUpload = async (fieldId: string, file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `img_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const filePath = `${user?.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('program-files')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          metadata: { owner: user?.id }
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('program-files')
        .getPublicUrl(filePath);

      setImageUploads(prev => ({ ...prev, [fieldId]: publicUrl }));
      setAnswers(prev => ({ ...prev, [fieldId]: publicUrl }));
      toast.success('Gambar berhasil diunggah');
    } catch (error: any) {
      console.error(error);
      toast.error('Gagal mengunggah gambar');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validasi manual — hanya field yang visible
    const missingFields = visibleFields.filter(f => {
        if (!f.required || f.type === 'payment_section') return false;
        if (f.type === 'checkbox' && (!answers[f.id] || answers[f.id].length === 0)) return true;
        if (f.type === 'addon_group') {
            const orders = addonOrders[f.id] || [];
            const hasOrder = orders.some(o => o.quantity > 0);
            return !hasOrder;
        }
        if (f.type === 'file_upload' && !fileUploads[f.id]) return true;
        if (f.type === 'image' && !imageUploads[f.id]) return true;
        return !answers[f.id];
    });

    if (missingFields && missingFields.length > 0) {
      toast.error(`Mohon lengkapi kolom wajib: ${missingFields.map(f => f.label).join(', ')}`);
      return;
    }

    // Validasi payment — cek apakah ada payment_section yang butuh verifikasi
    const paymentFields = visibleFields.filter(f => f.type === 'payment_section');
    for (const pf of paymentFields) {
      if (!paymentProofs[pf.id]) {
        toast.error('Upload bukti transfer terlebih dahulu');
        return;
      }
      if (pf.verify_with_ai !== false && !paymentVerified[pf.id]) {
        toast.error('Verifikasi pembayaran terlebih dahulu');
        return;
      }
    }

    setSubmitting(true);
    try {
      // Format payload respons — exclude hidden fields
      const finalAnswers: Record<string, any> = {};
      visibleFields.forEach(f => {
        if (answers[f.id] !== undefined) finalAnswers[f.id] = answers[f.id];
      });
      
      // Inject file uploads ke jawaban
      Object.keys(fileUploads).forEach(key => {
        if (visibleFields.some(f => f.id === key)) finalAnswers[key] = fileUploads[key];
      });

      // Inject image uploads ke jawaban
      Object.keys(imageUploads).forEach(key => {
        if (visibleFields.some(f => f.id === key)) finalAnswers[key] = imageUploads[key];
      });

      // Inject addon orders ke jawaban
      Object.keys(addonOrders).forEach(key => {
        if (visibleFields.some(f => f.id === key)) finalAnswers[key] = addonOrders[key];
      });

      // Inject payment total
      visibleFields.filter(f => f.type === 'payment_section').forEach(pf => {
        finalAnswers[`_payment_total`] = computeTotal();
        finalAnswers[`_payment_proof`] = paymentProofs[pf.id] || '';
        finalAnswers[`_payment_verified`] = paymentVerified[pf.id] || false;
      });

      const { error: respError } = await supabase
        .from('dynamic_form_responses')
        .insert({
          form_id: formId,
          user_id: user.id,
          answers: finalAnswers
        });
      if (respError) throw respError;

      // Registrasi program jika ada
      if (programId) {
         // (Sama seperti kode sebelumnya, skip untuk brevity)
      }

      setSubmitted(true);
      toast.success('Formulir berhasil dikirim!');
    } catch (error: any) {
      toast.error('Gagal mengirim formulir: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckboxChange = (fieldId: string, option: string, checked: boolean) => {
    setAnswers(prev => {
      const current = prev[fieldId] || [];
      if (checked) return { ...prev, [fieldId]: [...current, option] };
      return { ...prev, [fieldId]: current.filter((o: string) => o !== option) };
    });
  };

  // --- Payment Helpers ---
  const computeTotal = (): number => calculateVisibleFormTotal(form?.fields || [], answers, addonOrders);

  const formatPrice = (amount: number) => {
    return 'Rp ' + amount.toLocaleString('id-ID');
  };

  const verifyPayment = async (fieldId: string, expectedAmount: number) => {
    const imageBase64 = paymentProofs[fieldId];
    if (!imageBase64) {
      toast.error('Upload bukti transfer terlebih dahulu');
      return;
    }
    setAiVerifying(prev => ({ ...prev, [fieldId]: true }));
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch('/api/validate/receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ imageBase64, totalAmount: expectedAmount }),
      });
      const json = await res.json();
      if (json.success && json.data?.valid) {
        setPaymentVerified(prev => ({ ...prev, [fieldId]: true }));
        toast.success('Pembayaran terverifikasi!');
      } else {
        setPaymentVerified(prev => ({ ...prev, [fieldId]: false }));
        toast.error('Bukti transfer tidak valid: ' + (json.data?.reason || 'Nominal tidak sesuai'));
      }
    } catch {
      toast.error('Gagal verifikasi. Coba lagi.');
    } finally {
      setAiVerifying(prev => ({ ...prev, [fieldId]: false }));
    }
  };

  const handlePaymentProofUpload = async (fieldId: string, file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `payment_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const filePath = `${user?.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('program-files')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          metadata: { owner: user?.id }
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('program-files')
        .getPublicUrl(filePath);

      // Convert to base64 for AI verification
      const toBase64 = (f: File): Promise<string> => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(f);
      });
      const base64 = await toBase64(file);

      setPaymentProofs(prev => ({ ...prev, [fieldId]: base64 }));
      setAnswers(prev => ({ ...prev, [fieldId]: publicUrl }));
      toast.success('Bukti transfer berhasil diunggah');
    } catch (error: any) {
      toast.error('Gagal mengunggah bukti transfer');
    }
  };

  const themeColor = (form as any)?.theme_color || '#673AB7';

  const getInputClass = (base = "w-full py-4 px-5 transition-all outline-none focus:ring-2 focus:ring-[var(--theme-color)]/30") => {
    let borderStyle = "";
    if ((form as any)?.input_style === 'sharp') {
      borderStyle = "border border-zinc-300 dark:border-zinc-700 focus:border-[var(--theme-color)]";
    } else if ((form as any)?.input_style === 'underline') {
      borderStyle = "border-b-2 border-t-0 border-l-0 border-r-0 border-zinc-250 dark:border-zinc-750 bg-transparent px-1 focus:border-[var(--theme-color)]";
    } else {
      borderStyle = "border-2 border-zinc-100 dark:border-zinc-800 focus:border-[var(--theme-color)] rounded-2xl";
    }
    return `${base} ${borderStyle} bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white`;
  };

  const handleNextCard = () => {
    if (currentCardIndex === 0) {
      if (visibleFields.length === 0) {
        toast.error('Formulir ini belum memiliki pertanyaan yang dapat diisi.');
        return;
      }
      setCurrentCardIndex(1);
      return;
    }
    
    const currentField = visibleFields[currentCardIndex - 1];
    if (currentField && currentField.required) {
      let hasError = false;
      if (currentField.type === 'checkbox' && (!answers[currentField.id] || answers[currentField.id].length === 0)) hasError = true;
      else if (currentField.type === 'addon_group') {
        const orders = addonOrders[currentField.id] || [];
        const hasOrder = orders.some(o => o.quantity > 0);
        if (!hasOrder) hasError = true;
      }
      else if (currentField.type === 'file_upload' && !fileUploads[currentField.id]) hasError = true;
      else if (currentField.type === 'image' && !imageUploads[currentField.id]) hasError = true;
      else if (currentField.type === 'payment_section') {
        if (!paymentProofs[currentField.id]) {
          toast.error('Silakan upload bukti transfer terlebih dahulu');
          return;
        }
        if (currentField.verify_with_ai !== false && !paymentVerified[currentField.id]) {
          toast.error('Silakan lakukan verifikasi bukti bayar terlebih dahulu');
          return;
        }
      }
      else if (answers[currentField.id] === undefined || answers[currentField.id] === null || answers[currentField.id] === '') hasError = true;
      
      if (hasError) {
        toast.error(`Pertanyaan ini wajib diisi: ${currentField.label}`);
        return;
      }
    }
    
    if (currentCardIndex <= visibleFields.length) {
      setCurrentCardIndex(currentCardIndex + 1);
    }
  };

  const uploadPremiumFile = async (fieldId: string, file: File): Promise<string> => {
    const field = form?.fields.find(candidate => candidate.id === fieldId);
    const maximumMb = field?.max_size_mb || (fieldId === 'payment-proof' ? 8 : 5);
    if (file.size > maximumMb * 1024 * 1024) throw new Error(`Ukuran file maksimal ${maximumMb} MB.`);
    if (fieldId === 'payment-proof' && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      throw new Error('Bukti pembayaran harus berupa JPG, PNG, atau WEBP.');
    }
    const extension = file.name.split('.').pop()?.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'bin';
    const uniqueName = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const filePath = `${user?.id}/${fieldId}/${uniqueName}.${extension}`;
    const { error: uploadError } = await supabase.storage.from('program-files').upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
      metadata: { owner: user?.id, field_id: fieldId },
    });
    if (uploadError) throw uploadError;
    if (fieldId === 'payment-proof') return filePath;
    return supabase.storage.from('program-files').getPublicUrl(filePath).data.publicUrl;
  };

  const handlePremiumSubmit = async (submission: PremiumFormSubmitPayload): Promise<PremiumFormSubmitResult> => {
    if (!user || !formId) throw new Error('Sesi Anda tidak valid. Silakan masuk kembali.');
    if (premiumProgramResolutionLoading) throw new Error('Program masih sedang diverifikasi. Silakan tunggu sebentar.');
    if (premiumSetupError) throw new Error(premiumSetupError);
    if (programId && !activePremiumWorkflowPricing) {
      throw new Error('Konfigurasi harga program belum tersedia. Muat ulang halaman sebelum mengirim formulir.');
    }

    const serverAnswers: Record<string, unknown> = { ...submission.answers };
    Object.entries(submission.addonOrders).forEach(([fieldId, orders]) => { serverAnswers[fieldId] = orders; });
    if (submission.paymentMethod) serverAnswers._payment_method = submission.paymentMethod;

    if (!programId) {
      if (submission.total > 0) throw new Error('Formulir berbayar harus dihubungkan ke program kerja sebelum dipublikasikan.');
      const { data, error: responseError } = await supabase.from('dynamic_form_responses').insert({
        form_id: formId,
        user_id: user.id,
        answers: serverAnswers,
      }).select('id').single();
      if (responseError) throw responseError;
      const declined = Boolean(submission.outcomeId && form?.outcomes?.find(outcome => outcome.id === submission.outcomeId)?.kind === 'declined');
      return {
        status: declined ? 'declined' : 'success',
        reference: data?.id ? String(data.id).slice(0, 8).toUpperCase() : undefined,
        total: 0,
      };
    }

    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) throw new Error('Sesi login berakhir. Silakan masuk kembali.');
    const submitResponse = await fetch(`/api/portal/programs/${encodeURIComponent(programId)}/registration-v2/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ answers: serverAnswers, clientTotal: submission.total, expectedFormId: formId }),
    });
    const submitPayload = await submitResponse.json().catch(() => ({}));
    if (!submitResponse.ok) throw new Error(submitPayload.error || submitPayload.message || 'Registrasi belum berhasil disimpan.');

    const registration = submitPayload.data;
    const authoritativeTotal = Number(registration?.total_amount || 0);
    if (authoritativeTotal > 0) {
      if (!submission.paymentProof) throw new Error('Bukti pembayaran wajib diunggah.');
      const payment = submitPayload.payment || registration?.payments?.[0];
      if (!payment?.id) throw new Error('Data pembayaran belum tersedia. Hubungi admin program.');
      const proofUrl = await uploadPremiumFile('payment-proof', submission.paymentProof);
      const proofResponse = await fetch(`/api/portal/programs/${encodeURIComponent(programId)}/registration-v2/payment-proof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ paymentId: payment.id, proofUrl, declaredAmount: authoritativeTotal }),
      });
      const proofPayload = await proofResponse.json().catch(() => ({}));
      if (!proofResponse.ok) throw new Error(proofPayload.error || proofPayload.message || 'Bukti pembayaran belum berhasil dicatat.');
      if (proofPayload.ai_verified && proofPayload.registration) {
        const mapped = mapPremiumRegistrationResult(proofPayload.registration);
        return {
          ...mapped,
          title: 'Pembayaran terverifikasi otomatis',
          message: proofPayload.message || mapped.message,
          total: authoritativeTotal,
        };
      }
      return {
        status: 'pending',
        title: 'Bukti pembayaran sedang diperiksa',
        message: proofPayload.message || 'Tiket dan kupon akan diterbitkan setelah pembayaran disetujui admin.',
        reference: registration?.id ? String(registration.id).slice(0, 8).toUpperCase() : undefined,
        total: authoritativeTotal,
      };
    }

    return mapPremiumRegistrationResult(registration);
  };

  const handleBackCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(currentCardIndex - 1);
    }
  };

  // --- Helper Renderers ---

  const renderImageChoice = (field: FormField) => (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {field.options?.map((opt) => (
        <label 
          key={opt.value}
          className={`relative cursor-pointer group rounded-2xl overflow-hidden border-2 transition-all ${
            answers[field.id] === opt.value
              ? 'border-blue-500 ring-2 ring-blue-500/20'
              : 'border-zinc-100 dark:border-zinc-800 hover:border-blue-300'
          }`}
        >
          <input
            type="radio"
            name={field.id}
            value={opt.value}
            checked={answers[field.id] === opt.value}
            onChange={() => setAnswers({ ...answers, [field.id]: opt.value })}
            className="sr-only"
          />
          <div className="aspect-video bg-zinc-100 dark:bg-zinc-800 relative">
            {opt.image ? (
              <img src={opt.image} alt={opt.label} className="w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-zinc-300">
                <ImageIcon className="w-8 h-8" />
              </div>
            )}
            {answers[field.id] === opt.value && (
                <div className="absolute top-2 right-2 bg-blue-500 text-white p-1 rounded-full shadow-lg">
                    <CheckCircle2 className="w-4 h-4" />
                </div>
            )}
          </div>
          <div className="p-3 bg-white dark:bg-zinc-900">
            <p className="font-bold text-sm text-center text-zinc-800 dark:text-white">{opt.label}</p>
          </div>
        </label>
      ))}
    </div>
  );

  const renderRating = (field: FormField) => {
    const max = field.max || 5;
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="flex gap-2">
          {[...Array(max)].map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setAnswers({ ...answers, [field.id]: i + 1 })}
              className={`p-2 transition-transform hover:scale-110 ${answers[field.id] === i + 1 ? 'text-yellow-400' : 'text-zinc-300'}`}
            >
              <Star className="w-8 h-8 fill-current" />
            </button>
          ))}
        </div>
        <p className="text-sm font-bold text-zinc-400">
            {answers[field.id] ? `Anda memberi ${answers[field.id]} bintang` : 'Pilih jumlah bintang'}
        </p>
      </div>
    );
  };

  const renderScale = (field: FormField) => {
    const max = field.max_scale || 10;
    return (
      <div className="space-y-3">
        <div className="flex justify-between text-xs text-zinc-400 font-bold uppercase">
            <span>1</span>
            <span>{max}</span>
        </div>
        <div className="flex gap-1 overflow-x-auto pb-2">
          {[...Array(max)].map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setAnswers({ ...answers, [field.id]: i + 1 })}
              className={`flex-1 min-w-[40px] h-12 rounded-xl font-bold transition-all ${
                answers[field.id] === i + 1
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderFileUpload = (field: FormField) => (
    <div className="border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-2xl p-6 text-center hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
      {fileUploads[field.id] ? (
        <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl">
            <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center text-blue-600">
                    <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="text-left">
                    <p className="text-sm font-bold text-blue-700 dark:text-blue-300 truncate max-w-[200px]">File Terunggah</p>
                    <p className="text-xs text-blue-500/70 truncate max-w-[200px]">{fileUploads[field.id].split('/').pop()}</p>
                </div>
            </div>
            <button onClick={() => setFileUploads(prev => ({...prev, [field.id]: ''}))} className="text-zinc-400 hover:text-red-500">
                <X className="w-5 h-5" />
            </button>
        </div>
      ) : (
        <label className="cursor-pointer block">
          <input 
            type="file" 
            className="hidden" 
            accept={field.allowed_types?.join(',')}
            onChange={(e) => e.target.files?.[0] && handleFileUpload(field.id, e.target.files[0])}
          />
          <UploadCloud className="w-10 h-10 text-zinc-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-zinc-600 dark:text-zinc-300">Klik untuk Unggah</p>
          <p className="text-xs text-zinc-400 mt-1">Max {field.max_size_mb || 5}MB</p>
        </label>
      )}
    </div>
  );

  const renderAddonGroup = (field: FormField) => {
    const orders = addonOrders[field.id] || [{ item_id: field.items?.[0]?.id || '', size: '', quantity: 0 }];
    
    const addRow = () => {
        setAddonOrders(prev => ({
            ...prev,
            [field.id]: [...(prev[field.id] || []), { item_id: field.items?.[0]?.id || '', size: '', quantity: 0 }]
        }));
    };

    const updateRow = (index: number, key: keyof AddonOrder, value: any) => {
        const newOrders = [...orders];
        newOrders[index] = { ...newOrders[index], [key]: value };
        setAddonOrders(prev => ({ ...prev, [field.id]: newOrders }));
    };

    const removeRow = (index: number) => {
        if (orders.length > 1) {
            const newOrders = orders.filter((_, i) => i !== index);
            setAddonOrders(prev => ({ ...prev, [field.id]: newOrders }));
        } else {
            // Reset if it's the last one
             updateRow(0, 'quantity', 0);
             updateRow(0, 'size', '');
        }
    };

    return (
        <div className="space-y-3 bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800">
            {orders.map((order, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                         {/* Pilihan Item (Hidden if only 1 item) */}
                         {field.items && field.items.length > 1 && (
                            <select 
                                value={order.item_id}
                                onChange={(e) => updateRow(idx, 'item_id', e.target.value)}
                                className="w-full p-3 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm font-bold"
                            >
                                {field.items.map(item => (
                                    <option key={item.id} value={item.id}>{item.name} (Rp {item.price})</option>
                                ))}
                            </select>
                         )}
                         
                         {/* Size Selector */}
                         <select 
                            value={order.size}
                            onChange={(e) => updateRow(idx, 'size', e.target.value)}
                            className="w-full p-3 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm"
                         >
                             <option value="">Pilih Ukuran</option>
                             {field.items?.find(i => i.id === order.item_id)?.sizes.map(s => (
                                 <option key={s} value={s}>{s}</option>
                             ))}
                         </select>

                         {/* Quantity */}
                         <input 
                            type="number" 
                            min="1"
                            value={order.quantity}
                            onChange={(e) => updateRow(idx, 'quantity', parseInt(e.target.value) || 0)}
                            className="w-full p-3 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm"
                            placeholder="Jumlah"
                         />
                    </div>
                    <button onClick={() => removeRow(idx)} className="p-3 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-xl transition-colors">
                        <Trash2 className="w-5 h-5" />
                    </button>
                </div>
            ))}
            
            <button 
                onClick={addRow}
                className="w-full py-2 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-500 font-bold text-sm hover:bg-white dark:hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2"
            >
                <Plus className="w-4 h-4" /> Tambah Pesanan Ekstra
            </button>
            
            {field.required && (
                 <p className="text-xs text-orange-500 font-bold flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Wajib memesan minimal 1
                 </p>
            )}
        </div>
    );
  };

  if (!user) return <Navigate to="/login" />;

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-blue-500" /></div>;

  // Check targeting
  const isTargetedByNiksDepts = !form?.target_niks && !form?.target_departments || (
    form?.target_niks?.includes(user?.nik || '') ||
    (form?.target_departments?.length > 0 && userDepartment && form.target_departments.includes(userDepartment))
  );
  
  let isTargeted = isTargetedByNiksDepts;

  // Check cutoff date if specified on the form
  if (form?.target_cutoff_date && userTanggalMasuk) {
      const cutoffDate = new Date(form.target_cutoff_date);
      const userDate = new Date(userTanggalMasuk);
      if (userDate > cutoffDate) {
          isTargeted = false;
      }
  }

  // NOTE: We no longer bypass targeting with Boolean(programId).
  // The form itself (or the union program overriding it) must have its targeting checked.

  if (!isTargeted && form) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 p-8 rounded-3xl text-center border border-zinc-100 dark:border-zinc-800 shadow-xl">
          <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="w-10 h-10 text-zinc-400" />
          </div>
          <h2 className="text-2xl font-black text-zinc-900 dark:text-white mb-2">Akses Terbatas</h2>
          <p className="text-zinc-500 mb-8">Formulir ini hanya dapat diakses oleh anggota yang telah ditentukan.</p>
          <button onClick={() => navigate('/portal')} className="w-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 py-4 rounded-2xl font-black">Kembali</button>
        </div>
      </div>
    );
  }

  if (form?.experience_version === 2 || Boolean(programId)) {
    const waitingForWorkflowPricing = Boolean(programId && !activePremiumWorkflowPricing && !premiumSetupError);
    if (premiumStatusLoading || premiumProgramResolutionLoading || waitingForWorkflowPricing) {
      return <div className="min-h-screen bg-zinc-50 flex items-center justify-center dark:bg-zinc-950"><div className="text-center"><Loader2 className="mx-auto h-10 w-10 animate-spin text-indigo-600" /><p className="mt-3 text-sm font-semibold text-zinc-500">Menyiapkan pengalaman formulir…</p></div></div>;
    }
    if (premiumSetupError || (programId && !activePremiumWorkflowPricing)) {
      return (
        <div className="min-h-screen bg-zinc-50 px-4 py-10 dark:bg-zinc-950 sm:flex sm:items-center sm:justify-center">
          <div className="mx-auto w-full max-w-md rounded-3xl border border-amber-200 bg-white p-6 text-center shadow-xl dark:border-amber-900/70 dark:bg-zinc-900 sm:p-8">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
              <AlertCircle className="h-8 w-8" />
            </div>
            <h2 className="mt-5 text-xl font-black text-zinc-900 dark:text-white">Formulir belum siap</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              {premiumSetupError || 'Konfigurasi harga program belum tersedia. Muat ulang halaman atau hubungi admin.'}
            </p>
            <button type="button" onClick={() => navigate('/portal/program')} className="mt-6 min-h-12 w-full rounded-2xl bg-zinc-900 px-4 text-sm font-black text-white dark:bg-white dark:text-zinc-900">
              Kembali ke program
            </button>
          </div>
        </div>
      );
    }
    const premiumForm: FormConfig = {
      ...form,
      ...(activePremiumWorkflowPricing?.form_snapshot || {}),
      id: form.id,
      fields: premiumPricedFields.map(field => field.type !== 'payment_section' || !premiumPaymentInstructions
        ? field
        : {
            ...field,
            payment_methods: premiumPaymentInstructions.payment_methods?.length
              ? premiumPaymentInstructions.payment_methods
              : field.payment_methods,
            qris_image_url: premiumPaymentInstructions.qris_image_url || field.qris_image_url,
            account_name: premiumPaymentInstructions.account_name || field.account_name,
            bank_accounts: premiumPaymentInstructions.account_number
              ? [{
                  id: 'program-payment-account',
                  bank_name: premiumPaymentInstructions.bank_name || 'Transfer bank',
                  account_number: premiumPaymentInstructions.account_number,
                  account_name: premiumPaymentInstructions.account_name || '',
                }]
              : field.bank_accounts,
            payment_description: premiumPaymentInstructions.instructions || field.payment_description,
            proof_required: premiumPaymentInstructions.proof_required ?? field.proof_required,
            verify_with_ai: premiumPaymentInstructions.verify_with_ai ?? field.verify_with_ai,
          }),
    };
    return (
      <PremiumFormExperience
        form={premiumForm}
        initialAnswers={premiumInitialAnswers}
        initialResult={premiumInitialResult}
        draftKey={`sps-form-draft:${form.id}:${user.id}`}
        respondentName={user.name}
        programName={programId ? 'Program Kerja SPS' : undefined}
        onBack={() => navigate(programId ? '/portal/program' : '/portal/forms', programId ? { state: { programId } } : undefined)}
        onUploadFile={uploadPremiumFile}
        onSubmit={handlePremiumSubmit}
      />
    );
  }

  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950">
        <motion.div initial={{scale:0.9, opacity:0}} animate={{scale:1, opacity:1}} className="max-w-md w-full bg-white dark:bg-zinc-900 p-8 rounded-3xl text-center border border-zinc-100 dark:border-zinc-800 shadow-xl">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600">
                <CheckCircle2 className="w-12 h-12" />
            </div>
            <h2 className="text-2xl font-black text-zinc-900 dark:text-white mb-2">Berhasil!</h2>
            <p className="text-zinc-500 mb-8">Terima kasih telah mengisi formulir.</p>
            <button onClick={() => navigate('/portal/forms')} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black">Kembali</button>
        </motion.div>
    </div>
  );

  const renderFieldComponent = (field: FormField) => {
    return (
      <div className="space-y-3">
        {field.type === 'text' && (
          <input 
            type="text" 
            required={field.required} 
            placeholder={field.placeholder} 
            value={answers[field.id] || ''} 
            onChange={(e) => setAnswers({...answers, [field.id]: e.target.value})} 
            className={getInputClass()} 
          />
        )}

        {field.type === 'textarea' && (
          <textarea 
            required={field.required} 
            rows={4} 
            value={answers[field.id] || ''} 
            onChange={(e) => setAnswers({...answers, [field.id]: e.target.value})} 
            className={getInputClass()} 
          />
        )}

        {field.type === 'number' && (
          <input 
            type="number" 
            required={field.required} 
            value={answers[field.id] || ''} 
            onChange={(e) => setAnswers({...answers, [field.id]: e.target.value})} 
            className={getInputClass()} 
          />
        )}

        {field.type === 'date' && (
          <input 
            type="date" 
            required={field.required} 
            value={answers[field.id] || ''} 
            onChange={(e) => setAnswers({...answers, [field.id]: e.target.value})} 
            className={getInputClass()} 
          />
        )}

        {field.type === 'select' && (
          <select 
            required={field.required} 
            value={answers[field.id] || ''} 
            onChange={(e) => setAnswers({...answers, [field.id]: e.target.value})} 
            className={getInputClass("w-full py-4 px-5 transition-all outline-none focus:ring-2 focus:ring-[var(--theme-color)]/30 appearance-none")}
          >
            <option value="">-- Pilih --</option>
            {field.options?.map(opt => <option key={opt.value} value={opt.value}>{opt.label}{opt.price ? ` (${formatPrice(opt.price)})` : ''}</option>)}
          </select>
        )}

        {field.type === 'radio' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {field.options?.map(opt => (
              <label 
                key={opt.value} 
                className={`flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all`}
                style={{
                  borderColor: answers[field.id] === opt.value ? themeColor : 'rgba(228, 228, 231, 0.1)',
                  backgroundColor: answers[field.id] === opt.value ? `${themeColor}10` : undefined
                }}
              >
                <input 
                  type="radio" 
                  name={field.id} 
                  checked={answers[field.id] === opt.value} 
                  onChange={() => setAnswers({...answers, [field.id]: opt.value})} 
                  className="w-5 h-5" 
                  style={{ accentColor: themeColor }}
                />
                <span className="font-bold text-sm text-zinc-800 dark:text-zinc-200">{opt.label}</span>
                {opt.price ? <span className="text-sm font-bold text-emerald-600 ml-auto">{formatPrice(opt.price)}</span> : null}
              </label>
            ))}
          </div>
        )}
        
        {field.type === 'checkbox' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {field.options?.map(opt => (
              <label 
                key={opt.value} 
                className={`flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all`}
                style={{
                  borderColor: answers[field.id]?.includes(opt.value) ? themeColor : 'rgba(228, 228, 231, 0.1)',
                  backgroundColor: answers[field.id]?.includes(opt.value) ? `${themeColor}10` : undefined
                }}
              >
                <input 
                  type="checkbox" 
                  checked={answers[field.id]?.includes(opt.value)} 
                  onChange={(e) => handleCheckboxChange(field.id, opt.value, e.target.checked)} 
                  className="w-5 h-5 rounded" 
                  style={{ accentColor: themeColor }}
                />
                <span className="font-bold text-sm text-zinc-800 dark:text-zinc-200">{opt.label}</span>
                {opt.price ? <span className="text-sm font-bold text-emerald-600 ml-auto">{formatPrice(opt.price)}</span> : null}
              </label>
            ))}
          </div>
        )}

        {field.type === 'image_choice' && renderImageChoice(field)}
        {field.type === 'rating' && renderRating(field)}
        {field.type === 'scale' && renderScale(field)}
        {field.type === 'file_upload' && renderFileUpload(field)}
        {field.type === 'image' && (
          <div className="space-y-3">
            {imageUploads[field.id] ? (
              <div className="space-y-3">
                <div className="relative rounded-2xl overflow-hidden border-2 border-zinc-200 dark:border-zinc-700">
                  <img src={imageUploads[field.id]} alt={field.label} className="w-full max-h-80 object-contain bg-zinc-50 dark:bg-zinc-850" />
                  <button
                    type="button"
                    onClick={() => { setImageUploads(prev => ({...prev, [field.id]: ''})); setAnswers(prev => ({...prev, [field.id]: ''})); }}
                    className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="flex flex-col items-center gap-2 p-6 border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-2xl cursor-pointer hover:bg-zinc-55 dark:hover:bg-zinc-800/50 transition-colors">
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleImageUpload(field.id, e.target.files[0])} />
                  <UploadCloud className="w-8 h-8 text-zinc-300" />
                  <span className="text-sm font-bold text-zinc-500">Klik untuk upload gambar</span>
                  <span className="text-xs text-zinc-400">JPG, PNG, atau WebP dari perangkat Anda</span>
                </label>
              </div>
            )}
          </div>
        )}
        {field.type === 'addon_group' && renderAddonGroup(field)}

        {field.type === 'payment_section' && (
          <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl p-6 border-2 border-emerald-250 dark:border-emerald-900/50 space-y-4">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-black text-lg">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              Pembayaran
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 flex items-center justify-between border border-zinc-150 dark:border-zinc-800">
              <span className="font-bold text-zinc-500">Total Pembayaran</span>
              <span className="font-black text-2xl text-emerald-600">{formatPrice(computeTotal())}</span>
            </div>

            {field.qris_image_url && (
              <div className="text-center space-y-2">
                <p className="text-sm font-bold text-zinc-500">Scan QRIS untuk membayar</p>
                <img src={field.qris_image_url} alt="QRIS" className="w-48 h-48 object-contain mx-auto rounded-xl border-2 border-zinc-200 dark:border-zinc-700" />
                {field.account_name && (
                  <p className="text-sm text-zinc-500">Rekening: <span className="font-bold text-zinc-800 dark:text-zinc-200">{field.account_name}</span></p>
                )}
              </div>
            )}

            {field.payment_description && (
              <p className="text-sm text-zinc-500">{field.payment_description}</p>
            )}

            <div className="space-y-3">
              <p className="font-bold text-sm text-zinc-650 dark:text-zinc-400">Upload Bukti Transfer</p>
              {paymentProofs[field.id] ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-150 dark:border-emerald-850">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">Bukti terunggah</span>
                    </div>
                    <button onClick={() => { setPaymentProofs(prev => ({...prev, [field.id]: ''})); setPaymentVerified(prev => ({...prev, [field.id]: false})); }} className="text-zinc-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                  </div>

                  {field.verify_with_ai !== false && (
                    <div className="space-y-2">
                      {paymentVerified[field.id] === true ? (
                        <div className="flex items-center gap-2 p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                          <CheckCircle2 className="w-5 h-5" />
                          Pembayaran terverifikasi
                        </div>
                      ) : paymentVerified[field.id] === false ? (
                        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl text-red-600 dark:text-red-400 font-bold text-sm">
                          <AlertCircle className="w-5 h-5" />
                          Verifikasi gagal, upload ulang bukti yang benar
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => verifyPayment(field.id, computeTotal())}
                          disabled={aiVerifying[field.id]}
                          className="w-full py-3 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                          style={{ backgroundColor: themeColor }}
                        >
                          {aiVerifying[field.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                          {aiVerifying[field.id] ? 'Memverifikasi...' : 'Verifikasi Bukti dengan AI'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <label className="flex flex-col items-center gap-2 p-6 border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl cursor-pointer hover:bg-white dark:hover:bg-zinc-800/50 transition-colors">
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handlePaymentProofUpload(field.id, e.target.files[0])} />
                  <UploadCloud className="w-8 h-8 text-zinc-300" />
                  <span className="text-sm font-bold text-zinc-500">Klik untuk upload bukti transfer</span>
                </label>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const cardClassName = (form as any)?.card_glassmorphism
    ? "bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl border border-white/20 dark:border-zinc-800/40 rounded-3xl p-6 md:p-10 shadow-2xl relative overflow-hidden"
    : "bg-white dark:bg-zinc-900 rounded-3xl p-6 md:p-10 border border-zinc-100 dark:border-zinc-800 shadow-sm relative overflow-hidden";

  return (
    <div 
      className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-20 relative dynamic-font-container"
      style={{
        '--theme-color': themeColor,
        backgroundImage: (form as any)?.bg_image_url ? `url(${(form as any).bg_image_url})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      } as React.CSSProperties}
    >
      {/* Background Overlay for image readability */}
      {(form as any)?.bg_image_url && (
        <div className="absolute inset-0 bg-zinc-950/20 backdrop-blur-[2px] pointer-events-none" />
      )}

      {/* Dynamic Font Loading */}
      {(form as any)?.font_family && (
        <link
          href={`https://fonts.googleapis.com/css2?family=${(form as any).font_family.replace(/ /g, '+')}:wght@400;500;700;900&display=swap`}
          rel="stylesheet"
        />
      )}
      <style>{`
        .dynamic-font-container {
          font-family: '${(form as any)?.font_family || 'Inter'}', sans-serif;
        }
      `}</style>

      {/* Header */}
      <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-150 dark:border-zinc-800 sticky top-0 z-10 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl"><ChevronLeft className="w-6 h-6 text-zinc-500" /></button>
          <div className="flex-1"><h1 className="text-lg md:text-xl font-black text-zinc-900 dark:text-white truncate">{form?.title}</h1></div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 mt-8 relative z-20">
        {form?.experience_version === 2 ? (
          <div className="bg-transparent">
            <PremiumFormExperience
              form={form}
              mode="respondent"
              initialAnswers={premiumInitialAnswers}
              initialResult={premiumInitialResult}
              onSubmit={handlePremiumSubmit}
            />
          </div>
        ) : (
          <div className={cardClassName}>
            {/* Top Accent Strip if no banner */}
            {!(form as any)?.banner_url && (
              <div className="absolute top-0 left-0 right-0 h-2.5" style={{ backgroundColor: themeColor }} />
            )}

            <form onSubmit={handleSubmit} className="space-y-0">
              {(form as any)?.layout_type === 'card' ? (
                <div>
                  <AnimatePresence mode="wait">
                   {currentCardIndex === 0 ? (
                     <motion.div
                       key="welcome"
                       initial={{ x: 50, opacity: 0 }}
                       animate={{ x: 0, opacity: 1 }}
                       exit={{ x: -50, opacity: 0 }}
                       transition={{ duration: 0.2 }}
                       className="text-center py-10 space-y-6"
                     >
                       {(form as any)?.banner_url && (
                         <div className="w-full h-48 md:h-64 overflow-hidden rounded-2xl mb-6">
                           <img src={(form as any).banner_url} alt="Banner" className="w-full h-full object-cover" />
                         </div>
                       )}
                       <h2 className="text-3xl font-black text-zinc-900 dark:text-white">{form?.title}</h2>
                       <p className="text-zinc-505 leading-relaxed max-w-xl mx-auto">{form?.description}</p>
                       
                       <div className="pt-6">
                         <button
                           type="button"
                           onClick={() => handleNextCard()}
                           className="px-10 py-4 text-white rounded-full font-black text-lg shadow-lg hover:opacity-90 active:scale-95 transition-all"
                           style={{ backgroundColor: themeColor, boxShadow: `0 10px 25px -5px ${themeColor}55` }}
                         >
                           Mulai Mengisi
                         </button>
                       </div>
                     </motion.div>
                   ) : (
                     (() => {
                       const fieldIndex = currentCardIndex - 1;
                       const field = visibleFields[fieldIndex];
                       
                       if (!field) return null;
                       
                       const isLast = currentCardIndex === visibleFields.length;
                       
                       return (
                         <motion.div
                           key={field.id}
                           initial={{ x: 50, opacity: 0 }}
                           animate={{ x: 0, opacity: 1 }}
                           exit={{ x: -50, opacity: 0 }}
                           transition={{ duration: 0.2 }}
                           className="space-y-6 py-6"
                         >
                           <div className="space-y-4">
                             <label className="flex items-center gap-2 text-xl font-bold text-zinc-900 dark:text-white">
                               {field.label} {field.required && <span className="text-red-500">*</span>}
                             </label>
                             
                             <div className="pt-2">
                               {renderFieldComponent(field)}
                             </div>
                           </div>

                           {/* Card controls */}
                           <div className="pt-10 flex items-center justify-between gap-4 border-t border-zinc-150 dark:border-zinc-800">
                             <button
                               type="button"
                               onClick={handleBackCard}
                               className="px-6 py-3 border-2 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-350 rounded-full font-bold text-sm hover:bg-zinc-55 dark:hover:bg-zinc-800 transition-colors"
                             >
                               Kembali
                             </button>

                             {isLast ? (
                               <button
                                 type="submit"
                                 disabled={submitting}
                                 className="px-8 py-3 text-white rounded-full font-black text-sm flex items-center gap-2 shadow-lg hover:opacity-90 active:scale-95 transition-all"
                                 style={{ backgroundColor: themeColor, boxShadow: `0 10px 20px -5px ${themeColor}44` }}
                               >
                                 {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                 Kirim Formulir
                               </button>
                             ) : (
                               <button
                                 type="button"
                                 onClick={handleNextCard}
                                 className="px-8 py-3 text-white rounded-full font-bold text-sm hover:opacity-90 active:scale-95 transition-all"
                                 style={{ backgroundColor: themeColor }}
                               >
                                 Selanjutnya
                               </button>
                             )}
                           </div>

                           {/* Progress bar */}
                           <div className="pt-6">
                             <div className="w-full bg-zinc-150 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                               <div 
                                 className="h-full transition-all duration-300" 
                                 style={{ 
                                   width: `${(currentCardIndex / visibleFields.length) * 100}%`,
                                   backgroundColor: themeColor 
                                 }} 
                               />
                             </div>
                             <p className="text-[10px] text-zinc-400 font-bold text-center mt-2 uppercase tracking-wider">
                               Pertanyaan {currentCardIndex} dari {visibleFields.length}
                             </p>
                           </div>
                         </motion.div>
                       );
                     })()
                   )}
                 </AnimatePresence>
               </div>
             ) : (
               // Render Classic Layout
               <div className="space-y-0">
                 {(form as any)?.banner_url && (
                   <div className="w-full h-48 md:h-64 overflow-hidden rounded-2xl mb-8 -mx-6 -mt-6 md:-mx-10 md:-mt-10 border-b border-zinc-150 dark:border-zinc-800">
                     <img src={(form as any).banner_url} alt="Banner" className="w-full h-full object-cover" />
                   </div>
                 )}

                 <div className="mb-8 pb-8 border-b border-zinc-150 dark:border-zinc-800">
                    <h2 className="text-2xl font-black text-zinc-900 dark:text-white mb-2">{form?.title}</h2>
                    <p className="text-zinc-500 leading-relaxed">{form?.description}</p>
                 </div>

                  {visibleFields.map((field) => (
                      <motion.div
                        key={field.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0, marginBottom: 40 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                      >
                       <div className="space-y-3">
                         <label className="flex items-center gap-2 text-base font-bold text-zinc-700 dark:text-zinc-300">
                           {field.label} {field.required && <span className="text-red-500">*</span>}
                         </label>
                         {renderFieldComponent(field)}
                       </div>
                      </motion.div>
                  ))}

                 {/* Classic layout submit block */}
                 <div className="pt-8 flex flex-col gap-4">
                   {(() => {
                     const total = computeTotal();
                      const hasPaymentSection = visibleFields.some(f => f.type === 'payment_section');
                     if (total > 0 && !hasPaymentSection) {
                       return (
                         <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl p-4 flex items-center justify-between border border-emerald-250 dark:border-emerald-800">
                           <span className="font-bold text-zinc-650 dark:text-zinc-400">Total Pemesanan</span>
                           <span className="font-black text-xl text-emerald-600">{formatPrice(total)}</span>
                         </div>
                       );
                     }
                     return null;
                   })()}
                   <button 
                     type="submit" 
                     disabled={submitting} 
                     className="w-full text-white py-5 rounded-3xl font-black text-lg flex items-center justify-center gap-3 active:scale-95 shadow-2xl transition-all hover:opacity-90"
                     style={{ 
                       backgroundColor: themeColor,
                       boxShadow: `0 10px 30px -5px ${themeColor}55` 
                     }}
                   >
                     {submitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Send className="w-6 h-6" /> Kirim Formulir</>}
                   </button>
                 </div>
               </div>
             )}
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

function ImageIcon({className}: {className?: string}) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
    );
}
