import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Play,
  Search,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import {
  CAREER_PATHS,
  getAllConceptsForPath,
  getAllExercisesForPath,
  getCareerPath,
  getStageId,
} from '../../data/curriculum';
import type { CareerPathId } from '../../types';

interface MyProgressViewProps {
  onLaunchModule: (moduleId: string, stageNumber?: 1 | 2 | 3 | 4) => void;
}

export const MyProgressView: React.FC<MyProgressViewProps> = ({ onLaunchModule }) => {
  const {
    profile,
    attempts,
    completedConceptIds,
    completedExerciseIds,
    completedStageIds,
    completedModuleIds,
    weakTopics,
    averageAccuracy,
  } = useApp();

  const activePathId: CareerPathId = (profile?.careerPathId as CareerPathId) || 'inventory';
  const activePath = getCareerPath(activePathId);

  const [modeFilter, setModeFilter] = useState<'all' | 'guided' | 'mixed' | 'simulation'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAttempts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return attempts.filter((a) => {
      if (modeFilter !== 'all' && a.mode !== modeFilter) return false;
      if (q && !a.exerciseTitle.toLowerCase().includes(q) && !a.topic.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [attempts, modeFilter, searchQuery]);

  const formatDateTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const formatDuration = (secs: number) => {
    if (secs < 60) return `${secs}s`;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold text-blue-700 mb-1">Performance Analytics</p>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">My Progress &amp; History</h2>
        <p className="text-sm text-slate-600 mt-1">
          Detailed module completion, accuracy breakdown, weak topics to revise, and your full
          practice log.
        </p>
      </div>

      {/* Career Paths Summary Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {CAREER_PATHS.map((path) => {
          const concepts = getAllConceptsForPath(path.id);
          const exercises = getAllExercisesForPath(path.id);
          const doneC = concepts.filter((c) => completedConceptIds.has(c.id)).length;
          const doneE = exercises.filter((e) => completedExerciseIds.has(e.id)).length;
          const total = concepts.length + exercises.length;
          const pct = total > 0 ? Math.round(((doneC + doneE) / total) * 100) : 0;
          const isCurrent = path.id === activePathId;

          return (
            <div
              key={path.id}
              className={`bg-white rounded-xl border p-4 ${
                isCurrent ? 'border-blue-300' : 'border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-bold text-slate-900 truncate">{path.shortTitle}</span>
                <span className="text-xs font-mono font-semibold text-blue-700 tabular-nums">
                  {pct}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-2.5">
                <div
                  className="h-full bg-blue-600 rounded-full"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="text-[11px] text-slate-500 tabular-nums">
                {doneC}/{concepts.length} concepts · {doneE}/{exercises.length} exercises
              </div>
            </div>
          );
        })}
      </section>

      {/* Active Path Module-by-Module Breakdown */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {activePath.title} — Module Breakdown
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
              Average accuracy across attempts: {averageAccuracy}% · Total attempts: {attempts.length}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <th className="py-3 px-6">Module</th>
                <th className="py-3 px-4">Stages</th>
                <th className="py-3 px-4">Concepts</th>
                <th className="py-3 px-4">Exercises</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {activePath.modules.map((mod) => {
                const modConcepts = [
                  ...(mod.stages[0].concepts || []),
                  ...(mod.stages[2].concepts || []),
                ];
                const modExercises = [
                  ...(mod.stages[1].exercises || []),
                  ...(mod.stages[3].exercises || []),
                ];
                const doneC = modConcepts.filter((c) => completedConceptIds.has(c.id)).length;
                const doneE = modExercises.filter((e) => completedExerciseIds.has(e.id)).length;
                const doneStages = ([1, 2, 3, 4] as const).filter((n) =>
                  completedStageIds.has(getStageId(mod.id, n))
                ).length;
                const isDone = completedModuleIds.has(mod.id);
                const nextStage = ([1, 2, 3, 4] as const).find(
                  (n) => !completedStageIds.has(getStageId(mod.id, n))
                );

                return (
                  <tr key={mod.id} className="hover:bg-slate-50/70">
                    <td className="py-3.5 px-6">
                      <div className="font-semibold text-slate-900">
                        {mod.order}. {mod.title}
                      </div>
                      <div className="text-xs text-slate-500 truncate max-w-md">
                        {mod.description}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-mono text-slate-700 tabular-nums">
                      {doneStages} / 4
                    </td>
                    <td className="py-3.5 px-4 text-xs font-mono text-slate-700 tabular-nums">
                      {doneC} / {modConcepts.length}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-mono text-slate-700 tabular-nums">
                      {doneE} / {modExercises.length}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-medium">
                      {isDone ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Completed
                        </span>
                      ) : doneC + doneE > 0 ? (
                        <span className="text-blue-700">In Progress</span>
                      ) : (
                        <span className="text-slate-400">Not Started</span>
                      )}
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <button
                        type="button"
                        onClick={() => onLaunchModule(mod.id, nextStage || 1)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>{isDone ? 'Review' : doneC + doneE > 0 ? 'Continue' : 'Start'}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Weak Topics Needing Revision */}
      {weakTopics.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <h3 className="text-base font-bold text-slate-900">Topics Recommended for Revision</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {weakTopics.map((wt) => (
              <div
                key={wt.topic}
                className="p-4 rounded-lg border border-amber-200 bg-amber-50/40 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">{wt.topic}</div>
                  <div className="text-xs text-slate-600 tabular-nums mt-0.5">
                    {wt.avgAccuracy}% avg accuracy · {wt.attempts}{' '}
                    {wt.attempts === 1 ? 'attempt' : 'attempts'}
                  </div>
                </div>
                {wt.moduleId && wt.moduleId !== 'simulation' && wt.moduleId !== 'custom' && (
                  <button
                    type="button"
                    onClick={() => onLaunchModule(wt.moduleId, 1)}
                    className="px-3 py-1.5 text-xs font-semibold text-amber-900 bg-white border border-amber-300 rounded-lg hover:bg-amber-50 shrink-0"
                  >
                    Revise
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Full Practice Attempt History */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Exercise Attempt History</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Every guided exercise, mixed test, and workplace simulation submission is recorded.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by topic or title..."
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value as typeof modeFilter)}
              className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Modes</option>
              <option value="guided">Guided Practice</option>
              <option value="mixed">Mixed Practice</option>
              <option value="simulation">Workplace Simulation</option>
            </select>
          </div>
        </div>

        {filteredAttempts.length === 0 ? (
          <div className="p-10 text-center">
            <TrendingUp className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-700">No matching exercise attempts yet</p>
            <p className="text-xs text-slate-500 mt-1">
              Submit answers in Practice, Mixed Practice, or Workplace Simulations to see your score
              log here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="py-3 px-6">Exercise</th>
                  <th className="py-3 px-4">Mode</th>
                  <th className="py-3 px-4">Score</th>
                  <th className="py-3 px-4">Accuracy</th>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Result</th>
                  <th className="py-3 px-6 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredAttempts.slice(0, 50).map((att) => (
                  <tr key={att.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-6">
                      <div className="font-semibold text-slate-900">{att.exerciseTitle}</div>
                      <div className="text-slate-500">{att.topic}</div>
                    </td>
                    <td className="py-3 px-4 capitalize text-slate-600">{att.mode}</td>
                    <td className="py-3 px-4 font-mono text-slate-800 tabular-nums">
                      {att.score}/{att.maxScore}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900 tabular-nums">
                      {att.accuracy}%
                    </td>
                    <td className="py-3 px-4 text-slate-600 tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {formatDuration(att.timeSpentSeconds)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {att.passed ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Passed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-700 font-semibold">
                          <XCircle className="w-3.5 h-3.5" />
                          Needs Practice
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-6 text-right text-slate-500 tabular-nums whitespace-nowrap">
                      {formatDateTime(att.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
