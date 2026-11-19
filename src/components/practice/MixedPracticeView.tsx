import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Lock,
  Shuffle,
} from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { generateMixedPracticeQuestions, getCareerPath } from '../../data/curriculum';
import { ExcelSpreadsheet } from '../spreadsheet/ExcelSpreadsheet';
import { cloneWorkbook } from '../../engine/formulaEngine';
import { evaluateChecks } from '../../engine/evaluator';
import type { CareerPathId, DifficultyLevel, EvaluationResult, ExerciseItem, WorkbookData } from '../../types';

interface MixedPracticeViewProps {
  onFocusChange: (focused: boolean) => void;
}

export const MixedPracticeView: React.FC<MixedPracticeViewProps> = ({ onFocusChange }) => {
  const { profile, completedModuleIds, recordExerciseResult, setActiveView } = useApp();
  const pathId: CareerPathId = (profile?.careerPathId as CareerPathId) || 'inventory';
  const careerPath = getCareerPath(pathId);

  const completedInPath = careerPath.modules.filter((m) => completedModuleIds.has(m.id));
  const isFullyUnlocked = completedInPath.length >= 1;

  // Config State
  const [difficulty, setDifficulty] = useState<DifficultyLevel | 'All'>('All');
  const [evalMode, setEvalMode] = useState<'instant' | 'end'>('instant');
  const [timerMinutes, setTimerMinutes] = useState<number>(0); // 0 = untimed

  // Active Test State
  const [questions, setQuestions] = useState<ExerciseItem[] | null>(null);
  const [workbooks, setWorkbooks] = useState<WorkbookData[]>([]);
  const [results, setResults] = useState<(EvaluationResult | null)[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    onFocusChange(Boolean(questions && !finished));
    return () => onFocusChange(false);
  }, [questions, finished, onFocusChange]);

  // Countdown Timer
  useEffect(() => {
    if (!questions || finished || secondsLeft === null) return;
    if (secondsLeft <= 0) {
      void finishEntireTest();
      return;
    }
    const id = window.setInterval(() => {
      setSecondsLeft((s) => (s !== null ? Math.max(0, s - 1) : null));
    }, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions, finished, secondsLeft]);

  const startTest = () => {
    const picked = generateMixedPracticeQuestions(pathId, completedModuleIds, difficulty, 5);
    setQuestions(picked);
    setWorkbooks(picked.map((q) => cloneWorkbook(q.workbook)));
    setResults(picked.map(() => null));
    setCurrentIdx(0);
    setFinished(false);
    setSecondsLeft(timerMinutes > 0 ? timerMinutes * 60 : null);
    startTimeRef.current = Date.now();
  };

  const evaluateSingle = async (idx: number) => {
    if (!questions) return;
    const ex = questions[idx];
    const res = evaluateChecks(workbooks[idx], ex.checks, ex.points);
    setResults((prev) => {
      const next = [...prev];
      next[idx] = res;
      return next;
    });
    const elapsed = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));
    await recordExerciseResult({
      exerciseId: ex.id,
      exerciseTitle: `Mixed Practice: ${ex.title}`,
      moduleId: ex.moduleId,
      careerPathId: pathId,
      mode: 'mixed',
      topic: ex.topic,
      score: res.score,
      maxScore: res.maxScore,
      accuracy: res.accuracy,
      passed: res.passed,
      timeSpentSeconds: elapsed,
    });
  };

  const finishEntireTest = async () => {
    if (!questions) return;
    const finalResults = questions.map((ex, idx) =>
      results[idx] ?? evaluateChecks(workbooks[idx], ex.checks, ex.points)
    );
    setResults(finalResults);
    setFinished(true);

    // Log any unlogged questions to Firestore
    const elapsedPerQ = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000 / questions.length));
    for (let i = 0; i < questions.length; i++) {
      if (!results[i]) {
        const ex = questions[i];
        const res = finalResults[i];
        await recordExerciseResult({
          exerciseId: ex.id,
          exerciseTitle: `Mixed Practice: ${ex.title}`,
          moduleId: ex.moduleId,
          careerPathId: pathId,
          mode: 'mixed',
          topic: ex.topic,
          score: res.score,
          maxScore: res.maxScore,
          accuracy: res.accuracy,
          passed: res.passed,
          timeSpentSeconds: elapsedPerQ,
        });
      }
    }
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Summary / Review Screen after Mixed Practice completes
  if (questions && finished) {
    const totalScore = results.reduce((s, r) => s + (r?.score || 0), 0);
    const totalMax = results.reduce((s, r) => s + (r?.maxScore || 0), 0);
    const overallAcc = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;

    // Topic-wise breakdown
    const topicMap = new Map<string, { score: number; max: number }>();
    questions.forEach((q, i) => {
      const r = results[i];
      const cur = topicMap.get(q.topic) || { score: 0, max: 0 };
      cur.score += r?.score || 0;
      cur.max += r?.maxScore || q.points;
      topicMap.set(q.topic, cur);
    });

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-blue-700 mb-1">Mixed Practice Complete</p>
            <h2 className="text-2xl font-bold text-slate-900">Your Assessment Summary</h2>
            <p className="text-sm text-slate-600 mt-1">
              Score: <strong className="font-mono text-slate-900">{totalScore} / {totalMax}</strong> · Accuracy:{' '}
              <strong className="font-mono text-slate-900">{overallAcc}%</strong>
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={startTest}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span>New Randomized Set</span>
            </button>
            <button
              type="button"
              onClick={() => setQuestions(null)}
              className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg"
            >
              Back to Setup
            </button>
          </div>
        </div>

        {/* Topic-wise Performance */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h3 className="text-base font-bold text-slate-900 mb-3">Topic-Wise Performance</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array.from(topicMap.entries()).map(([topic, data]) => {
              const pct = data.max > 0 ? Math.round((data.score / data.max) * 100) : 0;
              return (
                <div key={topic} className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-slate-800">{topic}</span>
                    <span className="font-mono font-bold text-slate-900 tabular-nums">{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${pct >= 80 ? 'bg-emerald-600' : 'bg-amber-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Question-by-Question Review */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h3 className="text-base font-bold text-slate-900">Detailed Answer Review</h3>
          {questions.map((q, idx) => {
            const res = results[idx];
            return (
              <div
                key={q.id}
                className={`p-4 rounded-lg border ${
                  res?.passed ? 'bg-emerald-50/50 border-emerald-200' : 'bg-rose-50/50 border-rose-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h4 className="text-sm font-bold text-slate-900">
                    Q{idx + 1}. {q.title}
                  </h4>
                  <span className="text-xs font-mono font-semibold tabular-nums">
                    {res?.passed ? 'Passed' : 'Incorrect'} · {res?.accuracy || 0}%
                  </span>
                </div>
                <p className="text-xs text-slate-600 mb-2">{q.explanation}</p>
                <p className="text-xs font-mono text-blue-700 font-semibold">
                  Reference Solution: {q.sampleSolution}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Active Mixed Practice Session (Focus Mode)
  if (questions) {
    const q = questions[currentIdx];
    const currentRes = results[currentIdx];

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setQuestions(null)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Exit Test</span>
            </button>
            <span className="text-xs font-semibold text-slate-700">
              Mixed Practice · Question {currentIdx + 1} of {questions.length}
            </span>
          </div>

          <div className="flex items-center gap-4">
            {secondsLeft !== null && (
              <span className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-slate-800 tabular-nums">
                <Clock className="w-4 h-4 text-blue-600" />
                {formatTimer(secondsLeft)}
              </span>
            )}
            <button
              type="button"
              onClick={() => void finishEntireTest()}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg"
            >
              Submit &amp; Grade Test
            </button>
          </div>
        </header>

        <div className="flex-1 flex flex-col lg:flex-row">
          <aside className="w-full lg:w-88 shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 p-5 space-y-4">
            <div>
              <p className="text-xs text-slate-500 mb-1">
                No formula hints · {q.difficulty} · {q.points} pts
              </p>
              <h2 className="text-base font-bold text-slate-900">{q.title}</h2>
              <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{q.objective}</p>
            </div>

            <ol className="space-y-2 text-xs text-slate-700">
              {q.instructions.map((step, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="font-mono font-bold text-slate-400">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>

            {evalMode === 'instant' && currentRes && (
              <div
                className={`p-3.5 rounded-lg border text-xs space-y-1.5 ${
                  currentRes.passed
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                <p className="font-bold flex items-center gap-1.5">
                  {currentRes.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                  )}
                  <span>
                    {currentRes.passed ? 'Correct!' : 'Incorrect'} ({currentRes.accuracy}%)
                  </span>
                </p>
                {currentRes.checkResults.map((c) => (
                  <p key={c.id}>
                    {c.passed ? '✓' : '×'} {c.message}
                  </p>
                ))}
              </div>
            )}
          </aside>

          <div className="flex-1 p-4 sm:p-5 flex flex-col gap-4 min-w-0">
            <ExcelSpreadsheet
              workbook={workbooks[currentIdx]}
              onChange={(nextWb) => {
                setWorkbooks((prev) => {
                  const copy = [...prev];
                  copy[currentIdx] = nextWb;
                  return copy;
                });
              }}
              highlightCells={q.targetCells}
            />

            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
              <div>
                {evalMode === 'instant' && (
                  <button
                    type="button"
                    onClick={() => void evaluateSingle(currentIdx)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg"
                  >
                    Check Question {currentIdx + 1}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {currentIdx > 0 && (
                  <button
                    type="button"
                    onClick={() => setCurrentIdx(currentIdx - 1)}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg"
                  >
                    Previous
                  </button>
                )}
                {currentIdx < questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentIdx(currentIdx + 1)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg"
                  >
                    <span>Next Question</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void finishEntireTest()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg"
                  >
                    <span>Finish &amp; View Results</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Configuration Screen
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-semibold text-blue-700 mb-1">{careerPath.title} Assessment</p>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Mixed Practice Mode</h2>
        <p className="text-sm text-slate-600 mt-1 leading-relaxed">
          Test your real Excel recall without formula hints. Every session generates fresh datasets
          drawn randomly from your completed modules.
        </p>
      </div>

      {!isFullyUnlocked && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-950">
                Complete Module 1 to unlock full multi-module Mixed Practice
              </p>
              <p className="text-xs text-amber-900 mt-0.5">
                You currently have 0 completed modules in {careerPath.title}. You can still run a
                Starter Warmup Drill from Module 1 below, or complete modules to expand the question pool.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveView('my-learning')}
            className="px-3 py-1.5 bg-white border border-amber-300 text-amber-900 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0"
          >
            Go to Modules
          </button>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-2">Difficulty Level</label>
            <div className="grid grid-cols-2 gap-1.5">
              {(['All', 'Easy', 'Medium', 'Hard'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDifficulty(d)}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-colors ${
                    difficulty === d
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-2">Evaluation Style</label>
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => setEvalMode('instant')}
                className={`w-full text-left py-2 px-3 rounded-lg text-xs font-semibold border transition-colors ${
                  evalMode === 'instant'
                    ? 'bg-blue-50 text-blue-800 border-blue-600'
                    : 'bg-white text-slate-700 border-slate-200'
                }`}
              >
                Instant Check per Question
              </button>
              <button
                type="button"
                onClick={() => setEvalMode('end')}
                className={`w-full text-left py-2 px-3 rounded-lg text-xs font-semibold border transition-colors ${
                  evalMode === 'end'
                    ? 'bg-blue-50 text-blue-800 border-blue-600'
                    : 'bg-white text-slate-700 border-slate-200'
                }`}
              >
                End-of-Test Grading (Exam Style)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-2">Optional Time Limit</label>
            <select
              value={timerMinutes}
              onChange={(e) => setTimerMinutes(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg text-slate-800"
            >
              <option value={0}>No Time Limit</option>
              <option value={5}>5 Minutes</option>
              <option value={10}>10 Minutes</option>
              <option value={15}>15 Minutes</option>
            </select>
            <p className="text-[11px] text-slate-500 mt-1.5">
              Source pool: {completedInPath.length > 0 ? `${completedInPath.length} completed module(s)` : 'Module 1 starter pool'}
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-500">5 randomized live spreadsheet questions · Zero formula spoilers</span>
          <button
            type="button"
            onClick={startTest}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <Shuffle className="w-4 h-4" />
            <span>Start Mixed Practice</span>
          </button>
        </div>
      </div>
    </div>
  );
};
