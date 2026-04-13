const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jofwebrbdlovwkgklwab.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  // Create Admin
  const { data: adminData, error: adminError } = await supabase.auth.signUp({
    email: 'spscorner@gmail.com',
    password: 'Sukses2026',
    options: {
      data: {
        name: 'Admin SPS Corner',
        role: 'admin'
      }
    }
  });
  if (adminError) console.error('Admin Error:', adminError.message);
  else console.log('Admin created:', adminData.user?.id);

  // Create Sariroti Admin
  const { data: sarirotiData, error: sarirotiError } = await supabase.auth.signUp({
    email: 'Sales.Adm.bjm@sariroti.com',
    password: '12345678',
    options: {
      data: {
        name: 'Admin Sariroti',
        role: 'seller'
      }
    }
  });
  if (sarirotiError) console.error('Sariroti Error:', sarirotiError.message);
  else console.log('Sariroti created:', sarirotiData.user?.id);
}
run();
