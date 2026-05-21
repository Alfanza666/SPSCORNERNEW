const fs = require('fs');

// Patch AdminStockOpname.tsx
let stockOpname = fs.readFileSync('src/pages/dashboard/admin/AdminStockOpname.tsx', 'utf8');
stockOpname = stockOpname.replace(
    /stock: newStock, updated_at: new Date\(\)\.toISOString\(\)/g,
    'stock: newStock'
);
fs.writeFileSync('src/pages/dashboard/admin/AdminStockOpname.tsx', stockOpname, 'utf8');
console.log('Patched AdminStockOpname.tsx');


// Patch AdminStandbySchedule.tsx
let schedule = fs.readFileSync('src/pages/dashboard/admin/AdminStandbySchedule.tsx', 'utf8');

// Replace form state
schedule = schedule.replace(
    /const \[form, setForm\] = useState\(\{ day: 'Senin', time_start: '07:00', time_end: '16:00', officer_name: '', notes: '' \}\);/g,
    `const [form, setForm] = useState<{ days: string[], time_start: string, time_end: string, officer_name: string, notes: string }>({ days: ['Senin'], time_start: '07:00', time_end: '16:00', officer_name: '', notes: '' });`
);

// Replace handleSave
schedule = schedule.replace(
    /const \{ error \} = await supabase\s*\.from\('standby_schedules'\)\s*\.insert\(\{ \.\.\.form, created_at: new Date\(\)\.toISOString\(\) \}\);/g,
    `const payloads = form.days.map(d => ({
          day: d,
          time_start: form.time_start,
          time_end: form.time_end,
          officer_name: form.officer_name,
          notes: form.notes,
          created_at: new Date().toISOString()
        }));
        const { error } = await supabase.from('standby_schedules').insert(payloads);`
);

// Replace form reset in handleSave
schedule = schedule.replace(
    /setForm\(\{ day: 'Senin', time_start: '07:00', time_end: '16:00', officer_name: '', notes: '' \}\);/g,
    `setForm({ days: ['Senin'], time_start: '07:00', time_end: '16:00', officer_name: '', notes: '' });`
);

// Replace select dropdown with checkboxes
const selectHtml = `<select value={form.day} onChange={e => setForm(p => ({ ...p, day: e.target.value }))}
                className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500">
                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>`;
const checkboxHtml = `<div className="flex flex-wrap gap-2">
                {DAYS.map(d => (
                  <label key={d} className={\`px-3 py-1.5 rounded-xl border text-sm cursor-pointer transition-colors \${form.days.includes(d) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'}\`}>
                    <input type="checkbox" className="hidden" checked={form.days.includes(d)} onChange={(e) => {
                      if (e.target.checked) setForm(p => ({ ...p, days: [...p.days, d] }));
                      else setForm(p => ({ ...p, days: p.days.filter(day => day !== d) }));
                    }} />
                    {d}
                  </label>
                ))}
              </div>`;
schedule = schedule.replace(selectHtml, checkboxHtml);

fs.writeFileSync('src/pages/dashboard/admin/AdminStandbySchedule.tsx', schedule, 'utf8');
console.log('Patched AdminStandbySchedule.tsx');
