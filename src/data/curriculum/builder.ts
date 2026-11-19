import type {
  CareerPathId,
  CellStyle,
  ConceptItem,
  CurriculumModule,
  DifficultyLevel,
  ExerciseCheck,
  ExerciseItem,
  ExerciseKind,
  WorkbookData,
} from '../../types';
import { createSheetFromRows } from '../../engine/formulaEngine';

export function makeWorkbook(
  rows: (string | number)[][],
  options?: {
    sheetName?: string;
    currencyCols?: number[];
    percentCols?: number[];
    colWidths?: Record<number, number>;
    extraSheets?: { name: string; rows: (string | number)[][]; currencyCols?: number[] }[];
    cellStyles?: Record<string, CellStyle>;
  }
): WorkbookData {
  const mainSheet = createSheetFromRows(options?.sheetName || 'Sheet1', rows, {
    currencyCols: options?.currencyCols,
    percentCols: options?.percentCols,
    colWidths: options?.colWidths,
  });
  if (options?.cellStyles) {
    for (const [k, st] of Object.entries(options.cellStyles)) {
      const existing = mainSheet.cells[k] || { raw: '' };
      mainSheet.cells[k] = {
        raw: existing.raw,
        style: { ...(existing.style || {}), ...st },
      };
    }
  }
  const sheets = [mainSheet];
  if (options?.extraSheets) {
    for (const extra of options.extraSheets) {
      sheets.push(
        createSheetFromRows(extra.name, extra.rows, {
          currencyCols: extra.currencyCols,
        })
      );
    }
  }
  return { sheets, activeSheetIndex: 0 };
}

export interface CompactConceptSpec {
  title: string;
  topic: string;
  explanation: string;
  whyUseful: string;
  whereUsedInJob: string;
  syntax?: string;
  practicalExample: string;
  commonMistakes: string[];
  tryItPrompt: string;
  rows: (string | number)[][];
  currencyCols?: number[];
  percentCols?: number[];
  check: Omit<ExerciseCheck, 'id'>;
  hint: string;
}

export interface CompactExerciseSpec {
  title: string;
  topic: string;
  kind: ExerciseKind;
  difficulty: DifficultyLevel;
  objective: string;
  instructions: string[];
  targetCells: string[];
  rows: (string | number)[][];
  sheetName?: string;
  currencyCols?: number[];
  percentCols?: number[];
  extraSheets?: { name: string; rows: (string | number)[][]; currencyCols?: number[] }[];
  checks: Omit<ExerciseCheck, 'id'>[];
  hints: string[];
  explanation: string;
  sampleSolution: string;
  points?: number;
}

export interface ModuleBlueprint {
  id: string;
  order: number;
  title: string;
  description: string;
  estimatedMinutes: number;
  stage1: CompactConceptSpec[];
  stage2: CompactExerciseSpec[];
  stage3: CompactConceptSpec[];
  stage4: CompactExerciseSpec[];
}

export function buildModule(careerPathId: CareerPathId, bp: ModuleBlueprint): CurriculumModule {
  const buildConcepts = (specs: CompactConceptSpec[], stageNumber: 1 | 3): ConceptItem[] =>
    specs.map((spec, idx) => ({
      id: `${bp.id}_s${stageNumber}_c${idx + 1}`,
      moduleId: bp.id,
      stageNumber,
      order: idx + 1,
      title: spec.title,
      topic: spec.topic,
      explanation: spec.explanation,
      whyUseful: spec.whyUseful,
      whereUsedInJob: spec.whereUsedInJob,
      syntax: spec.syntax,
      practicalExample: spec.practicalExample,
      commonMistakes: spec.commonMistakes,
      tryItPrompt: spec.tryItPrompt,
      tryItWorkbook: makeWorkbook(spec.rows, {
        currencyCols: spec.currencyCols,
        percentCols: spec.percentCols,
      }),
      tryItCheck: { id: `${bp.id}_s${stageNumber}_c${idx + 1}_chk`, ...spec.check },
      tryItHint: spec.hint,
    }));

  const buildExercises = (specs: CompactExerciseSpec[], stageNumber: 2 | 4): ExerciseItem[] =>
    specs.map((spec, idx) => ({
      id: `${bp.id}_s${stageNumber}_e${idx + 1}`,
      moduleId: bp.id,
      careerPathId,
      stageNumber,
      order: idx + 1,
      title: spec.title,
      topic: spec.topic,
      kind: spec.kind,
      difficulty: spec.difficulty,
      objective: spec.objective,
      instructions: spec.instructions,
      targetCells: spec.targetCells,
      workbook: makeWorkbook(spec.rows, {
        sheetName: spec.sheetName,
        currencyCols: spec.currencyCols,
        percentCols: spec.percentCols,
        extraSheets: spec.extraSheets,
      }),
      checks: spec.checks.map((c, cIdx) => ({
        id: `${bp.id}_s${stageNumber}_e${idx + 1}_chk${cIdx + 1}`,
        ...c,
      })),
      hints: spec.hints,
      explanation: spec.explanation,
      sampleSolution: spec.sampleSolution,
      points: spec.points ?? (spec.difficulty === 'Hard' ? 40 : spec.difficulty === 'Medium' ? 30 : 20),
    }));

  return {
    id: bp.id,
    careerPathId,
    order: bp.order,
    title: bp.title,
    description: bp.description,
    estimatedMinutes: bp.estimatedMinutes,
    stages: [
      {
        stageNumber: 1,
        title: 'Stage 1: Learn 5 Core Concepts',
        kind: 'concepts',
        concepts: buildConcepts(bp.stage1, 1),
      },
      {
        stageNumber: 2,
        title: 'Stage 2: Practise 5 Questions',
        kind: 'practice',
        exercises: buildExercises(bp.stage2, 2),
      },
      {
        stageNumber: 3,
        title: 'Stage 3: Learn 5 Applied Concepts',
        kind: 'concepts',
        concepts: buildConcepts(bp.stage3, 3),
      },
      {
        stageNumber: 4,
        title: 'Stage 4: Practise 5 Job Scenarios',
        kind: 'practice',
        exercises: buildExercises(bp.stage4, 4),
      },
    ],
  };
}
