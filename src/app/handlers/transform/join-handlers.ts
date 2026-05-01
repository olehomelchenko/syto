import * as aq from 'arquero';
import type { Signal } from '@preact/signals';
import { applyTransform } from '../../../core/transforms';
import { DialogStore } from '../../stores/DialogStore';
import { AppStore } from '../../stores/AppStore';
import { StepService } from '../../services/StepService';
import { DependencyService } from '../../services/DependencyService';
import { NameService } from '../../services/NameService';
import { prompt } from '../core/notification-handlers';
import { cloneData } from '../../../core/type-converter';
import { ensureSourceData, ensureModelData } from '../../infrastructure/storage';
import i18n from '../../../i18n';
import { TransformStep } from '../../../core/schema-engine';
import type { JoinType, JoinTarget } from '../../../types/modes';

export interface KeyPairAnalysis {
  leftCol: string | null;
  rightCol: string | null;
  leftUnique: number;
  rightUnique: number;
  leftHasDuplicates: boolean;
  rightHasDuplicates: boolean;
  leftOnly: number;
  rightOnly: number;
  matches: number;
  leftTotalRows: number;
  rightTotalRows: number;
  leftNonNullRows: number;
  rightNonNullRows: number;
  leftNulls: number;
  rightNulls: number;
  leftMatchPercent: number;
  rightMatchPercent: number;
  leftOnlyPercent: number;
  rightOnlyPercent: number;
  leftOnlyValues: any[];
  rightOnlyValues: any[];
}

export interface MismatchPreview {
  values: any[];
  column: string;
  side: 'left' | 'right';
}

export interface JoinDialogState {
  leftModel: Signal<string | null>;
  rightModel: Signal<string | null>;
  joinType: Signal<JoinType>;
  keyPairs: Signal<(string | null)[][]>;
  suffixes: Signal<string[]>;
  targets: Signal<JoinTarget[]>;
  leftColumns: Signal<string[]>;
  rightColumns: Signal<string[]>;
  selectedLeftColumns: Signal<string[]>;
  selectedRightColumns: Signal<string[]>;
  saveAsNewModel: Signal<boolean>;
  previewData: Signal<any | null>;
  previewError: Signal<string | null>;
  isPreviewing: Signal<boolean>;
  keyPairAnalysis: Signal<KeyPairAnalysis[]>;
  previewTableId: Signal<string | null>;
  previewMismatchValues: Signal<MismatchPreview | null>;
}

/**
 * Finds columns with identical names between left and right tables.
 * Returns pairs sorted by position in the left table.
 */
export function findMatchingColumns(
  leftColumns: string[],
  rightColumns: string[]
): [string, string][] {
  const rightSet = new Set(rightColumns);
  return leftColumns.filter((col) => rightSet.has(col)).map((col) => [col, col]);
}

/**
 * Preserves valid key pairs after a table change, then auto-matches remaining columns.
 * Invalid keys (columns no longer present in the changed table) are nulled out;
 * pairs that are entirely empty are dropped; unmatched columns are auto-paired.
 */
export function reconcileKeyPairs(
  currentPairs: (string | null)[][],
  leftColumns: string[],
  rightColumns: string[],
  changedSide: 'left' | 'right'
): (string | null)[][] {
  const validCols = new Set(changedSide === 'left' ? leftColumns : rightColumns);

  const preserved = currentPairs
    .map((pair) => {
      const idx = changedSide === 'left' ? 0 : 1;
      const updated = [...pair] as (string | null)[];
      if (!validCols.has(updated[idx]!)) updated[idx] = null;
      return updated;
    })
    .filter((pair) => pair[0] || pair[1]);

  const usedLeft = new Set(preserved.map((p) => p[0]).filter(Boolean));
  const usedRight = new Set(preserved.map((p) => p[1]).filter(Boolean));
  const autoMatched = findMatchingColumns(leftColumns, rightColumns).filter(
    ([l, r]) => !usedLeft.has(l) && !usedRight.has(r)
  );

  const combined = [...preserved, ...autoMatched];
  return combined.length > 0 ? combined : [[null, null]];
}

/**
 * Builds a join/semijoin/antijoin/lookup transform step from dialog state.
 */
export function buildJoinTransform(
  joinType: string,
  rightModel: string,
  keyPairs: (string | null)[][],
  suffixes: [string, string],
  selectedRightColumns: string[]
): TransformStep {
  const completePairs = keyPairs.filter((pair) => pair[0] && pair[1]) as [string, string][];
  if (joinType === 'semi') {
    return { semijoin: { right: rightModel, on: completePairs } };
  }
  if (joinType === 'anti') {
    return { antijoin: { right: rightModel, on: completePairs } };
  }
  if (joinType === 'lookup') {
    return { lookup: { right: rightModel, on: completePairs, values: selectedRightColumns } };
  }
  return { join: { right: rightModel, on: completePairs, how: joinType, suffixes } };
}

/**
 * Gets data and columns for a target (model or source) ID.
 * Lazily loads data from IndexedDB if not yet in memory.
 * @returns Object with data array and columns array
 */
export async function getTableDataForTarget(
  targetId: string
): Promise<{ data: any[]; columns: string[] }> {
  if (!targetId) return { data: [], columns: [] };
  const models = AppStore.models.value;
  const sources = AppStore.sources.value;

  const model = models.find((m) => m.id === targetId);
  if (model) {
    // Ensure upstream source data is loaded for computation
    const modelSource = sources.find((s) => s.id === model.sourceId);
    if (modelSource) await ensureSourceData(modelSource);
    await ensureModelData(model);

    if (model.steps.length > 0) {
      try {
        const result = StepService.computeModelUpToStep(model, model.steps.length - 1, {
          sources,
          models,
        });
        return { data: result.data, columns: result.columns };
      } catch (error) {
        console.error('Error computing model:', error);
        const data = model.data || [];
        const columns =
          model.schema?.map((c) => c.name) || (data.length > 0 ? Object.keys(data[0]) : []);
        return { data, columns };
      }
    } else {
      const data = model.data || [];
      const columns =
        model.schema?.map((c) => c.name) || (data.length > 0 ? Object.keys(data[0]) : []);
      return { data, columns };
    }
  }

  const source = sources.find((s) => s.id === targetId);
  if (source) {
    await ensureSourceData(source);
    const data = source.data || [];
    const columns =
      source.columns?.map((c: any) => c.name) || (data.length > 0 ? Object.keys(data[0]) : []);
    return { data, columns };
  }

  return { data: [], columns: [] };
}

/**
 * Gets only columns for a target (model or source) ID.
 * For columns we can use schema/metadata without loading data.
 * @returns Array of column names
 */
export function getColumnsForTarget(targetId: string): string[] {
  if (!targetId) return [];
  const models = AppStore.models.value;
  const sources = AppStore.sources.value;

  const model = models.find((m) => m.id === targetId);
  if (model) {
    return model.schema?.map((c) => c.name) || [];
  }

  const source = sources.find((s) => s.id === targetId);
  if (source) {
    return source.columns?.map((c: any) => c.name) || [];
  }

  return [];
}

export async function analyzeJoinKeys(state: JoinDialogState) {
  const leftModelId = state.leftModel.value;
  const rightModelId = state.rightModel.value;
  const keyPairs = state.keyPairs.value;

  if (!leftModelId || !rightModelId) {
    state.keyPairAnalysis.value = [];
    return;
  }

  // Get left and right table data
  const { data: leftData } = await getTableDataForTarget(leftModelId);
  const { data: rightData } = await getTableDataForTarget(rightModelId);

  const analysis = keyPairs.map((pair) => {
    const leftCol = pair[0];
    const rightCol = pair[1];

    if (!leftCol || !rightCol) {
      return {
        leftCol,
        rightCol,
        leftUnique: 0,
        rightUnique: 0,
        leftHasDuplicates: false,
        rightHasDuplicates: false,
        leftOnly: 0,
        rightOnly: 0,
        matches: 0,
        leftTotalRows: 0,
        rightTotalRows: 0,
        leftNonNullRows: 0,
        rightNonNullRows: 0,
        leftNulls: 0,
        rightNulls: 0,
        leftMatchPercent: 0,
        rightMatchPercent: 0,
        leftOnlyPercent: 0,
        rightOnlyPercent: 0,
        leftOnlyValues: [],
        rightOnlyValues: [],
      };
    }

    // Extract values from left column
    const leftValues = leftData.map((row) => row[leftCol]);
    const leftNonNullValues = leftValues.filter((v) => v != null);
    const leftValueSet = new Set(leftNonNullValues);
    const leftUnique = leftValueSet.size;
    const leftHasDuplicates = leftNonNullValues.length > leftUnique;
    const leftTotalRows = leftData.length;
    const leftNonNullRows = leftNonNullValues.length;

    // Extract values from right column
    const rightValues = rightData.map((row) => row[rightCol]);
    const rightNonNullValues = rightValues.filter((v) => v != null);
    const rightValueSet = new Set(rightNonNullValues);
    const rightUnique = rightValueSet.size;
    const rightHasDuplicates = rightNonNullValues.length > rightUnique;
    const rightTotalRows = rightData.length;
    const rightNonNullRows = rightNonNullValues.length;

    // Find matches and mismatches (based on unique values)
    const leftOnlySet = new Set(leftNonNullValues.filter((v) => !rightValueSet.has(v)));
    const rightOnlySet = new Set(rightNonNullValues.filter((v) => !leftValueSet.has(v)));
    const matches = new Set(leftNonNullValues.filter((v) => rightValueSet.has(v)));

    // Get actual values (sorted for display)
    const leftOnlyValues = Array.from(leftOnlySet).sort((a, b) => {
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    });
    const rightOnlyValues = Array.from(rightOnlySet).sort((a, b) => {
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    });

    // Calculate row-level statistics for percentages
    const leftRowsWithMatch = leftValues.filter((v) => v != null && rightValueSet.has(v)).length;
    const leftRowsWithoutMatch = leftValues.filter(
      (v) => v != null && !rightValueSet.has(v)
    ).length;
    const rightRowsWithMatch = rightValues.filter((v) => v != null && leftValueSet.has(v)).length;
    const rightRowsWithoutMatch = rightValues.filter(
      (v) => v != null && !leftValueSet.has(v)
    ).length;

    // Calculate percentages based on actual rows
    const leftMatchPercent =
      leftNonNullRows > 0 ? Math.round((leftRowsWithMatch / leftNonNullRows) * 100) : 0;
    const rightMatchPercent =
      rightNonNullRows > 0 ? Math.round((rightRowsWithMatch / rightNonNullRows) * 100) : 0;
    const leftOnlyPercent =
      leftNonNullRows > 0 ? Math.round((leftRowsWithoutMatch / leftNonNullRows) * 100) : 0;
    const rightOnlyPercent =
      rightNonNullRows > 0 ? Math.round((rightRowsWithoutMatch / rightNonNullRows) * 100) : 0;

    return {
      leftCol,
      rightCol,
      leftUnique,
      rightUnique,
      leftHasDuplicates,
      rightHasDuplicates,
      leftOnly: leftOnlySet.size,
      rightOnly: rightOnlySet.size,
      matches: matches.size,
      leftOnlyValues,
      rightOnlyValues,
      leftTotalRows,
      rightTotalRows,
      leftNonNullRows,
      rightNonNullRows,
      leftNulls: leftTotalRows - leftNonNullRows,
      rightNulls: rightTotalRows - rightNonNullRows,
      leftMatchPercent,
      rightMatchPercent,
      leftOnlyPercent,
      rightOnlyPercent,
    };
  });

  state.keyPairAnalysis.value = analysis;
}

export async function previewJoin(state: JoinDialogState) {
  const leftModelId = state.leftModel.value;
  const rightModel = state.rightModel.value;
  const joinType = state.joinType.value;
  const keyPairs = state.keyPairs.value;
  const suffixes = state.suffixes.value;
  const selectedLeftColumns = state.selectedLeftColumns.value;
  const selectedRightColumns = state.selectedRightColumns.value;
  const models = AppStore.models.value;
  const sources = AppStore.sources.value;

  if (!leftModelId) {
    state.previewError.value = i18n.t('validation.selection.leftTable', { ns: 'errors' });
    return;
  }
  if (!rightModel) {
    state.previewError.value = i18n.t('validation.selection.joinRightTable', { ns: 'errors' });
    return;
  }
  if (joinType !== 'cross') {
    const hasCompleteKeyPair = keyPairs.some((pair) => pair[0] && pair[1]);
    if (!hasCompleteKeyPair) {
      state.previewError.value = i18n.t('validation.required.keyPair', { ns: 'errors' });
      return;
    }
  }

  // Cycle check
  const cycleResult = DependencyService.checkCircularDependency(
    models,
    sources,
    leftModelId,
    rightModel
  );
  if (cycleResult.isCyclic) {
    state.previewError.value =
      cycleResult.message || i18n.t('system.circularDependency', { ns: 'errors' });
    return;
  }

  state.isPreviewing.value = true;
  state.previewError.value = null;
  state.previewData.value = null;

  try {
    // Get left table data and columns
    const { data: leftData, columns: leftColumns } = await getTableDataForTarget(leftModelId);

    // Get right table data (ensure model data is up-to-date for transform)
    const targetModel = models.find((m) => m.id === rightModel);
    if (targetModel && targetModel.steps.length > 0) {
      const result = StepService.computeModelUpToStep(targetModel, targetModel.steps.length - 1, {
        sources,
        models,
      });
      targetModel.data = result.data;
    }

    const transform = buildJoinTransform(
      joinType,
      rightModel,
      keyPairs,
      suffixes as [string, string],
      selectedRightColumns
    );
    const table = aq.from(leftData);
    const context = { sources, models };
    let result = applyTransform(table, transform, leftColumns, context);

    // Apply column selection if specified
    const allSelectedColumns = [...selectedLeftColumns, ...selectedRightColumns];
    if (allSelectedColumns.length > 0) {
      const availableColumns = result.columnNames();
      const columnsToSelect = allSelectedColumns.filter((col) => availableColumns.includes(col));
      if (columnsToSelect.length > 0) {
        result = result.select(columnsToSelect);
      }
    }

    const allData = result.objects();
    const resultColumns = result.columnNames();
    const previewRows = allData.slice(0, 100);
    const totalRows = allData.length;

    // Store in local state
    state.previewData.value = {
      rows: previewRows,
      totalRows: totalRows,
      columns: resultColumns,
    };

    // Also populate the shared previewState for the preview panel
    DialogStore.previewState.title.value = 'Join Preview';
    DialogStore.previewState.stats.value = `${totalRows} rows, ${resultColumns.length} columns (showing first ${previewRows.length} rows)`;
    DialogStore.previewState.columns.value = resultColumns;
    DialogStore.previewState.newColumns.value = [];
    DialogStore.previewState.rows.value = previewRows;
  } catch (error: any) {
    console.error('Join preview error:', error);
    state.previewError.value = error.message;
    // Clear preview on error
    DialogStore.previewState.title.value = '';
    DialogStore.previewState.stats.value = '';
    DialogStore.previewState.columns.value = [];
    DialogStore.previewState.newColumns.value = [];
    DialogStore.previewState.rows.value = [];
  } finally {
    state.isPreviewing.value = false;
  }
}

export async function applyJoinTransform(callbacks: any) {
  const rawState = DialogStore.activeDialogState.value;
  if (!rawState) return;

  const leftModelId = rawState.leftModel as string | null;
  const rightModelVal = rawState.rightModel as string | null;
  const joinType = rawState.joinType as JoinType;
  const keyPairs = rawState.keyPairs as (string | null)[][];
  const suffixes = rawState.suffixes as string[];
  const selectedLeftColumns = rawState.selectedLeftColumns as string[];
  const selectedRightColumns = rawState.selectedRightColumns as string[];
  const saveAsNewModel = rawState.saveAsNewModel as boolean;
  const models = AppStore.models.value;
  const sources = AppStore.sources.value;

  if (!leftModelId) {
    await callbacks.onError?.(i18n.t('validation.selection.leftTable', { ns: 'errors' }));
    return;
  }
  if (!rightModelVal) {
    await callbacks.onError?.(i18n.t('validation.selection.joinRightTable', { ns: 'errors' }));
    return;
  }
  if (joinType !== 'cross') {
    const completePairs = keyPairs.filter((pair) => pair[0] && pair[1]);
    if (completePairs.length === 0) {
      await callbacks.onError?.(i18n.t('validation.required.keyPair', { ns: 'errors' }));
      return;
    }
  }

  // Cycle check
  const cycleResult = DependencyService.checkCircularDependency(
    models,
    sources,
    leftModelId,
    rightModelVal
  );
  if (cycleResult.isCyclic) {
    await callbacks.onError?.(
      cycleResult.message || i18n.t('system.circularDependency', { ns: 'errors' })
    );
    return;
  }

  try {
    // Get left table data and columns
    const { data: leftData, columns: leftColumns } = await getTableDataForTarget(leftModelId);
    const leftModel = models.find((m) => m.id === leftModelId);

    // Get right table data (ensure model data is up-to-date for transform)
    const targetModel = models.find((m) => m.id === rightModelVal);
    if (targetModel && targetModel.steps.length > 0) {
      const result = StepService.computeModelUpToStep(targetModel, targetModel.steps.length - 1, {
        sources,
        models,
      });
      targetModel.data = result.data;
    }

    const transform = buildJoinTransform(
      joinType,
      rightModelVal,
      keyPairs,
      suffixes as [string, string],
      selectedRightColumns
    );

    // Apply join transform
    const table = aq.from(leftData);
    const context = { sources, models };
    let resultTable = applyTransform(table, transform, leftColumns, context);

    // Apply column selection if specified
    const allSelectedColumns = [...selectedLeftColumns, ...selectedRightColumns];
    if (allSelectedColumns.length > 0) {
      const availableColumns = resultTable.columnNames();
      const columnsToSelect = allSelectedColumns.filter((col) => availableColumns.includes(col));
      if (columnsToSelect.length > 0) {
        resultTable = resultTable.select(columnsToSelect);
      }
    }

    const resultData = resultTable.objects();

    if (saveAsNewModel) {
      // Create a new model from the join result — resolve root source for chained models
      const resolveSourceId = leftModel ? leftModel.sourceId : leftModelId;
      let leftSource = sources.find((s) => s.id === resolveSourceId);
      if (!leftSource && leftModel) {
        const rootId = DependencyService.getRootSourceId(models, sources, leftModel.id);
        if (rootId) leftSource = sources.find((s) => s.id === rootId);
      }

      if (!leftSource) {
        await callbacks.onError?.(i18n.t('system.sourceNotFoundForNewModel', { ns: 'errors' }));
        return;
      }

      const defaultName = `join_${AppStore.models.value.filter((m) => m.sourceId === leftSource!.id).length + 1}`;
      const modelName = await prompt(i18n.t('prompts.newModel', { ns: 'common' }), defaultName);
      if (!modelName || modelName.trim() === '') return;

      const name = modelName.trim();
      if (NameService.isModelNameTaken(name, leftSource.id)) {
        await callbacks.onError?.(i18n.t('validation.duplicate.modelExists', { ns: 'errors' }));
        return;
      }

      // Create logical schema from result (models use logical types)
      const { SchemaEngine } = await import('../../../core/schema-engine');
      const schema = SchemaEngine.createLogicalSchema(resultData);

      const { StepService } = await import('../../services/StepService');
      const [importStep, typesStep] = StepService.createInitialSteps(leftSource);

      const newModel: any = {
        id: `mdl_${Date.now()}`,
        name: name,
        sourceId: leftSource.id,
        steps: [importStep, typesStep, transform],
        schema: schema,
        data: cloneData(resultData),
        __v: 1,
      };

      AppStore.models.value = [...AppStore.models.value, newModel];
      const { ModelService } = await import('../../services/ModelService');
      ModelService.switchToModel(
        newModel,
        () => {},
        () => {},
        'rows',
        () => {}
      );
      await callbacks.onDialogClose?.(true);
    } else {
      // Apply to current model (existing behavior)
      // We need to temporarily set the active model to the left model
      const originalModel = AppStore.activeModel.value;
      const originalData = AppStore.currentData.value;
      const originalColumns = AppStore.columns.value;

      // Temporarily switch to left model if different
      if (leftModel && leftModel.id !== originalModel?.id) {
        AppStore.activeModel.value = leftModel;
        AppStore.currentData.value = leftData;
        AppStore.columns.value = leftColumns;
      }

      try {
        await StepService.runTransform('Join', transform, callbacks);
      } finally {
        // Restore original if we switched
        if (leftModel && leftModel.id !== originalModel?.id) {
          AppStore.activeModel.value = originalModel;
          AppStore.currentData.value = originalData;
          AppStore.columns.value = originalColumns;
        }
      }
    }
  } catch (error: any) {
    console.error('Join transform setup error:', error);
    await callbacks.onError?.(
      i18n.t('transform.joinFailed', { ns: 'errors', message: error.message })
    );
  }
}
