export default function MatchSettingReferenceSection({
  handleImportsChange,
  handlePrefixChange,
  handleReferenceUpload,
  handleSolutionBodyChange,
  handleSuffixChange,
  isEditable,
  referenceSolutionBody,
  referenceSolutionImports,
  referenceSolutionPrefix,
  referenceSolutionSuffix,
  styles,
}) {
  return (
    <div className={styles.card}>
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Reference solution</h2>
          <p className={styles.sectionDescription}>
            Split the solution into imports, fixed prefix, solution body, and
            fixed suffix to keep the template consistent.
          </p>
        </div>
        <div className={styles.gridTwo}>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor='solutionImports'>
              Imports
            </label>
            <textarea
              id='solutionImports'
              className={styles.textarea}
              value={referenceSolutionImports}
              onChange={handleImportsChange}
              placeholder='#include <bits/stdc++.h>'
              disabled={!isEditable}
            />
            <p className={styles.fieldHint}>
              Use only <code>#include</code> lines in this section.
            </p>
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor='solutionPrefix'>
              Fixed prefix
            </label>
            <textarea
              id='solutionPrefix'
              className={styles.textarea}
              value={referenceSolutionPrefix}
              onChange={handlePrefixChange}
              placeholder='e.g. int main() {'
              disabled={!isEditable}
            />
            <p className={styles.fieldHint}>
              This section stays before the editable solution body.
            </p>
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor='solutionBody'>
              Solution body
            </label>
            <textarea
              id='solutionBody'
              className={styles.textarea}
              value={referenceSolutionBody}
              onChange={handleSolutionBodyChange}
              placeholder='Write the reference implementation here.'
              disabled={!isEditable}
            />
            <p className={styles.fieldHint}>
              This is where the core solution logic goes.
            </p>
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor='solutionSuffix'>
              Fixed suffix
            </label>
            <textarea
              id='solutionSuffix'
              className={styles.textarea}
              value={referenceSolutionSuffix}
              onChange={handleSuffixChange}
              placeholder='e.g. }'
              disabled={!isEditable}
            />
            <p className={styles.fieldHint}>
              This section closes any fixed blocks from the prefix.
            </p>
          </div>
        </div>
        <div className={styles.uploadRow}>
          <label className={styles.uploadLabel} htmlFor='referenceUpload'>
            Upload solution file
          </label>
          <input
            id='referenceUpload'
            type='file'
            accept='.cpp,.c,.txt'
            onChange={handleReferenceUpload}
            disabled={!isEditable}
          />
        </div>
      </div>
    </div>
  );
}
