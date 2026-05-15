import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createMockBuyer() {
  const mockData = {
    email: 'buyer.mock@sps.local',
    password: 'password123',
    email_confirm: true,
    user_metadata: {
      name: 'Buyer Mock User',
      role: 'buyer',
      nik: 'MOCK' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0')
    }
  };

  console.log('Creating mock buyer user...');

  const { data, error } = await supabase.auth.admin.createUser(mockData);

  if (error) {
    console.error('Error creating user:', error.message);
    return;
  }

  const userId = data.user.id;
  console.log('User created in auth.users with ID:', userId);

  // Profile is usually created via trigger, but let's make sure it's correct
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ 
      role: 'buyer',
      name: mockData.user_metadata.name,
      nik: mockData.user_metadata.nik,
      phone: '08123456789'
    })
    .eq('id', userId);

  if (profileError) {
    console.error('Error updating profile:', profileError.message);
  } else {
    console.log('Profile updated successfully.');
  }

  console.log('\n--- MOCK ACCOUNT DETAILS ---');
  console.log('Email:   ', mockData.email);
  console.log('Password:', mockData.password);
  console.log('NIK:     ', mockData.user_metadata.nik);
  console.log('----------------------------\n');
}

createMockBuyer();
