import React, { useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Lock,
  Play,
  TerminalSquare,
} from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { getCareerPath, getStageId } from '../../data/curriculum';
import type { CareerPathId, CurriculumModule } from '../../types';

interface MyLearningViewProps {
  onOpenStage: (moduleId: string, stageNumber: 1 | 2 | 3 | 4, itemIndex?: number) => void;
  initialExpandedModuleId?: string | null;
}

export const MyLearningView: React.FC<MyLearningViewProps> = ({
  onOpenStage,
  initialExpandedModuleId,
}) => {
  const {
    profile,
    completedConceptIds,
    completedExerciseIds,
    completedStageIds,
    completedModuleIds,
    setActiveView,
  } = useApp();

  const pathId: CareerPathId = (profile?.careerPathId as CareerPathId) || 'inventory';
  const careerPath = getCareerPath(pathId);

  const defaultExpanded =
    initialExpandedModuleId ||
    careerPath.modules.find((m) => !completedModuleIds.has(m.id))?.id ||
    careerPath.modules[0].id;

  const [expandedModuleId, setExpandedModuleId] = useState<string>(defaultExpanded);

  const isStageUnlocked = (mod: CurriculumModule, stageNum: 1 | 2 | 3 | 4): boolean => {
    if (stageNum === 1) return true;
    const prevStageId = getStageId(mod.id, (stageNum - 1) as 1 | 2 | 3);
    return completedStageIds.has(prevStageId);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-blue-700 mb-1">{careerPath.title} Curriculum</p>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">My Learning Modules</h2>
          <p className="text-sm text-slate-600 mt-1">
            Each module unlocks step by step across 4 stages (20 items total). Complete each stage to
            unlock the next; revisit completed stages anytime.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setActiveView('career-paths')}
          className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-800 whitespace-nowrap shrink-0"
        >
          Change Career Path
        </button>
      </div>

      <div className="space-y-3">
        {careerPath.modules.map((mod) => {
          const isExpanded = expandedModuleId === mod.id;
          const isModuleDone = completedModuleIds.has(mod.id);
          const allConcepts = [...(mod.stages[0].concepts || []), ...(mod.stages[2].concepts || [])];
          const allExercises = [...(mod.stages[1].exercises || []), ...(mod.stages[3].exercises || [])];
          const doneCount =
            allConcepts.filter((c) => completedConceptIds.has(c.id)).length +
            allExercises.filter((e) => completedExerciseIds.has(e.id)).length;
          const pct = Math.round((doneCount / 20) * 100);

          return (
            <div key={mod.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedModuleId(isExpanded ? '' : mod.id)}
                className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left hover:bg-slate-50/70 transition-colors"
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-mono font-bold shrink-0 mt-0.5 ${
                      isModuleDone
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {isModuleDone ? <CheckCircle2 className="w-4 h-4" /> : String(mod.order).padStart(2, '0')}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-slate-900 truncate">
                      Module {mod.order}: {mod.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{mod.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="hidden sm:block text-right">
                    <p className="text-xs font-mono font-semibold text-slate-900 tabular-nums">
                      {doneCount} / 20 items · {pct}%
                    </p>
                    <div className="w-28 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                      <div className="h-full bg-blue-600 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="px-5 pb-5 pt-2 border-t border-slate-100 bg-slate-50/50 space-y-3">
                  {mod.stages.map((stage) => {
                    const stageId = getStageId(mod.id, stage.stageNumber);
                    const unlocked = isStageUnlocked(mod, stage.stageNumber);
                    const stageDone = completedStageIds.has(stageId);

                    const stageItems =
                      stage.kind === 'concepts'
                        ? (stage.concepts || []).map((c, idx) => ({
                            id: c.id,
                            title: c.title,
                            done: completedConceptIds.has(c.id),
                            index: idx,
                          }))
                        : (stage.exercises || []).map((e, idx) => ({
                            id: e.id,
                            title: e.title,
                            done: completedExerciseIds.has(e.id),
                            index: idx,
                          }));

                    const stageDoneCount = stageItems.filter((i) => i.done).length;
                    const firstUndoneIdx = Math.max(
                      0,
                      stageItems.findIndex((i) => !i.done)
                    );

                    return (
                      <div
                        key={stage.stageNumber}
                        className={`bg-white border rounded-lg p-4 ${
                          unlocked ? 'border-slate-200' : 'border-slate-200/70 opacity-75'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div
                              className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
                                stageDone
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : unlocked
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'bg-slate-100 text-slate-400'
                              }`}
                            >
                              {stageDone ? (
                                <CheckCircle2 className="w-4 h-4" />
                              ) : !unlocked ? (
                                <Lock className="w-3.5 h-3.5" />
                              ) : stage.kind === 'concepts' ? (
                                <BookOpen className="w-4 h-4" />
                              ) : (
                                <TerminalSquare className="w-4 h-4" />
                              )}
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-slate-900">{stage.title}</h4>
                              <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                                {stageDoneCount} of {stageItems.length} completed ·{' '}
                                {stage.kind === 'concepts'
                                  ? 'Interactive concepts with Try It Yourself'
                                  : 'Graded live spreadsheet exercises'}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={!unlocked}
                            onClick={() => onOpenStage(mod.id, stage.stageNumber, firstUndoneIdx)}
                            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                              !unlocked
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : stageDone
                                ? 'bg-white border border-slate-300 text-slate-800 hover:bg-slate-50'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                          >
                            {!unlocked ? (
                              <>
                                <Lock className="w-3.5 h-3.5" />
                                <span>Complete Stage {stage.stageNumber - 1} First</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3.5 h-3.5" />
                                <span>
                                  {stageDone ? 'Revisit Stage' : stageDoneCount > 0 ? 'Continue Stage' : 'Start Stage'}
                                </span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Individual Concept/Exercise Quick List when unlocked */}
                        {unlocked && (
                          <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-5 gap-2">
                            {stageItems.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => onOpenStage(mod.id, stage.stageNumber, item.index)}
                                className={`text-left px-2.5 py-2 rounded-md border text-xs transition-colors flex items-center gap-1.5 ${
                                  item.done
                                    ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900 hover:bg-emerald-50'
                                    : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50/40'
                                }`}
                              >
                                <span
                                  className={`font-mono text-[10px] font-bold shrink-0 ${
                                    item.done ? 'text-emerald-600' : 'text-slate-400'
                                  }`}
                                >
                                  {item.done ? '✓' : `${item.index + 1}.`}
                                </span>
                                <span className="truncate">{item.title}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
