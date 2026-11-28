import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  HelpCircle,
  Lightbulb,
} from 'lucide-react';
import type { ConceptItem, CurriculumModule, WorkbookData } from '../../types';
import { ExcelSpreadsheet } from '../spreadsheet/ExcelSpreadsheet';
import { cloneWorkbook } from '../../engine/formulaEngine';
import { evaluateChecks } from '../../engine/evaluator';
import { useApp } from '../../contexts/AppContext';
import { playCelebration, playError, playHint, playSuccess } from '../../utils/soundEffects';

interface ConceptLessonViewProps {
  module: CurriculumModule;
  stageNumber: 1 | 3;
  concepts: ConceptItem[];
  initialIndex: number;
  onExit: () => void;
  onProceedToPractice: (nextStage: 2 | 4) => void;
}

export const ConceptLessonView: React.FC<ConceptLessonViewProps> = ({
  module,
  stageNumber,
  concepts,
  initialIndex,
  onExit,
  onProceedToPractice,
}) => {
  const { completedConceptIds, recordConceptCompleted } = useApp();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const concept = concepts[currentIndex];

  const [workbook, setWorkbook] = useState<WorkbookData>(() => cloneWorkbook(concept.tryItWorkbook));
  const [showHint, setShowHint] = useState(false);
  const [checkFeedback, setCheckFeedback] = useState<{ passed: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setWorkbook(cloneWorkbook(concept.tryItWorkbook));
    setShowHint(false);
    setCheckFeedback(null);
  }, [concept]);

  const isCompleted = completedConceptIds.has(concept.id);

  const handleCheckTryIt = async () => {
    const res = evaluateChecks(workbook, [concept.tryItCheck], 100);
    const first = res.checkResults[0];
    if (res.passed) {
      playSuccess();
    } else {
      playError();
    }
    setCheckFeedback({
      passed: res.passed,
      message: first?.message || (res.passed ? 'Correct!' : 'Not quite right yet. Try again!'),
    });
    if (res.passed) {
      setSaving(true);
      try {
        await recordConceptCompleted({
          conceptId: concept.id,
          moduleId: module.id,
          careerPathId: module.careerPathId,
          stageNumber,
          topic: concept.topic,
        });
      } finally {
        setSaving(false);
      }
    }
  };

  const handleMarkCompleteAndNext = async () => {
    setSaving(true);
    try {
      await recordConceptCompleted({
        conceptId: concept.id,
        moduleId: module.id,
        careerPathId: module.careerPathId,
        stageNumber,
        topic: concept.topic,
      });
      if (currentIndex < concepts.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        playCelebration();
        onProceedToPractice((stageNumber + 1) as 2 | 4);
      }
    } finally {
      setSaving(false);
    }
  };

  const targetCells = concept.tryItCheck.cell ? [concept.tryItCheck.cell] : [];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Focused Distraction-Free Lesson Header */}
      <header className="h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onExit}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Exit Lesson</span>
          </button>
          <span className="text-xs text-slate-500 truncate hidden sm:inline">
            Module {module.order}: {module.title} · Stage {stageNumber}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {concepts.map((c, idx) => {
            const done = completedConceptIds.has(c.id);
            const active = idx === currentIndex;
            return (
              <button
                key={c.id}
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

      {/* Main Two-Column Lesson & Live Sandbox */}
      <div className="flex-1 max-w-[1380px] w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Bite-Sized Concept Explanation */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div>
            <p className="text-xs font-semibold text-blue-700 mb-1">
              Concept {currentIndex + 1} of {concepts.length} · {concept.topic}
            </p>
            <h1 className="text-xl font-bold text-slate-900 leading-snug">{concept.title}</h1>
          </div>

          <div className="space-y-4 text-sm text-slate-700 leading-relaxed">
            <div>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide mb-1">
                1. What It Is
              </h2>
              <p>{concept.explanation}</p>
            </div>

            <div>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide mb-1">
                2. Why It Is Useful
              </h2>
              <p>{concept.whyUseful}</p>
            </div>

            {concept.syntax && (
              <div className="bg-slate-900 text-slate-50 rounded-lg p-3.5">
                <p className="text-[11px] text-slate-400 mb-1">Excel Formula Syntax</p>
                <code className="text-sm font-mono text-blue-300 break-all">{concept.syntax}</code>
              </div>
            )}

            <div>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide mb-1">
                3. Practical Example
              </h2>
              <p>{concept.practicalExample}</p>
            </div>

            <div className="p-3.5 bg-blue-50/70 border border-blue-100 rounded-lg flex items-start gap-2.5">
              <Briefcase className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-slate-900 mb-0.5">Where Used in a Job</p>
                <p className="text-xs text-slate-700 leading-relaxed">{concept.whereUsedInJob}</p>
              </div>
            </div>

            <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-lg">
              <p className="text-xs font-bold text-amber-900 flex items-center gap-1.5 mb-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Common Beginner Mistakes</span>
              </p>
              <ul className="space-y-1 text-xs text-amber-950/90">
                {concept.commonMistakes.map((m) => (
                  <li key={m} className="flex items-start gap-2">
                    <span>·</span>
                    <span>{m}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Right: Interactive Try It Yourself Spreadsheet */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Lightbulb className="w-4 h-4 text-blue-600" />
                  <span>Try It Yourself</span>
                </h2>
                <p className="text-sm text-slate-700 mt-1">{concept.tryItPrompt}</p>
              </div>
              {isCompleted && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                  Completed
                </span>
              )}
            </div>

            <ExcelSpreadsheet
              workbook={workbook}
              onChange={setWorkbook}
              highlightCells={targetCells}
              compact
              onReset={() => {
                setWorkbook(cloneWorkbook(concept.tryItWorkbook));
                setCheckFeedback(null);
              }}
            />

            {/* Feedback & Hint */}
            {showHint && (
              <div className="mt-3 p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-900">
                <strong>Hint:</strong> {concept.tryItHint}
              </div>
            )}

            {checkFeedback && (
              <div
                className={`mt-3 p-3 rounded-lg border text-xs flex items-start gap-2 ${
                  checkFeedback.passed
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                {checkFeedback.passed ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                )}
                <span>{checkFeedback.message}</span>
              </div>
            )}

            {/* Action Bar */}
            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-sound="none"
                  onClick={handleCheckTryIt}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  Check My Answer
                </button>
                <button
                  type="button"
                  data-sound="none"
                  onClick={() => {
                    if (!showHint) playHint();
                    setShowHint((h) => !h);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg transition-colors"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>{showHint ? 'Hide Hint' : 'Show Hint'}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                {currentIndex > 0 && (
                  <button
                    type="button"
                    onClick={() => setCurrentIndex(currentIndex - 1)}
                    className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
                  >
                    Previous
                  </button>
                )}
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleMarkCompleteAndNext}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  <span>
                    {currentIndex < concepts.length - 1
                      ? 'Complete & Next Concept'
                      : `Complete Stage ${stageNumber} & Start Practice`}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
