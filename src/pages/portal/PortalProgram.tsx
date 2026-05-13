import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import SPSLogo from '../../components/SPSLogo';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import {
  Gift, Calendar, Users, QrCode, CheckCircle, XCircle,
  Plus, Search, Download, Copy, Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { exportExcel } from '../../lib/utils';

interface UnionProgram {
  id: string;
  name: string;
  description: string;
  program_type: 'kupon' | 'kurban' | 'gathering' | 'attendance' | 'lainnya';
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
}

interface ProgramRegistration {
  id: string;
  program_id: string;
  user_id: string;
  status: string;
  kupon_code: string;
  profiles?: { name: string; nik: string };
  registered_at: string;
}

export default function PortalProgram() {
  const { user } = useAuthStore();
  const [programs, setPrograms] = useState<UnionProgram[]>([]);
  const [myRegistrations, setMyRegistrations] = useState<ProgramRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<UnionProgram | null>(null);
  const [registeredMembers, setRegisteredMembers] = useState<ProgramRegistration[]>([]);

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [progRes, regRes] = await Promise.all([
        supabase
          .from('union_programs')
          .select('*')
          .eq('is_active', true)
          .lte('start_date', new Date().toISOString().split('T')[0])
          .gte('end_date', new Date().toISOString().split('T')[0])
          .order('created_at', { ascending: false }),
        // Trik !inner: Jika program master sudah dihapus/hilang, pendaftaran otomatis tidak ditampilkan (gak nyangkut)
        supabase
          .from('program_registrations')
          .select('*, union_programs!inner(name, program_type)')
          .eq('user_id', user?.id)
      ]);

      if (progRes.data) setPrograms(progRes.data);
      if (regRes.data) setMyRegistrations(regRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimProgram = async (programId: string) => {
    if (!user) return;
    setClaiming(programId);
    try {
      const kuponCode = `${programId.slice(0, 4).toUpperCase()}-${user.id.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

      const { error } = await supabase
        .from('program_registrations')
        .insert({
          program_id: programId,
          user_id: user.id,
          status: 'terdaftar',
          kupon_code: kuponCode
        });

      if (error) throw error;

      toast.success('Berhasil klaim program!');
      fetchData();
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

  const handleViewParticipants = async (programId: string) => {
    try {
      const { data } = await supabase
        .from('program_registrations')
        .select('*, profiles(name, nik)')
        .eq('program_id', programId);

      if (data) {
        setRegisteredMembers(data);
        const program = programs.find(p => p.id === programId);
        setSelectedProgram(program || null);
      }
    } catch (error) {
      console.error('Error fetching participants:', error);
    }
  };

  const handleExportExcel = () => {
    if (registeredMembers.length === 0) {
      toast.error('Belum ada peserta terdaftar');
      return;
    }

    const headers = ['No', 'NIK', 'Nama Anggota', 'Kode Kupon', 'Status', 'Tanggal Daftar'];
    const rows = registeredMembers.map((reg, idx) => [
      idx + 1,
      reg.profiles?.nik || '-',
      reg.profiles?.name || '-',
      reg.kupon_code || '-',
      reg.status,
      format(new Date(reg.registered_at), 'dd-MM-yyyy HH:mm')
    ]);

    exportExcel(headers, rows, `program_${selectedProgram?.name}_${format(new Date(), 'yyyyMMdd')}`, 'Peserta');
    toast.success('Excel diunduh!');
  };

  const getProgramIcon = (type: string) => {
    switch (type) {
      case 'kupon': return <Gift className="w-8 h-8" />;
      case 'kurban': return <Users className="w-8 h-8" />;
      case 'gathering': return <Users className="w-8 h-8" />;
      case 'attendance': return <Calendar className="w-8 h-8" />;
      default: return <Gift className="w-8 h-8" />;
    }
  };

  if (!user) return <Navigate to="/login" />;

  return (
    <div className="min-h-screen bg-[#e8ebf2] dark:bg-zinc-950">
      <div className="p-4 space-y-4">
        {/* My Registrations */}
        {myRegistrations.length > 0 && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-800">
            <h3 className="font-bold text-zinc-900 dark:text-white mb-3">Program Saya</h3>
            <div className="space-y-2">
              {myRegistrations.map((reg) => (
                <div key={reg.id} className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-green-800 dark:text-green-200">
                        {(reg as any).union_programs?.name || 'Program'}
                      </p>
                      <p className="text-xs text-green-600 dark:text-green-400 font-mono">{reg.kupon_code}</p>
                    </div>
                    <CheckCircle className="w-6 h-6 text-green-500" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Available Programs */}
        <h3 className="font-bold text-zinc-700 dark:text-zinc-300">Program Tersedia</h3>

        {loading ? (
          <div className="text-center py-8 text-zinc-400 dark:text-zinc-500">Memuat...</div>
        ) : programs.length === 0 ? (
          <div className="text-center py-8 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <Gift className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">Tidak ada program tersedia saat ini</p>
          </div>
        ) : (
          <div className="space-y-3">
            {programs.map((program) => {
              const isRegistered = myRegistrations.some(r => r.program_id === program.id);
              return (
                <div
                  key={program.id}
                  className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-800"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center text-amber-600 dark:text-amber-400">
                      {getProgramIcon(program.program_type)}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-zinc-900 dark:text-white">{program.name}</h4>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 capitalize">{program.program_type}</p>
                      {program.description && (
                        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 line-clamp-2">{program.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-zinc-400 dark:text-zinc-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {program.start_date && format(new Date(program.start_date), 'dd MMM')}
                          {' - '}
                          {program.end_date && format(new Date(program.end_date), 'dd MMM yyyy')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex gap-2">
                    {isRegistered ? (
                      <button disabled className="flex-1 py-2 bg-green-500 dark:bg-green-600 text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2 cursor-not-allowed opacity-80">
                        <CheckCircle className="w-4 h-4" />
                        Sudah Terdaftar
                      </button>
                    ) : (
                      <button
                        onClick={() => handleClaimProgram(program.id)}
                        disabled={claiming === program.id}
                        className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2"
                      >
                        {claiming === program.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Gift className="w-4 h-4" />
                            Klaim Program
                          </>
                        )}
                      </button>
                    )}
                    {(user?.role === 'superadmin' || user?.role === 'admin') && (
                      <button
                        onClick={() => handleViewParticipants(program.id)}
                        className="py-2 px-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-bold text-sm"
                      >
                        <Users className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Participants Modal (Admin Only) */}
      {selectedProgram && (user?.role === 'superadmin' || user?.role === 'admin') && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => { setSelectedProgram(null); setRegisteredMembers([]); }}
        >
          <div
            className="bg-white dark:bg-zinc-900 rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto border border-zinc-100 dark:border-zinc-800 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-4 flex items-center justify-between z-10">
              <div>
                <h2 className="font-black text-lg text-zinc-900 dark:text-white">{selectedProgram.name}</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{registeredMembers.length} peserta terdaftar</p>
              </div>
              <button
                onClick={() => { setSelectedProgram(null); setRegisteredMembers([]); }}
                className="p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-600 dark:hover:text-zinc-300 rounded-lg transition-colors"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4 space-y-2">
              {registeredMembers.map((reg) => (
                <div key={reg.id} className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl flex items-center justify-between border border-zinc-100 dark:border-zinc-800">
                  <div>
                    <p className="font-bold text-sm text-zinc-900 dark:text-white">{reg.profiles?.name || 'Unknown'}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{reg.profiles?.nik || '-'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400 mb-1">{reg.kupon_code}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${reg.status === 'terdaftar' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                        reg.status === 'hadir' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                          'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
                      }`}>
                      {reg.status}
                    </span>
                  </div>
                </div>
              ))}
              <button
                onClick={handleExportExcel}
                className="w-full mt-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export Data Excel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}