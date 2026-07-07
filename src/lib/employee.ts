import { supabase } from './supabase';

/**
 * Sync nama profil user dengan employee master data berdasarkan NIK.
 * Panggil setelah user login/register dengan NIK.
 */
export async function syncEmployeeName(nik: string, userId: string): Promise<string | null> {
  try {
    const { data: emp } = await supabase
      .from('employees')
      .select('name')
      .eq('nik', nik)
      .maybeSingle();

    if (emp && emp.name) {
      const { error } = await supabase
        .from('profiles')
        .update({ name: emp.name })
        .eq('id', userId);

      if (!error) return emp.name;
    }
  } catch {}
  return null;
}
