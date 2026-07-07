import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { CheckCircle2, Clock, Lock, Loader2, Users, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';

interface Candidate {
  id: string;
  name: string;
  photo_url?: string;
  sort_order: number;
}

interface GatheringVotingProps {
  announcementId: string;
  candidates: Candidate[];
  targetNiks: string[];
  targetDepartments: string[];
  userDepartment: string;
  votingDeadline?: string;
  votingEnabled: boolean;
}

interface VoteCount {
  candidate_id: string;
  count: number;
}

export default function GatheringVoting({
  announcementId,
  candidates,
  targetNiks,
  targetDepartments,
  userDepartment,
  votingDeadline,
  votingEnabled
}: GatheringVotingProps) {
  const { user } = useAuthStore();
  const [myVote, setMyVote] = useState<string | null>(null);
  const [voteCounts, setVoteCounts] = useState<VoteCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);

  const isTargeted = user?.nik && (
    targetNiks?.includes(user.nik) ||
    (targetDepartments?.length > 0 && userDepartment && targetDepartments.includes(userDepartment))
  );
  const isDeadlinePassed = votingDeadline ? new Date(votingDeadline) < new Date() : false;
  const canVote = votingEnabled && isTargeted && !isDeadlinePassed;

  const fetchVoteData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch my vote
      const { data: myVoteData } = await supabase
        .from('gathering_votes')
        .select('candidate_id')
        .eq('announcement_id', announcementId)
        .eq('voter_id', user.id)
        .maybeSingle();

      if (myVoteData) {
        setMyVote(myVoteData.candidate_id);
        setHasVoted(true);
      }

      // Fetch vote counts
      const { data: allVotes } = await supabase
        .from('gathering_votes')
        .select('candidate_id')
        .eq('announcement_id', announcementId);

      if (allVotes) {
        const counts: Record<string, number> = {};
        allVotes.forEach(v => {
          counts[v.candidate_id] = (counts[v.candidate_id] || 0) + 1;
        });
        setVoteCounts(
          candidates.map(c => ({
            candidate_id: c.id,
            count: counts[c.id] || 0
          }))
        );
      }
    } catch (error) {
      console.error('Error fetching vote data:', error);
    } finally {
      setLoading(false);
    }
  }, [user, announcementId, candidates]);

  useEffect(() => {
    fetchVoteData();
  }, [fetchVoteData]);

  const handleVote = async (candidateId: string) => {
    if (!user || !canVote || voting) return;

    setVoting(true);
    try {
      if (hasVoted) {
        // Update existing vote
        const { error } = await supabase
          .from('gathering_votes')
          .update({
            candidate_id: candidateId,
            updated_at: new Date().toISOString()
          })
          .eq('announcement_id', announcementId)
          .eq('voter_id', user.id);
        if (error) throw error;
        toast.success('Pilihan Anda berhasil diubah!');
      } else {
        // Insert new vote
        const { error } = await supabase
          .from('gathering_votes')
          .insert({
            announcement_id: announcementId,
            candidate_id: candidateId,
            voter_id: user.id,
            voter_nik: user.nik || ''
          });
        if (error) throw error;
        toast.success('Vote berhasil tercatat!');
      }

      setMyVote(candidateId);
      setHasVoted(true);
      await fetchVoteData();
    } catch (error: any) {
      console.error('Vote error:', error);
      toast.error('Gagal melakukan vote: ' + (error.message || 'Unknown error'));
    } finally {
      setVoting(false);
    }
  };

  const totalVotes = voteCounts.reduce((sum, vc) => sum + vc.count, 0);

  if (!votingEnabled) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  // Non-targeted user
  if (!isTargeted) {
    return (
      <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl p-6 text-center border border-zinc-200 dark:border-zinc-700">
        <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-7 h-7 text-zinc-400" />
        </div>
        <p className="font-bold text-zinc-600 dark:text-zinc-300 text-sm mb-1">Akses Terbatas</p>
        <p className="text-xs text-zinc-400">
          Pemilihan ini hanya dapat diikuti oleh anggota yang telah ditentukan oleh pengurus serikat.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-zinc-900 dark:text-white text-sm">Pemilihan Ketua Panitia</h3>
            <p className="text-[10px] text-zinc-400 font-medium">
              {totalVotes} suara masuk
              {hasVoted && ' • Anda sudah memilih'}
            </p>
          </div>
        </div>
        {votingDeadline && (
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold ${
            isDeadlinePassed
              ? 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400'
              : 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
          }`}>
            <Clock className="w-3 h-3" />
            {isDeadlinePassed
              ? 'Voting Ditutup'
              : `s.d. ${new Date(votingDeadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`
            }
          </div>
        )}
      </div>

      {/* Candidates Grid */}
      <div className={`grid gap-4 ${candidates.length <= 3 ? 'grid-cols-1 sm:grid-cols-' + candidates.length : 'grid-cols-2 sm:grid-cols-3'}`}>
        <AnimatePresence>
          {candidates.sort((a, b) => a.sort_order - b.sort_order).map((candidate, idx) => {
            const isSelected = myVote === candidate.id;
            const voteData = voteCounts.find(vc => vc.candidate_id === candidate.id);
            const percentage = totalVotes > 0 ? Math.round(((voteData?.count || 0) / totalVotes) * 100) : 0;

            return (
              <motion.div
                key={candidate.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.08 }}
                className={`relative rounded-2xl border-2 overflow-hidden transition-all group ${
                  isSelected
                    ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20 shadow-lg shadow-blue-500/10'
                    : 'border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-600'
                }`}
              >
                {/* Selected Badge */}
                {isSelected && (
                  <div className="absolute top-3 right-3 z-10">
                    <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center shadow-lg">
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    </div>
                  </div>
                )}

                {/* Photo */}
                <div className="w-full aspect-square bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                  {candidate.photo_url ? (
                    <img
                      src={candidate.photo_url}
                      alt={candidate.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Users className="w-12 h-12 text-zinc-300 dark:text-zinc-600" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <h4 className="font-bold text-zinc-900 dark:text-white text-sm mb-3 text-center leading-tight">
                    {candidate.name}
                  </h4>

                  {/* Vote Result Bar - only show after voting */}
                  {hasVoted && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-[10px] font-bold mb-1.5">
                        <span className="text-zinc-400">{voteData?.count || 0} suara</span>
                        <span className={isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-500'}>{percentage}%</span>
                      </div>
                      <div className="w-full h-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ delay: 0.3 + idx * 0.1, duration: 0.8, ease: 'easeOut' }}
                          className={`h-full rounded-full ${
                            isSelected
                              ? 'bg-gradient-to-r from-blue-500 to-indigo-500'
                              : 'bg-zinc-300 dark:bg-zinc-600'
                          }`}
                        />
                      </div>
                    </div>
                  )}

                  {/* Vote Button */}
                  {canVote && (
                    <button
                      onClick={() => handleVote(candidate.id)}
                      disabled={voting}
                      className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all active:scale-95 ${
                        isSelected
                          ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400'
                      }`}
                    >
                      {voting ? (
                        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                      ) : isSelected ? (
                        '✓ Pilihan Anda'
                      ) : hasVoted ? (
                        'Ubah Pilihan'
                      ) : (
                        'Pilih'
                      )}
                    </button>
                  )}

                  {/* Deadline passed */}
                  {isDeadlinePassed && (
                    <div className="text-center">
                      <p className="text-[10px] text-zinc-400 font-medium">Voting telah ditutup</p>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Info text */}
      {canVote && (
        <p className="text-[10px] text-zinc-400 text-center font-medium">
          {hasVoted ? 'Anda masih bisa mengubah pilihan sebelum batas waktu berakhir.' : 'Pilih salah satu kandidat di atas untuk memberikan suara Anda.'}
        </p>
      )}
    </div>
  );
}
