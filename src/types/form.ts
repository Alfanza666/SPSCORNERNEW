export type FieldType = 
  | 'text' 
  | 'textarea' 
  | 'number' 
  | 'select' 
  | 'radio' 
  | 'checkbox' 
  | 'image_choice'
  | 'rating'
  | 'scale'
  | 'file_upload'
  | 'image'
  | 'addon_group'
  | 'repeater'
  | 'date'
  | 'payment_section';

export type FormOutcomeKind = 'declined' | 'confirmed' | 'pending_payment' | 'submitted';
export type ManualPaymentMethod = 'bank_transfer' | 'manual_qris';

export interface FormOutcome {
  id: string;
  kind: FormOutcomeKind;
  title: string;
  message?: string;
  button_label?: string;
  issue_entitlements?: boolean;
}

export interface BankAccountConfig {
  id: string;
  bank_name: string;
  account_number: string;
  account_name: string;
}

export interface FormThemeConfig {
  preset?: 'sps_event_premium' | 'minimal' | 'editorial' | 'legacy';
  primary_color?: string;
  accent_color?: string;
  surface_color?: string;
  text_color?: string;
  muted_color?: string;
  heading_font?: string;
  body_font?: string;
  radius?: 'soft' | 'rounded' | 'pill';
  density?: 'comfortable' | 'compact';
  choice_style?: 'cards' | 'buttons' | 'classic';
  button_style?: 'solid' | 'gradient' | 'soft';
  cover_overlay?: 'none' | 'soft' | 'dramatic';
  show_progress?: boolean;
}

export interface ProgramAutomationConfig {
  attendance_field_id?: string;
  attending_value?: string;
  declined_value?: string;
  family_count_field_id?: string;
  family_repeater_field_id?: string;
  issue_employee_attendance?: boolean;
  issue_employee_meal?: boolean;
  issue_family_attendance?: boolean;
  issue_family_meal?: boolean;
  hold_entitlements_until_paid?: boolean;
}

export interface Condition {
  fieldId: string;
  operator: 'eq' | 'neq' | 'in';
  value: string | string[];
}

export interface FormOption {
  value: string;
  label: string;
  image?: string; // URL untuk image_choice
  price?: number; // Harga untuk auto-kalkulasi total
  outcome_id?: string; // Akhiri flow pada outcome tertentu
  helper_text?: string;
}

export interface AddonItem {
  id: string;
  name: string;
  sizes: string[];
  price: number; // Harga per unit
}

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  description?: string;
  required: boolean;
  placeholder?: string;
  system_key?: 'attendance' | 'shirt_size' | 'camping' | 'family_count' | 'family_members' | 'payment' | string;
  
  // Untuk select, radio, image_choice
  options?: FormOption[];
  
  // Untuk rating
  max?: number; // Default 5
  icon?: 'star' | 'heart';
  
  // Untuk scale
  min?: number;
  step?: number;
  unit_price?: number; // number × unit_price
  currency?: 'IDR';
  max_scale?: number; // Default 10
  
  // Untuk file_upload
  allowed_types?: string[];
  max_size_mb?: number;
  
  // Untuk addon_group
  allow_multiple?: boolean;
  items?: AddonItem[];

  // Untuk repeater (mis. anggota keluarga)
  subfields?: FormField[];
  min_items?: number;
  max_items?: number;
  item_label?: string;
  item_unit_price?: number;

  // Untuk payment_section
  qris_image_url?: string;
  account_name?: string;
  payment_description?: string;
  verify_with_ai?: boolean;
  payment_methods?: ManualPaymentMethod[];
  bank_accounts?: BankAccountConfig[];
  payment_required_when?: 'always' | 'total_positive';
  proof_required?: boolean;

  // Conditional logic
  condition?: Condition;
}

export interface FormConfig {
  id?: string;
  title: string;
  description?: string;
  theme_color?: string;
  banner_url?: string;
  fields: FormField[];
  
  // Visual styling & layout configuration (JotForm style)
  layout_type?: 'classic' | 'card';
  font_family?: string;
  input_style?: 'rounded' | 'sharp' | 'underline';
  bg_image_url?: string;
  card_glassmorphism?: boolean;
  experience_version?: 1 | 2;
  theme?: FormThemeConfig;
  outcomes?: FormOutcome[];
  default_outcome_id?: string;
  review_enabled?: boolean;
  autosave_draft?: boolean;
  program_automation?: ProgramAutomationConfig;
}
