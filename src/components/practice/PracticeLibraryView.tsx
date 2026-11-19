import React, { useMemo, useState } from 'react';
import { CheckCircle2, Play, Search } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { getAllExercisesForPath, getCareerPath } from '../../data/curriculum';
import { makeWorkbook } from '../../data/curriculum/builder';
import type { CareerPathId, DifficultyLevel, ExerciseItem, ExerciseKind } from '../../types';

interface PracticeLibraryViewProps {
  onLaunchExercise: (exercises: ExerciseItem[], index: number, title: string) => void;
}

const KIND_LABELS: Record<ExerciseKind | 'all', string> = {
  all: 'All Types',
  formula: 'Write Formula',
  'drag-fill': 'Drag & Fill',
  lookup: 'Lookup Functions',
  report: 'Workplace Reports',
  formatting: 'Formatting',
  sort: 'Sorting',
  filter: 'Filtering',
  'find-error': 'Find & Fix Errors',
  totals: 'Totals',
  'fill-cells': 'Data Entry',
};

export const PracticeLibraryView: React.FC<PracticeLibraryViewProps> = ({ onLaunchExercise }) => {
  const { profile, completedExerciseIds, customContent } = useApp();
  const pathId: CareerPathId = (profile?.careerPathId as CareerPathId) || 'inventory';
  const careerPath = getCareerPath(pathId);

  const [kindFilter, setKindFilter] = useState<ExerciseKind | 'all'>('all');
  const [diffFilter, setDiffFilter] = useState<DifficultyLevel | 'All'>('All');
  const [search, setSearch] = useState('');

  // Merge built-in career path exercises + admin-published custom exercises
  const allExercises = useMemo(() => {
    const builtIn = getAllExercisesForPath(pathId);
    const customExercises: ExerciseItem[] = customContent
      .filter((c) => c.contentType === 'exercise' && c.published && c.careerPathId === pathId)
      .map((c, idx) => {
        const parsedRows = (c.datasetRows && c.datasetRows.length > 0
          ? c.datasetRows
          : ['Item,Quantity,Unit Price', 'Product A,12,500', 'Product B,8,750', 'Total,,']
        ).map((line) =>
          line.split(',').map((cell) => {
            const t = cell.trim();
            return t !== '' && !isNaN(Number(t)) ? Number(t) : t;
          })
        );
        const expectedNum =
          c.expectedValue !== '' && !isNaN(Number(c.expectedValue))
            ? Number(c.expectedValue)
            : c.expectedValue;

        return {
          id: c.id,
          moduleId: c.moduleId || 'custom',
          careerPathId: pathId,
          stageNumber: 2,
          order: idx + 1,
          title: c.title,
          topic: 'Custom Admin Exercise',
          kind: 'formula',
          difficulty: c.difficulty,
          objective: c.summary || 'Complete the custom workplace spreadsheet task.',
          instructions: [
            c.summary || 'Solve the spreadsheet task in the highlighted target cell.',
            c.targetCell ? `Enter your formula in cell ${c.targetCell}.` : 'Use live Excel formulas.',
          ],
          targetCells: c.targetCell ? [c.targetCell.toUpperCase()] : [],
          workbook: makeWorkbook(parsedRows, { sheetName: 'Practice' }),
          checks: [
            {
              id: `${c.id}_chk`,
              description: `Evaluate ${c.targetCell || 'B4'}`,
              type: c.expectedFormula ? 'formula-value' : 'value',
              cell: (c.targetCell || 'B4').toUpperCase(),
              expectedValue: expectedNum,
              mustBeFormula: Boolean(c.expectedFormula),
            },
          ],
          hints: c.hint ? [c.hint] : ['Double-check your formula syntax and cell references.'],
          explanation: c.explanation || 'Custom exercise authored by your Academy instructor.',
          sampleSolution: c.expectedFormula || String(c.expectedValue),
          points: c.difficulty === 'Hard' ? 40 : c.difficulty === 'Medium' ? 30 : 20,
        };
      });

    return [...customExercises, ...builtIn];
  }, [pathId, customContent]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allExercises.filter((ex) => {
      if (kindFilter !== 'all' && ex.kind !== kindFilter) return false;
      if (diffFilter !== 'All' && ex.difficulty !== diffFilter) return false;
      if (q && !ex.title.toLowerCase().includes(q) && !ex.topic.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [allExercises, kindFilter, diffFilter, search]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold text-blue-700 mb-1">{careerPath.title} Practice Bank</p>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Hands-On Spreadsheet Practice</h2>
        <p className="text-sm text-slate-600 mt-1">
          Jump straight into any real spreadsheet exercise by skill type or difficulty level.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by formula, skill, or title (e.g. VLOOKUP, SUMIF, PMT)..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
          />
        </div>

        <select
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value as ExerciseKind | 'all')}
          className="px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700"
        >
          {Object.entries(KIND_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
          {(['All', 'Easy', 'Medium', 'Hard'] as const).map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setDiffFilter(lvl)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                diffFilter === lvl
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Exercise Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Exercise</th>
                <th className="py-3 px-4">Topic</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Difficulty</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filtered.slice(0, 40).map((ex, idx) => {
                const done = completedExerciseIds.has(ex.id);
                return (
                  <tr key={ex.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-900">{ex.title}</td>
                    <td className="py-3 px-4 text-xs text-slate-600">{ex.topic}</td>
                    <td className="py-3 px-4 text-xs text-slate-500">{KIND_LABELS[ex.kind]}</td>
                    <td className="py-3 px-4 text-xs font-medium text-slate-700">{ex.difficulty}</td>
                    <td className="py-3 px-4 text-xs">
                      {done ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Passed
                        </span>
                      ) : (
                        <span className="text-slate-400">Not attempted</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => onLaunchExercise(filtered, idx, `${careerPath.shortTitle} Practice`)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md transition-colors whitespace-nowrap"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>{done ? 'Practise Again' : 'Start'}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="p-8 text-center text-sm text-slate-500">
            No exercises matched your filter. Try clearing your search or selecting "All".
          </div>
        )}
      </div>
    </div>
  );
};
