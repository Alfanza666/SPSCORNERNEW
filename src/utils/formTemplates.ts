import { FormConfig } from '../types/form';

export interface EventRsvpTemplateOptions {
  title?: string;
  description?: string;
  xxlSurcharge?: number;
  xxxlSurcharge?: number;
  familyUnitPrice?: number;
  maxFamilyMembers?: number;
  requireFamilyNames?: boolean;
}

export function createEventRsvpTemplate(options: EventRsvpTemplateOptions = {}): FormConfig {
  const {
    title = 'Konfirmasi Kehadiran Acara',
    description = 'Konfirmasikan kehadiran dan kebutuhan acara Anda.',
    xxlSurcharge = 0,
    xxxlSurcharge = 0,
    familyUnitPrice = 0,
    maxFamilyMembers = 5,
    requireFamilyNames = true,
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
        type: 'radio',
        label: 'Apakah Anda membawa keluarga?',
        required: true,
        condition: { fieldId: 'camping', operator: 'eq', value: 'yes' },
        options: [
          { value: 'yes', label: 'Ya, membawa keluarga' },
          { value: 'no', label: 'Tidak membawa keluarga' },
        ],
      },
      {
        id: 'family_members',
        system_key: 'family_members',
        type: 'repeater',
        label: 'Data anggota keluarga',
        description: 'Tambahkan satu baris untuk setiap anggota keluarga.',
        required: true,
        condition: { fieldId: 'bring_family', operator: 'eq', value: 'yes' },
        item_label: 'Anggota keluarga',
        min_items: 1,
        max_items: Math.max(1, maxFamilyMembers),
        item_unit_price: Math.max(0, familyUnitPrice),
        subfields: [
          {
            id: 'name',
            type: 'text',
            label: 'Nama anggota keluarga',
            required: requireFamilyNames,
            placeholder: 'Masukkan nama lengkap',
          },
        ],
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
        message: 'Seluruh tiket dan kupon akan diterbitkan setelah pembayaran disetujui admin.',
        issue_entitlements: false,
      },
    ],
    default_outcome_id: 'confirmed',
    program_automation: {
      attendance_field_id: 'attendance',
      attending_value: 'yes',
      declined_value: 'no',
      family_repeater_field_id: 'family_members',
      issue_employee_attendance: true,
      issue_employee_meal: true,
      issue_family_attendance: true,
      issue_family_meal: true,
      hold_entitlements_until_paid: true,
    },
  };
}

