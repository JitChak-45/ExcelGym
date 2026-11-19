export type CareerPathId = 'inventory' | 'store' | 'banking' | 'mis';

export type NavView =
  | 'dashboard'
  | 'my-learning'
  | 'career-paths'
  | 'practice'
  | 'mixed-practice'
  | 'simulations'
  | 'achievements'
  | 'progress'
  | 'profile'
  | 'admin';

export type NumberFormatType = 'general' | 'number' | 'currency' | 'percent';

export interface CellStyle {
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  bgColor?: string;
  textColor?: string;
  numberFormat?: NumberFormatType;
}

export interface CellData {
  raw: string; // User-entered value or formula (e.g. "=SUM(B2:B6)" or "1500")
  style?: CellStyle;
}

export interface SheetFilter {
  headerRow: number; // 0-indexed row where filter buttons appear
  columnFilters: Record<number, string[]>; // colIndex -> allowed display strings (empty/absent = show all)
}

export interface SheetData {
  id: string;
  name: string;
  rows: number;
  cols: number;
  cells: Record<string, CellData>; // Key: "A1", "B2"
  colWidths?: Record<number, number>;
  rowHeights?: Record<number, number>;
  freezeRows?: number;
  freezeCols?: number;
  filter?: SheetFilter | null;
}

export interface WorkbookData {
  sheets: SheetData[];
  activeSheetIndex: number;
}

export interface EvaluatedCell {
  raw: string;
  value: string | number | boolean | null;
  display: string;
  error?: string;
  errorHelp?: string;
  style?: CellStyle;
}

export type ExerciseKind =
  | 'formula'
  | 'fill-cells'
  | 'drag-fill'
  | 'formatting'
  | 'sort'
  | 'filter'
  | 'find-error'
  | 'totals'
  | 'lookup'
  | 'report';

export type DifficultyLevel = 'Easy' | 'Medium' | 'Hard';

export interface ExerciseCheck {
  id: string;
  description: string;
  sheetIndex?: number;
  type:
    | 'value'
    | 'formula-value'
    | 'cell-style'
    | 'sort-order'
    | 'filter-active';
  cell?: string; // e.g. "B7"
  expectedValue?: string | number;
  tolerance?: number; // Numeric tolerance, default 0.05
  requiredFunctions?: string[]; // e.g. ["SUM"] — checks formula contains function
  mustBeFormula?: boolean; // Rejects hardcoded numbers when true
  // For style check:
  expectedStyle?: Partial<CellStyle>;
  // For sort check:
  sortColumn?: number; // 0-indexed col
  sortStartRow?: number; // 1-indexed Excel row
  sortEndRow?: number; // 1-indexed Excel row
  sortDirection?: 'asc' | 'desc';
  // For filter check:
  filterColumn?: number;
  expectedFilterValues?: string[];
}

export interface ConceptItem {
  id: string;
  moduleId: string;
  stageNumber: 1 | 3;
  order: number;
  title: string;
  topic: string;
  explanation: string;
  whyUseful: string;
  whereUsedInJob: string;
  syntax?: string;
  practicalExample: string;
  commonMistakes: string[];
  tryItPrompt: string;
  tryItWorkbook: WorkbookData;
  tryItCheck: ExerciseCheck;
  tryItHint: string;
}

export interface ExerciseItem {
  id: string;
  moduleId: string;
  careerPathId: CareerPathId;
  stageNumber: 2 | 4;
  order: number;
  title: string;
  topic: string;
  kind: ExerciseKind;
  difficulty: DifficultyLevel;
  objective: string;
  instructions: string[];
  targetCells: string[]; // Highlighted in guided mode
  workbook: WorkbookData;
  checks: ExerciseCheck[];
  hints: string[];
  explanation: string;
  sampleSolution: string;
  points: number;
  randomizable?: {
    numericCells: string[];
    min: number;
    max: number;
    step?: number;
    recomputeChecks?: (wb: WorkbookData) => ExerciseCheck[];
  };
}

export interface ModuleStage {
  stageNumber: 1 | 2 | 3 | 4;
  title: string;
  kind: 'concepts' | 'practice';
  concepts?: ConceptItem[];
  exercises?: ExerciseItem[];
}

export interface CurriculumModule {
  id: string;
  careerPathId: CareerPathId;
  order: number;
  title: string;
  description: string;
  estimatedMinutes: number;
  stages: [ModuleStage, ModuleStage, ModuleStage, ModuleStage];
}

export interface CareerPath {
  id: CareerPathId;
  title: string;
  shortTitle: string;
  subtitle: string;
  description: string;
  coverImage: string;
  jobRoles: string[];
  practicalSkills: string[];
  modules: CurriculumModule[];
}

export interface WorkplaceSimulation {
  id: string;
  roleTitle: string;
  careerPathId: CareerPathId;
  companyName: string;
  location: string;
  difficulty: DifficultyLevel;
  estimatedMinutes: number;
  brief: string;
  managerNote: string;
  tasks: string[];
  workbook: WorkbookData;
  checks: ExerciseCheck[];
  solutionGuide: string[];
  maxScore: number;
}

// Firestore & Persistence Models
export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  careerPathId: CareerPathId | '';
  onboardingComplete: boolean;
  xp: number;
  streakDays: number;
  lastActiveDate: string; // YYYY-MM-DD
  weeklyGoalItems: number;
  totalLearningSeconds: number;
  totalAttempts: number;
  correctAttempts: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProgressRecord {
  id: string;
  userId: string;
  itemType: 'concept' | 'stage' | 'module' | 'simulation';
  itemId: string;
  careerPathId: string;
  moduleId: string;
  topic: string;
  score: number;
  maxScore: number;
  completedAt: string;
  updatedAt: string;
}

export interface ExerciseAttempt {
  id: string;
  userId: string;
  careerPathId: string;
  moduleId: string;
  exerciseId: string;
  exerciseTitle: string;
  mode: 'guided' | 'mixed' | 'simulation';
  topic: string;
  score: number;
  maxScore: number;
  accuracy: number;
  passed: boolean;
  timeSpentSeconds: number;
  createdAt: string;
}

export interface CertificateRecord {
  id: string;
  userId: string;
  learnerName: string;
  careerPathId: string;
  moduleId: string;
  moduleTitle: string;
  accuracy: number;
  issuedAt: string;
}

export interface CustomContentRecord {
  id: string;
  contentType: 'careerPath' | 'module' | 'concept' | 'exercise' | 'simulation';
  careerPathId: string;
  moduleId: string;
  title: string;
  summary: string;
  difficulty: DifficultyLevel;
  published: boolean;
  targetCell: string;
  expectedFormula: string;
  expectedValue: string;
  hint: string;
  explanation: string;
  datasetRows?: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface EvaluationResult {
  passed: boolean;
  score: number;
  maxScore: number;
  accuracy: number;
  checkResults: {
    id: string;
    description: string;
    passed: boolean;
    message: string;
  }[];
}
