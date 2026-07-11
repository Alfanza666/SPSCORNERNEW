import type { ComponentType } from 'react';
import type { FieldType, FormConfig, FormField } from '../../types/form';

export type BuilderDevice = 'desktop' | 'tablet' | 'mobile';

export type BuilderSaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

export type InspectorTab = 'field' | 'logic' | 'design' | 'settings' | 'ai';

export interface BuilderIconProps {
  className?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
}

export interface FieldPaletteItem {
  type: FieldType;
  label: string;
  description: string;
  icon: ComponentType<BuilderIconProps>;
  accent: string;
  surface: string;
}

export interface FieldPaletteGroup {
  id: string;
  label: string;
  items: FieldPaletteItem[];
}

export type FormAppearanceUpdates = Partial<
  Pick<
    FormConfig,
    | 'title'
    | 'description'
    | 'theme_color'
    | 'banner_url'
    | 'layout_type'
    | 'font_family'
    | 'input_style'
    | 'bg_image_url'
    | 'card_glassmorphism'
  >
>;

export type FieldUpdateHandler = (fieldId: string, updates: Partial<FormField>) => void;

export const SPS_FIELD_DRAG_MIME = 'application/x-sps-form-field';
export const SPS_REORDER_DRAG_MIME = 'application/x-sps-form-reorder';
export const BUILDER_HEADER_ID = 'header';
