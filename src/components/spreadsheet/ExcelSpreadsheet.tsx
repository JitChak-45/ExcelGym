import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownAZ,
  ArrowUpZA,
  Bold,
  Check,
  Clipboard,
  Copy,
  Eraser,
  Filter,
  IndianRupee,
  Italic,
  Lock,
  Percent,
  Plus,
  Redo2,
  RotateCcw,
  Undo2,
  X,
} from 'lucide-react';
import type { CellData, CellStyle, NumberFormatType, SheetData, WorkbookData } from '../../types';
import {
  cellIdFromCoords,
  cloneWorkbook,
  colIndexToLetter,
  evaluateWorkbook,
  generateAutoFillValue,
  shiftFormulaReferences,
  SUPPORTED_FUNCTIONS,
} from '../../engine/formulaEngine';

interface CellCoord {
  row: number;
  col: number;
}

interface SelectionRange {
  start: CellCoord;
  end: CellCoord;
}

interface ClipboardBuffer {
  origin: CellCoord;
  cells: { rOffset: number; cOffset: number; data: CellData }[];
}

export interface ExcelSpreadsheetProps {
  workbook: WorkbookData;
  onChange: (wb: WorkbookData) => void;
  highlightCells?: string[];
  compact?: boolean;
  readOnly?: boolean;
  onReset?: () => void;
}

const TEXT_COLORS = ['#0f172a', '#1d4ed8', '#15803d', '#b91c1c', '#b45309', '#6d28d9', '#475569'];
const FILL_COLORS = ['', '#eff6ff', '#ecfdf5', '#fef3c7', '#fee2e2', '#f1f5f9', '#f3e8ff'];

const DEFAULT_COL_WIDTH = 112;
const DEFAULT_ROW_HEIGHT = 30;

function normalizeRange(range: SelectionRange) {
  return {
    r1: Math.min(range.start.row, range.end.row),
    r2: Math.max(range.start.row, range.end.row),
    c1: Math.min(range.start.col, range.end.col),
    c2: Math.max(range.start.col, range.end.col),
  };
}

export const ExcelSpreadsheet: React.FC<ExcelSpreadsheetProps> = ({
  workbook,
  onChange,
  highlightCells = [],
  compact = false,
  readOnly = false,
  onReset,
}) => {
  const [selection, setSelection] = useState<SelectionRange>({
    start: { row: 0, col: 0 },
    end: { row: 0, col: 0 },
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isSelecting, setIsSelecting] = useState(false);
  const [isFillDragging, setIsFillDragging] = useState(false);
  const [fillTarget, setFillTarget] = useState<CellCoord | null>(null);
  const [undoStack, setUndoStack] = useState<WorkbookData[]>([]);
  const [redoStack, setRedoStack] = useState<WorkbookData[]>([]);
  const [clipboard, setClipboard] = useState<ClipboardBuffer | null>(null);
  const [openColorMenu, setOpenColorMenu] = useState<'text' | 'fill' | null>(null);
  const [openFilterCol, setOpenFilterCol] = useState<number | null>(null);
  const [renamingSheetIdx, setRenamingSheetIdx] = useState<number | null>(null);
  const [renameText, setRenameText] = useState('');

  // Resize tracking
  const resizingColRef = useRef<{ col: number; startX: number; startW: number } | null>(null);
  const resizingRowRef = useRef<{ row: number; startY: number; startH: number } | null>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const formulaInputRef = useRef<HTMLInputElement>(null);
  const cellEditorRef = useRef<HTMLInputElement>(null);

  const activeSheetIndex = Math.min(workbook.activeSheetIndex, Math.max(0, workbook.sheets.length - 1));
  const sheet: SheetData = workbook.sheets[activeSheetIndex];

  const evaluatedWorkbook = useMemo(() => evaluateWorkbook(workbook), [workbook]);
  const evaluatedSheet = evaluatedWorkbook[activeSheetIndex] || {};

  const activeCoord = selection.start;
  const activeKey = cellIdFromCoords(activeCoord.row, activeCoord.col);
  const activeCell = sheet.cells[activeKey];
  const activeEval = evaluatedSheet[activeKey];

  const highlightSet = useMemo(
    () => new Set(highlightCells.map((c) => c.toUpperCase())),
    [highlightCells]
  );

  // Sync formula bar text when selection moves (if not currently editing)
  useEffect(() => {
    if (!isEditing) {
      setEditValue(activeCell?.raw ?? '');
    }
  }, [activeKey, activeCell?.raw, isEditing, activeSheetIndex]);

  const pushHistory = useCallback(
    (nextWb: WorkbookData) => {
      setUndoStack((prev) => [...prev.slice(-39), cloneWorkbook(workbook)]);
      setRedoStack([]);
      onChange(nextWb);
    },
    [workbook, onChange]
  );

  const updateActiveSheet = useCallback(
    (mutator: (draftSheet: SheetData) => void, recordHistory = true) => {
      const nextWb = cloneWorkbook(workbook);
      const targetSheet = nextWb.sheets[activeSheetIndex];
      if (!targetSheet) return;
      mutator(targetSheet);
      if (recordHistory) {
        pushHistory(nextWb);
      } else {
        onChange(nextWb);
      }
    },
    [workbook, activeSheetIndex, pushHistory, onChange]
  );

  const commitEdit = useCallback(
    (valueToCommit?: string) => {
      if (readOnly) {
        setIsEditing(false);
        return;
      }
      const val = valueToCommit !== undefined ? valueToCommit : editValue;
      const currentRaw = sheet.cells[activeKey]?.raw ?? '';
      if (val !== currentRaw) {
        updateActiveSheet((s) => {
          const prev = s.cells[activeKey];
          if (val === '' && !prev?.style) {
            delete s.cells[activeKey];
          } else {
            s.cells[activeKey] = {
              raw: val,
              style: prev?.style,
            };
          }
        });
      }
      setIsEditing(false);
    },
    [readOnly, editValue, sheet.cells, activeKey, updateActiveSheet]
  );

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0 || readOnly) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [...prev, cloneWorkbook(workbook)]);
    setUndoStack((prev) => prev.slice(0, -1));
    onChange(previous);
    setIsEditing(false);
  }, [undoStack, workbook, onChange, readOnly]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0 || readOnly) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [...prev, cloneWorkbook(workbook)]);
    setRedoStack((prev) => prev.slice(0, -1));
    onChange(next);
    setIsEditing(false);
  }, [redoStack, workbook, onChange, readOnly]);

  const applyStyleToSelection = useCallback(
    (patch: Partial<CellStyle> | 'clear') => {
      if (readOnly) return;
      const { r1, r2, c1, c2 } = normalizeRange(selection);
      updateActiveSheet((s) => {
        for (let r = r1; r <= r2; r++) {
          for (let c = c1; c <= c2; c++) {
            const k = cellIdFromCoords(r, c);
            const prev = s.cells[k] || { raw: '' };
            if (patch === 'clear') {
              if (prev.raw === '') {
                delete s.cells[k];
              } else {
                s.cells[k] = { raw: prev.raw };
              }
            } else {
              s.cells[k] = {
                raw: prev.raw,
                style: { ...(prev.style || {}), ...patch },
              };
            }
          }
        }
      });
    },
    [readOnly, selection, updateActiveSheet]
  );

  const handleCopy = useCallback(() => {
    const { r1, r2, c1, c2 } = normalizeRange(selection);
    const copied: ClipboardBuffer['cells'] = [];
    const tsvRows: string[] = [];
    for (let r = r1; r <= r2; r++) {
      const rowTexts: string[] = [];
      for (let c = c1; c <= c2; c++) {
        const k = cellIdFromCoords(r, c);
        const cell = sheet.cells[k];
        copied.push({
          rOffset: r - r1,
          cOffset: c - c1,
          data: cell ? JSON.parse(JSON.stringify(cell)) : { raw: '' },
        });
        rowTexts.push(evaluatedSheet[k]?.display ?? '');
      }
      tsvRows.push(rowTexts.join('\t'));
    }
    setClipboard({ origin: { row: r1, col: c1 }, cells: copied });
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(tsvRows.join('\n')).catch(() => {});
    }
  }, [selection, sheet.cells, evaluatedSheet]);

  const handlePaste = useCallback(() => {
    if (readOnly || !clipboard) return;
    const destRow = selection.start.row;
    const destCol = selection.start.col;
    const rowDelta = destRow - clipboard.origin.row;
    const colDelta = destCol - clipboard.origin.col;

    updateActiveSheet((s) => {
      for (const item of clipboard.cells) {
        const r = destRow + item.rOffset;
        const c = destCol + item.cOffset;
        if (r >= s.rows || c >= s.cols) continue;
        const k = cellIdFromCoords(r, c);
        const shiftedRaw = item.data.raw.startsWith('=')
          ? shiftFormulaReferences(item.data.raw, rowDelta, colDelta)
          : item.data.raw;
        s.cells[k] = {
          raw: shiftedRaw,
          style: item.data.style ? { ...item.data.style } : undefined,
        };
      }
    });
  }, [readOnly, clipboard, selection.start, updateActiveSheet]);

  const handleDeleteSelection = useCallback(() => {
    if (readOnly) return;
    const { r1, r2, c1, c2 } = normalizeRange(selection);
    updateActiveSheet((s) => {
      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
          const k = cellIdFromCoords(r, c);
          if (s.cells[k]) {
            s.cells[k] = { raw: '', style: s.cells[k].style };
          }
        }
      }
    });
    setEditValue('');
  }, [readOnly, selection, updateActiveSheet]);

  // Execute Drag Fill Handle operation
  const completeFillDrag = useCallback(
    (target: CellCoord) => {
      if (readOnly) return;
      const { r1, r2, c1, c2 } = normalizeRange(selection);
      const srcRowCount = r2 - r1 + 1;
      const srcColCount = c2 - c1 + 1;

      const verticalDelta = target.row > r2 ? target.row - r2 : target.row < r1 ? r1 - target.row : 0;
      const horizontalDelta = target.col > c2 ? target.col - c2 : target.col < c1 ? c1 - target.col : 0;

      if (verticalDelta === 0 && horizontalDelta === 0) return;

      updateActiveSheet((s) => {
        if (verticalDelta >= horizontalDelta) {
          // Vertical fill (down or up)
          if (target.row > r2) {
            for (let c = c1; c <= c2; c++) {
              const srcVals: string[] = [];
              const srcStyles: (CellStyle | undefined)[] = [];
              for (let r = r1; r <= r2; r++) {
                const k = cellIdFromCoords(r, c);
                srcVals.push(s.cells[k]?.raw ?? '');
                srcStyles.push(s.cells[k]?.style);
              }
              for (let r = r2 + 1; r <= target.row; r++) {
                const stepIdx = r - (r2 + 1);
                const srcRowUsed = r1 + (stepIdx % srcRowCount);
                const newRaw = generateAutoFillValue(srcVals, stepIdx, r - srcRowUsed, 0);
                const k = cellIdFromCoords(r, c);
                const styleCopy = srcStyles[stepIdx % srcRowCount];
                s.cells[k] = {
                  raw: newRaw,
                  style: styleCopy ? { ...styleCopy } : undefined,
                };
              }
            }
            setSelection({ start: { row: r1, col: c1 }, end: { row: target.row, col: c2 } });
          } else if (target.row < r1) {
            for (let c = c1; c <= c2; c++) {
              const srcVals: string[] = [];
              for (let r = r2; r >= r1; r--) {
                srcVals.push(s.cells[cellIdFromCoords(r, c)]?.raw ?? '');
              }
              for (let r = r1 - 1; r >= target.row; r--) {
                const stepIdx = r1 - 1 - r;
                const srcRowUsed = r2 - (stepIdx % srcRowCount);
                const newRaw = generateAutoFillValue(srcVals, stepIdx, r - srcRowUsed, 0);
                s.cells[cellIdFromCoords(r, c)] = { raw: newRaw };
              }
            }
            setSelection({ start: { row: target.row, col: c1 }, end: { row: r2, col: c2 } });
          }
        } else {
          // Horizontal fill (right or left)
          if (target.col > c2) {
            for (let r = r1; r <= r2; r++) {
              const srcVals: string[] = [];
              const srcStyles: (CellStyle | undefined)[] = [];
              for (let c = c1; c <= c2; c++) {
                const k = cellIdFromCoords(r, c);
                srcVals.push(s.cells[k]?.raw ?? '');
                srcStyles.push(s.cells[k]?.style);
              }
              for (let c = c2 + 1; c <= target.col; c++) {
                const stepIdx = c - (c2 + 1);
                const srcColUsed = c1 + (stepIdx % srcColCount);
                const newRaw = generateAutoFillValue(srcVals, stepIdx, 0, c - srcColUsed);
                const styleCopy = srcStyles[stepIdx % srcColCount];
                s.cells[cellIdFromCoords(r, c)] = {
                  raw: newRaw,
                  style: styleCopy ? { ...styleCopy } : undefined,
                };
              }
            }
            setSelection({ start: { row: r1, col: c1 }, end: { row: r2, col: target.col } });
          }
        }
      });
    },
    [readOnly, selection, updateActiveSheet]
  );

  // Sorting data block below header row (row 0) based on currently selected column
  const handleSortColumn = useCallback(
    (direction: 'asc' | 'desc') => {
      if (readOnly) return;
      const sortCol = activeCoord.col;
      // Determine contiguous non-empty data rows starting from row 1 (Row 2 in Excel)
      const dataRows: number[] = [];
      for (let r = 1; r < sheet.rows; r++) {
        let hasAny = false;
        for (let c = 0; c < sheet.cols; c++) {
          const raw = sheet.cells[cellIdFromCoords(r, c)]?.raw ?? '';
          if (raw.trim() !== '') {
            hasAny = true;
            break;
          }
        }
        // Stop before a "Total" summary row if present
        const firstColVal = String(evaluatedSheet[cellIdFromCoords(r, 0)]?.value ?? '').toLowerCase();
        if (firstColVal.startsWith('total') || firstColVal.startsWith('grand total')) {
          break;
        }
        if (hasAny) {
          dataRows.push(r);
        } else if (dataRows.length > 0) {
          break;
        }
      }
      if (dataRows.length < 2) return;

      const rowSnapshots = dataRows.map((r) => {
        const sortVal = evaluatedSheet[cellIdFromCoords(r, sortCol)]?.value ?? '';
        const rowCells: Record<number, CellData | undefined> = {};
        for (let c = 0; c < sheet.cols; c++) {
          const cell = sheet.cells[cellIdFromCoords(r, c)];
          if (cell) rowCells[c] = JSON.parse(JSON.stringify(cell));
        }
        return { origRow: r, sortVal, rowCells };
      });

      rowSnapshots.sort((a, b) => {
        const av = a.sortVal;
        const bv = b.sortVal;
        const bothNum = typeof av === 'number' && typeof bv === 'number';
        const cmp = bothNum
          ? av - bv
          : String(av).toLowerCase().localeCompare(String(bv).toLowerCase());
        return direction === 'asc' ? cmp : -cmp;
      });

      updateActiveSheet((s) => {
        dataRows.forEach((targetRow, idx) => {
          const snap = rowSnapshots[idx];
          const rowDelta = targetRow - snap.origRow;
          for (let c = 0; c < s.cols; c++) {
            const key = cellIdFromCoords(targetRow, c);
            const cell = snap.rowCells[c];
            if (cell) {
              s.cells[key] = {
                raw: cell.raw.startsWith('=')
                  ? shiftFormulaReferences(cell.raw, rowDelta, 0)
                  : cell.raw,
                style: cell.style,
              };
            } else {
              delete s.cells[key];
            }
          }
        });
      });
    },
    [readOnly, activeCoord.col, sheet, evaluatedSheet, updateActiveSheet]
  );

  // Toggle AutoFilter on Row 1
  const handleToggleFilter = useCallback(() => {
    if (readOnly) return;
    setOpenFilterCol(null);
    updateActiveSheet((s) => {
      s.filter = s.filter ? null : { headerRow: 0, columnFilters: {} };
    });
  }, [readOnly, updateActiveSheet]);

  const handleToggleFreeze = useCallback(() => {
    if (readOnly) return;
    updateActiveSheet((s) => {
      s.freezeRows = (s.freezeRows ?? 0) > 0 ? 0 : 1;
    });
  }, [readOnly, updateActiveSheet]);

  // Mouse global listeners for drag selection, fill handle, and col/row resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (resizingColRef.current) {
        const { col, startX, startW } = resizingColRef.current;
        const nextW = Math.max(54, Math.min(360, startW + (e.clientX - startX)));
        updateActiveSheet((s) => {
          s.colWidths = { ...(s.colWidths || {}), [col]: nextW };
        }, false);
      } else if (resizingRowRef.current) {
        const { row, startY, startH } = resizingRowRef.current;
        const nextH = Math.max(24, Math.min(120, startH + (e.clientY - startY)));
        updateActiveSheet((s) => {
          s.rowHeights = { ...(s.rowHeights || {}), [row]: nextH };
        }, false);
      }
    };

    const handleMouseUp = () => {
      if (isFillDragging && fillTarget) {
        completeFillDrag(fillTarget);
      }
      setIsSelecting(false);
      setIsFillDragging(false);
      setFillTarget(null);
      resizingColRef.current = null;
      resizingRowRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isFillDragging, fillTarget, completeFillDrag, updateActiveSheet]);

  // Compute visible rows when AutoFilter is active
  const visibleRowIndices = useMemo(() => {
    const allRows = Array.from({ length: sheet.rows }, (_, i) => i);
    if (!sheet.filter) return allRows;
    const activeCols = Object.entries(sheet.filter.columnFilters).filter(([, vals]) => vals.length > 0);
    if (activeCols.length === 0) return allRows;

    return allRows.filter((r) => {
      if (r <= sheet.filter!.headerRow) return true;
      // Keep empty rows below the dataset visible so grid looks full
      let rowHasContent = false;
      for (let c = 0; c < sheet.cols; c++) {
        if ((sheet.cells[cellIdFromCoords(r, c)]?.raw ?? '').trim() !== '') {
          rowHasContent = true;
          break;
        }
      }
      if (!rowHasContent) return true;

      return activeCols.every(([colIdxStr, allowedVals]) => {
        const c = Number(colIdxStr);
        const disp = evaluatedSheet[cellIdFromCoords(r, c)]?.display ?? '';
        return allowedVals.includes(disp);
      });
    });
  }, [sheet, evaluatedSheet]);

  // Unique values for a filter dropdown column
  const getUniqueColumnValues = useCallback(
    (colIdx: number): string[] => {
      const vals = new Set<string>();
      const startR = (sheet.filter?.headerRow ?? 0) + 1;
      for (let r = startR; r < sheet.rows; r++) {
        const raw = sheet.cells[cellIdFromCoords(r, colIdx)]?.raw ?? '';
        if (raw.trim() !== '') {
          vals.add(evaluatedSheet[cellIdFromCoords(r, colIdx)]?.display ?? raw);
        }
      }
      return Array.from(vals).sort();
    },
    [sheet, evaluatedSheet]
  );

  // Keyboard navigation on grid
  const handleGridKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isEditing) return;

    const isMeta = e.ctrlKey || e.metaKey;
    if (isMeta && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      handleUndo();
      return;
    }
    if (isMeta && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
      e.preventDefault();
      handleRedo();
      return;
    }
    if (isMeta && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      handleCopy();
      return;
    }
    if (isMeta && e.key.toLowerCase() === 'v') {
      e.preventDefault();
      handlePaste();
      return;
    }
    if (isMeta && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      applyStyleToSelection({ bold: !activeCell?.style?.bold });
      return;
    }
    if (isMeta && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      applyStyleToSelection({ italic: !activeCell?.style?.italic });
      return;
    }

    const moveSelection = (dr: number, dc: number, expand: boolean) => {
      e.preventDefault();
      if (expand) {
        setSelection((prev) => ({
          start: prev.start,
          end: {
            row: Math.max(0, Math.min(sheet.rows - 1, prev.end.row + dr)),
            col: Math.max(0, Math.min(sheet.cols - 1, prev.end.col + dc)),
          },
        }));
      } else {
        const nextRow = Math.max(0, Math.min(sheet.rows - 1, activeCoord.row + dr));
        const nextCol = Math.max(0, Math.min(sheet.cols - 1, activeCoord.col + dc));
        setSelection({ start: { row: nextRow, col: nextCol }, end: { row: nextRow, col: nextCol } });
      }
    };

    if (e.key === 'ArrowDown') return moveSelection(1, 0, e.shiftKey);
    if (e.key === 'ArrowUp') return moveSelection(-1, 0, e.shiftKey);
    if (e.key === 'ArrowRight') return moveSelection(0, 1, e.shiftKey);
    if (e.key === 'ArrowLeft') return moveSelection(0, -1, e.shiftKey);
    if (e.key === 'Tab') return moveSelection(0, e.shiftKey ? -1 : 1, false);
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!readOnly) {
        setIsEditing(true);
        setTimeout(() => cellEditorRef.current?.focus(), 0);
      }
      return;
    }
    if (e.key === 'F2' && !readOnly) {
      e.preventDefault();
      setIsEditing(true);
      setTimeout(() => cellEditorRef.current?.focus(), 0);
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && !readOnly) {
      e.preventDefault();
      handleDeleteSelection();
      return;
    }

    // Direct typing starts editing immediately
    if (!readOnly && !isMeta && !e.altKey && e.key.length === 1) {
      e.preventDefault();
      setIsEditing(true);
      setEditValue(e.key);
      setTimeout(() => cellEditorRef.current?.focus(), 0);
    }
  };

  // Formula autocomplete suggestions
  const formulaSuggestions = useMemo(() => {
    if (!isEditing || !editValue.startsWith('=')) return [];
    const match = editValue.match(/([A-Za-z]+)$/);
    if (!match || match[1].length < 1) return [];
    const prefix = match[1].toUpperCase();
    return SUPPORTED_FUNCTIONS.filter((fn) => fn.startsWith(prefix) && fn !== prefix).slice(0, 6);
  }, [isEditing, editValue]);

  // Selection status summary (SUM, AVERAGE, COUNT)
  const selectionStats = useMemo(() => {
    const { r1, r2, c1, c2 } = normalizeRange(selection);
    const nums: number[] = [];
    let nonEmpty = 0;
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        const ev = evaluatedSheet[cellIdFromCoords(r, c)];
        if (ev && ev.display !== '') nonEmpty++;
        if (ev && typeof ev.value === 'number' && !ev.error) {
          nums.push(ev.value);
        }
      }
    }
    const sum = nums.reduce((a, b) => a + b, 0);
    return {
      count: nonEmpty,
      numCount: nums.length,
      sum,
      avg: nums.length > 0 ? sum / nums.length : 0,
    };
  }, [selection, evaluatedSheet]);

  const normSel = normalizeRange(selection);
  const selectionLabel =
    normSel.r1 === normSel.r2 && normSel.c1 === normSel.c2
      ? activeKey
      : `${cellIdFromCoords(normSel.r1, normSel.c1)}:${cellIdFromCoords(normSel.r2, normSel.c2)}`;

  // Fill preview rectangle
  const fillPreviewRect = useMemo(() => {
    if (!isFillDragging || !fillTarget) return null;
    const { r1, r2, c1, c2 } = normSel;
    const vDelta = fillTarget.row > r2 ? fillTarget.row - r2 : fillTarget.row < r1 ? r1 - fillTarget.row : 0;
    const hDelta = fillTarget.col > c2 ? fillTarget.col - c2 : fillTarget.col < c1 ? c1 - fillTarget.col : 0;
    if (vDelta === 0 && hDelta === 0) return null;
    if (vDelta >= hDelta) {
      return {
        r1: Math.min(r1, fillTarget.row),
        r2: Math.max(r2, fillTarget.row),
        c1,
        c2,
      };
    }
    return {
      r1,
      r2,
      c1: Math.min(c1, fillTarget.col),
      c2: Math.max(c2, fillTarget.col),
    };
  }, [isFillDragging, fillTarget, normSel]);

  const handleAddSheet = () => {
    if (readOnly) return;
    const nextWb = cloneWorkbook(workbook);
    const nextNum = nextWb.sheets.length + 1;
    nextWb.sheets.push({
      id: `sheet_${Date.now()}`,
      name: `Sheet${nextNum}`,
      rows: 20,
      cols: 10,
      cells: {},
      freezeRows: 1,
      filter: null,
    });
    nextWb.activeSheetIndex = nextWb.sheets.length - 1;
    pushHistory(nextWb);
  };

  const handleSwitchSheet = (idx: number) => {
    if (isEditing) commitEdit();
    const nextWb = cloneWorkbook(workbook);
    nextWb.activeSheetIndex = idx;
    onChange(nextWb);
    setSelection({ start: { row: 0, col: 0 }, end: { row: 0, col: 0 } });
    setOpenFilterCol(null);
  };

  const handleRenameSheet = (idx: number) => {
    const clean = renameText.trim();
    if (clean) {
      const nextWb = cloneWorkbook(workbook);
      nextWb.sheets[idx].name = clean.slice(0, 24);
      pushHistory(nextWb);
    }
    setRenamingSheetIdx(null);
  };

  const handleFormatNumber = (fmt: NumberFormatType) => {
    applyStyleToSelection({ numberFormat: fmt, align: fmt === 'general' ? undefined : 'right' });
  };

  return (
    <div className="flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs select-none">
      {/* Ribbon Toolbar */}
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-1 px-2.5 py-1.5 bg-slate-50 border-b border-slate-200 text-slate-700">
          {/* Undo / Redo */}
          <div className="flex items-center gap-0.5 pr-2 border-r border-slate-200">
            <button
              type="button"
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              title="Undo (Ctrl+Z)"
              className="p-1.5 rounded hover:bg-slate-200/70 disabled:opacity-35 transition-colors"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              title="Redo (Ctrl+Y)"
              className="p-1.5 rounded hover:bg-slate-200/70 disabled:opacity-35 transition-colors"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          {/* Copy / Paste */}
          <div className="flex items-center gap-0.5 pr-2 border-r border-slate-200">
            <button
              type="button"
              onClick={handleCopy}
              title="Copy (Ctrl+C)"
              className="p-1.5 rounded hover:bg-slate-200/70 transition-colors"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handlePaste}
              disabled={!clipboard}
              title="Paste (Ctrl+V)"
              className="p-1.5 rounded hover:bg-slate-200/70 disabled:opacity-35 transition-colors"
            >
              <Clipboard className="w-4 h-4" />
            </button>
          </div>

          {/* Font Styles */}
          <div className="flex items-center gap-0.5 pr-2 border-r border-slate-200">
            <button
              type="button"
              onClick={() => applyStyleToSelection({ bold: !activeCell?.style?.bold })}
              title="Bold (Ctrl+B)"
              className={`p-1.5 rounded transition-colors ${
                activeCell?.style?.bold ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-200/70'
              }`}
            >
              <Bold className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => applyStyleToSelection({ italic: !activeCell?.style?.italic })}
              title="Italic (Ctrl+I)"
              className={`p-1.5 rounded transition-colors ${
                activeCell?.style?.italic ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-200/70'
              }`}
            >
              <Italic className="w-4 h-4" />
            </button>

            {/* Text Color */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenColorMenu((m) => (m === 'text' ? null : 'text'))}
                title="Font Color"
                className="px-2 py-1 rounded hover:bg-slate-200/70 text-xs font-bold flex flex-col items-center leading-none"
              >
                <span>A</span>
                <span
                  className="w-3.5 h-1 mt-0.5 rounded-xs"
                  style={{ backgroundColor: activeCell?.style?.textColor || '#0f172a' }}
                />
              </button>
              {openColorMenu === 'text' && (
                <div className="absolute left-0 top-full mt-1 z-40 bg-white border border-slate-200 rounded-lg p-2 shadow-lg flex items-center gap-1.5">
                  {TEXT_COLORS.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => {
                        applyStyleToSelection({ textColor: col });
                        setOpenColorMenu(null);
                      }}
                      className="w-5 h-5 rounded-full border border-slate-300"
                      style={{ backgroundColor: col }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Fill Color */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenColorMenu((m) => (m === 'fill' ? null : 'fill'))}
                title="Cell Background Color"
                className="px-2 py-1 rounded hover:bg-slate-200/70 text-xs font-medium flex items-center gap-1"
              >
                <span
                  className="w-3.5 h-3.5 rounded-xs border border-slate-300"
                  style={{ backgroundColor: activeCell?.style?.bgColor || '#ffffff' }}
                />
                <span className="hidden sm:inline">Fill</span>
              </button>
              {openColorMenu === 'fill' && (
                <div className="absolute left-0 top-full mt-1 z-40 bg-white border border-slate-200 rounded-lg p-2 shadow-lg flex items-center gap-1.5">
                  {FILL_COLORS.map((col, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        applyStyleToSelection({ bgColor: col || undefined });
                        setOpenColorMenu(null);
                      }}
                      className="w-5 h-5 rounded border border-slate-300 text-[10px] flex items-center justify-center"
                      style={{ backgroundColor: col || '#ffffff' }}
                    >
                      {!col && '×'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Alignment */}
          <div className="flex items-center gap-0.5 pr-2 border-r border-slate-200">
            <button
              type="button"
              onClick={() => applyStyleToSelection({ align: 'left' })}
              title="Align Left"
              className={`p-1.5 rounded transition-colors ${
                activeCell?.style?.align === 'left' ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-200/70'
              }`}
            >
              <AlignLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => applyStyleToSelection({ align: 'center' })}
              title="Align Center"
              className={`p-1.5 rounded transition-colors ${
                activeCell?.style?.align === 'center' ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-200/70'
              }`}
            >
              <AlignCenter className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => applyStyleToSelection({ align: 'right' })}
              title="Align Right"
              className={`p-1.5 rounded transition-colors ${
                activeCell?.style?.align === 'right' ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-200/70'
              }`}
            >
              <AlignRight className="w-4 h-4" />
            </button>
          </div>

          {/* Number Format */}
          <div className="flex items-center gap-0.5 pr-2 border-r border-slate-200">
            <button
              type="button"
              onClick={() => handleFormatNumber('currency')}
              title="Format as Indian Rupees (₹)"
              className={`p-1.5 rounded transition-colors ${
                activeCell?.style?.numberFormat === 'currency' ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-200/70'
              }`}
            >
              <IndianRupee className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleFormatNumber('percent')}
              title="Format as Percentage (%)"
              className={`p-1.5 rounded transition-colors ${
                activeCell?.style?.numberFormat === 'percent' ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-200/70'
              }`}
            >
              <Percent className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => applyStyleToSelection('clear')}
              title="Clear Cell Formatting"
              className="p-1.5 rounded hover:bg-slate-200/70 transition-colors"
            >
              <Eraser className="w-4 h-4" />
            </button>
          </div>

          {/* Sort, Filter, Freeze */}
          {!compact && (
            <div className="flex items-center gap-1 pr-2 border-r border-slate-200">
              <button
                type="button"
                onClick={() => handleSortColumn('asc')}
                title="Sort Active Column A → Z / Low → High"
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium hover:bg-slate-200/70 transition-colors whitespace-nowrap"
              >
                <ArrowDownAZ className="w-3.5 h-3.5" />
                <span>Sort A-Z</span>
              </button>
              <button
                type="button"
                onClick={() => handleSortColumn('desc')}
                title="Sort Active Column Z → A / High → Low"
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium hover:bg-slate-200/70 transition-colors whitespace-nowrap"
              >
                <ArrowUpZA className="w-3.5 h-3.5" />
                <span>Sort Z-A</span>
              </button>
              <button
                type="button"
                onClick={handleToggleFilter}
                title="Toggle AutoFilter on Header Row"
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                  sheet.filter ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-200/70'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Filter</span>
              </button>
              <button
                type="button"
                onClick={handleToggleFreeze}
                title="Freeze / Unfreeze Top Row"
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                  (sheet.freezeRows ?? 0) > 0 ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-200/70'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Freeze Row 1</span>
              </button>
            </div>
          )}

          {onReset && (
            <button
              type="button"
              onClick={onReset}
              title="Reset spreadsheet to initial data"
              className="ml-auto flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-slate-600 hover:bg-slate-200/70 transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Sheet</span>
            </button>
          )}
        </div>
      )}

      {/* Name Box & Formula Bar */}
      <div className="relative flex items-center border-b border-slate-200 bg-white px-2 py-1.5 gap-2">
        <div className="w-20 shrink-0 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-mono font-semibold text-slate-700 text-center tabular-nums">
          {selectionLabel}
        </div>
        <div className="flex items-center gap-1 text-slate-400 border-r border-slate-200 pr-2 shrink-0">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setEditValue(activeCell?.raw ?? '');
                }}
                title="Cancel (Esc)"
                className="p-0.5 text-rose-600 hover:bg-rose-50 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => commitEdit()}
                title="Confirm (Enter)"
                className="p-0.5 text-emerald-600 hover:bg-emerald-50 rounded"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <span className="font-mono text-xs italic font-semibold px-1 text-slate-500">fx</span>
          )}
        </div>
        <input
          ref={formulaInputRef}
          type="text"
          readOnly={readOnly}
          value={isEditing ? editValue : activeCell?.raw ?? ''}
          onFocus={() => {
            if (!readOnly && !isEditing) {
              setIsEditing(true);
              setEditValue(activeCell?.raw ?? '');
            }
          }}
          onChange={(e) => {
            if (readOnly) return;
            if (!isEditing) setIsEditing(true);
            setEditValue(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitEdit();
              const nextR = Math.min(sheet.rows - 1, activeCoord.row + 1);
              setSelection({ start: { row: nextR, col: activeCoord.col }, end: { row: nextR, col: activeCoord.col } });
              gridContainerRef.current?.focus();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              setIsEditing(false);
              setEditValue(activeCell?.raw ?? '');
              gridContainerRef.current?.focus();
            }
          }}
          placeholder="Enter value or formula (e.g. =SUM(B2:B6))"
          className="flex-1 text-sm font-mono text-slate-900 focus:outline-none bg-transparent"
        />

        {/* Formula Autocomplete Popover */}
        {formulaSuggestions.length > 0 && (
          <div className="absolute left-28 top-full mt-0.5 z-50 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-44">
            {formulaSuggestions.map((fn) => (
              <button
                key={fn}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  const replaced = editValue.replace(/([A-Za-z]+)$/, `${fn}(`);
                  setEditValue(replaced);
                }}
                className="w-full text-left px-3 py-1 text-xs font-mono text-slate-800 hover:bg-blue-50 hover:text-blue-700 flex items-center justify-between"
              >
                <span className="font-semibold">{fn}</span>
                <span className="text-[11px] text-slate-400">fn</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Understandable Formula Error Diagnostics Bar */}
      {activeEval?.error && (
        <div className="px-3 py-1.5 bg-rose-50 border-b border-rose-200 text-xs text-rose-800 flex items-center justify-between gap-2">
          <span>
            <strong className="font-mono font-semibold">{activeKey} ({activeEval.error}):</strong>{' '}
            {activeEval.errorHelp || 'Formula error detected.'}
          </span>
        </div>
      )}

      {/* Spreadsheet Grid Viewport */}
      <div
        ref={gridContainerRef}
        tabIndex={0}
        onKeyDown={handleGridKeyDown}
        onClick={() => {
          if (openColorMenu) setOpenColorMenu(null);
        }}
        className={`relative overflow-auto sheet-scroll focus:outline-none bg-white ${
          compact ? 'max-h-[290px]' : 'flex-1 min-h-[380px] max-h-[62vh]'
        }`}
      >
        <table className="border-collapse table-fixed w-max">
          <thead>
            <tr>
              {/* Top-left corner select-all cell */}
              <th className="sticky top-0 left-0 z-30 w-11 min-w-[44px] h-7 bg-slate-100 border-b border-r border-slate-300 text-[11px] font-medium text-slate-500" />
              {Array.from({ length: sheet.cols }, (_, colIdx) => {
                const width = sheet.colWidths?.[colIdx] ?? DEFAULT_COL_WIDTH;
                const isSelectedCol = colIdx >= normSel.c1 && colIdx <= normSel.c2;
                return (
                  <th
                    key={colIdx}
                    style={{ width, minWidth: width, maxWidth: width }}
                    onClick={() => {
                      if (isEditing) commitEdit();
                      setSelection({
                        start: { row: 0, col: colIdx },
                        end: { row: sheet.rows - 1, col: colIdx },
                      });
                    }}
                    className={`sticky top-0 z-20 h-7 border-b border-r border-slate-300 text-xs font-semibold select-none relative cursor-pointer ${
                      isSelectedCol
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                    }`}
                  >
                    <span>{colIndexToLetter(colIdx)}</span>
                    {/* Column Resize Handle */}
                    <div
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        resizingColRef.current = { col: colIdx, startX: e.clientX, startW: width };
                      }}
                      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500/60"
                    />
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {visibleRowIndices.map((rowIdx) => {
              const rowHeight = sheet.rowHeights?.[rowIdx] ?? DEFAULT_ROW_HEIGHT;
              const isSelectedRow = rowIdx >= normSel.r1 && rowIdx <= normSel.r2;
              const isFrozenRow = (sheet.freezeRows ?? 0) > 0 && rowIdx === 0;

              return (
                <tr key={rowIdx} style={{ height: rowHeight }}>
                  {/* Row Number Header */}
                  <td
                    onClick={() => {
                      if (isEditing) commitEdit();
                      setSelection({
                        start: { row: rowIdx, col: 0 },
                        end: { row: rowIdx, col: sheet.cols - 1 },
                      });
                    }}
                    style={isFrozenRow ? { top: 28 } : undefined}
                    className={`sticky left-0 ${
                      isFrozenRow ? 'z-20' : 'z-10'
                    } w-11 min-w-[44px] border-b border-r border-slate-300 text-[11px] font-mono text-center select-none relative cursor-pointer tabular-nums ${
                      isSelectedRow
                        ? 'bg-blue-100 text-blue-800 font-semibold'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200/70'
                    }`}
                  >
                    {rowIdx + 1}
                    <div
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        resizingRowRef.current = { row: rowIdx, startY: e.clientY, startH: rowHeight };
                      }}
                      className="absolute bottom-0 left-0 right-0 h-1 cursor-row-resize hover:bg-blue-500/60"
                    />
                  </td>

                  {Array.from({ length: sheet.cols }, (_, colIdx) => {
                    const key = cellIdFromCoords(rowIdx, colIdx);
                    const cell = sheet.cells[key];
                    const ev = evaluatedSheet[key];
                    const width = sheet.colWidths?.[colIdx] ?? DEFAULT_COL_WIDTH;

                    const isActive = activeCoord.row === rowIdx && activeCoord.col === colIdx;
                    const inSelection =
                      rowIdx >= normSel.r1 &&
                      rowIdx <= normSel.r2 &&
                      colIdx >= normSel.c1 &&
                      colIdx <= normSel.c2;
                    const isBottomRightOfSelection = rowIdx === normSel.r2 && colIdx === normSel.c2;
                    const inFillPreview =
                      fillPreviewRect &&
                      rowIdx >= fillPreviewRect.r1 &&
                      rowIdx <= fillPreviewRect.r2 &&
                      colIdx >= fillPreviewRect.c1 &&
                      colIdx <= fillPreviewRect.c2;
                    const isTargetHighlight = highlightSet.has(key);

                    const showFilterBtn = sheet.filter && sheet.filter.headerRow === rowIdx && (cell?.raw ?? '').trim() !== '';
                    const colActiveFilters = sheet.filter?.columnFilters?.[colIdx] || [];

                    const alignClass =
                      cell?.style?.align === 'right'
                        ? 'text-right'
                        : cell?.style?.align === 'center'
                        ? 'text-center'
                        : typeof ev?.value === 'number' && !cell?.style?.align
                        ? 'text-right'
                        : 'text-left';

                    const cellBg =
                      cell?.style?.bgColor ||
                      (isTargetHighlight && !cell?.raw ? '#fefce8' : undefined);

                    return (
                      <td
                        key={colIdx}
                        style={{
                          width,
                          minWidth: width,
                          maxWidth: width,
                          height: rowHeight,
                          backgroundColor: cellBg,
                          color: ev?.error ? '#dc2626' : cell?.style?.textColor || '#0f172a',
                          top: isFrozenRow ? 28 : undefined,
                        }}
                        onMouseDown={(e) => {
                          if (e.button !== 0) return;
                          if (isEditing && !isActive) commitEdit();
                          if (e.shiftKey) {
                            setSelection((prev) => ({ start: prev.start, end: { row: rowIdx, col: colIdx } }));
                          } else {
                            setSelection({ start: { row: rowIdx, col: colIdx }, end: { row: rowIdx, col: colIdx } });
                            setIsSelecting(true);
                          }
                        }}
                        onMouseEnter={() => {
                          if (isFillDragging) {
                            setFillTarget({ row: rowIdx, col: colIdx });
                          } else if (isSelecting) {
                            setSelection((prev) => ({ start: prev.start, end: { row: rowIdx, col: colIdx } }));
                          }
                        }}
                        onDoubleClick={() => {
                          if (readOnly) return;
                          setSelection({ start: { row: rowIdx, col: colIdx }, end: { row: rowIdx, col: colIdx } });
                          setIsEditing(true);
                          setEditValue(cell?.raw ?? '');
                          setTimeout(() => cellEditorRef.current?.focus(), 0);
                        }}
                        className={`relative border-b border-r border-slate-200 px-2 text-[13px] tabular-nums transition-none ${
                          isFrozenRow ? 'sticky z-10' : ''
                        } ${cell?.style?.bold ? 'font-semibold' : 'font-normal'} ${
                          cell?.style?.italic ? 'italic' : ''
                        } ${alignClass} ${
                          inSelection && !isActive ? 'bg-blue-50/70' : ''
                        } ${isTargetHighlight ? 'ring-1 ring-inset ring-amber-400' : ''} ${
                          inFillPreview ? 'outline-1 outline-dashed outline-blue-500' : ''
                        }`}
                      >
                        {/* Active Cell Outline */}
                        {isActive && (
                          <div className="pointer-events-none absolute inset-0 border-2 border-blue-600 z-20" />
                        )}

                        {/* Inline Cell Editor OR Formatted Display Value */}
                        {isActive && isEditing ? (
                          <input
                            ref={cellEditorRef}
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => commitEdit()}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                commitEdit();
                                const nextR = Math.min(sheet.rows - 1, rowIdx + 1);
                                setSelection({ start: { row: nextR, col: colIdx }, end: { row: nextR, col: colIdx } });
                                gridContainerRef.current?.focus();
                              } else if (e.key === 'Tab') {
                                e.preventDefault();
                                commitEdit();
                                const nextC = Math.min(sheet.cols - 1, colIdx + 1);
                                setSelection({ start: { row: rowIdx, col: nextC }, end: { row: rowIdx, col: nextC } });
                                gridContainerRef.current?.focus();
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                setIsEditing(false);
                                setEditValue(cell?.raw ?? '');
                                gridContainerRef.current?.focus();
                              }
                            }}
                            className="absolute inset-0 w-full h-full px-2 bg-white text-[13px] font-mono text-slate-900 focus:outline-none z-30"
                          />
                        ) : (
                          <div className="flex items-center justify-between gap-1 overflow-hidden">
                            <span className="truncate flex-1">{ev?.display ?? ''}</span>
                            {showFilterBtn && (
                              <button
                                type="button"
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenFilterCol((prev) => (prev === colIdx ? null : colIdx));
                                }}
                                className={`shrink-0 p-0.5 rounded border text-[10px] leading-none ${
                                  colActiveFilters.length > 0
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-100'
                                }`}
                                title="Filter column"
                              >
                                ▾
                              </button>
                            )}
                          </div>
                        )}

                        {/* AutoFilter Dropdown Popover */}
                        {showFilterBtn && openFilterCol === colIdx && (
                          <div
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            className="absolute left-0 top-full mt-1 z-50 w-52 bg-white border border-slate-200 rounded-lg shadow-xl p-2.5 text-left font-normal"
                          >
                            <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100">
                              <span className="text-xs font-semibold text-slate-700">
                                Filter: {ev?.display}
                              </span>
                              <button
                                type="button"
                                onClick={() => setOpenFilterCol(null)}
                                className="text-slate-400 hover:text-slate-600"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <div className="max-h-40 overflow-y-auto space-y-1">
                              {getUniqueColumnValues(colIdx).map((val) => {
                                const checked =
                                  colActiveFilters.length === 0 || colActiveFilters.includes(val);
                                return (
                                  <label
                                    key={val}
                                    className="flex items-center gap-2 text-xs text-slate-700 py-0.5 cursor-pointer hover:bg-slate-50 px-1 rounded"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => {
                                        const allUnique = getUniqueColumnValues(colIdx);
                                        const current =
                                          colActiveFilters.length === 0 ? allUnique : colActiveFilters;
                                        const next = current.includes(val)
                                          ? current.filter((v) => v !== val)
                                          : [...current, val];
                                        updateActiveSheet((s) => {
                                          if (!s.filter) return;
                                          if (next.length === allUnique.length || next.length === 0) {
                                            delete s.filter.columnFilters[colIdx];
                                          } else {
                                            s.filter.columnFilters[colIdx] = next;
                                          }
                                        });
                                      }}
                                      className="rounded border-slate-300 text-blue-600"
                                    />
                                    <span className="truncate">{val}</span>
                                  </label>
                                );
                              })}
                            </div>
                            <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-100">
                              <button
                                type="button"
                                onClick={() => {
                                  updateActiveSheet((s) => {
                                    if (s.filter) delete s.filter.columnFilters[colIdx];
                                  });
                                }}
                                className="text-xs text-blue-600 hover:underline font-medium"
                              >
                                Clear Filter
                              </button>
                              <button
                                type="button"
                                onClick={() => setOpenFilterCol(null)}
                                className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded font-medium"
                              >
                                Done
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Interactive Drag Fill Handle */}
                        {!readOnly && !isEditing && isBottomRightOfSelection && (
                          <div
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              setIsFillDragging(true);
                              setFillTarget({ row: rowIdx, col: colIdx });
                            }}
                            title="Drag to auto-fill series or copy formula with relative references"
                            className="absolute -right-[4px] -bottom-[4px] w-2.5 h-2.5 bg-blue-600 border border-white cursor-crosshair z-30"
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Bottom Worksheet Tabs & Live Selection Status Bar */}
      <div className="flex items-center justify-between gap-4 px-2.5 py-1.5 bg-slate-50 border-t border-slate-200 text-xs">
        <div className="flex items-center gap-1 overflow-x-auto">
          {workbook.sheets.map((s, idx) => (
            <div key={s.id} className="shrink-0">
              {renamingSheetIdx === idx ? (
                <input
                  type="text"
                  autoFocus
                  value={renameText}
                  onChange={(e) => setRenameText(e.target.value)}
                  onBlur={() => handleRenameSheet(idx)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRenameSheet(idx);
                    if (e.key === 'Escape') setRenamingSheetIdx(null);
                  }}
                  className="px-2 py-0.5 text-xs border border-blue-500 rounded bg-white w-24 focus:outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => handleSwitchSheet(idx)}
                  onDoubleClick={() => {
                    if (readOnly) return;
                    setRenamingSheetIdx(idx);
                    setRenameText(s.name);
                  }}
                  className={`px-3 py-1 rounded-md font-medium transition-colors whitespace-nowrap ${
                    idx === activeSheetIndex
                      ? 'bg-white text-blue-700 border border-slate-200 shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-200/70'
                  }`}
                >
                  {s.name}
                </button>
              )}
            </div>
          ))}
          {!readOnly && !compact && (
            <button
              type="button"
              onClick={handleAddSheet}
              title="Add new worksheet"
              className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Live Excel Selection Summary */}
        <div className="hidden sm:flex items-center gap-4 text-[11px] text-slate-600 font-mono tabular-nums shrink-0">
          <span>Count: {selectionStats.count}</span>
          {selectionStats.numCount > 0 && (
            <>
              <span>Average: {Number(selectionStats.avg.toFixed(2)).toLocaleString('en-IN')}</span>
              <span>Sum: {Number(selectionStats.sum.toFixed(2)).toLocaleString('en-IN')}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
