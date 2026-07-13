import { FormConfig } from '../types/form';

export interface EventRsvpTemplateOptions {
  title?: string;
  description?: string;
  xxlSurcharge?: number;
  xxxlSurcharge?: number;
  familyUnitPrice?: number;
  maxFamilyMembers?: number;
  /** @deprecated Family identity is intentionally not collected. */
  requireFamilyNames?: boolean;
}

export function createEventRsvpTemplate(options: EventRsvpTemplateOptions = {}): FormConfig {
  const {
    title = 'Konfirmasi Kehadiran Acara',
    description = 'Konfirmasikan kehadiran dan kebutuhan acara Anda.',
    xxlSurcharge = 0,
    xxxlSurcharge = 0,
    familyUnitPrice = 30_000,
    maxFamilyMembers = 5,
  } = options;

  return {
    title,
    description,
    experience_version: 2,
    layout_type: 'card',
    theme_color: '#4F46E5',
    font_family: 'Inter',
    input_style: 'rounded',
    review_enabled: true,
    autosave_draft: true,
    welcome_screen: {
      enabled: true,
      eyebrow: 'Konfirmasi digital',
      badge: 'Form resmi SPS',
      title,
      description,
      start_label: 'Mulai konfirmasi',
      highlights: [],
      adaptive_note_enabled: false,
      adaptive_note_title: 'Formulir mengikuti jawaban Anda.',
      adaptive_note_description: 'Pertanyaan yang tidak relevan otomatis dilewati. Biaya hanya dihitung dari pilihan aktif.',
    },
    theme: {
      preset: 'sps_event_premium',
      primary_color: '#4F46E5',
      accent_color: '#06B6D4',
      surface_color: '#FFFFFF',
      text_color: '#18181B',
      muted_color: '#71717A',
      heading_font: 'Inter',
      body_font: 'Inter',
      radius: 'rounded',
      density: 'comfortable',
      choice_style: 'cards',
      button_style: 'gradient',
      cover_overlay: 'dramatic',
      show_progress: true,
    },
    fields: [
      {
        id: 'attendance',
        system_key: 'attendance',
        type: 'radio',
        label: 'Apakah Anda akan hadir?',
        description: 'Pilih jawaban yang paling sesuai.',
        required: true,
        options: [
          { value: 'yes', label: 'Ya, saya akan hadir' },
          { value: 'no', label: 'Tidak dapat hadir', outcome_id: 'declined' },
        ],
      },
      {
        id: 'shirt_size',
        system_key: 'shirt_size',
        type: 'radio',
        label: 'Pilih ukuran baju',
        description: 'Harga tambahan dapat diatur pada setiap opsi ukuran.',
        required: true,
        condition: { fieldId: 'attendance', operator: 'eq', value: 'yes' },
        options: [
          { value: 's', label: 'S' },
          { value: 'm', label: 'M' },
          { value: 'l', label: 'L' },
          { value: 'xl', label: 'XL' },
          { value: 'xxl', label: 'XXL', price: Math.max(0, xxlSurcharge) },
          { value: 'xxxl', label: 'XXXL', price: Math.max(0, xxxlSurcharge) },
        ],
      },
      {
        id: 'camping',
        system_key: 'camping',
        type: 'radio',
        label: 'Apakah Anda akan camping?',
        required: true,
        condition: { fieldId: 'attendance', operator: 'eq', value: 'yes' },
        options: [
          { value: 'yes', label: 'Ya, ikut camping' },
          { value: 'no', label: 'Tidak camping' },
        ],
      },
      {
        id: 'bring_family',
        system_key: 'bringing_family',
        type: 'radio',
        label: 'Apakah Anda membawa keluarga?',
        required: true,
        condition: { fieldId: 'attendance', operator: 'eq', value: 'yes' },
        options: [
          { value: 'yes', label: 'Ya, membawa keluarga' },
          { value: 'no', label: 'Tidak membawa keluarga' },
        ],
      },
      {
        id: 'family_count',
        system_key: 'family_count',
        type: 'number',
        label: 'Berapa anggota keluarga yang dibawa?',
        description: `Biaya paket keluarga ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Math.max(0, familyUnitPrice))} per orang, termasuk tiket masuk dan makan. Kami tidak meminta nama atau identitas keluarga.`,
        required: true,
        condition: { fieldId: 'bring_family', operator: 'eq', value: 'yes' },
        placeholder: 'Contoh: 2',
        min: 1,
        max: Math.max(1, maxFamilyMembers),
        step: 1,
        unit_price: Math.max(0, familyUnitPrice),
      },
      {
        id: 'payment',
        system_key: 'payment',
        type: 'payment_section',
        label: 'Pembayaran biaya tambahan',
        description: 'Transfer atau scan QRIS, lalu unggah bukti pembayaran.',
        required: false,
        condition: { fieldId: 'attendance', operator: 'eq', value: 'yes' },
        payment_methods: ['bank_transfer', 'manual_qris'],
        payment_required_when: 'total_positive',
        proof_required: true,
        verify_with_ai: false,
      },
    ],
    outcomes: [
      {
        id: 'declined',
        kind: 'declined',
        title: 'Konfirmasi tidak hadir',
        message: 'Periksa kembali pilihan Anda sebelum mengirim konfirmasi.',
        button_label: 'Konfirmasi tidak hadir',
        issue_entitlements: false,
      },
      {
        id: 'confirmed',
        kind: 'confirmed',
        title: 'Kehadiran berhasil dikonfirmasi',
        message: 'Tiket kehadiran dan kupon makan Anda sedang disiapkan.',
        issue_entitlements: true,
      },
      {
        id: 'pending_payment',
        kind: 'pending_payment',
        title: 'Bukti pembayaran sedang diperiksa',
        message: 'Tiket dan kupon karyawan tetap aktif. QR keluarga diterbitkan setelah pembayaran disetujui admin.',
        issue_entitlements: false,
      },
    ],
    default_outcome_id: 'confirmed',
    program_automation: {
      attendance_field_id: 'attendance',
      attending_value: 'yes',
      declined_value: 'no',
      family_count_field_id: 'family_count',
      issue_employee_attendance: true,
      issue_employee_meal: true,
      issue_family_attendance: true,
      issue_family_meal: true,
      hold_entitlements_until_paid: false,
      hold_family_entitlements_until_paid: true,
    },
  };
}
