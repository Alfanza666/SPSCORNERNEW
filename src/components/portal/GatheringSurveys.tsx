import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { ClipboardList, ExternalLink, Lock, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';

interface Survey {
  id: string;
  title: string;
  description?: string;
  form_id?: string; // internal dynamic_forms ID
  external_url?: string; // or external URL
}

interface GatheringSurveysProps {
  surveys: Survey[];
  targetNiks: string[];
}

export default function GatheringSurveys({ surveys, targetNiks }: GatheringSurveysProps) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const isTargeted = user?.nik && targetNiks?.includes(user.nik);

  if (!surveys || surveys.length === 0) return null;

  // Non-targeted user
  if (!isTargeted) {
    return (
      <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl p-6 text-center border border-zinc-200 dark:border-zinc-700">
        <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-7 h-7 text-zinc-400" />
        </div>
        <p className="font-bold text-zinc-600 dark:text-zinc-300 text-sm mb-1">Akses Terbatas</p>
        <p className="text-xs text-zinc-400">
          Survei ini hanya dapat diakses oleh anggota yang telah ditentukan oleh pengurus serikat.
        </p>
      </div>
    );
  }

  const handleOpenSurvey = (survey: Survey) => {
    if (survey.form_id) {
      // Navigate to internal form
      navigate(`/portal/forms/${survey.form_id}`);
    } else if (survey.external_url) {
      window.open(survey.external_url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
          <ClipboardList className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-zinc-900 dark:text-white text-sm">Survei Gathering</h3>
          <p className="text-[10px] text-zinc-400 font-medium">{surveys.length} survei tersedia</p>
        </div>
      </div>

      <div className="space-y-3">
        {surveys.map((survey, idx) => (
          <motion.button
            key={survey.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.08 }}
            onClick={() => handleOpenSurvey(survey)}
            className="w-full flex items-center gap-4 p-4 bg-white dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-700 hover:border-purple-200 dark:hover:border-purple-800 transition-all group text-left active:scale-[0.98]"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-500 dark:text-purple-400 shrink-0 group-hover:bg-purple-100 dark:group-hover:bg-purple-900/30 transition-colors">
              {survey.external_url ? (
                <ExternalLink className="w-5 h-5" />
              ) : (
                <ClipboardList className="w-5 h-5" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-zinc-900 dark:text-white truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                {survey.title}
              </p>
              {survey.description && (
                <p className="text-[10px] text-zinc-400 truncate mt-0.5">{survey.description}</p>
              )}
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-purple-500 transition-colors shrink-0" />
          </motion.button>
        ))}
      </div>
    </div>
  );
}
