/**
 * Unit Tests for Join Handlers
 *
 * Tests join-related logic including key pair management, key analysis,
 * target/column resolution, and join type handling.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@preact/signals';
import { AppStore } from '../../stores/AppStore';
import { resetStores, suppressConsole } from '../test-utils';
import type { JoinDialogState } from './join-handlers';

vi.mock('../../infrastructure/storage', () => ({
  ensureSourceData: vi.fn().mockImplementation(async (source: any) => source.data || []),
  ensureModelData: vi.fn().mockImplementation(async (model: any) => model.data || []),
}));

import * as JoinHandlers from './join-handlers';

describe('join-handlers', () => {
  beforeEach(() => {
    resetStores();
    suppressConsole();
  });

  describe('getTableDataForTarget', () => {
    it('returns empty data for null targetId', async () => {
      const result = await JoinHandlers.getTableDataForTarget('');

      expect(result).toEqual({ data: [], columns: [] });
    });

    it('returns source data when target is a source', async () => {
      const sourceData = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ];
      AppStore.sources.value = [
        {
          id: 'src_1',
          name: 'Users',
          data: sourceData,
          columns: [
            { name: 'id', type: 'number' },
            { name: 'name', type: 'string' },
          ],
        } as any,
      ];

      const result = await JoinHandlers.getTableDataForTarget('src_1');

      expect(result.data).toEqual(sourceData);
      expect(result.columns).toEqual(['id', 'name']);
    });

    it('returns model data when target is a model without steps', async () => {
      const modelData = [
        { product: 'A', price: 100 },
        { product: 'B', price: 200 },
      ];
      AppStore.models.value = [
        {
          id: 'mdl_1',
          name: 'Products',
          sourceId: 'src_1',
          data: modelData,
          steps: [],
          schema: [
            { name: 'product', type: 'string' },
            { name: 'price', type: 'number' },
          ],
        } as any,
      ];

      const result = await JoinHandlers.getTableDataForTarget('mdl_1');

      expect(result.data).toEqual(modelData);
      expect(result.columns).toEqual(['product', 'price']);
    });

    it('returns empty for non-existent target', async () => {
      AppStore.sources.value = [];
      AppStore.models.value = [];

      const result = await JoinHandlers.getTableDataForTarget('non_existent');

      expect(result).toEqual({ data: [], columns: [] });
    });

    it('derives columns from data when schema is missing', async () => {
      const sourceData = [{ a: 1, b: 2, c: 3 }];
      AppStore.sources.value = [
        {
          id: 'src_1',
          name: 'Test',
          data: sourceData,
          columns: null,
        } as any,
      ];

      const result = await JoinHandlers.getTableDataForTarget('src_1');

      expect(result.columns).toEqual(['a', 'b', 'c']);
    });
  });

  describe('getColumnsForTarget', () => {
    it('returns only columns without data', () => {
      AppStore.sources.value = [
        {
          id: 'src_1',
          name: 'Test',
          data: [{ x: 1, y: 2 }],
          columns: [
            { name: 'x', type: 'number' },
            { name: 'y', type: 'number' },
          ],
        } as any,
      ];

      const columns = JoinHandlers.getColumnsForTarget('src_1');

      expect(columns).toEqual(['x', 'y']);
    });
  });

  const createMockJoinState = (
    overrides: Partial<Record<keyof JoinDialogState, any>> = {}
  ): JoinDialogState => ({
    leftModel: signal<string | null>(overrides.leftModel ?? null),
    rightModel: signal<string | null>(overrides.rightModel ?? null),
    joinType: signal(overrides.joinType ?? 'left'),
    keyPairs: signal<(string | null)[][]>(overrides.keyPairs ?? [[null, null]]),
    suffixes: signal<string[]>(overrides.suffixes ?? ['_x', '_y']),
    targets: signal(overrides.targets ?? []),
    leftColumns: signal<string[]>(overrides.leftColumns ?? []),
    rightColumns: signal<string[]>(overrides.rightColumns ?? []),
    selectedLeftColumns: signal<string[]>(overrides.selectedLeftColumns ?? []),
    selectedRightColumns: signal<string[]>(overrides.selectedRightColumns ?? []),
    saveAsNewModel: signal<boolean>(overrides.saveAsNewModel ?? false),
    previewData: signal<any | null>(overrides.previewData ?? null),
    previewError: signal<string | null>(overrides.previewError ?? null),
    isPreviewing: signal<boolean>(overrides.isPreviewing ?? false),
    keyPairAnalysis: signal(overrides.keyPairAnalysis ?? []),
    previewTableId: signal<string | null>(overrides.previewTableId ?? null),
    previewMismatchValues: signal(overrides.previewMismatchValues ?? null),
  });

  describe('analyzeJoinKeys', () => {
    beforeEach(() => {
      // Set up two sources for join analysis
      AppStore.sources.value = [
        {
          id: 'left_src',
          name: 'Left',
          data: [
            { id: 1, name: 'Alice' },
            { id: 2, name: 'Bob' },
            { id: 3, name: 'Carol' },
          ],
          columns: [
            { name: 'id', type: 'number' },
            { name: 'name', type: 'string' },
          ],
        } as any,
        {
          id: 'right_src',
          name: 'Right',
          data: [
            { user_id: 1, salary: 50000 },
            { user_id: 2, salary: 60000 },
            { user_id: 4, salary: 70000 },
          ],
          columns: [
            { name: 'user_id', type: 'number' },
            { name: 'salary', type: 'number' },
          ],
        } as any,
      ];
    });

    it('returns empty analysis when left model is not set', () => {
      const state = createMockJoinState({
        rightModel: 'right_src',
        keyPairs: [['id', 'user_id']],
      });

      JoinHandlers.analyzeJoinKeys(state);

      expect(state.keyPairAnalysis.value).toEqual([]);
    });

    it('returns empty analysis when right model is not set', () => {
      const state = createMockJoinState({
        leftModel: 'left_src',
        keyPairs: [['id', 'user_id']],
      });

      JoinHandlers.analyzeJoinKeys(state);

      expect(state.keyPairAnalysis.value).toEqual([]);
    });

    it('analyzes key pairs with matching values', async () => {
      const state = createMockJoinState({
        leftModel: 'left_src',
        rightModel: 'right_src',
        keyPairs: [['id', 'user_id']],
      });

      await JoinHandlers.analyzeJoinKeys(state);

      const analysis = state.keyPairAnalysis.value;
      expect(analysis).toHaveLength(1);

      const keyAnalysis = analysis[0];
      expect(keyAnalysis.leftCol).toBe('id');
      expect(keyAnalysis.rightCol).toBe('user_id');
      expect(keyAnalysis.leftUnique).toBe(3); // 1, 2, 3
      expect(keyAnalysis.rightUnique).toBe(3); // 1, 2, 4
      expect(keyAnalysis.matches).toBe(2); // 1 and 2 match
      expect(keyAnalysis.leftOnly).toBe(1); // 3 only in left
      expect(keyAnalysis.rightOnly).toBe(1); // 4 only in right
    });

    it('returns zeroed analysis for incomplete key pairs', async () => {
      const state = createMockJoinState({
        leftModel: 'left_src',
        rightModel: 'right_src',
        keyPairs: [['id', null]],
      });

      await JoinHandlers.analyzeJoinKeys(state);

      const analysis = state.keyPairAnalysis.value;
      expect(analysis).toHaveLength(1);
      expect(analysis[0].matches).toBe(0);
      expect(analysis[0].leftUnique).toBe(0);
    });

    it('detects duplicate values in columns', async () => {
      AppStore.sources.value = [
        {
          id: 'left_src',
          name: 'Left',
          data: [
            { category: 'A', value: 1 },
            { category: 'A', value: 2 },
            { category: 'B', value: 3 },
          ],
          columns: [{ name: 'category', type: 'string' }],
        } as any,
        {
          id: 'right_src',
          name: 'Right',
          data: [
            { cat: 'A', score: 10 },
            { cat: 'B', score: 20 },
          ],
          columns: [{ name: 'cat', type: 'string' }],
        } as any,
      ];

      const state = createMockJoinState({
        leftModel: 'left_src',
        rightModel: 'right_src',
        keyPairs: [['category', 'cat']],
      });

      await JoinHandlers.analyzeJoinKeys(state);

      const analysis = state.keyPairAnalysis.value[0];
      expect(analysis.leftHasDuplicates).toBe(true);
      expect(analysis.rightHasDuplicates).toBe(false);
    });

    it('handles null values in join columns', async () => {
      AppStore.sources.value = [
        {
          id: 'left_src',
          name: 'Left',
          data: [
            { id: 1, name: 'Alice' },
            { id: null, name: 'Unknown' },
            { id: 2, name: 'Bob' },
          ],
          columns: [{ name: 'id', type: 'number' }],
        } as any,
        {
          id: 'right_src',
          name: 'Right',
          data: [
            { user_id: 1, salary: 50000 },
            { user_id: null, salary: 0 },
          ],
          columns: [{ name: 'user_id', type: 'number' }],
        } as any,
      ];

      const state = createMockJoinState({
        leftModel: 'left_src',
        rightModel: 'right_src',
        keyPairs: [['id', 'user_id']],
      });

      await JoinHandlers.analyzeJoinKeys(state);

      const analysis = state.keyPairAnalysis.value[0];
      expect(analysis.leftTotalRows).toBe(3);
      expect(analysis.leftNonNullRows).toBe(2);
      expect(analysis.rightTotalRows).toBe(2);
      expect(analysis.rightNonNullRows).toBe(1);
      // Null counts surface to the editor as a "won't match" warning badge.
      expect(analysis.leftNulls).toBe(1);
      expect(analysis.rightNulls).toBe(1);
    });

    it('calculates match percentages correctly', async () => {
      AppStore.sources.value = [
        {
          id: 'left_src',
          name: 'Left',
          data: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
          columns: [{ name: 'id', type: 'number' }],
        } as any,
        {
          id: 'right_src',
          name: 'Right',
          data: [{ user_id: 1 }, { user_id: 2 }],
          columns: [{ name: 'user_id', type: 'number' }],
        } as any,
      ];

      const state = createMockJoinState({
        leftModel: 'left_src',
        rightModel: 'right_src',
        keyPairs: [['id', 'user_id']],
      });

      await JoinHandlers.analyzeJoinKeys(state);

      const analysis = state.keyPairAnalysis.value[0];
      expect(analysis.leftMatchPercent).toBe(50); // 2 of 4 match
      expect(analysis.rightMatchPercent).toBe(100); // 2 of 2 match
    });
  });
});
