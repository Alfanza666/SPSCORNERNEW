export type FieldType = 
  | 'text' 
  | 'textarea' 
  | 'number' 
  | 'select' 
  | 'radio' 
  | 'checkbox' 
  | 'image_choice' // Polling Visual
  | 'rating'       // Bintang
  | 'scale'        // 1-10
  | 'file_upload'  // Unggah File
  | 'image'        // Unggah Gambar / URL
  | 'addon_group'
  | 'date';        // Tanggal

export interface Condition {
  fieldId: string;
  operator: 'eq' | 'neq' | 'in';
  value: string | string[];
}

export interface FormOption {
  value: string;
  label: string;
  image?: string; // URL untuk image_choice
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