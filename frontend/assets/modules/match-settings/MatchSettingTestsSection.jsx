import { Button } from '#components/common/Button';

export default function MatchSettingTestsSection({
  addLabel,
  emptyText,
  isEditable,
  onAddTestCase,
  onChangeTestCase,
  onRemoveTestCase,
  outputPrefix,
  sectionDescription,
  sectionTitle,
  tests,
  styles,
}) {
  return (
    <div className={styles.card}>
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>{sectionTitle}</h2>
          <p className={styles.sectionDescription}>{sectionDescription}</p>
        </div>
        <div className={styles.testList}>
          {tests.length === 0 ? (
            <p className={styles.emptyHint}>{emptyText}</p>
          ) : null}
          {tests.map((testCase) => {
            const { id, input, output } = testCase;
            const inputId = `${outputPrefix}-input-${id}`;
            const outputId = `${outputPrefix}-output-${id}`;
            return (
              <div key={id} className={styles.testRow}>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel} htmlFor={inputId}>
                    Input
                  </label>
                  <textarea
                    id={inputId}
                    className={styles.textarea}
                    value={input}
                    onChange={(event) =>
                      onChangeTestCase(id, 'input', event.target.value)
                    }
                    placeholder='e.g. [1,2,3]'
                    disabled={!isEditable}
                  />
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel} htmlFor={outputId}>
                    Expected output
                  </label>
                  <textarea
                    id={outputId}
                    className={styles.textarea}
                    value={output}
                    onChange={(event) =>
                      onChangeTestCase(id, 'output', event.target.value)
                    }
                    placeholder='e.g. 6'
                    disabled={!isEditable}
                  />
                </div>
                <div className={styles.testActions}>
                  <Button
                    variant='ghost'
                    size='sm'
                    type='button'
                    onClick={() => onRemoveTestCase(id)}
                    disabled={!isEditable}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        <Button
          variant='secondary'
          type='button'
          onClick={onAddTestCase}
          disabled={!isEditable}
        >
          {addLabel}
        </Button>
      </div>
    </div>
  );
}
