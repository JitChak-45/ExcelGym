import type {
  CareerPath,
  CareerPathId,
  ConceptItem,
  CurriculumModule,
  DifficultyLevel,
  ExerciseItem,
  WorkbookData,
} from '../../types';
import { CAREER_PATHS } from './pathsData';
import { cloneWorkbook } from '../../engine/formulaEngine';

export { CAREER_PATHS };

export function getCareerPath(id: CareerPathId | '' | undefined): CareerPath {
  return CAREER_PATHS.find((p) => p.id === id) || CAREER_PATHS[0];
}

export function getAllConceptsForPath(pathId: CareerPathId): ConceptItem[] {
  const path = getCareerPath(pathId);
  return path.modules.flatMap((m) => [
    ...(m.stages[0].concepts || []),
    ...(m.stages[2].concepts || []),
  ]);
}

export function getAllExercisesForPath(pathId: CareerPathId): ExerciseItem[] {
  const path = getCareerPath(pathId);
  return path.modules.flatMap((m) => [
    ...(m.stages[1].exercises || []),
    ...(m.stages[3].exercises || []),
  ]);
}

export function getModuleById(moduleId: string): CurriculumModule | undefined {
  for (const p of CAREER_PATHS) {
    const found = p.modules.find((m) => m.id === moduleId);
    if (found) return found;
  }
  return undefined;
}

export function getStageId(moduleId: string, stageNumber: 1 | 2 | 3 | 4): string {
  return `${moduleId}_stage_${stageNumber}`;
}

export function getLearnerLevel(xp: number): {
  title: 'Beginner' | 'Intermediate' | 'Advanced';
  minXp: number;
  nextXp: number;
  progressPct: number;
} {
  if (xp < 500) {
    return { title: 'Beginner', minXp: 0, nextXp: 500, progressPct: Math.min(100, Math.round((xp / 500) * 100)) };
  }
  if (xp < 1800) {
    return {
      title: 'Intermediate',
      minXp: 500,
      nextXp: 1800,
      progressPct: Math.min(100, Math.round(((xp - 500) / 1300) * 100)),
    };
  }
  return { title: 'Advanced', minXp: 1800, nextXp: 3500, progressPct: Math.min(100, Math.round(((xp - 1800) / 1700) * 100)) };
}

export interface AchievementBadge {
  id: string;
  title: string;
  description: string;
  criteria: string;
  isEarned: (stats: {
    conceptsCompleted: number;
    exercisesCompleted: number;
    modulesCompleted: number;
    simulationsCompleted: number;
    streakDays: number;
    avgAccuracy: number;
    xp: number;
  }) => boolean;
}

export const ACHIEVEMENT_BADGES: AchievementBadge[] = [
  {
    id: 'first_concept',
    title: 'First Step in Excel',
    description: 'Completed your very first interactive Excel concept.',
    criteria: 'Complete 1 concept',
    isEarned: (s) => s.conceptsCompleted >= 1,
  },
  {
    id: 'formula_starter',
    title: 'Formula Builder',
    description: 'Successfully passed 5 live spreadsheet practice exercises.',
    criteria: 'Complete 5 exercises',
    isEarned: (s) => s.exercisesCompleted >= 5,
  },
  {
    id: 'module_graduate',
    title: 'Module Finisher',
    description: 'Completed all 4 stages (20 learning items) of a career module.',
    criteria: 'Complete 1 full module',
    isEarned: (s) => s.modulesCompleted >= 1,
  },
  {
    id: 'precision_analyst',
    title: 'Precision Analyst',
    description: 'Maintained 85% or higher accuracy across at least 10 attempts.',
    criteria: '85%+ average accuracy (10+ exercises)',
    isEarned: (s) => s.exercisesCompleted >= 10 && s.avgAccuracy >= 85,
  },
  {
    id: 'workplace_solver',
    title: 'Workplace Problem Solver',
    description: 'Solved a complete Real-World Workplace Simulation without hints.',
    criteria: 'Complete 1 Workplace Simulation',
    isEarned: (s) => s.simulationsCompleted >= 1,
  },
  {
    id: 'streak_3',
    title: 'Consistent Learner',
    description: 'Built a 3-day consecutive Excel practice streak.',
    criteria: '3-day learning streak',
    isEarned: (s) => s.streakDays >= 3,
  },
  {
    id: 'career_specialist',
    title: 'Career Track Specialist',
    description: 'Completed 3 full modules in your chosen career path.',
    criteria: 'Complete 3 modules',
    isEarned: (s) => s.modulesCompleted >= 3,
  },
  {
    id: 'job_ready_pro',
    title: 'Job Ready Professional',
    description: 'Earned 1,800+ XP and reached Advanced career readiness.',
    criteria: 'Reach 1,800 XP',
    isEarned: (s) => s.xp >= 1800,
  },
];

/**
 * Generates fresh randomized Mixed Practice questions with newly generated datasets
 * so learners practise concepts repeatedly without seeing identical numbers.
 */
export function generateMixedPracticeQuestions(
  pathId: CareerPathId,
  completedModuleIds: Set<string>,
  difficulty: DifficultyLevel | 'All',
  count = 5
): ExerciseItem[] {
  const path = getCareerPath(pathId);
  const poolModules = path.modules.filter((m) => completedModuleIds.has(m.id));
  // If learner hasn't finished any module yet, allow sampling Module 1 if unlocked via preview
  const sourceModules = poolModules.length > 0 ? poolModules : [path.modules[0]];

  const candidates: ExerciseItem[] = [];
  for (const mod of sourceModules) {
    const allEx = [...(mod.stages[1].exercises || []), ...(mod.stages[3].exercises || [])];
    for (const ex of allEx) {
      if (difficulty === 'All' || ex.difficulty === difficulty) {
        candidates.push(ex);
      }
    }
  }

  // Fallback if chosen difficulty had too few items in completed modules
  const finalPool =
    candidates.length >= 2
      ? candidates
      : sourceModules.flatMap((m) => [...(m.stages[1].exercises || []), ...(m.stages[3].exercises || [])]);

  // Shuffle deterministically-random
  const shuffled = [...finalPool].sort(() => Math.random() - 0.5).slice(0, count);

  // Add fresh randomized variants for arithmetic/SUM/AVERAGE/MAX/IF exercises so datasets vary every run
  return shuffled.map((ex, idx) => createRandomizedVariant(ex, idx));
}

function createRandomizedVariant(ex: ExerciseItem, seedIdx: number): ExerciseItem {
  const clonedWb: WorkbookData = cloneWorkbook(ex.workbook);
  // Strip explicit function names from instructions in Mixed Practice ("No indication of which function is required")
  const neutralInstructions = ex.instructions.map((line) =>
    line
      .replace(/using\s+=[A-Z]+\([^)]*\)/gi, 'using an appropriate Excel formula')
      .replace(/=[A-Z0-9_]+\([^)]*\)/gi, 'the required Excel formula')
      .replace(/\b(SUMIFS|COUNTIFS|SUMIF|COUNTIF|VLOOKUP|XLOOKUP|AVERAGE|SUMPRODUCT|IFERROR|CONCAT|TRIM|LEFT|RIGHT|LEN|ROUND|PMT|SUM|MIN|MAX|IF|AND|OR)\b/g, 'the right function')
  );

  // For pure SUM / AVERAGE / MAX / MIN single-column checks on Sheet1 C2:C6, vary numeric values cleanly & recompute check!
  const sheet = clonedWb.sheets[0];
  const isSingleC2C6Check =
    ex.checks.length === 1 &&
    ex.checks[0].type === 'formula-value' &&
    ex.checks[0].cell === 'C7' &&
    ['SUM', 'AVERAGE', 'MAX', 'MIN'].includes(ex.checks[0].requiredFunctions?.[0] || '') &&
    sheet.cells['C2'] &&
    sheet.cells['C6'] &&
    !sheet.cells['C2'].raw.startsWith('=');

  if (isSingleC2C6Check) {
    const newNums: number[] = [];
    for (let r = 2; r <= 6; r++) {
      const orig = Number(sheet.cells[`C${r}`]?.raw || 10);
      const jitter = Math.floor(Math.random() * 15) + 3 + seedIdx;
      const updated = Math.max(5, orig + (Math.random() > 0.5 ? jitter : -Math.min(jitter, Math.floor(orig / 2))));
      sheet.cells[`C${r}`] = { ...sheet.cells[`C${r}`], raw: String(updated) };
      newNums.push(updated);
    }
    const fn = ex.checks[0].requiredFunctions![0];
    const newExpected =
      fn === 'SUM'
        ? newNums.reduce((a, b) => a + b, 0)
        : fn === 'AVERAGE'
        ? Math.round((newNums.reduce((a, b) => a + b, 0) / newNums.length) * 100) / 100
        : fn === 'MAX'
        ? Math.max(...newNums)
        : Math.min(...newNums);

    return {
      ...ex,
      id: `${ex.id}_mix_${Date.now()}_${seedIdx}`,
      instructions: neutralInstructions,
      workbook: clonedWb,
      checks: [{ ...ex.checks[0], expectedValue: newExpected }],
    };
  }

  return {
    ...ex,
    id: `${ex.id}_mix_${Date.now()}_${seedIdx}`,
    instructions: neutralInstructions,
    workbook: clonedWb,
  };
}
