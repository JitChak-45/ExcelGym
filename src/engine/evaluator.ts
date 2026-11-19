import type { EvaluationResult, ExerciseCheck, WorkbookData } from '../types';
import { cellIdFromCoords, evaluateWorkbook } from './formulaEngine';

function normalizeString(val: unknown): string {
  return String(val ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function evaluateChecks(
  workbook: WorkbookData,
  checks: ExerciseCheck[],
  maxPoints = 100
): EvaluationResult {
  const evaluated = evaluateWorkbook(workbook);
  const checkResults: EvaluationResult['checkResults'] = [];

  for (const check of checks) {
    const sheetIdx = check.sheetIndex ?? 0;
    const sheet = workbook.sheets[sheetIdx];
    const sheetEval = evaluated[sheetIdx] || {};

    if (!sheet) {
      checkResults.push({
        id: check.id,
        description: check.description,
        passed: false,
        message: 'Required worksheet is missing.',
      });
      continue;
    }

    if (check.type === 'value' || check.type === 'formula-value') {
      const cellKey = (check.cell || 'A1').toUpperCase();
      const rawCell = sheet.cells[cellKey];
      const evalCell = sheetEval[cellKey];
      const rawText = (rawCell?.raw || '').trim();

      if (!rawText) {
        checkResults.push({
          id: check.id,
          description: check.description,
          passed: false,
          message: `Cell ${cellKey} is currently empty.`,
        });
        continue;
      }

      if (evalCell?.error) {
        checkResults.push({
          id: check.id,
          description: check.description,
          passed: false,
          message: `Cell ${cellKey} has a formula error (${evalCell.error}): ${evalCell.errorHelp || 'Check your formula syntax.'}`,
        });
        continue;
      }

      // Check formula requirement
      if (check.type === 'formula-value' || check.mustBeFormula) {
        if (!rawText.startsWith('=')) {
          checkResults.push({
            id: check.id,
            description: check.description,
            passed: false,
            message: `Cell ${cellKey} contains a fixed value instead of an Excel formula starting with "=".`,
          });
          continue;
        }
        if (check.requiredFunctions && check.requiredFunctions.length > 0) {
          const upperFormula = rawText.toUpperCase();
          const hasAll = check.requiredFunctions.some((fn) =>
            new RegExp(`\\b${fn.toUpperCase()}\\s*\\(`).test(upperFormula)
          );
          if (!hasAll) {
            checkResults.push({
              id: check.id,
              description: check.description,
              passed: false,
              message: `Cell ${cellKey} should use ${check.requiredFunctions.join(' or ')}() rather than manual calculation.`,
            });
            continue;
          }
        }
      }

      // Check evaluated result
      const expected = check.expectedValue;
      const actual = evalCell?.value;
      const tol = check.tolerance ?? 0.05;

      let matched = false;
      if (typeof expected === 'number') {
        const actualNum = typeof actual === 'number' ? actual : Number(String(actual ?? '').replace(/[₹$,%]/g, ''));
        matched = !isNaN(actualNum) && Math.abs(actualNum - expected) <= tol;
      } else {
        matched = normalizeString(actual) === normalizeString(expected);
      }

      checkResults.push({
        id: check.id,
        description: check.description,
        passed: matched,
        message: matched
          ? `Cell ${cellKey} calculated correctly (${evalCell?.display ?? ''}).`
          : `Cell ${cellKey} evaluated to "${evalCell?.display ?? ''}", which does not match the expected result.`,
      });
    } else if (check.type === 'cell-style') {
      const cellKey = (check.cell || 'A1').toUpperCase();
      const style = sheet.cells[cellKey]?.style || {};
      const exp = check.expectedStyle || {};
      const mismatches: string[] = [];

      if (exp.bold !== undefined && Boolean(style.bold) !== exp.bold) mismatches.push('bold');
      if (exp.italic !== undefined && Boolean(style.italic) !== exp.italic) mismatches.push('italic');
      if (exp.align !== undefined && style.align !== exp.align) mismatches.push(`alignment (${exp.align})`);
      if (exp.numberFormat !== undefined && style.numberFormat !== exp.numberFormat) {
        mismatches.push(`number format (${exp.numberFormat})`);
      }
      if (exp.bgColor !== undefined && !style.bgColor) mismatches.push('background fill color');
      if (exp.textColor !== undefined && !style.textColor) mismatches.push('font color');

      const passed = mismatches.length === 0;
      checkResults.push({
        id: check.id,
        description: check.description,
        passed,
        message: passed
          ? `Cell ${cellKey} formatting applied accurately.`
          : `Cell ${cellKey} is missing required formatting: ${mismatches.join(', ')}.`,
      });
    } else if (check.type === 'sort-order') {
      const col = check.sortColumn ?? 0;
      const startRow = (check.sortStartRow ?? 2) - 1;
      const endRow = (check.sortEndRow ?? 6) - 1;
      const dir = check.sortDirection ?? 'asc';
      const vals: (string | number)[] = [];
      for (let r = startRow; r <= endRow; r++) {
        const key = cellIdFromCoords(r, col);
        const v = sheetEval[key]?.value ?? '';
        vals.push(typeof v === 'number' ? v : String(v));
      }
      let sorted = true;
      for (let i = 1; i < vals.length; i++) {
        const prev = vals[i - 1];
        const curr = vals[i];
        const bothNum = typeof prev === 'number' && typeof curr === 'number';
        const cmp = bothNum
          ? prev - curr
          : String(prev).toLowerCase().localeCompare(String(curr).toLowerCase());
        if ((dir === 'asc' && cmp > 0) || (dir === 'desc' && cmp < 0)) {
          sorted = false;
          break;
        }
      }
      checkResults.push({
        id: check.id,
        description: check.description,
        passed: sorted,
        message: sorted
          ? `Rows are sorted in ${dir === 'asc' ? 'ascending' : 'descending'} order.`
          : `Rows are not yet sorted in ${dir === 'asc' ? 'ascending (A→Z / Low→High)' : 'descending (Z→A / High→Low)'} order.`,
      });
    } else if (check.type === 'filter-active') {
      const col = check.filterColumn ?? 0;
      const activeVals = sheet.filter?.columnFilters?.[col] || [];
      const expectedVals = (check.expectedFilterValues || []).map((v) => v.toLowerCase());
      const activeLower = activeVals.map((v) => v.toLowerCase());
      const passed =
        activeVals.length > 0 &&
        expectedVals.length === activeLower.length &&
        expectedVals.every((v) => activeLower.includes(v));

      checkResults.push({
        id: check.id,
        description: check.description,
        passed,
        message: passed
          ? 'Filter applied accurately to the dataset.'
          : `Turn on Filter and filter column to show only: ${(check.expectedFilterValues || []).join(', ')}.`,
      });
    }
  }

  const passedCount = checkResults.filter((c) => c.passed).length;
  const totalChecks = Math.max(1, checkResults.length);
  const accuracy = Math.round((passedCount / totalChecks) * 100);
  const score = Math.round((passedCount / totalChecks) * maxPoints);

  return {
    passed: passedCount === checkResults.length && checkResults.length > 0,
    score,
    maxScore: maxPoints,
    accuracy,
    checkResults,
  };
}
