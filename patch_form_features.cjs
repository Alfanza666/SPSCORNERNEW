const fs = require('fs');

// 1. Update src/types/form.ts
let types = fs.readFileSync('src/types/form.ts', 'utf8');
types = types.replace(
  /export interface FormConfig \{\s*title: string;\s*description\?: string;\s*fields: FormField\[\];\s*\}/,
  `export interface FormConfig {
  title: string;
  description?: string;
  theme_color?: string;
  banner_url?: string;
  fields: FormField[];
}`
);
fs.writeFileSync('src/types/form.ts', types);

// 2. Update AdminFormBuilder.tsx
let admin = fs.readFileSync('src/pages/dashboard/admin/AdminFormBuilder.tsx', 'utf8');

// Update editingForm state initialization
admin = admin.replace(
  /setEditingForm\(\{ title: 'Formulir Tanpa Judul', description: '', fields: \[\] \}\);/g,
  `setEditingForm({ title: 'Formulir Tanpa Judul', description: '', theme_color: '#673AB7', banner_url: '', fields: [] });`
);

admin = admin.replace(
  /const \[editingForm, setEditingForm\] = useState<FormConfig>\(\{[\s\S]*?fields: \[\]\s*\}\);/,
  `const [editingForm, setEditingForm] = useState<FormConfig>({
    title: 'Formulir Tanpa Judul',
    description: '',
    theme_color: '#673AB7',
    banner_url: '',
    fields: []
  });`
);

// Update onClick when opening a form
admin = admin.replace(
  /setEditingForm\(form\);/g,
  `let desc = form.description;
  let theme = '#673AB7';
  let banner = '';
  try {
    const parsed = JSON.parse(form.description);
    if (parsed.text !== undefined) {
      desc = parsed.text;
      theme = parsed.theme || '#673AB7';
      banner = parsed.banner || '';
    }
  } catch(e) {}
  setEditingForm({ ...form, description: desc, theme_color: theme, banner_url: banner });`
);

// Update handleSave to stringify description
admin = admin.replace(
  /const payload = \{\s*title: editingForm\.title,\s*description: editingForm\.description,\s*fields: cleanFields,\s*is_active: true\s*\};/,
  `const payload = {
        title: editingForm.title,
        description: JSON.stringify({
          text: editingForm.description || '',
          theme: editingForm.theme_color || '#673AB7',
          banner: editingForm.banner_url || ''
        }),
        fields: cleanFields,
        is_active: true
      };`
);

// Update UI to show theme_color and banner_url inputs
admin = admin.replace(
  /\{activeFieldId === 'header' && \(\s*<div className="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800">/,
  `{activeFieldId === 'header' && (
                            <div className="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800 flex flex-col gap-4">
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-bold tracking-widest text-zinc-400 uppercase">Tema Warna (Hex)</label>
                                    <div className="flex items-center gap-3">
                                      <input
                                          type="color"
                                          value={editingForm.theme_color || '#673AB7'}
                                          onChange={(e) => setEditingForm(prev => ({ ...prev, theme_color: e.target.value }))}
                                          className="w-10 h-10 rounded cursor-pointer border-0 p-0"
                                      />
                                      <input
                                          type="text"
                                          value={editingForm.theme_color || '#673AB7'}
                                          onChange={(e) => setEditingForm(prev => ({ ...prev, theme_color: e.target.value }))}
                                          className="flex-1 p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:border-[#673AB7] outline-none uppercase"
                                          placeholder="#673AB7"
                                      />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-bold tracking-widest text-zinc-400 uppercase">Banner URL (Gambar Opsional)</label>
                                    <input
                                        type="text"
                                        value={editingForm.banner_url || ''}
                                        onChange={(e) => setEditingForm(prev => ({ ...prev, banner_url: e.target.value }))}
                                        className="w-full p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:border-[#673AB7] outline-none"
                                        placeholder="https://contoh.com/banner.jpg"
                                    />
                                </div>`
);

// Replace dynamic color in header
admin = admin.replace(
  /className="h-3 w-full bg-\[#673AB7\]"/g,
  `className="h-3 w-full" style={{ backgroundColor: editingForm.theme_color || '#673AB7' }}`
);
admin = admin.replace(
  /bg-\[#673AB7\]"\s*\/\}/g,
  `" style={{ backgroundColor: editingForm.theme_color || '#673AB7' }} />}`
);

fs.writeFileSync('src/pages/dashboard/admin/AdminFormBuilder.tsx', admin);

// 3. Update PortalFormView.tsx
let portal = fs.readFileSync('src/pages/portal/PortalFormView.tsx', 'utf8');

portal = portal.replace(
  /const fetchForm = async \(\) => \{[\s\S]*?if \(error\) throw error;\s*setForm\(data\);/,
  `const fetchForm = async () => {
    setLoading(true);
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
      try {
        const parsed = JSON.parse(data.description);
        if (parsed.text !== undefined) {
          desc = parsed.text;
          theme = parsed.theme || '#673AB7';
          banner = parsed.banner || '';
        }
      } catch(e) {}
      
      data.description = desc;
      (data as any).theme_color = theme;
      (data as any).banner_url = banner;

      setForm(data);`
);

portal = portal.replace(
  /<div className="h-3 w-full bg-\[#673AB7\]" \/>/,
  `{(form as any)?.banner_url ? (
            <img src={(form as any).banner_url} alt="Banner" className="w-full h-32 md:h-48 object-cover" />
          ) : (
            <div className="h-3 w-full" style={{ backgroundColor: (form as any)?.theme_color || '#673AB7' }} />
          )}`
);

portal = portal.replace(
  /className="bg-\[#673AB7\] hover:bg-\[#5E35B1\]/g,
  `style={{ backgroundColor: (form as any)?.theme_color || '#673AB7' }} className="`
);

fs.writeFileSync('src/pages/portal/PortalFormView.tsx', portal);
console.log('Done patching.');
