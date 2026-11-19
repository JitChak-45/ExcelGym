import type { CellStyle, EvaluatedCell, SheetData, WorkbookData } from '../types';

export type ScalarValue = string | number | boolean | null;

export class FormulaError extends Error {
  code: string;
  help: string;
  constructor(code: string, help: string) {
    super(code);
    this.code = code;
    this.help = help;
  }
}

export function colIndexToLetter(index: number): string {
  let result = '';
  let n = index;
  while (n >= 0) {
    result = String.fromCharCode((n % 26) + 65) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}

export function colLetterToIndex(letters: string): number {
  const upper = letters.toUpperCase();
  let col = 0;
  for (let i = 0; i < upper.length; i++) {
    col = col * 26 + (upper.charCodeAt(i) - 64);
  }
  return col - 1;
}

export function cellIdFromCoords(row: number, col: number): string {
  return `${colIndexToLetter(col)}${row + 1}`;
}

export function parseCellRef(ref: string): { col: number; row: number; colAbs: boolean; rowAbs: boolean } | null {
  const match = ref.trim().match(/^(\$?)([A-Za-z]{1,3})(\$?)([1-9]\d*)$/);
  if (!match) return null;
  const colAbs = match[1] === '$';
  const col = colLetterToIndex(match[2]);
  const rowAbs = match[3] === '$';
  const row = parseInt(match[4], 10) - 1;
  return { col, row, colAbs, rowAbs };
}

/**
 * Adjusts relative cell references when copying or drag-filling formulas.
 * Respects $ absolute markers (e.g., $B$2 stays $B$2, B2 shifted by rowDelta=1 becomes B3).
 */
export function shiftFormulaReferences(formula: string, rowDelta: number, colDelta: number): string {
  if (!formula.startsWith('=')) return formula;
  // Split around quoted strings so we never rewrite text inside "..."
  const parts = formula.split(/("[^"]*")/g);
  return parts
    .map((part, idx) => {
      if (idx % 2 === 1) return part; // Inside string literal
      return part.replace(/(\$?)([A-Za-z]{1,3})(\$?)([1-9]\d*)(?!\s*\()/g, (full, colAbs, colStr, rowAbs, rowStr) => {
        const colIdx = colLetterToIndex(colStr);
        const rowIdx = parseInt(rowStr, 10) - 1;
        if (colIdx > 100 || rowIdx > 5000) return full;
        const newCol = colAbs === '$' ? colIdx : Math.max(0, colIdx + colDelta);
        const newRow = rowAbs === '$' ? rowIdx : Math.max(0, rowIdx + rowDelta);
        return `${colAbs}${colIndexToLetter(newCol)}${rowAbs}${newRow + 1}`;
      });
    })
    .join('');
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAYS_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * Generates Excel-like auto-fill values given a sequence of source cells and the target offset step.
 */
export function generateAutoFillValue(
  sourceValues: string[],
  stepIndex: number, // 0-based index past sourceValues
  rowDelta: number,
  colDelta: number
): string {
  if (sourceValues.length === 0) return '';

  // Formula drag-fill: repeat source formula cyclically with relative shifting
  const srcIdx = stepIndex % sourceValues.length;
  const srcVal = sourceValues[srcIdx];
  if (srcVal.startsWith('=')) {
    return shiftFormulaReferences(srcVal, rowDelta, colDelta);
  }

  // Numeric linear series (e.g., [1, 2] -> 3, 4, 5)
  const nums = sourceValues.map((v) => (v.trim() !== '' && !isNaN(Number(v)) ? Number(v) : NaN));
  if (nums.every((n) => !isNaN(n))) {
    if (nums.length >= 2) {
      const diff = nums[1] - nums[0];
      const isLinear = nums.every((n, i) => i === 0 || Math.abs(n - nums[i - 1] - diff) < 1e-9);
      if (isLinear) {
        const nextVal = nums[nums.length - 1] + diff * (stepIndex + 1);
        return String(Number(nextVal.toFixed(6)));
      }
    } else if (nums.length === 1) {
      // Single number dragged: keep value or increment? Excel copies single number unless Ctrl,
      // but beginners love 1 -> 2 -> 3 when dragging a single integer 1, or copying repeated values.
      // Let's preserve exact copy for single numbers unless >=2 numbers define a series, OR if it's text+number like "Item 1".
      return srcVal;
    }
  }

  // Months / Days series
  const lastRaw = sourceValues[sourceValues.length - 1].trim();
  const lists = [MONTHS_SHORT, MONTHS_LONG, DAYS_SHORT, DAYS_LONG];
  for (const list of lists) {
    const idx = list.findIndex((item) => item.toLowerCase() === lastRaw.toLowerCase());
    if (idx !== -1) {
      return list[(idx + stepIndex + 1) % list.length];
    }
  }

  // Prefix + Number pattern (e.g., "Item 1", "INV-101", "Row 1")
  const match = lastRaw.match(/^(.*?)(\d+)$/);
  if (match) {
    const prefix = match[1];
    const startNum = parseInt(match[2], 10);
    const padLen = match[2].length;
    let step = 1;
    if (sourceValues.length >= 2) {
      const prevMatch = sourceValues[sourceValues.length - 2].trim().match(/^(.*?)(\d+)$/);
      if (prevMatch && prevMatch[1] === prefix) {
        step = startNum - parseInt(prevMatch[2], 10);
      }
    }
    const nextNum = startNum + step * (stepIndex + 1);
    const padded = padLen > 1 && match[2].startsWith('0') ? String(nextNum).padStart(padLen, '0') : String(nextNum);
    return `${prefix}${padded}`;
  }

  return srcVal;
}

// ---------- Formula Tokenizer & Recursive-Descent Parser ----------

type TokenType =
  | 'NUMBER'
  | 'STRING'
  | 'BOOL'
  | 'IDENT'
  | 'CELL'
  | 'SHEET_CELL'
  | 'OP'
  | 'LPAREN'
  | 'RPAREN'
  | 'COMMA'
  | 'COLON'
  | 'EOF';

interface Token {
  type: TokenType;
  value: string;
}

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = expr.length;

  while (i < len) {
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === '"') {
      let str = '';
      i++;
      while (i < len) {
        if (expr[i] === '"' && expr[i + 1] === '"') {
          str += '"';
          i += 2;
        } else if (expr[i] === '"') {
          i++;
          break;
        } else {
          str += expr[i++];
        }
      }
      tokens.push({ type: 'STRING', value: str });
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === '.' && i + 1 < len && /[0-9]/.test(expr[i + 1]))) {
      let num = '';
      while (i < len && /[0-9.]/.test(expr[i])) num += expr[i++];
      if (i < len && expr[i] === '%') {
        i++;
        tokens.push({ type: 'NUMBER', value: String(parseFloat(num) / 100) });
      } else {
        tokens.push({ type: 'NUMBER', value: num });
      }
      continue;
    }
    if (ch === '(') {
      tokens.push({ type: 'LPAREN', value: ch });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'RPAREN', value: ch });
      i++;
      continue;
    }
    if (ch === ',') {
      tokens.push({ type: 'COMMA', value: ch });
      i++;
      continue;
    }
    if (ch === ':') {
      tokens.push({ type: 'COLON', value: ch });
      i++;
      continue;
    }
    // Multi-char operators
    const two = expr.slice(i, i + 2);
    if (two === '<=' || two === '>=' || two === '<>' || two === '!=') {
      tokens.push({ type: 'OP', value: two === '!=' ? '<>' : two });
      i += 2;
      continue;
    }
    if ('+-*/^=&<>%'.includes(ch)) {
      tokens.push({ type: 'OP', value: ch });
      i++;
      continue;
    }
    // Quoted sheet name e.g. 'Sales Data'!A1
    if (ch === "'") {
      let sheet = '';
      i++;
      while (i < len && expr[i] !== "'") sheet += expr[i++];
      if (expr[i] === "'") i++;
      if (expr[i] === '!') {
        i++;
        let cellPart = '';
        while (i < len && /[$A-Za-z0-9]/.test(expr[i])) cellPart += expr[i++];
        tokens.push({ type: 'SHEET_CELL', value: `${sheet}!${cellPart}` });
        continue;
      }
      throw new FormulaError('#NAME?', 'Invalid sheet reference syntax. Use SheetName!A1.');
    }
    // Identifiers, Cell refs, Sheet!Cell refs, TRUE/FALSE
    if (/[$A-Za-z_]/.test(ch)) {
      let ident = '';
      while (i < len && /[$A-Za-z0-9_.]/.test(expr[i])) ident += expr[i++];
      if (expr[i] === '!') {
        i++;
        let cellPart = '';
        while (i < len && /[$A-Za-z0-9]/.test(expr[i])) cellPart += expr[i++];
        tokens.push({ type: 'SHEET_CELL', value: `${ident}!${cellPart}` });
        continue;
      }
      const upper = ident.toUpperCase();
      if (upper === 'TRUE' || upper === 'FALSE') {
        tokens.push({ type: 'BOOL', value: upper });
      } else if (expr[i] === '(') {
        tokens.push({ type: 'IDENT', value: upper });
      } else if (/^\$?[A-Za-z]{1,3}\$?[1-9]\d*$/.test(ident)) {
        tokens.push({ type: 'CELL', value: ident.toUpperCase() });
      } else {
        tokens.push({ type: 'IDENT', value: upper });
      }
      continue;
    }
    throw new FormulaError('#SYNTAX!', `Unexpected character "${ch}" in formula.`);
  }

  tokens.push({ type: 'EOF', value: '' });
  return tokens;
}

type EvalArg =
  | { kind: 'scalar'; value: ScalarValue }
  | { kind: 'range'; values: ScalarValue[][]; flat: ScalarValue[] };

function toNumber(v: ScalarValue, strict = false): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v === null || v === '') return 0;
  const cleaned = String(v).replace(/[₹$,\s]/g, '');
  if (cleaned.endsWith('%')) {
    const n = parseFloat(cleaned.slice(0, -1));
    if (!isNaN(n)) return n / 100;
  }
  const n = Number(cleaned);
  if (isNaN(n)) {
    if (strict) {
      throw new FormulaError(
        '#VALUE!',
        `Expected a number, but found text "${String(v)}". Check that you are referencing numeric cells.`
      );
    }
    return NaN;
  }
  return n;
}

function toStringVal(v: ScalarValue): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return String(v);
}

function toBoolean(v: ScalarValue): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const u = v.trim().toUpperCase();
    if (u === 'TRUE') return true;
    if (u === 'FALSE' || u === '') return false;
    return true;
  }
  return false;
}

function matchesCriteria(cellVal: ScalarValue, criteria: ScalarValue): boolean {
  if (criteria === null) return cellVal === null || cellVal === '';
  const critStr = String(criteria).trim();
  const opMatch = critStr.match(/^(>=|<=|<>|>|<|=)(.*)$/);
  if (opMatch) {
    const op = opMatch[1];
    const rhsRaw = opMatch[2].trim();
    const rhsNum = Number(rhsRaw.replace(/[₹$,]/g, ''));
    const lhsNum = typeof cellVal === 'number' ? cellVal : Number(String(cellVal ?? '').replace(/[₹$,]/g, ''));
    const bothNumeric = rhsRaw !== '' && !isNaN(rhsNum) && cellVal !== null && cellVal !== '' && !isNaN(lhsNum);

    if (bothNumeric) {
      if (op === '>') return lhsNum > rhsNum;
      if (op === '>=') return lhsNum >= rhsNum;
      if (op === '<') return lhsNum < rhsNum;
      if (op === '<=') return lhsNum <= rhsNum;
      if (op === '=') return Math.abs(lhsNum - rhsNum) < 1e-9;
      if (op === '<>') return Math.abs(lhsNum - rhsNum) >= 1e-9;
    } else {
      const lhsStr = toStringVal(cellVal).toLowerCase();
      const rhsStr = rhsRaw.toLowerCase();
      if (op === '=') return lhsStr === rhsStr;
      if (op === '<>') return lhsStr !== rhsStr;
      if (op === '>') return lhsStr > rhsStr;
      if (op === '>=') return lhsStr >= rhsStr;
      if (op === '<') return lhsStr < rhsStr;
      if (op === '<=') return lhsStr <= rhsStr;
    }
  }

  // Exact match (case-insensitive for strings, wildcard * supported)
  if (typeof criteria === 'string' && criteria.includes('*')) {
    const escaped = criteria.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp(`^${escaped}$`, 'i').test(toStringVal(cellVal));
  }

  if (typeof cellVal === 'number' && typeof criteria === 'number') {
    return Math.abs(cellVal - criteria) < 1e-9;
  }
  const cNum = Number(critStr);
  const vNum = typeof cellVal === 'number' ? cellVal : Number(String(cellVal ?? ''));
  if (critStr !== '' && !isNaN(cNum) && cellVal !== '' && cellVal !== null && !isNaN(vNum)) {
    return Math.abs(vNum - cNum) < 1e-9;
  }
  return toStringVal(cellVal).trim().toLowerCase() === critStr.toLowerCase();
}

export const SUPPORTED_FUNCTIONS = [
  'SUM', 'AVERAGE', 'MIN', 'MAX', 'COUNT', 'COUNTA',
  'IF', 'AND', 'OR', 'COUNTIF', 'SUMIF', 'COUNTIFS', 'SUMIFS',
  'VLOOKUP', 'XLOOKUP', 'ROUND', 'TODAY', 'CONCAT', 'CONCATENATE',
  'LEFT', 'RIGHT', 'LEN', 'TRIM', 'PMT', 'ABS', 'IFERROR',
  'UPPER', 'LOWER', 'PROPER', 'MEDIAN', 'SUMPRODUCT',
] as const;

export function formatDisplayValue(value: ScalarValue, style?: CellStyle): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') {
    if (!isFinite(value)) return '#DIV/0!';
    const fmt = style?.numberFormat || 'general';
    if (fmt === 'currency') {
      return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    }
    if (fmt === 'percent') {
      return `${(value * 100).toFixed(1)}%`;
    }
    if (fmt === 'number') {
      return value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
    }
    // General format: keep clean precision
    const rounded = Math.round(value * 1e6) / 1e6;
    return String(rounded);
  }
  return String(value);
}

/**
 * Evaluates an entire workbook (all sheets, with cross-sheet reference support and circular detection).
 */
export function evaluateWorkbook(workbook: WorkbookData): Record<number, Record<string, EvaluatedCell>> {
  const results: Record<number, Record<string, EvaluatedCell>> = {};
  const cache = new Map<string, ScalarValue>();
  const errorCache = new Map<string, FormulaError>();
  const visiting = new Set<string>();

  function getSheetIndexByName(name: string): number {
    const clean = name.replace(/^'|'$/g, '').trim().toLowerCase();
    return workbook.sheets.findIndex((s) => s.name.trim().toLowerCase() === clean);
  }

  function evalCell(sheetIdx: number, cellKey: string): ScalarValue {
    const normKey = cellKey.replace(/\$/g, '').toUpperCase();
    const fullId = `${sheetIdx}!${normKey}`;
    if (errorCache.has(fullId)) {
      throw errorCache.get(fullId)!;
    }
    if (cache.has(fullId)) {
      return cache.get(fullId)!;
    }
    if (visiting.has(fullId)) {
      const err = new FormulaError(
        '#CIRC!',
        `Circular reference detected at ${normKey}. A formula cannot reference its own cell directly or indirectly.`
      );
      errorCache.set(fullId, err);
      throw err;
    }

    const sheet = workbook.sheets[sheetIdx];
    if (!sheet) {
      throw new FormulaError('#REF!', 'Referenced worksheet does not exist.');
    }

    const cell = sheet.cells[normKey];
    if (!cell || cell.raw === '') {
      cache.set(fullId, null);
      return null;
    }

    const raw = cell.raw.trim();
    if (!raw.startsWith('=')) {
      // Parse numeric literals cleanly
      if (/^-?\d+(\.\d+)?$/.test(raw)) {
        const n = Number(raw);
        cache.set(fullId, n);
        return n;
      }
      if (/^-?\d+(\.\d+)?%$/.test(raw)) {
        const n = parseFloat(raw.slice(0, -1)) / 100;
        cache.set(fullId, n);
        return n;
      }
      const upper = raw.toUpperCase();
      if (upper === 'TRUE') {
        cache.set(fullId, true);
        return true;
      }
      if (upper === 'FALSE') {
        cache.set(fullId, false);
        return false;
      }
      cache.set(fullId, cell.raw);
      return cell.raw;
    }

    visiting.add(fullId);
    try {
      const val = evalFormula(raw.slice(1), sheetIdx);
      visiting.delete(fullId);
      cache.set(fullId, val);
      return val;
    } catch (e) {
      visiting.delete(fullId);
      const err =
        e instanceof FormulaError
          ? e
          : new FormulaError('#ERROR!', e instanceof Error ? e.message : 'Formula could not be calculated.');
      errorCache.set(fullId, err);
      throw err;
    }
  }

  function resolveRange(sheetIdx: number, startRef: string, endRef: string): { values: ScalarValue[][]; flat: ScalarValue[] } {
    const s = parseCellRef(startRef);
    const e = parseCellRef(endRef);
    if (!s || !e) {
      throw new FormulaError('#REF!', `Invalid cell range "${startRef}:${endRef}".`);
    }
    const r1 = Math.min(s.row, e.row);
    const r2 = Math.max(s.row, e.row);
    const c1 = Math.min(s.col, e.col);
    const c2 = Math.max(s.col, e.col);
    const values: ScalarValue[][] = [];
    const flat: ScalarValue[] = [];
    for (let r = r1; r <= r2; r++) {
      const rowArr: ScalarValue[] = [];
      for (let c = c1; c <= c2; c++) {
        const v = evalCell(sheetIdx, cellIdFromCoords(r, c));
        rowArr.push(v);
        flat.push(v);
      }
      values.push(rowArr);
    }
    return { values, flat };
  }

  function evalFormula(expr: string, currentSheetIdx: number): ScalarValue {
    const tokens = tokenize(expr);
    let pos = 0;

    function peek(): Token {
      return tokens[pos] || { type: 'EOF', value: '' };
    }
    function consume(): Token {
      return tokens[pos++];
    }

    function asScalar(arg: EvalArg): ScalarValue {
      if (arg.kind === 'scalar') return arg.value;
      return arg.flat[0] ?? null;
    }

    function parseComparison(): EvalArg {
      let left = parseConcat();
      while (peek().type === 'OP' && ['=', '<>', '<', '<=', '>', '>='].includes(peek().value)) {
        const op = consume().value;
        const right = parseConcat();
        const l = asScalar(left);
        const r = asScalar(right);

        const lNum = typeof l === 'number' ? l : l !== null && l !== '' && !isNaN(Number(l)) ? Number(l) : NaN;
        const rNum = typeof r === 'number' ? r : r !== null && r !== '' && !isNaN(Number(r)) ? Number(r) : NaN;
        let res = false;
        if (!isNaN(lNum) && !isNaN(rNum)) {
          if (op === '=') res = Math.abs(lNum - rNum) < 1e-9;
          else if (op === '<>') res = Math.abs(lNum - rNum) >= 1e-9;
          else if (op === '<') res = lNum < rNum;
          else if (op === '<=') res = lNum <= rNum;
          else if (op === '>') res = lNum > rNum;
          else if (op === '>=') res = lNum >= rNum;
        } else {
          const ls = toStringVal(l).toLowerCase();
          const rs = toStringVal(r).toLowerCase();
          if (op === '=') res = ls === rs;
          else if (op === '<>') res = ls !== rs;
          else if (op === '<') res = ls < rs;
          else if (op === '<=') res = ls <= rs;
          else if (op === '>') res = ls > rs;
          else if (op === '>=') res = ls >= rs;
        }
        left = { kind: 'scalar', value: res };
      }
      return left;
    }

    function parseConcat(): EvalArg {
      let left = parseAddSub();
      while (peek().type === 'OP' && peek().value === '&') {
        consume();
        const right = parseAddSub();
        left = { kind: 'scalar', value: toStringVal(asScalar(left)) + toStringVal(asScalar(right)) };
      }
      return left;
    }

    function parseAddSub(): EvalArg {
      let left = parseMulDiv();
      while (peek().type === 'OP' && (peek().value === '+' || peek().value === '-')) {
        const op = consume().value;
        const right = parseMulDiv();
        const l = toNumber(asScalar(left), true);
        const r = toNumber(asScalar(right), true);
        left = { kind: 'scalar', value: op === '+' ? l + r : l - r };
      }
      return left;
    }

    function parseMulDiv(): EvalArg {
      let left = parsePower();
      while (peek().type === 'OP' && (peek().value === '*' || peek().value === '/')) {
        const op = consume().value;
        const right = parsePower();
        const l = toNumber(asScalar(left), true);
        const r = toNumber(asScalar(right), true);
        if (op === '/') {
          if (r === 0) {
            throw new FormulaError('#DIV/0!', 'Cannot divide by zero. Check the denominator cell.');
          }
          left = { kind: 'scalar', value: l / r };
        } else {
          left = { kind: 'scalar', value: l * r };
        }
      }
      return left;
    }

    function parsePower(): EvalArg {
      let left = parseUnary();
      while (peek().type === 'OP' && peek().value === '^') {
        consume();
        const right = parseUnary();
        const l = toNumber(asScalar(left), true);
        const r = toNumber(asScalar(right), true);
        left = { kind: 'scalar', value: Math.pow(l, r) };
      }
      return left;
    }

    function parseUnary(): EvalArg {
      if (peek().type === 'OP' && (peek().value === '-' || peek().value === '+')) {
        const op = consume().value;
        const operand = parseUnary();
        const val = toNumber(asScalar(operand), true);
        return { kind: 'scalar', value: op === '-' ? -val : val };
      }
      return parsePrimary();
    }

    function parsePrimary(): EvalArg {
      const tok = peek();
      if (tok.type === 'NUMBER') {
        consume();
        return { kind: 'scalar', value: parseFloat(tok.value) };
      }
      if (tok.type === 'STRING') {
        consume();
        return { kind: 'scalar', value: tok.value };
      }
      if (tok.type === 'BOOL') {
        consume();
        return { kind: 'scalar', value: tok.value === 'TRUE' };
      }
      if (tok.type === 'LPAREN') {
        consume();
        const inner = parseComparison();
        if (peek().type !== 'RPAREN') {
          throw new FormulaError('#SYNTAX!', 'Missing closing parenthesis ")" in formula.');
        }
        consume();
        return inner;
      }
      if (tok.type === 'SHEET_CELL') {
        consume();
        const [sheetName, startCell] = tok.value.split('!');
        const targetSheetIdx = getSheetIndexByName(sheetName);
        if (targetSheetIdx === -1) {
          throw new FormulaError('#REF!', `Worksheet "${sheetName}" not found.`);
        }
        if (peek().type === 'COLON') {
          consume();
          const next = consume();
          const endCell = next.type === 'SHEET_CELL' ? next.value.split('!')[1] : next.value;
          const rng = resolveRange(targetSheetIdx, startCell, endCell);
          return { kind: 'range', ...rng };
        }
        return { kind: 'scalar', value: evalCell(targetSheetIdx, startCell) };
      }
      if (tok.type === 'CELL') {
        consume();
        if (peek().type === 'COLON') {
          consume();
          const next = consume();
          if (next.type !== 'CELL') {
            throw new FormulaError('#REF!', `Invalid range ending near "${next.value}".`);
          }
          const rng = resolveRange(currentSheetIdx, tok.value, next.value);
          return { kind: 'range', ...rng };
        }
        return { kind: 'scalar', value: evalCell(currentSheetIdx, tok.value) };
      }
      if (tok.type === 'IDENT') {
        consume();
        if (peek().type === 'LPAREN') {
          consume(); // '('
          const fnName = tok.value.toUpperCase();
          // Lazy handling for IF and IFERROR so non-taken branch doesn't throw!
          if (fnName === 'IF') {
            const cond = toBoolean(asScalar(parseComparison()));
            if (peek().type !== 'COMMA') {
              throw new FormulaError('#SYNTAX!', 'IF requires at least 2 arguments: IF(condition, value_if_true, [value_if_false]).');
            }
            consume(); // ','
            const trueStartPos = pos;
            // Parse or skip branches safely
            if (cond) {
              const trueVal = asScalar(parseComparison());
              if (peek().type === 'COMMA') {
                consume();
                skipArgument();
              }
              expectRparen(fnName);
              return { kind: 'scalar', value: trueVal };
            } else {
              void trueStartPos;
              skipArgument();
              let falseVal: ScalarValue = false;
              if (peek().type === 'COMMA') {
                consume();
                falseVal = asScalar(parseComparison());
              }
              expectRparen(fnName);
              return { kind: 'scalar', value: falseVal };
            }
          }

          if (fnName === 'IFERROR') {
            const savedPos = pos;
            try {
              const primary = asScalar(parseComparison());
              if (peek().type === 'COMMA') {
                consume();
                skipArgument();
              }
              expectRparen(fnName);
              return { kind: 'scalar', value: primary };
            } catch (e) {
              if (e instanceof FormulaError) {
                pos = savedPos;
                skipArgument();
                if (peek().type !== 'COMMA') {
                  throw new FormulaError('#SYNTAX!', 'IFERROR requires 2 arguments: IFERROR(value, value_if_error).');
                }
                consume();
                const fallback = asScalar(parseComparison());
                expectRparen(fnName);
                return { kind: 'scalar', value: fallback };
              }
              throw e;
            }
          }

          const args: EvalArg[] = [];
          if (peek().type !== 'RPAREN') {
            args.push(parseComparison());
            while (peek().type === 'COMMA') {
              consume();
              args.push(parseComparison());
            }
          }
          expectRparen(fnName);
          return { kind: 'scalar', value: callFunction(fnName, args) };
        }
        throw new FormulaError(
          '#NAME?',
          `Unrecognized name "${tok.value}". Wrap text values in double quotes like "${tok.value}", or check your function spelling.`
        );
      }

      throw new FormulaError('#SYNTAX!', 'Incomplete formula expression. Check for missing values or misplaced operators.');
    }

    function skipArgument() {
      let depth = 0;
      while (peek().type !== 'EOF') {
        const t = peek();
        if (t.type === 'LPAREN') depth++;
        else if (t.type === 'RPAREN') {
          if (depth === 0) break;
          depth--;
        } else if (t.type === 'COMMA' && depth === 0) {
          break;
        }
        consume();
      }
    }

    function expectRparen(fnName: string) {
      if (peek().type !== 'RPAREN') {
        throw new FormulaError('#SYNTAX!', `Missing closing parenthesis ")" for ${fnName}().`);
      }
      consume();
    }

    function flattenNumbers(args: EvalArg[]): number[] {
      const nums: number[] = [];
      for (const arg of args) {
        if (arg.kind === 'range') {
          for (const v of arg.flat) {
            if (typeof v === 'number' && !isNaN(v)) nums.push(v);
          }
        } else {
          const v = arg.value;
          if (typeof v === 'number' && !isNaN(v)) nums.push(v);
          else if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) nums.push(Number(v));
        }
      }
      return nums;
    }

    function callFunction(name: string, args: EvalArg[]): ScalarValue {
      switch (name) {
        case 'SUM': {
          return flattenNumbers(args).reduce((a, b) => a + b, 0);
        }
        case 'AVERAGE': {
          const nums = flattenNumbers(args);
          if (nums.length === 0) {
            throw new FormulaError('#DIV/0!', 'AVERAGE found no numeric values in the selected range.');
          }
          return nums.reduce((a, b) => a + b, 0) / nums.length;
        }
        case 'MEDIAN': {
          const nums = flattenNumbers(args).sort((a, b) => a - b);
          if (nums.length === 0) throw new FormulaError('#NUM!', 'MEDIAN found no numeric values.');
          const mid = Math.floor(nums.length / 2);
          return nums.length % 2 === 0 ? (nums[mid - 1] + nums[mid]) / 2 : nums[mid];
        }
        case 'MIN': {
          const nums = flattenNumbers(args);
          return nums.length === 0 ? 0 : Math.min(...nums);
        }
        case 'MAX': {
          const nums = flattenNumbers(args);
          return nums.length === 0 ? 0 : Math.max(...nums);
        }
        case 'COUNT': {
          return flattenNumbers(args).length;
        }
        case 'COUNTA': {
          let count = 0;
          for (const arg of args) {
            const list = arg.kind === 'range' ? arg.flat : [arg.value];
            for (const v of list) {
              if (v !== null && v !== undefined && String(v) !== '') count++;
            }
          }
          return count;
        }
        case 'AND': {
          if (args.length === 0) throw new FormulaError('#VALUE!', 'AND requires at least one condition.');
          return args.every((a) => toBoolean(asScalar(a)));
        }
        case 'OR': {
          if (args.length === 0) throw new FormulaError('#VALUE!', 'OR requires at least one condition.');
          return args.some((a) => toBoolean(asScalar(a)));
        }
        case 'COUNTIF': {
          if (args.length !== 2) {
            throw new FormulaError('#VALUE!', 'COUNTIF requires 2 arguments: COUNTIF(range, criteria).');
          }
          const rangeVals = args[0].kind === 'range' ? args[0].flat : [args[0].value];
          const crit = asScalar(args[1]);
          return rangeVals.filter((v) => matchesCriteria(v, crit)).length;
        }
        case 'SUMIF': {
          if (args.length < 2 || args.length > 3) {
            throw new FormulaError('#VALUE!', 'SUMIF requires 2 or 3 arguments: SUMIF(range, criteria, [sum_range]).');
          }
          const critRange = args[0].kind === 'range' ? args[0].flat : [args[0].value];
          const crit = asScalar(args[1]);
          const sumRange =
            args.length === 3
              ? args[2].kind === 'range'
                ? args[2].flat
                : [args[2].value]
              : critRange;
          let total = 0;
          for (let i = 0; i < critRange.length; i++) {
            if (matchesCriteria(critRange[i], crit)) {
              const n = toNumber(sumRange[i] ?? 0);
              if (!isNaN(n)) total += n;
            }
          }
          return total;
        }
        case 'COUNTIFS': {
          if (args.length < 2 || args.length % 2 !== 0) {
            throw new FormulaError('#VALUE!', 'COUNTIFS requires pairs of (criteria_range, criteria).');
          }
          const firstRange = args[0].kind === 'range' ? args[0].flat : [args[0].value];
          let count = 0;
          for (let i = 0; i < firstRange.length; i++) {
            let allMatch = true;
            for (let p = 0; p < args.length; p += 2) {
              const arg = args[p];
              const rVals = arg.kind === 'range' ? arg.flat : [arg.value];
              const crit = asScalar(args[p + 1]);
              if (!matchesCriteria(rVals[i] ?? null, crit)) {
                allMatch = false;
                break;
              }
            }
            if (allMatch) count++;
          }
          return count;
        }
        case 'SUMIFS': {
          if (args.length < 3 || (args.length - 1) % 2 !== 0) {
            throw new FormulaError(
              '#VALUE!',
              'SUMIFS requires (sum_range, criteria_range1, criteria1, ...).'
            );
          }
          const sumRange = args[0].kind === 'range' ? args[0].flat : [args[0].value];
          let total = 0;
          for (let i = 0; i < sumRange.length; i++) {
            let allMatch = true;
            for (let p = 1; p < args.length; p += 2) {
              const arg = args[p];
              const rVals = arg.kind === 'range' ? arg.flat : [arg.value];
              const crit = asScalar(args[p + 1]);
              if (!matchesCriteria(rVals[i] ?? null, crit)) {
                allMatch = false;
                break;
              }
            }
            if (allMatch) {
              const n = toNumber(sumRange[i] ?? 0);
              if (!isNaN(n)) total += n;
            }
          }
          return total;
        }
        case 'VLOOKUP': {
          if (args.length < 3 || args.length > 4) {
            throw new FormulaError(
              '#VALUE!',
              'VLOOKUP syntax: VLOOKUP(lookup_value, table_array, col_index_num, [range_lookup]).'
            );
          }
          const lookupVal = asScalar(args[0]);
          if (args[1].kind !== 'range') {
            throw new FormulaError('#VALUE!', 'Second argument of VLOOKUP must be a cell range (e.g. A2:C10).');
          }
          const table = args[1].values;
          const colIndex = Math.round(toNumber(asScalar(args[2]), true));
          const approx = args.length === 4 ? toBoolean(asScalar(args[3])) : true;
          if (colIndex < 1 || (table[0] && colIndex > table[0].length)) {
            throw new FormulaError('#REF!', `VLOOKUP column index ${colIndex} is outside the table width.`);
          }
          if (!approx) {
            for (const row of table) {
              if (matchesCriteria(row[0] ?? null, lookupVal)) {
                return row[colIndex - 1] ?? null;
              }
            }
            throw new FormulaError('#N/A', `VLOOKUP could not find "${toStringVal(lookupVal)}" in the first column.`);
          } else {
            // Exact first, then largest <= lookupVal
            let bestRow: ScalarValue[] | null = null;
            const targetNum = toNumber(lookupVal);
            for (const row of table) {
              if (matchesCriteria(row[0] ?? null, lookupVal)) return row[colIndex - 1] ?? null;
              if (!isNaN(targetNum)) {
                const rn = toNumber(row[0] ?? null);
                if (!isNaN(rn) && rn <= targetNum) bestRow = row;
              }
            }
            if (bestRow) return bestRow[colIndex - 1] ?? null;
            throw new FormulaError('#N/A', `VLOOKUP could not find a match for "${toStringVal(lookupVal)}".`);
          }
        }
        case 'XLOOKUP': {
          if (args.length < 3 || args.length > 4) {
            throw new FormulaError(
              '#VALUE!',
              'XLOOKUP syntax: XLOOKUP(lookup_value, lookup_array, return_array, [if_not_found]).'
            );
          }
          const lookupVal = asScalar(args[0]);
          const lookupArr = args[1].kind === 'range' ? args[1].flat : [args[1].value];
          const returnArr = args[2].kind === 'range' ? args[2].flat : [args[2].value];
          for (let i = 0; i < lookupArr.length; i++) {
            if (matchesCriteria(lookupArr[i] ?? null, lookupVal)) {
              return returnArr[i] ?? null;
            }
          }
          if (args.length === 4) return asScalar(args[3]);
          throw new FormulaError('#N/A', `XLOOKUP did not find "${toStringVal(lookupVal)}" in the lookup range.`);
        }
        case 'ROUND': {
          if (args.length !== 2) {
            throw new FormulaError('#VALUE!', 'ROUND requires 2 arguments: ROUND(number, num_digits).');
          }
          const num = toNumber(asScalar(args[0]), true);
          const digits = Math.round(toNumber(asScalar(args[1]), true));
          const factor = Math.pow(10, digits);
          return Math.round((num + Number.EPSILON) * factor) / factor;
        }
        case 'ABS': {
          if (args.length !== 1) throw new FormulaError('#VALUE!', 'ABS requires 1 numeric argument.');
          return Math.abs(toNumber(asScalar(args[0]), true));
        }
        case 'TODAY': {
          const now = new Date();
          const d = String(now.getDate()).padStart(2, '0');
          const m = String(now.getMonth() + 1).padStart(2, '0');
          const y = now.getFullYear();
          return `${d}-${m}-${y}`;
        }
        case 'CONCAT':
        case 'CONCATENATE': {
          let out = '';
          for (const arg of args) {
            const list = arg.kind === 'range' ? arg.flat : [arg.value];
            for (const v of list) out += toStringVal(v);
          }
          return out;
        }
        case 'LEFT': {
          if (args.length < 1 || args.length > 2) {
            throw new FormulaError('#VALUE!', 'LEFT syntax: LEFT(text, [num_chars]).');
          }
          const txt = toStringVal(asScalar(args[0]));
          const n = args.length === 2 ? Math.max(0, Math.round(toNumber(asScalar(args[1]), true))) : 1;
          return txt.slice(0, n);
        }
        case 'RIGHT': {
          if (args.length < 1 || args.length > 2) {
            throw new FormulaError('#VALUE!', 'RIGHT syntax: RIGHT(text, [num_chars]).');
          }
          const txt = toStringVal(asScalar(args[0]));
          const n = args.length === 2 ? Math.max(0, Math.round(toNumber(asScalar(args[1]), true))) : 1;
          return n === 0 ? '' : txt.slice(-n);
        }
        case 'LEN': {
          if (args.length !== 1) throw new FormulaError('#VALUE!', 'LEN requires 1 argument: LEN(text).');
          return toStringVal(asScalar(args[0])).length;
        }
        case 'TRIM': {
          if (args.length !== 1) throw new FormulaError('#VALUE!', 'TRIM requires 1 argument: TRIM(text).');
          return toStringVal(asScalar(args[0])).trim().replace(/\s+/g, ' ');
        }
        case 'UPPER': {
          if (args.length !== 1) throw new FormulaError('#VALUE!', 'UPPER requires 1 argument.');
          return toStringVal(asScalar(args[0])).toUpperCase();
        }
        case 'LOWER': {
          if (args.length !== 1) throw new FormulaError('#VALUE!', 'LOWER requires 1 argument.');
          return toStringVal(asScalar(args[0])).toLowerCase();
        }
        case 'PROPER': {
          if (args.length !== 1) throw new FormulaError('#VALUE!', 'PROPER requires 1 argument.');
          return toStringVal(asScalar(args[0]))
            .toLowerCase()
            .replace(/\b\w/g, (c) => c.toUpperCase());
        }
        case 'PMT': {
          if (args.length < 3 || args.length > 5) {
            throw new FormulaError('#VALUE!', 'PMT syntax: PMT(rate, nper, pv, [fv], [type]).');
          }
          const rate = toNumber(asScalar(args[0]), true);
          const nper = toNumber(asScalar(args[1]), true);
          const pv = toNumber(asScalar(args[2]), true);
          const fv = args.length >= 4 ? toNumber(asScalar(args[3]), true) : 0;
          const type = args.length >= 5 ? toNumber(asScalar(args[4]), true) : 0;
          if (nper === 0) throw new FormulaError('#DIV/0!', 'Number of periods (nper) in PMT cannot be zero.');
          if (rate === 0) return -(pv + fv) / nper;
          const pvif = Math.pow(1 + rate, nper);
          let pmt = (rate * (pv * pvif + fv)) / (pvif - 1);
          if (type === 1) pmt /= 1 + rate;
          return -pmt;
        }
        case 'SUMPRODUCT': {
          if (args.length < 1) throw new FormulaError('#VALUE!', 'SUMPRODUCT requires at least 1 range.');
          const arrays = args.map((a) => (a.kind === 'range' ? a.flat : [a.value]));
          const len = arrays[0].length;
          let sum = 0;
          for (let i = 0; i < len; i++) {
            let prod = 1;
            for (const arr of arrays) {
              const n = toNumber(arr[i] ?? 0);
              prod *= isNaN(n) ? 0 : n;
            }
            sum += prod;
          }
          return sum;
        }
        default:
          throw new FormulaError(
            '#NAME?',
            `Function "${name}" is not supported in this spreadsheet engine. Supported functions include SUM, AVERAGE, MIN, MAX, COUNT, COUNTA, IF, AND, OR, COUNTIF, SUMIF, COUNTIFS, SUMIFS, VLOOKUP, XLOOKUP, ROUND, TODAY, CONCAT, LEFT, RIGHT, LEN, TRIM, and PMT.`
          );
      }
    }

    const result = parseComparison();
    if (peek().type !== 'EOF') {
      throw new FormulaError('#SYNTAX!', `Unexpected "${peek().value}" near the end of your formula.`);
    }
    return asScalar(result);
  }

  workbook.sheets.forEach((sheet, sheetIdx) => {
    const sheetEval: Record<string, EvaluatedCell> = {};
    for (const key of Object.keys(sheet.cells)) {
      const cell = sheet.cells[key];
      try {
        const val = evalCell(sheetIdx, key);
        sheetEval[key] = {
          raw: cell.raw,
          value: val,
          display: formatDisplayValue(val, cell.style),
          style: cell.style,
        };
      } catch (e) {
        const ferr =
          e instanceof FormulaError
            ? e
            : new FormulaError('#ERROR!', 'Formula could not be evaluated.');
        sheetEval[key] = {
          raw: cell.raw,
          value: ferr.code,
          display: ferr.code,
          error: ferr.code,
          errorHelp: ferr.help,
          style: cell.style,
        };
      }
    }
    results[sheetIdx] = sheetEval;
  });

  return results;
}

export function cloneWorkbook(wb: WorkbookData): WorkbookData {
  return JSON.parse(JSON.stringify(wb)) as WorkbookData;
}

export function createSheetFromRows(
  name: string,
  rowsData: (string | number)[][],
  options?: {
    totalRows?: number;
    totalCols?: number;
    headerBold?: boolean;
    currencyCols?: number[];
    percentCols?: number[];
    colWidths?: Record<number, number>;
    freezeRows?: number;
  }
): SheetData {
  const cells: Record<string, { raw: string; style?: CellStyle }> = {};
  const minRows = Math.max(options?.totalRows ?? 16, rowsData.length + 5);
  const maxColsInData = rowsData.reduce((m, r) => Math.max(m, r.length), 6);
  const minCols = Math.max(options?.totalCols ?? 8, maxColsInData + 2);

  rowsData.forEach((row, rIdx) => {
    row.forEach((val, cIdx) => {
      if (val === '' || val === undefined || val === null) return;
      const key = cellIdFromCoords(rIdx, cIdx);
      const isHeader = rIdx === 0 && (options?.headerBold ?? true);
      const style: CellStyle = {};
      if (isHeader) {
        style.bold = true;
        style.bgColor = '#eff6ff';
        style.textColor = '#0f172a';
      } else {
        if (options?.currencyCols?.includes(cIdx)) {
          style.numberFormat = 'currency';
          style.align = 'right';
        } else if (options?.percentCols?.includes(cIdx)) {
          style.numberFormat = 'percent';
          style.align = 'right';
        } else if (typeof val === 'number') {
          style.align = 'right';
        }
      }
      cells[key] = {
        raw: String(val),
        style: Object.keys(style).length > 0 ? style : undefined,
      };
    });
  });

  return {
    id: `sheet_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
    name,
    rows: minRows,
    cols: minCols,
    cells,
    colWidths: options?.colWidths,
    freezeRows: options?.freezeRows ?? 1,
    filter: null,
  };
}
