import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { BarChart3, Loader2, Search, ChevronDown, ChevronUp, FileText, Users, CheckCheck, X, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

interface SurveyQuestion {
  id: string;
  label: string;
  type: 'text' | 'radio' | 'checkbox' | 'textarea';
  required: boolean;
  options?: string[];
}

interface GatheringSurvey {
  id: string;
  title: string;
  description?: string;
  questions?: SurveyQuestion[];
}

interface Announcement {
  id: string;
  title: string;
  announcement_type?: string;
  gathering_config?: { surveys: GatheringSurvey[] };
  created_at: string;
  profiles?: { name: string };
}

interface SurveyResponse {
  id: string;
  survey_id: string;
  user_id: string;
  answers: Record<string, any>;
  created_at: string;
  profiles?: { name: string; nik: string };
}

export default function AdminSurveyReports() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [responsesLoading, setResponsesLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedSurvey, setExpandedSurvey] = useState<string | null>(null);
  const [expandedRespondent, setExpandedRespondent] = useState<string | null>(null);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*, profiles!announcements_created_by_fkey(name)')
        .eq('announcement_type', 'gathering')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const withSurveys = (data || []).filter(
        (a: Announcement) => a.gathering_config?.surveys?.length > 0
      );
      setAnnouncements(withSurveys);
    } catch (error) {
      console.error('Error fetching announcements:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchResponses = async (announcement: Announcement) => {
    setSelectedAnnouncement(announcement);
    setResponsesLoading(true);
    setExpandedSurvey(null);
    setExpandedRespondent(null);
    try {
      const { data, error } = await supabase
        .from('announcement_survey_responses')
        .select('*, profiles!announcement_survey_responses_user_id_fkey(name, nik)')
        .eq('announcement_id', announcement.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setResponses(data || []);
    } catch (error) {
      console.error('Error fetching responses:', error);
    } finally {
      setResponsesLoading(false);
    }
  };

  const getSurvey = (surveyId: string): GatheringSurvey | undefined => {
    return selectedAnnouncement?.gathering_config?.surveys?.find(s => s.id === surveyId);
  };

  const getResponseCount = (surveyId: string) => {
    return responses.filter(r => r.survey_id === surveyId).length;
  };

  const aggregateAnswers = (survey: GatheringSurvey) => {
    const surveyResponses = responses.filter(r => r.survey_id === survey.id);
    return (survey.questions || []).map(question => {
      const answers = surveyResponses.map(r => r.answers[question.id]).filter(Boolean);
      
      if (question.type === 'radio') {
        const counts: Record<string, number> = {};
        answers.forEach(a => { counts[a] = (counts[a] || 0) + 1; });
        const total = answers.length;
        return {
          question,
          type: 'radio' as const,
          counts,
          total,
          details: Object.entries(counts)
            .map(([option, count]) => ({
              option,
              count,
              percentage: total > 0 ? (count / total) * 100 : 0,
            }))
            .sort((a, b) => b.count - a.count),
        };
      }

      if (question.type === 'checkbox') {
        const counts: Record<string, number> = {};
        answers.flat().forEach((a: string) => { counts[a] = (counts[a] || 0) + 1; });
        const total = surveyResponses.length;
        return {
          question,
          type: 'checkbox' as const,
          counts,
          total,
          details: Object.entries(counts)
            .map(([option, count]) => ({
              option,
              count,
              percentage: total > 0 ? (count / total) * 100 : 0,
            }))
            .sort((a, b) => b.count - a.count),
        };
      }

      return {
        question,
        type: 'text' as const,
        answers: answers as string[],
        total: answers.length,
      };
    });
  };

  const filteredAnnouncements = announcements.filter(a =>
    a.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-zinc-900 dark:text-white">Laporan Hasil Survei</h1>
          <p className="text-sm text-zinc-500">Lihat hasil survei dari pengumuman gathering</p>
        </div>
        {selectedAnnouncement && (
          <button
            onClick={() => setSelectedAnnouncement(null)}
            className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl font-bold text-sm hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            ← Kembali
          </button>
        )}
      </div>

      {!selectedAnnouncement ? (
        <>
          {/* Search */}
          <div className="relative mb-6 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input
              type="text"
              placeholder="Cari pengumuman..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl py-3 pl-12 pr-4 text-sm text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : filteredAnnouncements.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
              <BarChart3 className="w-16 h-16 text-zinc-200 dark:text-zinc-800 mx-auto mb-4" />
              <p className="text-zinc-500 font-bold">Belum ada survei</p>
              <p className="text-zinc-400 text-sm mt-1">Buat pengumuman dengan survei terlebih dahulu</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredAnnouncements.map(a => {
                const surveyCount = a.gathering_config?.surveys?.length || 0;
                return (
                  <motion.button
                    key={a.id}
                    onClick={() => fetchResponses(a)}
                    className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 text-left hover:shadow-md transition-all hover:border-blue-200 dark:hover:border-blue-800"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-zinc-900 dark:text-white">{a.title}</h3>
                        <p className="text-xs text-zinc-500 mt-1">
                          {surveyCount} survei • {format(new Date(a.created_at), 'dd MMM yyyy')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1 rounded-full">
                          {surveyCount} Survei
                        </span>
                        <ChevronDown className="w-4 h-4 text-zinc-400" />
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* Survey Detail View */
        <div className="space-y-6">
          {/* Announcement Info */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5">
            <h2 className="font-bold text-lg text-zinc-900 dark:text-white">{selectedAnnouncement.title}</h2>
            <p className="text-xs text-zinc-500 mt-1">
              Total responden: {responses.length} orang
            </p>
          </div>

          {responsesLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : (
            <>
              {/* Survey Cards */}
              {(selectedAnnouncement.gathering_config?.surveys || []).map(survey => {
                const isExpanded = expandedSurvey === survey.id;
                const responseCount = getResponseCount(survey.id);
                const aggregation = aggregateAnswers(survey);

                return (
                  <motion.div
                    key={survey.id}
                    className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedSurvey(isExpanded ? null : survey.id)}
                      className="w-full p-5 flex items-center justify-between text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <h3 className="font-bold text-zinc-900 dark:text-white">{survey.title}</h3>
                          <p className="text-xs text-zinc-500">{responseCount} responden • {survey.questions?.length || 0} pertanyaan</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-purple-600">{responseCount}</span>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
                      </div>
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-zinc-100 dark:border-zinc-800"
                        >
                          <div className="p-5 space-y-6">
                            {/* Aggregated Results */}
                            {aggregation.map((agg, idx) => (
                              <div key={agg.question.id} className="space-y-3">
                                <div className="flex items-start gap-2">
                                  <span className="text-xs font-bold text-zinc-400 mt-0.5">Q{idx + 1}.</span>
                                  <div className="flex-1">
                                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                                      {agg.question.label}
                                      {agg.question.required && <span className="text-red-500 ml-1">*</span>}
                                    </p>
                                    <span className="text-[10px] text-zinc-400 uppercase tracking-wider">
                                      {agg.question.type === 'radio' ? 'Pilihan Ganda' : 
                                       agg.question.type === 'checkbox' ? 'Checkbox' :
                                       agg.question.type === 'textarea' ? 'Teks Panjang' : 'Teks Singkat'}
                                      {' • '}{agg.total} jawaban
                                    </span>
                                  </div>
                                </div>

                                {(agg.type === 'radio' || agg.type === 'checkbox') ? (
                                  <div className="space-y-2 pl-6">
                                    {agg.details.map(detail => (
                                      <div key={detail.option} className="flex items-center gap-3">
                                        <div className="flex-1">
                                          <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs text-zinc-700 dark:text-zinc-300 font-medium">{detail.option}</span>
                                            <span className="text-xs text-zinc-500">
                                              {detail.count} ({detail.percentage.toFixed(1)}%)
                                            </span>
                                          </div>
                                          <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                            <motion.div
                                              initial={{ width: 0 }}
                                              animate={{ width: `${detail.percentage}%` }}
                                              transition={{ duration: 0.8, ease: 'easeOut' }}
                                              className="h-full rounded-full bg-gradient-to-r from-purple-400 to-purple-600"
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="pl-6 space-y-2">
                                    {agg.answers.length === 0 ? (
                                      <p className="text-xs text-zinc-400 italic">Belum ada jawaban</p>
                                    ) : agg.answers.length <= 5 ? (
                                      agg.answers.map((answer, i) => (
                                        <div key={i} className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
                                          <p className="text-sm text-zinc-700 dark:text-zinc-300">{answer}</p>
                                        </div>
                                      ))
                                    ) : (
                                      <>
                                        {agg.answers.slice(0, 3).map((answer, i) => (
                                          <div key={i} className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
                                            <p className="text-sm text-zinc-700 dark:text-zinc-300 line-clamp-2">{answer}</p>
                                          </div>
                                        ))}
                                        <p className="text-xs text-zinc-400 italic">
                          dan {agg.answers.length - 3} jawaban lainnya
                                        </p>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}

                            {/* Individual Responses */}
                            <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4">
                              <button
                                onClick={() => setExpandedRespondent(expandedRespondent === survey.id ? null : survey.id)}
                                className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 font-medium"
                              >
                                <Users className="w-4 h-4" />
                                Lihat Jawaban per Responden ({responseCount})
                                {expandedRespondent === survey.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>

                              <AnimatePresence>
                                {expandedRespondent === survey.id && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="mt-4 space-y-3"
                                  >
                                    {responses.filter(r => r.survey_id === survey.id).map(r => (
                                      <div key={r.id} className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
                                        <div className="flex items-center gap-2 mb-3">
                                          <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-[10px] font-bold text-blue-600">
                                            {r.profiles?.name?.charAt(0) || '?'}
                                          </div>
                                          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                                            {r.profiles?.name || 'Anonymous'}
                                          </span>
                                          {r.profiles?.nik && (
                                            <span className="text-[10px] text-zinc-400">• {r.profiles.nik}</span>
                                          )}
                                        </div>
                                        <div className="space-y-2">
                                          {(survey.questions || []).map(q => (
                                            <div key={q.id} className="text-xs">
                                              <span className="text-zinc-500">{q.label}: </span>
                                              <span className="text-zinc-800 dark:text-zinc-200 font-medium">
                                                {Array.isArray(r.answers[q.id]) 
                                                  ? r.answers[q.id].join(', ') 
                                                  : r.answers[q.id] || '-'}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
