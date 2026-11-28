import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Briefcase,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  MapPin,
  Play,
  RotateCcw,
  Send,
  XCircle,
} from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { WORKPLACE_SIMULATIONS } from '../../data/simulations';
import { getCareerPath } from '../../data/curriculum';
import { cloneWorkbook } from '../../engine/formulaEngine';
import { evaluateChecks } from '../../engine/evaluator';
import { playCelebration, playError } from '../../utils/soundEffects';
import { ExcelSpreadsheet } from '../spreadsheet/ExcelSpreadsheet';
import type { EvaluationResult, WorkbookData, WorkplaceSimulation } from '../../types';

interface WorkplaceSimulationViewProps {
  onFocusModeChange?: (active: boolean) => void;
}

export const WorkplaceSimulationView: React.FC<WorkplaceSimulationViewProps> = ({
  onFocusModeChange,
}) => {
  const { completedSimulationIds, recordExerciseResult, profile } = useApp();

  const [activeSim, setActiveSim] = useState<WorkplaceSimulation | null>(null);
  const [workbook, setWorkbook] = useState<WorkbookData | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [showSolutions, setShowSolutions] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [startedAt, setStartedAt] = useState<number>(Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  useEffect(() => {
    onFocusModeChange?.(Boolean(activeSim));
    return () => {
      onFocusModeChange?.(false);
    };
  }, [activeSim, onFocusModeChange]);

  useEffect(() => {
    if (!activeSim || evaluation) return;
    const id = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [activeSim, evaluation, startedAt]);

  const startSimulation = (sim: WorkplaceSimulation) => {
    setActiveSim(sim);
    setWorkbook(cloneWorkbook(sim.workbook));
    setEvaluation(null);
    setShowSolutions(false);
    setRailCollapsed(false);
    setStartedAt(Date.now());
    setElapsedSeconds(0);
  };

  const resetSimulation = () => {
    if (!activeSim) return;
    setWorkbook(cloneWorkbook(activeSim.workbook));
    setEvaluation(null);
    setShowSolutions(false);
    setStartedAt(Date.now());
    setElapsedSeconds(0);
  };

  const handleSubmit = async () => {
    if (!activeSim || !workbook) return;
    const res = evaluateChecks(workbook, activeSim.checks, activeSim.maxScore);
    if (res.passed) {
      playCelebration();
    } else {
      playError();
    }
    setEvaluation(res);

    const spent = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
    await recordExerciseResult({
      exerciseId: activeSim.id,
      exerciseTitle: `${activeSim.roleTitle} Simulation — ${activeSim.companyName}`,
      moduleId: 'simulation',
      careerPathId: activeSim.careerPathId,
      mode: 'simulation',
      topic: `${activeSim.roleTitle} Simulation`,
      score: res.score,
      maxScore: res.maxScore,
      accuracy: res.accuracy,
      passed: res.passed,
      timeSpentSeconds: spent,
    });
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Focus Mode Simulation Workspace
  if (activeSim && workbook) {
    return (
      <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
        {/* Top Workspace Bar */}
        <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setActiveSim(null)}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Exit Simulation</span>
            </button>
            <span className="text-slate-300">|</span>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 truncate">
                {activeSim.roleTitle} · {activeSim.companyName}
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                Workplace Simulation · No formula hints · {activeSim.checks.length} objectives
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-mono text-slate-600 tabular-nums">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {formatTimer(elapsedSeconds)}
            </span>
            <button
              type="button"
              onClick={resetSimulation}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Sheet</span>
            </button>
            <button
              type="button"
              data-sound="none"
              onClick={() => void handleSubmit()}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit Work</span>
            </button>
          </div>
        </header>

        {/* Main Split Workspace */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Collapsible Assignment Brief Rail */}
          <aside
            className={`${
              railCollapsed ? 'w-11' : 'w-80 lg:w-96'
            } bg-white border-r border-slate-200 flex flex-col shrink-0 transition-all duration-150`}
          >
            <div className="h-10 px-3 border-b border-slate-200 flex items-center justify-between">
              {!railCollapsed && (
                <span className="text-xs font-semibold text-slate-900">Workplace Assignment</span>
              )}
              <button
                type="button"
                onClick={() => setRailCollapsed((c) => !c)}
                title={railCollapsed ? 'Expand assignment brief' : 'Collapse assignment brief'}
                className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded"
              >
                {railCollapsed ? (
                  <ChevronRight className="w-4 h-4" />
                ) : (
                  <ChevronLeft className="w-4 h-4" />
                )}
              </button>
            </div>

            {!railCollapsed && (
              <div className="flex-1 overflow-y-auto p-4 space-y-5 text-sm">
                {/* Company Context */}
                <div>
                  <div className="text-xs font-semibold text-blue-700 mb-1">
                    {activeSim.roleTitle}
                  </div>
                  <h2 className="text-base font-bold text-slate-900">{activeSim.companyName}</h2>
                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {activeSim.location}
                  </p>
                  <p className="text-xs text-slate-700 leading-relaxed mt-3">{activeSim.brief}</p>
                </div>

                {/* Manager's Email / Note */}
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                    Manager&apos;s Instructions
                  </div>
                  <p className="text-xs text-slate-800 leading-relaxed">{activeSim.managerNote}</p>
                </div>

                {/* Task Deliverables */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                    Required Deliverables
                  </h3>
                  <ol className="space-y-2.5 text-xs text-slate-700">
                    {activeSim.tasks.map((task, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded bg-slate-100 text-slate-700 font-mono text-[11px] font-semibold flex items-center justify-center shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <span className="leading-relaxed">{task}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Evaluation Results */}
                {evaluation && (
                  <div
                    className={`p-4 rounded-xl border ${
                      evaluation.passed
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-amber-50 border-amber-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`text-xs font-bold ${
                          evaluation.passed ? 'text-emerald-900' : 'text-amber-900'
                        }`}
                      >
                        {evaluation.passed
                          ? 'Simulation Passed — Ready for Review'
                          : 'Needs Revision'}
                      </span>
                      <span className="text-xs font-mono font-bold tabular-nums text-slate-900">
                        {evaluation.accuracy}% ({evaluation.score}/{evaluation.maxScore})
                      </span>
                    </div>

                    <ul className="space-y-1.5 mt-3">
                      {evaluation.checkResults.map((cr) => (
                        <li key={cr.id} className="flex items-start gap-2 text-xs">
                          {cr.passed ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                          )}
                          <div>
                            <div className="font-medium text-slate-900">{cr.description}</div>
                            {!cr.passed && (
                              <div className="text-[11px] text-rose-700 mt-0.5">{cr.message}</div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-4 pt-3 border-t border-slate-200/70 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setShowSolutions((s) => !s)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{showSolutions ? 'Hide Reference Formulas' : 'Review Reference Formulas'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={resetSimulation}
                        className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-white border border-blue-200 rounded-lg hover:bg-blue-50"
                      >
                        Try Again
                      </button>
                    </div>

                    {showSolutions && (
                      <div className="mt-3 p-3 bg-white rounded-lg border border-slate-200 space-y-1.5">
                        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                          Reference Solution Guide
                        </div>
                        {activeSim.solutionGuide.map((line, idx) => (
                          <div key={idx} className="text-xs font-mono text-slate-800 leading-relaxed">
                            {line}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </aside>

          {/* Maximized Live Spreadsheet */}
          <div className="flex-1 min-w-0 h-full p-2.5">
            <ExcelSpreadsheet
              workbook={workbook}
              onChange={(wb) => setWorkbook(wb)}
              highlightCells={[]}
              onReset={resetSimulation}
            />
          </div>
        </div>
      </div>
    );
  }

  // Hub View listing all 5 Workplace Simulations
  const completedCount = WORKPLACE_SIMULATIONS.filter((s) =>
    completedSimulationIds.has(s.id)
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-blue-700 mb-1">Job-Readiness Capstone</p>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Real-World Workplace Simulations
          </h2>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Solve end-to-end business assignments modelled on real Indian office desks. No formula
            prompts are shown — choose the right Excel logic yourself and submit for automated
            grading.
          </p>
        </div>
        <div className="text-sm font-medium text-slate-600 tabular-nums shrink-0">
          Completed: <strong className="text-slate-900">{completedCount} / {WORKPLACE_SIMULATIONS.length}</strong>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {WORKPLACE_SIMULATIONS.map((sim) => {
          const isCompleted = completedSimulationIds.has(sim.id);
          const path = getCareerPath(sim.careerPathId);
          const isRecommended = profile?.careerPathId === sim.careerPathId;

          return (
            <div
              key={sim.id}
              className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between hover:border-slate-300 transition-colors"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                      <Briefcase className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{sim.roleTitle}</h3>
                      <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3.5 h-3.5" />
                        <span>{sim.companyName}</span>
                      </div>
                    </div>
                  </div>
                  {isCompleted && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                      Passed
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-500 mb-3 tabular-nums">
                  {path.shortTitle} · {sim.difficulty} · ~{sim.estimatedMinutes} min ·{' '}
                  {sim.checks.length} graded objectives
                  {isRecommended && (
                    <span className="text-blue-700 font-semibold"> · Matches your career track</span>
                  )}
                </div>

                <p className="text-sm text-slate-600 leading-relaxed mb-4">{sim.brief}</p>

                <div className="text-xs text-slate-500 space-y-1 mb-5">
                  <div className="font-semibold text-slate-700">Key deliverables:</div>
                  {sim.tasks.slice(0, 3).map((t, idx) => (
                    <div key={idx} className="truncate">
                      · {t}
                    </div>
                  ))}
                  {sim.tasks.length > 3 && (
                    <div className="text-slate-400">
                      + {sim.tasks.length - 3} additional deliverables inside workspace
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-mono text-slate-500 tabular-nums">
                  Up to {sim.maxScore} XP
                </span>
                <button
                  type="button"
                  onClick={() => startSimulation(sim)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{isCompleted ? 'Re-attempt Simulation' : 'Start Simulation'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
