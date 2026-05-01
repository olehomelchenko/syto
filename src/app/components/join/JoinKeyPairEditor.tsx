import { useTranslation } from 'preact-i18next';
import formStyles from '../form-controls.module.css';
import colStyles from '../column-editor.module.css';
const styles = { ...formStyles, ...colStyles };
import joinStyles from '../JoinDialog.module.css';
import type { KeyPairAnalysis } from '../../handlers/transform/join-handlers';

interface JoinKeyPairEditorProps {
  index: number;
  pair: [string | null, string | null];
  leftColumns: string[];
  rightColumns: string[];
  analysis?: KeyPairAnalysis;
  canRemove: boolean;
  onUpdate: (index: number, position: 0 | 1, value: string | null) => void;
  onRemove: (index: number) => void;
  onShowMismatch: (values: any[], column: string, side: 'left' | 'right') => void;
}

export function JoinKeyPairEditor({
  index,
  pair,
  leftColumns,
  rightColumns,
  analysis,
  canRemove,
  onUpdate,
  onRemove,
  onShowMismatch,
}: JoinKeyPairEditorProps) {
  const { t } = useTranslation('dialogs');
  const hasLeftError = !pair[0];
  const hasRightError = !pair[1];
  const hasError = hasLeftError || hasRightError;

  return (
    <div class={joinStyles.keyPairContainer}>
      <div class={styles.keyGrid}>
        <select
          class={`${styles.input} ${hasLeftError ? joinStyles.inputError : ''}`}
          style={{ flex: 1 }}
          value={pair[0] || ''}
          onChange={(e) => onUpdate(index, 0, e.currentTarget.value || null)}
        >
          <option value="">{t('joinKeyPairEditor.selectLeft')}</option>
          {leftColumns.map((col) => (
            <option key={col} value={col}>
              {col}
            </option>
          ))}
        </select>
        <span>=</span>
        <select
          class={`${styles.input} ${hasRightError ? joinStyles.inputError : ''}`}
          style={{ flex: 1 }}
          value={pair[1] || ''}
          onChange={(e) => onUpdate(index, 1, e.currentTarget.value || null)}
        >
          <option value="">{t('joinKeyPairEditor.selectRight')}</option>
          {rightColumns.map((col) => (
            <option key={col} value={col}>
              {col}
            </option>
          ))}
        </select>
        <button
          class="button button--secondary button--small"
          onClick={() => onRemove(index)}
          disabled={!canRemove}
          title={t('joinKeyPairEditor.removeKeyPair')}
        >
          ×
        </button>
      </div>

      {/* Validation Errors */}
      {hasError && (
        <div class={joinStyles.validationError}>
          {hasLeftError && <span>{t('joinKeyPairEditor.leftRequired')}</span>}
          {hasLeftError && hasRightError && <span> • </span>}
          {hasRightError && <span>{t('joinKeyPairEditor.rightRequired')}</span>}
        </div>
      )}

      {/* Analysis Results */}
      {!hasError && analysis && pair[0] && pair[1] && (
        <div class={joinStyles.analysisBox}>
          <div class={joinStyles.analysisRow}>
            <span class={joinStyles.analysisLabel}>{t('joinKeyPairEditor.leftLabel')}</span>
            <span>
              {analysis.leftUnique} {t('joinKeyPairEditor.uniqueValues')}
            </span>
            {analysis.leftHasDuplicates && (
              <span
                class={joinStyles.warningBadge}
                title={t('joinKeyPairEditor.duplicatesTooltip')}
              >
                ⚠️ {t('joinKeyPairEditor.duplicates')}
              </span>
            )}
            {analysis.leftNulls > 0 && (
              <span class={joinStyles.warningBadge} title={t('joinKeyPairEditor.nullKeysTooltip')}>
                ⚠️ {t('joinKeyPairEditor.nullKeys', { count: analysis.leftNulls })}
              </span>
            )}
          </div>
          <div class={joinStyles.analysisRow}>
            <span class={joinStyles.analysisLabel}>{t('joinKeyPairEditor.rightLabel')}</span>
            <span>
              {analysis.rightUnique} {t('joinKeyPairEditor.uniqueValues')}
            </span>
            {analysis.rightHasDuplicates && (
              <span
                class={joinStyles.warningBadge}
                title={t('joinKeyPairEditor.duplicatesTooltip')}
              >
                ⚠️ {t('joinKeyPairEditor.duplicates')}
              </span>
            )}
            {analysis.rightNulls > 0 && (
              <span class={joinStyles.warningBadge} title={t('joinKeyPairEditor.nullKeysTooltip')}>
                ⚠️ {t('joinKeyPairEditor.nullKeys', { count: analysis.rightNulls })}
              </span>
            )}
          </div>
          <div class={joinStyles.analysisDivider}></div>
          <div class={joinStyles.analysisRow}>
            <span class={joinStyles.analysisLabel}>{t('joinKeyPairEditor.matchesLabel')}</span>
            <span class={joinStyles.matchCount}>{analysis.matches}</span>
            <span class={joinStyles.analysisLabel}>{t('joinKeyPairEditor.matchesValues')}</span>
          </div>
          <div class={joinStyles.analysisRow}>
            <span class={joinStyles.analysisLabel}>{t('joinKeyPairEditor.leftMatchLabel')}</span>
            <span class={joinStyles.matchPercent}>{analysis.leftMatchPercent}%</span>
            <span class={joinStyles.analysisLabel}>{t('joinKeyPairEditor.leftMatchDesc')}</span>
          </div>
          <div class={joinStyles.analysisRow}>
            <span class={joinStyles.analysisLabel}>{t('joinKeyPairEditor.rightMatchLabel')}</span>
            <span class={joinStyles.matchPercent}>{analysis.rightMatchPercent}%</span>
            <span class={joinStyles.analysisLabel}>{t('joinKeyPairEditor.rightMatchDesc')}</span>
          </div>
          <div class={joinStyles.analysisDivider}></div>
          <div class={joinStyles.analysisRow}>
            <span class={joinStyles.analysisLabel}>{t('joinKeyPairEditor.leftOnlyLabel')}</span>
            <button
              class={joinStyles.clickableCount}
              onClick={() =>
                onShowMismatch(analysis.leftOnlyValues, analysis.leftCol || '', 'left')
              }
              disabled={analysis.leftOnly === 0}
              title={t('joinKeyPairEditor.clickToView')}
            >
              {analysis.leftOnly}
            </button>
            <span class={joinStyles.analysisLabel}>
              {t('joinKeyPairEditor.leftOnlyPercent', { percent: analysis.leftOnlyPercent })}
            </span>
          </div>
          <div class={joinStyles.analysisRow}>
            <span class={joinStyles.analysisLabel}>{t('joinKeyPairEditor.rightOnlyLabel')}</span>
            <button
              class={joinStyles.clickableCount}
              onClick={() =>
                onShowMismatch(analysis.rightOnlyValues, analysis.rightCol || '', 'right')
              }
              disabled={analysis.rightOnly === 0}
              title={t('joinKeyPairEditor.clickToView')}
            >
              {analysis.rightOnly}
            </button>
            <span class={joinStyles.analysisLabel}>
              {t('joinKeyPairEditor.rightOnlyPercent', { percent: analysis.rightOnlyPercent })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

interface JoinKeysEditorProps {
  keyPairs: [string | null, string | null][];
  leftColumns: string[];
  rightColumns: string[];
  keyPairAnalysis: KeyPairAnalysis[];
  onUpdate: (index: number, position: 0 | 1, value: string | null) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onShowMismatch: (values: any[], column: string, side: 'left' | 'right') => void;
}

export function JoinKeysEditor({
  keyPairs,
  leftColumns,
  rightColumns,
  keyPairAnalysis,
  onUpdate,
  onAdd,
  onRemove,
  onShowMismatch,
}: JoinKeysEditorProps) {
  const { t } = useTranslation('dialogs');
  return (
    <div class={styles.group}>
      <label class={styles.label}>{t('joinKeyPairEditor.joinKeysLabel')}</label>
      {keyPairs.map((pair, index) => (
        <JoinKeyPairEditor
          key={index}
          index={index}
          pair={pair}
          leftColumns={leftColumns}
          rightColumns={rightColumns}
          analysis={keyPairAnalysis[index]}
          canRemove={keyPairs.length > 1}
          onUpdate={onUpdate}
          onRemove={onRemove}
          onShowMismatch={onShowMismatch}
        />
      ))}
      <button class="button button--secondary button--small" onClick={onAdd}>
        {t('joinKeyPairEditor.addKeyPair')}
      </button>
      <div class={styles.helpText}>{t('joinKeyPairEditor.helpText')}</div>
    </div>
  );
}
