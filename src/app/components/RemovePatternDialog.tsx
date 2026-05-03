import { signal } from '@preact/signals';
import { useTranslation } from 'preact-i18next';
import { useDialogState } from '../hooks/useDialogState';
import { validateRegexPattern } from '../handlers/validation-engine';
import type { PatternMatchType } from '../../types/modes';
import styles from './form-controls.module.css';

export function RemovePatternDialog() {
  const { t } = useTranslation('dialogs');

  const { state } = useDialogState(
    (ctx) => ({
      pattern: signal<string>(ctx.editingStep?.removePattern?.pattern ?? ''),
      matchType: signal<PatternMatchType>(ctx.editingStep?.removePattern?.matchType ?? 'prefix'),
      error: signal<string | null>(null),
    }),
    {
      hasError: (s) => !s.pattern.value?.trim() || !!s.error.value,
      getError: (s) => s.error.value,
    }
  );

  const { pattern, matchType, error } = state;

  const validatePattern = () => {
    if (matchType.value === 'regex') {
      validateRegexPattern(pattern.value, { errorSignal: error });
    } else {
      error.value = null;
    }
  };

  return (
    <div>
      <p class={styles.helpText} style={{ marginBottom: '1rem' }}>
        {t('pattern.remove.help')}
      </p>

      <div class={styles.group}>
        <label class={styles.label}>{t('common.labels.pattern')}</label>
        <input
          type="text"
          class={styles.input}
          value={pattern.value}
          onInput={(e) => {
            pattern.value = (e.target as HTMLInputElement).value;
            validatePattern();
          }}
          placeholder={t('pattern.remove.placeholder')}
        />
      </div>

      <div class={styles.group}>
        {/* TODO: a11y — the <label> here labels the group, not the <select>. Either
            give the label an `htmlFor` matching an `id` on the select, or add
            `aria-labelledby` to the select. Same gap exists in the other pattern
            dialogs (SelectPatternDialog). */}
        <label class={styles.label}>{t('common.labels.matchType')}</label>
        <select
          class={styles.input}
          value={matchType.value}
          onChange={(e) => {
            matchType.value = (e.target as HTMLSelectElement).value as any;
            validatePattern();
          }}
        >
          <option value="prefix">{t('common.matchTypes.prefix')}</option>
          <option value="suffix">{t('common.matchTypes.suffix')}</option>
          <option value="contains">{t('common.matchTypes.contains')}</option>
          <option value="regex">{t('common.matchTypes.regex')}</option>
        </select>
        <p class={styles.helpText}>
          {matchType.value === 'prefix' && t('common.matchTypeHelp.prefix')}
          {matchType.value === 'suffix' && t('common.matchTypeHelp.suffix')}
          {matchType.value === 'contains' && t('common.matchTypeHelp.contains')}
          {matchType.value === 'regex' && t('common.matchTypeHelp.regex')}
        </p>
      </div>

      {error.value && (
        <div class={styles.error} style={{ marginTop: '1rem' }}>
          {error.value}
        </div>
      )}
    </div>
  );
}
