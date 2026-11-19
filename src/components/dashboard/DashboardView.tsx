import React from 'react';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Compass,
  Flame,
  Play,
  Target,
} from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import {
  getAllConceptsForPath,
  getAllExercisesForPath,
  getCareerPath,
  getLearnerLevel,
  getStageId,
} from '../../data/curriculum';
import type { CareerPathId } from '../../types';

interface DashboardViewProps {
  onLaunchModule: (moduleId: string, stageNumber?: 1 | 2 | 3 | 4) => void;
}

function formatLearningTime(seconds: number): string {
  if (seconds < 60) return '< 1 min';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hrs}h ${rem}m`;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onLaunchModule }) => {
  const {
    profile,
    progressRecords,
    completedConceptIds,
    completedExerciseIds,
    completedStageIds,
    completedModuleIds,
    averageAccuracy,
    weakTopics,
    setActiveView,
  } = useApp();

  const pathId: CareerPathId = (profile?.careerPathId as CareerPathId) || 'inventory';
  const careerPath = getCareerPath(pathId);

  const pathConcepts = getAllConceptsForPath(pathId);
  const pathExercises = getAllExercisesForPath(pathId);

  const conceptsDone = pathConcepts.filter((c) => completedConceptIds.has(c.id)).length;
  const exercisesDone = pathExercises.filter((e) => completedExerciseIds.has(e.id)).length;
  const modulesDone = careerPath.modules.filter((m) => completedModuleIds.has(m.id)).length;

  const totalItems = pathConcepts.length + pathExercises.length;
  const completedItems = conceptsDone + exercisesDone;
  const overallPct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  const level = getLearnerLevel(profile?.xp || 0);

  // Determine recommended next module & stage
  let nextModule = careerPath.modules[0];
  let nextStage: 1 | 2 | 3 | 4 = 1;
  for (const mod of careerPath.modules) {
    if (!completedModuleIds.has(mod.id)) {
      nextModule = mod;
      for (const stNum of [1, 2, 3, 4] as const) {
        if (!completedStageIds.has(getStageId(mod.id, stNum))) {
          nextStage = stNum;
          break;
        }
      }
      break;
    }
  }

  // Weekly goal calculation (items completed in the last 7 days)
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weeklyCompleted = progressRecords.filter(
    (r) =>
      (r.itemType === 'concept' || r.itemType === 'simulation') &&
      new Date(r.completedAt).getTime() >= sevenDaysAgo
  ).length;
  const weeklyGoal = profile?.weeklyGoalItems || 15;
  const weeklyPct = Math.min(100, Math.round((weeklyCompleted / weeklyGoal) * 100));

  // Recently completed lessons (latest 5)
  const recentRecords = [...progressRecords]
    .filter((r) => r.itemType === 'concept' || r.itemType === 'module' || r.itemType === 'simulation')
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Primary Welcome & Continue Learning Hero Block */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <p className="text-xs font-semibold text-blue-700">
              {careerPath.title} Path · {level.title} Level
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Welcome back, {profile?.fullName || 'Learner'}
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Next up: <strong className="text-slate-900">Module {nextModule.order}: {nextModule.title}</strong> —{' '}
              {nextModule.stages[nextStage - 1].title}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onLaunchModule(nextModule.id, nextStage)}
              className="inline-flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Continue Learning</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveView('career-paths')}
              className="inline-flex items-center gap-2 px-4 py-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
            >
              <Compass className="w-4 h-4 text-slate-500" />
              <span>Switch Path</span>
            </button>
          </div>
        </div>

        {/* Visual Overall Progress Bar */}
        <div className="mt-7 pt-6 border-t border-slate-100">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-semibold text-slate-700">Overall Path Completion</span>
            <span className="font-mono font-semibold text-slate-900 tabular-nums">
              {overallPct}% ({completedItems} / {totalItems} items)
            </span>
          </div>
          <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-300"
              style={{ width: `${overallPct}%` }}
            />
          </div>
        </div>
      </section>

      {/* Key Metrics Strip (Real Calculated Records) */}
      <section className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Concepts Completed</p>
          <p className="text-xl font-bold text-slate-900 font-mono tabular-nums">
            {conceptsDone} <span className="text-xs font-normal text-slate-400">/ {pathConcepts.length}</span>
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Exercises Passed</p>
          <p className="text-xl font-bold text-slate-900 font-mono tabular-nums">
            {exercisesDone} <span className="text-xs font-normal text-slate-400">/ {pathExercises.length}</span>
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Modules Completed</p>
          <p className="text-xl font-bold text-slate-900 font-mono tabular-nums">
            {modulesDone} <span className="text-xs font-normal text-slate-400">/ {careerPath.modules.length}</span>
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Average Accuracy</p>
          <p className="text-xl font-bold text-slate-900 font-mono tabular-nums">
            {averageAccuracy > 0 ? `${averageAccuracy}%` : '—'}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-amber-600" />
            <span>Learning Streak</span>
          </p>
          <p className="text-xl font-bold text-slate-900 font-mono tabular-nums">
            {profile?.streakDays || 1} <span className="text-xs font-normal text-slate-400">days</span>
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Learning Time</p>
          <p className="text-xl font-bold text-slate-900 font-mono tabular-nums">
            {formatLearningTime(profile?.totalLearningSeconds || 0)}
          </p>
        </div>
      </section>

      {/* Two-Column Actionable Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Recommended Next Lesson + Recently Completed */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900">Recommended Next Lesson</h3>
              <span className="text-xs text-slate-500 font-mono">
                Module {nextModule.order} · Stage {nextStage} of 4
              </span>
            </div>
            <h4 className="text-lg font-bold text-slate-900 mb-1.5">{nextModule.title}</h4>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">{nextModule.description}</p>
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-100">
              <span className="text-xs text-slate-500">
                {nextModule.stages[nextStage - 1].title} · ~{nextModule.estimatedMinutes} min module
              </span>
              <button
                type="button"
                onClick={() => onLaunchModule(nextModule.id, nextStage)}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                <span>Open Stage {nextStage}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900">Recently Completed Lessons</h3>
              <button
                type="button"
                onClick={() => setActiveView('progress')}
                className="text-xs font-medium text-blue-600 hover:underline"
              >
                View full history
              </button>
            </div>

            {recentRecords.length === 0 ? (
              <div className="py-6 text-center">
                <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700">No lessons completed yet</p>
                <p className="text-xs text-slate-500 mt-1 mb-4">
                  Start Module 1 Stage 1 to complete your first Excel concept and interactive exercise.
                </p>
                <button
                  type="button"
                  onClick={() => onLaunchModule(nextModule.id, 1)}
                  className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800"
                >
                  Start First Concept
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recentRecords.map((rec) => (
                  <li key={rec.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{rec.topic}</p>
                        <p className="text-xs text-slate-500 capitalize">
                          {rec.itemType} · {new Date(rec.completedAt).toLocaleDateString('en-IN')}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-mono text-slate-600 tabular-nums shrink-0">
                      {rec.score}/{rec.maxScore}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right: Weekly Goal + Weak Topics + Quick Launchers */}
        <div className="lg:col-span-5 space-y-6">
          {/* Weekly Goal */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-600" />
                <span>Weekly Learning Goal</span>
              </h3>
              <span className="text-xs font-mono font-semibold text-slate-700 tabular-nums">
                {weeklyCompleted} / {weeklyGoal} items
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Keep steady momentum toward {level.title === 'Advanced' ? 'Mastery' : 'the next career level'} ({profile?.xp || 0} XP).
            </p>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 rounded-full transition-all"
                style={{ width: `${weeklyPct}%` }}
              />
            </div>
          </div>

          {/* Weak Topics Needing Revision */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h3 className="text-base font-bold text-slate-900 mb-1">Topics Needing Revision</h3>
            <p className="text-xs text-slate-500 mb-4">
              Automatically detected from practice exercises scoring below 80%.
            </p>

            {weakTopics.length === 0 ? (
              <p className="text-xs text-slate-600 py-3">
                No weak topics flagged yet. Complete graded spreadsheet exercises to track accuracy by skill.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {weakTopics.map((wt) => (
                  <li key={wt.topic} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{wt.topic}</p>
                        <p className="text-xs text-slate-500 tabular-nums">
                          {wt.attempts} attempt{wt.attempts > 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs font-mono font-semibold text-amber-700 tabular-nums">
                        {wt.avgAccuracy}%
                      </span>
                      <button
                        type="button"
                        onClick={() => onLaunchModule(wt.moduleId, 2)}
                        className="text-xs font-semibold text-blue-600 hover:underline"
                      >
                        Revise
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Workplace Simulation Callout */}
          <div className="bg-slate-900 text-white rounded-xl p-6">
            <h3 className="text-base font-bold mb-1.5">Workplace Simulations</h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Ready to test yourself without hints? Solve real Indian business scenarios as an
              Inventory Manager, Store Manager, Banking Assistant, Finance Executive, or MIS Executive.
            </p>
            <button
              type="button"
              onClick={() => setActiveView('simulations')}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-slate-900 hover:bg-slate-100 text-xs font-semibold rounded-lg transition-colors"
            >
              <span>Open Workplace Simulation</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
