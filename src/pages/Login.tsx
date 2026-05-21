import React, { useState } from 'react';
import { useNavigate, Link, useLocation, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';
import { useAuthStore } from '../store/useAuthStore';
import { LogIn, ArrowLeft, UserPlus, ShieldCheck, AlertCircle } from 'lucide-react';
import SPSLogo from '../components/SPSLogo';

export default function Login() {
  const [nik, setNik] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  
  const navigate = useNavigate();
  const location = useLocation();
  
  // Membaca parameter URL jika user dialihkan dari keranjang
  const [searchParams] = useSearchParams();
  const cartRedirect = searchParams.get('redirect');

  const fromPath = (location.state as any)?.from?.pathname;
  const from = cartRedirect || (fromPath && fromPath !== 'undefined' ? fromPath + ((location.state as any)?.from?.search || '') : null);
  
  const { fetchProfile } = useAuthStore();

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError('');
    try {
      if (from) {
        sessionStorage.setItem('returnUrl', from);
      }
      const redirectTo = `${window.location.origin}/auth/callback`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Gagal login dengan Google.');
      setGoogleLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const rawInput = nik.trim();
      let email: string;
      
      // 1. Cek dari input mentah, apakah ini email?
      if (rawInput.includes('@')) {
        // Jika email, gunakan langsung tanpa menghapus tanda titik
        email = rawInput.toLowerCase();
      } else {
        // 2. Jika bukan email (berarti NIK), baru bersihkan spasi, strip, dan titik
        const inputNik = rawInput.replace(/[\s-.]/g, '');
        
        const { data: profileByNik, error: nikError } = await supabase
          .from('profiles')
          .select('email, id')
          .ilike('nik', inputNik)
          .single();
        
        if (nikError || !profileByNik?.email) {
          email = `${inputNik.toLowerCase()}@sps.local`;
        } else {
