import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
} from 'lucide-react';
import type { EvaluationResult, ExerciseItem, WorkbookData } from '../../types';
import { ExcelSpreadsheet } from '../spreadsheet/ExcelSpreadsheet';
import { cloneWorkbook } from '../../engine/formulaEngine';
import { evaluateChecks } from '../../engine/evaluator';
import { useApp } from '../../contexts/AppContext';

interface PracticeWorkspaceProps {
  exercises: ExerciseItem[];
  initialIndex?: number;
  headerTitle: string;
  stageNumber?: 2 | 4;
  onExit: () => void;
  onStageFinished?: () => void;
}

export const PracticeWorkspace: React.FC<PracticeWorkspaceProps> = ({
  exercises,
  initialIndex = 0,
  headerTitle,
  stageNumber,
  onExit,
  onStageFinished,
}) => {
  const { completedExerciseIds, recordExerciseResult } = useApp();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const exercise = exercises[currentIndex];

  const [workbook, setWorkbook] = useState<WorkbookData>(() => cloneWorkbook(exercise.workbook));
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [hintLevel, setHintLevel] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    setWorkbook(cloneWorkbook(exercise.workbook));
    setResult(null);
    setHintLevel(0);
    setShowSolution(false);
    startTimeRef.current = Date.now();
  }, [exercise]);

  const handleCheckAnswer = async () => {
    const evalRes = evaluateChecks(workbook, exercise.checks, exercise.points);
    setResult(evalRes);
    const elapsed = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));

    setSubmitting(true);
    try {
      await recordExerciseResult({
        exerciseId: exercise.id,
        exerciseTitle: exercise.title,
        moduleId: exercise.moduleId,
        careerPathId: exercise.careerPathId,
        stageNumber,
        mode: 'guided',
        topic: exercise.topic,
        score: evalRes.score,
        maxScore: evalRes.maxScore,
        accuracy: evalRes.accuracy,
        passed: evalRes.passed,
        timeSpentSeconds: elapsed,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleTryAgain = () => {
    setWorkbook(cloneWorkbook(exercise.workbook));
    setResult(null);
    startTimeRef.current = Date.now();
  };

  const isLast = currentIndex === exercises.length - 1;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Maximized Workspace Top Bar */}
      <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between gap-3 sticky top-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onExit}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Exit Exercise</span>
          </button>
          <button
            type="button"
            onClick={() => setSidebarOpen((o) => !o)}
            title="Toggle instructions panel"
            className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg hidden lg:inline-flex"
          >
            {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </button>
          <span className="text-xs font-medium text-slate-600 truncate hidden sm:inline">
            {headerTitle} · Exercise {currentIndex + 1} of {exercises.length}
          </span>
        </div>

        {/* Question Stepper */}
        <div className="flex items-center gap-1.5 shrink-0">
          {exercises.map((ex, idx) => {
            const done = completedExerciseIds.has(ex.id);
            const active = idx === currentIndex;
            return (
              <button
                key={ex.id}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`w-7 h-7 rounded-md text-xs font-mono font-semibold transition-colors ${
                  active
                    ? 'bg-blue-600 text-white'
                    : done
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Maximized Practice Area */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Collapsible Left Instructions Rail */}
        {sidebarOpen && (
          <aside className="w-full lg:w-96 shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 p-5 overflow-y-auto space-y-5">
            <div>
              <p className="text-xs font-semibold text-blue-700 mb-1">
                {exercise.topic} · {exercise.difficulty} · {exercise.points} XP
              </p>
              <h1 className="text-lg font-bold text-slate-900 leading-snug">{exercise.title}</h1>
              <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{exercise.objective}</p>
            </div>

            <div className="space-y-2">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Steps to Complete
              </h2>
              <ol className="space-y-2 text-sm text-slate-700">
                {exercise.instructions.map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-xs font-mono font-semibold flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="leading-snug">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {exercise.targetCells.length > 0 && (
              <p className="text-xs text-slate-500">
                Target cells highlighted in yellow:{' '}
                <span className="font-mono font-semibold text-slate-800">
                  {exercise.targetCells.join(', ')}
                </span>
              </p>
            )}

            {/* Progressive Hints (Never reveals answer immediately) */}
            <div className="pt-3 border-t border-slate-100 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">Need a nudge?</span>
                {hintLevel < exercise.hints.length && (
                  <button
                    type="button"
                    onClick={() => setHintLevel((h) => Math.min(exercise.hints.length, h + 1))}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>{hintLevel === 0 ? 'Show Hint 1' : `Show Hint ${hintLevel + 1}`}</span>
                  </button>
                )}
              </div>

              {hintLevel > 0 && (
                <div className="space-y-2">
                  {exercise.hints.slice(0, hintLevel).map((h, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-950"
                    >
                      <strong>Hint {idx + 1}:</strong> {h}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Evaluation Results & Post-Submission Explanation */}
            {result && (
              <div
                className={`p-4 rounded-xl border space-y-3 ${
                  result.passed
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-rose-50 border-rose-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {result.passed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                    )}
                    <span
                      className={`text-sm font-bold ${
                        result.passed ? 'text-emerald-900' : 'text-rose-900'
                      }`}
                    >
                      {result.passed ? 'Correct Answer!' : 'Needs Adjustment'}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold tabular-nums text-slate-900">
                    {result.score}/{result.maxScore} ({result.accuracy}%)
                  </span>
                </div>

                <ul className="space-y-1.5 text-xs">
                  {result.checkResults.map((cr) => (
                    <li
                      key={cr.id}
                      className={`flex items-start gap-2 ${
                        cr.passed ? 'text-emerald-900' : 'text-rose-900'
                      }`}
                    >
                      <span className="font-bold shrink-0">{cr.passed ? '✓' : '×'}</span>
                      <span>{cr.message}</span>
                    </li>
                  ))}
                </ul>

                {result.passed ? (
                  <div className="pt-2 border-t border-emerald-200 text-xs text-emerald-950 leading-relaxed">
                    <strong>Explanation:</strong> {exercise.explanation}
                  </div>
                ) : (
                  <div className="pt-2 border-t border-rose-200 space-y-2">
                    <button
                      type="button"
                      onClick={() => setShowSolution((s) => !s)}
                      className="text-xs font-semibold text-rose-800 underline"
                    >
                      {showSolution ? 'Hide Explanation' : 'View Explanation & Reference Formula'}
                    </button>
                    {showSolution && (
                      <div className="p-2.5 rounded bg-white/80 text-xs text-slate-800 space-y-1">
                        <p>{exercise.explanation}</p>
                        <p className="font-mono text-blue-700 font-semibold">
                          Reference: {exercise.sampleSolution}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </aside>
        )}

        {/* Right: Maximized Live Spreadsheet Workspace */}
        <div className="flex-1 flex flex-col p-4 sm:p-5 min-w-0 gap-4">
          <div className="flex-1 flex flex-col min-h-0">
            <ExcelSpreadsheet
              workbook={workbook}
              onChange={setWorkbook}
              highlightCells={exercise.targetCells}
              onReset={handleTryAgain}
            />
          </div>

          {/* Bottom Check & Navigation Bar */}
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                disabled={submitting}
                onClick={handleCheckAnswer}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {submitting ? 'Checking...' : 'Check Answer'}
              </button>
              <button
                type="button"
                onClick={handleTryAgain}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Try Again</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {currentIndex > 0 && (
                <button
                  type="button"
                  onClick={() => setCurrentIndex(currentIndex - 1)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  Previous
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (!isLast) {
                    setCurrentIndex(currentIndex + 1);
                  } else if (onStageFinished) {
                    onStageFinished();
                  } else {
                    onExit();
                  }
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                <span>{isLast ? 'Finish Session' : 'Next Exercise'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
