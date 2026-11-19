import React, { useState } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { CAREER_PATHS, getAllConceptsForPath, getAllExercisesForPath } from '../../data/curriculum';
import { useApp } from '../../contexts/AppContext';
import type { CareerPathId } from '../../types';

export const CareerPathsView: React.FC = () => {
  const { profile, selectCareerPath, completedConceptIds, completedExerciseIds, completedModuleIds, setActiveView } =
    useApp();
  const [switching, setSwitching] = useState<CareerPathId | null>(null);
  const currentId = (profile?.careerPathId as CareerPathId) || 'inventory';

  const handleSelect = async (id: CareerPathId) => {
    setSwitching(id);
    try {
      await selectCareerPath(id, true);
      setActiveView('my-learning');
    } finally {
      setSwitching(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="max-w-2xl">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-1.5">Career Learning Paths</h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          Each career path contains 12 job-focused modules (240 interactive concepts and spreadsheet
          exercises). Your progress is saved independently for every path you study.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {CAREER_PATHS.map((path) => {
          const isCurrent = path.id === currentId;
          const concepts = getAllConceptsForPath(path.id);
          const exercises = getAllExercisesForPath(path.id);
          const doneC = concepts.filter((c) => completedConceptIds.has(c.id)).length;
          const doneE = exercises.filter((e) => completedExerciseIds.has(e.id)).length;
          const doneM = path.modules.filter((m) => completedModuleIds.has(m.id)).length;
          const total = concepts.length + exercises.length;
          const pct = total > 0 ? Math.round(((doneC + doneE) / total) * 100) : 0;

          return (
            <div
              key={path.id}
              className={`bg-white rounded-xl overflow-hidden border flex flex-col ${
                isCurrent ? 'border-blue-600' : 'border-slate-200'
              }`}
            >
              <div className="aspect-16/9 bg-slate-100 overflow-hidden relative">
                <img
                  src={path.coverImage}
                  alt={path.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>

              <div className="p-6 flex-1 flex flex-col">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <h3 className="text-lg font-bold text-slate-900">{path.title}</h3>
                  {isCurrent && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                      Active Path
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-500 mb-3 tabular-nums">
                  {path.modules.length} Modules · {doneM} Completed · {pct}% Overall
                </p>

                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-4">
                  <div className="h-full bg-blue-600 rounded-full" style={{ width: `${pct}%` }} />
                </div>

                <p className="text-sm text-slate-600 leading-relaxed mb-4">{path.description}</p>

                <div className="mb-5 space-y-1.5">
                  <p className="text-xs font-semibold text-slate-800">Workplace Skills Covered:</p>
                  <ul className="space-y-1 text-xs text-slate-600">
                    {path.practicalSkills.map((sk) => (
                      <li key={sk} className="flex items-start gap-2">
                        <span className="text-blue-600 font-bold">·</span>
                        <span>{sk}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
                  <span className="text-xs text-slate-500 truncate">
                    Target roles: {path.jobRoles.slice(0, 2).join(', ')}
                  </span>
                  <button
                    type="button"
                    disabled={switching === path.id}
                    onClick={() => handleSelect(path.id)}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                      isCurrent
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-slate-900 hover:bg-slate-800 text-white'
                    }`}
                  >
                    <span>
                      {switching === path.id
                        ? 'Switching...'
                        : isCurrent
                        ? 'Open Modules'
                        : 'Select Path'}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
