import { AppStore } from '../stores/AppStore';
import { Source, Model } from '../types';
import { SchemaEngine } from '../../core/schema-engine';
import { PersistenceService } from './PersistenceService';
import { StepService } from './StepService';
import { NameService } from './NameService';
import { showSuccess } from '../handlers/core/notification-handlers';
import { metricsCollector } from '../infrastructure/metrics';
import i18n from '../../i18n';

/**
 * ImportService
 *
 * Handles data import logic and updates the AppStore.
 * Replaces logic previously found in import-handlers.ts.
 */
export class ImportService {
  /**
   * Finalizes the import process and creates a new source and model
   */
  static async createSource(
    file: File,
    sourceName: string,
    columns: string[],
    data: any[],
    headerMode: string,
    delimiter: string,
    customHeaders: string[] | null = null,
    origin = 'file',
    updatePagination: () => void,
    closeDialog: (force?: boolean) => void
  ) {
    const importStart = performance.now();

    // Validation
    if (columns.some((c) => !c || c.trim() === '')) {
      throw new Error('Column names cannot be empty.');
    }

    const cleanData = data;

    // Ensure unique source name across all sources
    const uniqueSourceName = NameService.suggestUniqueName(sourceName, (n) =>
      NameService.isSourceNameTaken(n)
    );

    // Use physical types for the dataset (what PapaParse gives us after dynamicTyping)
    // Logical type inference happens in the model's first types step
    const physicalSchema = SchemaEngine.createPhysicalSchema(cleanData);
    const source: Source = {
      id: `src_${Date.now()}`,
      name: uniqueSourceName,
      fileName: file.name,
      origin: origin,
      delimiter: delimiter,
      headerMode: headerMode as 'first-row' | 'auto-generate' | 'manual',
      customHeaders: customHeaders || null,
      rawSize: file.size,
      rowCount: cleanData.length,
      colCount: physicalSchema.length,
      columns: physicalSchema,
      createdAt: new Date().toISOString(),
      data: cleanData,
      __v: 1,
    };

    AppStore.sources.value = [...AppStore.sources.value, source];

    const uniqueModelName = NameService.suggestUniqueName('main', (n) =>
      NameService.isModelNameTaken(n, source.id)
    );

    const mainModel: Model = {
      id: `mdl_${Date.now()}`,
      name: uniqueModelName,
      sourceId: source.id,
      steps: [],
      schema: JSON.parse(JSON.stringify(source.columns)),
      data: cleanData,
      __v: 1,
    };

    // Initial steps: import (metadata) + types (logical type inference)
    const [importStep, typesStep] = StepService.createInitialSteps(source);
    mainModel.steps.push(importStep, typesStep);

    // Compute final data and schema after initial steps
    const context = { sources: AppStore.sources.value, models: AppStore.models.value };
    const result = StepService.computeModelUpToStep(mainModel, mainModel.steps.length - 1, context);

    mainModel.data = result.data;
    mainModel.schema = result.schema;
    mainModel.rowCount = result.data.length;
    mainModel.colCount = result.schema.length;

    AppStore.models.value = [...AppStore.models.value, mainModel];

    // Update active state
    AppStore.activeModel.value = mainModel;
    AppStore.currentData.value = result.data;
    AppStore.columns.value = result.columns;
    AppStore.viewMode.value = 'model';
    AppStore.activeStepIndex.value = mainModel.steps.length - 1;
    AppStore.viewingIntermediate.value = false;

    updatePagination();
    await PersistenceService.autoSave();

    metricsCollector.record({
      transformType: `import:${origin}`,
      durationMs: performance.now() - importStart,
      success: true,
    });

    showSuccess(
      i18n.t('notifications.imported', { ns: 'common', name: file.name, count: cleanData.length })
    );
    closeDialog(true);
  }
}
