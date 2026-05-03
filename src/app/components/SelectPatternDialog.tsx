import { signal } from '@preact/signals';
import { useTranslation } from 'preact-i18next';
import { useDialogState } from '../hooks/useDialogState';
import { validateRegexPattern } from '../handlers/validation-engine';
import type { PatternMatchType } from '../../types/modes';
import styles from './form-controls.module.css';

export function SelectPatternDialog() {
  const { t } = useTranslation('dialogs');

  const { state } = useDialogState(
    (ctx) => ({
      pattern: signal<string>(ctx.editingStep?.selectPattern?.pattern ?? ''),
      matchType: signal<PatternMatchType>(ctx.editingStep?.selectPattern?.matchType ?? 'prefix'),
      include: signal<string[]>(ctx.editingStep?.selectPattern?.include ?? []),
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
        {t('pattern.select.help')}
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
          placeholder={t('pattern.select.placeholder')}
        />
      </div>

      <div class={styles.group}>
        {/* TODO: a11y — see RemovePatternDialog for the same finding. The <label>
            wraps the group but is not associated with the <select>. Add
            `aria-labelledby` (or `htmlFor` + `id`) so assistive tech can announce
            it. */}
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
