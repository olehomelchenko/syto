import type { Signal } from '@preact/signals';
import { useTranslation } from 'preact-i18next';
import { GeneratorType } from '../../services/GeneratorService';
import formStyles from '../form-controls.module.css';
import genStyles from '../GenerateDialog.module.css';
const styles = { ...formStyles, ...genStyles };

const generatorIcons: Record<GeneratorType, string> = {
  numberSequence: 'carbon:list-number',
  dateSequence: 'carbon:calendar',
  randomNumber: 'carbon:hashtag',
  randomDate: 'carbon:calendar-tools',
  randomBoolean: 'carbon:boolean',
  randomCategory: 'carbon:direction-loop',
};

const GENERATOR_TYPE_KEYS: Record<GeneratorType, string> = {
  numberSequence: 'generate.types.numberSequence',
  dateSequence: 'generate.types.dateSequence',
  randomNumber: 'generate.types.randomNumber',
  randomDate: 'generate.types.randomDate',
  randomBoolean: 'generate.types.randomBoolean',
  randomCategory: 'generate.types.randomCategory',
};

const GENERATOR_TYPES: GeneratorType[] = [
  'numberSequence',
  'dateSequence',
  'randomNumber',
  'randomDate',
  'randomBoolean',
  'randomCategory',
];

interface GeneratorTypeSelectorProps {
  type: Signal<string>;
  onChange: (type: GeneratorType) => void;
}

export function GeneratorTypeSelector({ type, onChange }: GeneratorTypeSelectorProps) {
  const { t } = useTranslation('dialogs');
  return (
    <div class={styles.group}>
      <label class={styles.label}>{t('generate.generatorType')}</label>
      <div class={styles.grid3} style={{ marginBottom: '1rem' }}>
        {GENERATOR_TYPES.map((gt) => (
          <label key={gt} class={styles.radioLabelCentered}>
            {/* TODO: a11y — radios are visually replaced by icon labels but
                hidden via `display: none`, which removes them from the
                accessibility tree entirely. Use `.visually-hidden` (clip-path /
                width:1px) instead so screen readers and keyboard users can still
                reach the controls. */}
            <input
              type="radio"
              name="generatorType"
              value={gt}
              checked={type.value === gt}
              onChange={() => onChange(gt)}
              style={{ display: 'none' }}
            />
            <span
              class="iconify"
              aria-hidden="true"
              data-icon={generatorIcons[gt]}
              style={{ fontSize: '16px' }}
            ></span>
            <span style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
              {t(GENERATOR_TYPE_KEYS[gt])}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
