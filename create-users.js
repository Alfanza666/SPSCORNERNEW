const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...values] = line.split('=');
  if (key && values.length > 0) {
    env[key.trim()] = values.join('=').trim();
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

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
