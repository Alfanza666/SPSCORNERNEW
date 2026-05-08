import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { Gift, Calendar, Users, CheckCircle, Loader2, QrCode, XCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { Navigate } from 'react-router-dom';

export default function PortalProgram() {
  const { user } = useAuthStore();
  const [programs, setPrograms] = useState<any[]>([]);
  const [myRegistrations, setMyRegistrations] = useState<any[]>([]);
  const [whitelistMap, setWhitelistMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);

  // For QR Code Modal
  const [selectedQR, setSelectedQR] = useState<{ id: string, name: string, code: string } | null>(null);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [progRes, regRes, whitelistRes] = await Promise.all([
        supabase
          .from('union_programs')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false }),
        supabase
          .from('program_registrations')
          .select('*, union_programs(name, program_type)')
          .eq('user_id', user?.id),
        supabase
          .from('program_whitelist')
          .select('program_id')
          .eq('nik', user?.nik || '')
      ]);

      if (progRes.data) setPrograms(progRes.data);
      if (regRes.data) setMyRegistrations(regRes.data);
      if (whitelistRes.data) {
        const wMap: Record<string, boolean> = {};
        whitelistRes.data.forEach((w) => { wMap[w.program_id] = true; });
        setWhitelistMap(wMap);
      }
    } catch (error) {
      console.error('Error fetching programs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimProgram = async (programId: string) => {
    if (!user) return;
    try {
      setClaiming(programId);
      const kuponCode = `${user.nik?.slice(-4) || '0000'}-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

      const { data, error } = await supabase
        .from('program_registrations')
        .insert({
          program_id: programId,
          user_id: user.id,
          status: 'terdaftar',
          kupon_code: kuponCode
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Berhasil klaim program!');
      fetchData();

      const programName = programs.find(p => p.id === programId)?.name || 'Program';
      setSelectedQR({ id: data.id, name: programName, code: data.id });
    } catch (error: any) {
      console.error('Error claiming program:', error);
      if (error.message?.includes('duplicate')) {
        toast.error('Anda sudah terdaftar di program ini');
      } else {
        toast.error('Gagal klaim program');
      }
    } finally {
      setClaiming(null);
    }
  };

  const getProgramIcon = (type: string) => {
    switch (type) {
      case 'kupon': return <Gift className="w-6 h-6" />;
      case 'kurban': return <Users className="w-6 h-6" />;
      case 'gathering': return <Users className="w-6 h-6" />;
      case 'attendance': return <Calendar className="w-6 h-6" />;
      default: return <Gift className="w-6 h-6" />;
    }
  };

  if (!user) return <Navigate to="/login" />;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 pb-20">
      {/* Header - ONLY PAGE NAME */}
      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-4 sticky top-0 z-30">
        <h1 className="text-xl font-black text-center text-zinc-900 dark:text-white">Klaim Program</h1>
      </div>

      <div className="p-4 space-y-6 max-w-lg mx-auto">
        {/* My Registrations / Active Claims */}
        {myRegistrations.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-bold text-zinc-900 dark:text-white text-sm px-1">Klaim Aktif Saya</h3>
            {myRegistrations.map((reg) => {
              const programName = (reg as any).union_programs?.name || 'Program';
              return (
                <div key={reg.id} className="bg-white dark:bg-zinc-900 border border-green-200 dark:border-green-900/50 p-4 rounded-2xl shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-bold text-green-700 dark:text-green-400">
                        {programName}
                      </p>
                      <p className="text-xs text-zinc-500 font-mono mt-0.5">Kode: {reg.kupon_code}</p>
                    </div>
                    <CheckCircle className="w-6 h-6 text-green-500" />
                  </div>
                  <button
                    onClick={() => setSelectedQR({ id: reg.id, name: programName, code: reg.id })}
                    className="w-full py-2.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 font-bold rounded-xl flex items-center justify-center gap-2 text-sm hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
                  >
                    <QrCode className="w-4 h-4" />
                    Tampilkan QR Code
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Available Programs */}
        <div className="space-y-3">
          <h3 className="font-bold text-zinc-900 dark:text-white text-sm px-1">Program Tersedia</h3>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : programs.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800">
              <Gift className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
              <p className="text-zinc-500 text-sm font-medium">Tidak ada program saat ini</p>
            </div>
          ) : (
            <div className="space-y-4">
              {programs.map((program) => {
                const isRegistered = myRegistrations.some(r => r.program_id === program.id);
                // Can claim if the user's NIK is in the whitelist, OR if no whitelist policy is strictly enforced (but instruction said "Admin menentukan Whitelist", so we require whitelist Map to have it)
                const canClaim = whitelistMap[program.id];

                return (
                  <div
                    key={program.id}
                    className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800 shadow-sm"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 shrink-0 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400">
                        {getProgramIcon(program.program_type)}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-zinc-900 dark:text-white leading-tight">{program.name}</h4>
                        {program.description && (
                          <p className="text-xs text-zinc-500 mt-1 line-clamp-2 leading-relaxed">{program.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2 text-xs font-medium text-zinc-400">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>
                            {program.start_date && format(new Date(program.start_date), 'dd MMM')}
                            {' - '}
                            {program.end_date && format(new Date(program.end_date), 'dd MMM yyyy')}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                      {isRegistered ? (
                        <div className="py-2.5 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                          <CheckCircle className="w-4 h-4" />
                          Terklaim
                        </div>
                      ) : canClaim ? (
                        <button
                          onClick={() => handleClaimProgram(program.id)}
                          disabled={claiming === program.id}
                          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-600/20"
                        >
                          {claiming === program.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Gift className="w-4 h-4" />
                              Klaim Sekarang
                            </>
                          )}
                        </button>
                      ) : (
                        <div className="py-2.5 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-400 dark:text-zinc-500 rounded-xl font-medium text-sm flex items-center justify-center">
                          Tidak Memenuhi Syarat Klaim
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* QR Code Modal */}
      {selectedQR && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl relative">
            <button
              onClick={() => setSelectedQR(null)}
              className="absolute top-4 right-4 p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              <XCircle className="w-5 h-5" />
            </button>

            <div className="p-6 pt-10 text-center">
              <h3 className="font-black text-lg text-zinc-900 dark:text-white mb-1">{selectedQR.name}</h3>
              <p className="text-xs text-zinc-500 mb-6">Tunjukkan QR Code ini kepada Admin</p>

              <div className="bg-white p-4 rounded-2xl inline-block shadow-sm border border-zinc-100 mx-auto">
                <QRCodeSVG
                  value={selectedQR.code}
                  size={200}
                  level="H"
                  includeMargin={false}
                />
              </div>

              <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                  Pastikan kecerahan layar Anda cukup untuk mempermudah proses scan.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
