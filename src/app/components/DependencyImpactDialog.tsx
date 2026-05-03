import { AppStore } from '../stores/AppStore';
import styles from './App.module.css';
import { useTranslation } from 'preact-i18next';

export function DependencyImpactDialog() {
  const { t } = useTranslation('common');
  const modal = AppStore.dependencyImpactModal.value;

  if (!modal.visible) return null;

  const handleCancel = () => {
    if (modal.resolve) modal.resolve(null);
    AppStore.dependencyImpactModal.value = { ...modal, visible: false };
  };

  const handleContinue = () => {
    if (modal.resolve) modal.resolve(modal.action);
    AppStore.dependencyImpactModal.value = { ...modal, visible: false };
  };

  const handleActionChange = (action: 'mark-stale' | 'recalculate') => {
    AppStore.dependencyImpactModal.value = { ...modal, action };
  };

  const count = modal.dependentModels.length;

  return (
    <div class={styles.centeredModalBackdrop} style={{ zIndex: 10000 }} onClick={handleCancel}>
      <div
        class={styles.centeredModal}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dependency-impact-title"
        style={{ maxWidth: '500px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div class={styles.centeredModalHeader}>
          <h2 id="dependency-impact-title">⚠️ {t('dependencyDialog.title')}</h2>
          <button onClick={handleCancel} aria-label={t('buttons.close')}>
            ×
          </button>
        </div>

        <div class={styles.centeredModalContent} style={{ padding: '20px' }}>
          <p
            style={{ marginBottom: '16px' }}
            dangerouslySetInnerHTML={{
              __html: t('dependencyDialog.message', { count }),
            }}
          ></p>

          <div style={{ marginBottom: '20px', maxHeight: '200px', overflowY: 'auto' }}>
            {modal.dependentModels.map((dep) => (
              <div
                key={dep.id}
                style={{
                  padding: '8px 12px',
                  marginBottom: '4px',
                  background: 'var(--color-bg-secondary)',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
              >
                <div style={{ fontWeight: '500' }}>
                  📊 {dep.sourceName} → {dep.name}
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--color-text-secondary)',
                    marginTop: '2px',
                  }}
                >
                  {dep.id}
                </div>
              </div>
            ))}
          </div>

          <p style={{ marginBottom: '12px', fontWeight: '500' }}>
            {t('dependencyDialog.question')}
          </p>

          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              padding: '10px',
              marginBottom: '8px',
              border: '1px solid var(--color-border)',
              borderRadius: '4px',
              cursor: 'pointer',
              background:
                modal.action === 'mark-stale' ? 'var(--color-bg-secondary)' : 'transparent',
            }}
          >
            <input
              type="radio"
              name="action"
              value="mark-stale"
              checked={modal.action === 'mark-stale'}
              onChange={() => handleActionChange('mark-stale')}
              style={{ marginTop: '3px' }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '500', marginBottom: '4px' }}>
                {t('dependencyDialog.markStale.title')}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                {t('dependencyDialog.markStale.description')}
              </div>
            </div>
          </label>

          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              padding: '10px',
              border: '1px solid var(--color-border)',
              borderRadius: '4px',
              cursor: 'pointer',
              background:
                modal.action === 'recalculate' ? 'var(--color-bg-secondary)' : 'transparent',
            }}
          >
            <input
              type="radio"
              name="action"
              value="recalculate"
              checked={modal.action === 'recalculate'}
              onChange={() => handleActionChange('recalculate')}
              style={{ marginTop: '3px' }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '500', marginBottom: '4px' }}>
                {t('dependencyDialog.recalculate.title')}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                {t('dependencyDialog.recalculate.description')}
              </div>
            </div>
          </label>
        </div>

        <div class={styles.centeredModalFooter}>
          <button onClick={handleCancel} style={{ marginRight: '8px' }}>
            {t('buttons.cancel')}
          </button>
          <button onClick={handleContinue} class="button-primary">
            {t('buttons.continue')}
          </button>
        </div>
      </div>
    </div>
  );
}
