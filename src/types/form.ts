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
  | 'date'
  | 'payment_section';

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
  
  // Untuk select, radio, image_choice
  options?: FormOption[];
  
  // Untuk rating
  max?: number; // Default 5
  icon?: 'star' | 'heart';
  
  // Untuk scale
  min?: number;
  max_scale?: number; // Default 10
  
  // Untuk file_upload
  allowed_types?: string[];
  max_size_mb?: number;
  
  // Untuk addon_group
  allow_multiple?: boolean;
  items?: AddonItem[];

  // Untuk payment_section
  qris_image_url?: string;
  account_name?: string;
  payment_description?: string;
  verify_with_ai?: boolean;

  // Conditional logic
  condition?: Condition;
}

export interface FormConfig {
  title: string;
  description?: string;
  theme_color?: string;
  banner_url?: string;
  fields: FormField[];
}