'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Field,
  FieldContent,
  FieldLabel,
  FieldSet,
} from '#components/common/Field';
import { Input } from '#components/common/Input';
import Spinner from '#components/common/Spinner';
import { getApiErrorMessage } from '#js/apiError';
import { MatchSettingStatus } from '#js/constants';
import { useRouter } from '#js/router';
import useMatchSettings from '#js/useMatchSetting';
import useRoleGuard from '#js/useRoleGuard';
import styles from './form.module.css';
import {
  createTestCaseId,
  getStatusLabel,
  getStatusVariant,
  mapTestCases,
  splitReferenceSolution,
} from './formUtils';
import MatchSettingActionsFooter from './MatchSettingActionsFooter';
import MatchSettingFormHeader from './MatchSettingFormHeader';
import MatchSettingReferenceSection from './MatchSettingReferenceSection';
import MatchSettingTestsSection from './MatchSettingTestsSection';
import useMatchSettingFormActions from './useMatchSettingFormActions';

export default function MatchSettingForm({ matchSettingId = null }) {
  const router = useRouter();
  const { isAuthorized } = useRoleGuard({
    allowedRoles: ['teacher', 'admin'],
  });
  const {
    getMatchSetting,
    createMatchSetting,
    updateMatchSetting,
    publishMatchSetting,
    unpublishMatchSetting,
    duplicateMatchSetting,
  } = useMatchSettings();

  const [currentId, setCurrentId] = useState(matchSettingId);
  const [formState, setFormState] = useState({
    problemTitle: '',
    problemDescription: '',
    referenceSolutionImports: '',
    referenceSolutionPrefix: '',
    referenceSolutionBody: '',
    referenceSolutionSuffix: '',
  });
  const [publicTests, setPublicTests] = useState([]);
  const [privateTests, setPrivateTests] = useState([]);
  const [status, setStatus] = useState(MatchSettingStatus.DRAFT);
  const [loading, setLoading] = useState(Boolean(matchSettingId));
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  useEffect(() => {
    setCurrentId(matchSettingId);
  }, [matchSettingId]);

  const loadMatchSetting = useCallback(async () => {
    if (!currentId) return;
    setLoading(true);
    setError(null);

    const result = await getMatchSetting(currentId);
    if (result?.success === false) {
      setError(getApiErrorMessage(result, 'Unable to load match setting.'));
      setLoading(false);
      return;
    }

    const data = result?.data || result;
    if (!data) {
      setError('Match setting not found.');
      setLoading(false);
      return;
    }

    const { imports, prefix, solution, suffix } = splitReferenceSolution(
      data.referenceSolution
    );

    setFormState({
      problemTitle: data.problemTitle || '',
      problemDescription: data.problemDescription || '',
      referenceSolutionImports: imports,
      referenceSolutionPrefix: prefix,
      referenceSolutionBody: solution,
      referenceSolutionSuffix: suffix,
    });
    setPublicTests(mapTestCases(data.publicTests));
    setPrivateTests(mapTestCases(data.privateTests));
    setStatus(data.status || MatchSettingStatus.DRAFT);
    setLoading(false);
  }, [currentId, getMatchSetting]);

  useEffect(() => {
    if (!currentId) {
      setLoading(false);
      return;
    }
    loadMatchSetting();
  }, [currentId, loadMatchSetting]);

  const statusLabel = useMemo(() => getStatusLabel(status), [status]);
  const statusVariant = useMemo(() => getStatusVariant(status), [status]);
  const isEditable = status !== MatchSettingStatus.READY;
  const isNew = !currentId;

  const {
    problemTitle,
    problemDescription,
    referenceSolutionImports,
    referenceSolutionPrefix,
    referenceSolutionBody,
    referenceSolutionSuffix,
  } = formState;

  const { handleDuplicate, handlePublish, handleSaveDraft, handleUnpublish } =
    useMatchSettingFormActions({
      createMatchSetting,
      currentId,
      duplicateMatchSetting,
      isNew,
      problemDescription,
      problemTitle,
      privateTests,
      publicTests,
      publishMatchSetting,
      referenceSolutionBody,
      referenceSolutionImports,
      referenceSolutionPrefix,
      referenceSolutionSuffix,
      router,
      setCurrentId,
      setDuplicating,
      setError,
      setPublishing,
      setSaving,
      setStatus,
      setSuccessMessage,
      setUnpublishing,
      unpublishMatchSetting,
      updateMatchSetting,
    });

  const updateFormField = useCallback((name, value) => {
    setFormState((prev) => ({
      ...prev,
      [name]: value,
    }));
  }, []);

  const handleFieldChange = (event) => {
    const { name, value } = event.target;
    updateFormField(name, value);
  };

  const handleImportsChange = (event) => {
    updateFormField('referenceSolutionImports', event.target.value);
  };

  const handlePrefixChange = (event) => {
    updateFormField('referenceSolutionPrefix', event.target.value);
  };

  const handleSolutionBodyChange = (event) => {
    updateFormField('referenceSolutionBody', event.target.value);
  };

  const handleSuffixChange = (event) => {
    updateFormField('referenceSolutionSuffix', event.target.value);
  };

  const updateTestCase = (setter, id, field, value) => {
    setter((prev) =>
      prev.map((testCase) => {
        if (testCase.id !== id) return testCase;
        return { ...testCase, [field]: value };
      })
    );
  };

  const addTestCase = (setter) => {
    setter((prev) => [
      ...prev,
      { id: createTestCaseId(), input: '', output: '' },
    ]);
  };

  const removeTestCase = (setter, id) => {
    setter((prev) => prev.filter((testCase) => testCase.id !== id));
  };

  const handleReferenceUpload = (event) => {
    const { files } = event.target;
    const [file] = files || [];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      const { imports, prefix, solution, suffix } =
        splitReferenceSolution(content);
      setFormState((prev) => ({
        ...prev,
        referenceSolutionImports: imports,
        referenceSolutionPrefix: prefix,
        referenceSolutionBody: solution,
        referenceSolutionSuffix: suffix,
      }));
      setSuccessMessage('Reference solution loaded from file.');
      setError(null);
    };
    reader.readAsText(file);
  };

  if (!isAuthorized) return null;

  if (loading && currentId) {
    return (
      <div className={styles.container}>
        <Spinner label='Loading match setting...' />
      </div>
    );
  }

  return (
    <section className={styles.container}>
      <MatchSettingFormHeader
        currentId={currentId}
        duplicating={duplicating}
        handleDuplicate={handleDuplicate}
        isNew={isNew}
        status={status}
        statusLabel={statusLabel}
        statusVariant={statusVariant}
        styles={styles}
      />

      <div className={styles.card}>
        <FieldSet>
          <Field orientation='vertical'>
            <FieldLabel htmlFor='problemTitle'>Match setting name</FieldLabel>
            <FieldContent>
              <Input
                id='problemTitle'
                name='problemTitle'
                value={problemTitle}
                onChange={handleFieldChange}
                placeholder='Enter a match setting name'
                disabled={!isEditable}
              />
            </FieldContent>
          </Field>
        </FieldSet>
      </div>

      <div className={styles.card}>
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Problem description</h2>
            <p className={styles.sectionDescription}>
              Add the prompt students will see when they start the match.
            </p>
          </div>
          <textarea
            id='problemDescription'
            name='problemDescription'
            className={styles.textarea}
            value={problemDescription}
            onChange={handleFieldChange}
            placeholder='Describe the challenge and any constraints.'
            disabled={!isEditable}
          />
        </div>
      </div>

      <MatchSettingReferenceSection
        handleImportsChange={handleImportsChange}
        handlePrefixChange={handlePrefixChange}
        handleReferenceUpload={handleReferenceUpload}
        handleSolutionBodyChange={handleSolutionBodyChange}
        handleSuffixChange={handleSuffixChange}
        isEditable={isEditable}
        referenceSolutionBody={referenceSolutionBody}
        referenceSolutionImports={referenceSolutionImports}
        referenceSolutionPrefix={referenceSolutionPrefix}
        referenceSolutionSuffix={referenceSolutionSuffix}
        styles={styles}
      />

      <MatchSettingTestsSection
        addLabel='Add public test'
        emptyText='No public tests yet. Add one to get started.'
        isEditable={isEditable}
        onAddTestCase={() => addTestCase(setPublicTests)}
        onChangeTestCase={(id, field, value) =>
          updateTestCase(setPublicTests, id, field, value)
        }
        onRemoveTestCase={(id) => removeTestCase(setPublicTests, id)}
        outputPrefix='public'
        sectionDescription='Public tests are visible to students after they run their code.'
        sectionTitle='Public test cases'
        tests={publicTests}
        styles={styles}
      />

      <MatchSettingTestsSection
        addLabel='Add private test'
        emptyText='No private tests yet. Add one to secure grading.'
        isEditable={isEditable}
        onAddTestCase={() => addTestCase(setPrivateTests)}
        onChangeTestCase={(id, field, value) =>
          updateTestCase(setPrivateTests, id, field, value)
        }
        onRemoveTestCase={(id) => removeTestCase(setPrivateTests, id)}
        outputPrefix='private'
        sectionDescription='Private tests are used for grading and not shown to students.'
        sectionTitle='Private test cases'
        tests={privateTests}
        styles={styles}
      />

      <MatchSettingActionsFooter
        error={error}
        handlePublish={handlePublish}
        handleSaveDraft={handleSaveDraft}
        handleUnpublish={handleUnpublish}
        isEditable={isEditable}
        publishing={publishing}
        saving={saving}
        status={status}
        styles={styles}
        successMessage={successMessage}
        unpublishing={unpublishing}
      />
    </section>
  );
}
