import { useCallback } from 'react';
import { getApiErrorMessage } from '#js/apiError';
import { MatchSettingStatus } from '#js/constants';
import {
  assembleReferenceSolution,
  isBlank,
  serializeTestCases,
} from './formUtils';

const buildPayload = ({
  problemDescription,
  problemTitle,
  privateTests,
  publicTests,
  referenceSolutionBody,
  referenceSolutionImports,
  referenceSolutionPrefix,
  referenceSolutionSuffix,
}) => ({
  problemTitle: problemTitle.trim(),
  problemDescription: problemDescription || '',
  referenceSolution: assembleReferenceSolution(
    referenceSolutionImports,
    referenceSolutionPrefix,
    referenceSolutionBody,
    referenceSolutionSuffix
  ),
  publicTests: serializeTestCases(publicTests),
  privateTests: serializeTestCases(privateTests),
});

const validatePublishPayload = (payload) => {
  if (isBlank(payload.problemDescription)) {
    return 'Problem description is required to publish.';
  }
  if (isBlank(payload.referenceSolution)) {
    return 'Reference solution is required to publish.';
  }
  if (!payload.publicTests.length) {
    return 'Add at least one public test case before publishing.';
  }
  if (!payload.privateTests.length) {
    return 'Add at least one private test case before publishing.';
  }
  return null;
};

export default function useMatchSettingFormActions({
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
}) {
  const validateTitle = useCallback(() => {
    if (isBlank(problemTitle)) {
      setError('Match setting name is required.');
      return false;
    }
    return true;
  }, [problemTitle, setError]);

  const persistDraft = useCallback(
    async (skipNavigation = false) => {
      if (!validateTitle()) return null;

      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      const payload = buildPayload({
        problemDescription,
        problemTitle,
        privateTests,
        publicTests,
        referenceSolutionBody,
        referenceSolutionImports,
        referenceSolutionPrefix,
        referenceSolutionSuffix,
      });

      const result = currentId
        ? await updateMatchSetting(currentId, payload)
        : await createMatchSetting(payload);

      if (result?.success === false) {
        setError(getApiErrorMessage(result, 'Unable to save match setting.'));
        setSaving(false);
        return null;
      }

      const data = result?.data || result;
      setSaving(false);
      setStatus(data.status || MatchSettingStatus.DRAFT);
      if (data?.id && !currentId) {
        setCurrentId(data.id);
        if (!skipNavigation) {
          router.replace(`/match-settings/${data.id}`);
        }
      }

      return data;
    },
    [
      createMatchSetting,
      currentId,
      privateTests,
      problemDescription,
      problemTitle,
      publicTests,
      referenceSolutionBody,
      referenceSolutionImports,
      referenceSolutionPrefix,
      referenceSolutionSuffix,
      router,
      setCurrentId,
      setError,
      setSaving,
      setStatus,
      setSuccessMessage,
      updateMatchSetting,
      validateTitle,
    ]
  );

  const handleSaveDraft = useCallback(async () => {
    const saved = await persistDraft();
    if (saved) {
      setSuccessMessage('Draft saved.');
    }
  }, [persistDraft, setSuccessMessage]);

  const handlePublish = useCallback(async () => {
    if (!validateTitle()) return;

    const payload = buildPayload({
      problemDescription,
      problemTitle,
      privateTests,
      publicTests,
      referenceSolutionBody,
      referenceSolutionImports,
      referenceSolutionPrefix,
      referenceSolutionSuffix,
    });

    const validationError = validatePublishPayload(payload);
    if (validationError) {
      setError(validationError);
      return;
    }

    setPublishing(true);
    setError(null);
    setSuccessMessage(null);

    const saved = await persistDraft(true);
    if (!saved?.id) {
      setPublishing(false);
      return;
    }

    const result = await publishMatchSetting(saved.id);
    if (result?.success === false) {
      setError(getApiErrorMessage(result, 'Unable to publish match setting.'));
      setPublishing(false);
      return;
    }

    const data = result?.data || result;
    setPublishing(false);
    setStatus(data.status || MatchSettingStatus.READY);
    setSuccessMessage('Match setting published.');
    if (data?.id && isNew) {
      router.replace(`/match-settings/${data.id}`);
    }
  }, [
    isNew,
    persistDraft,
    privateTests,
    problemDescription,
    problemTitle,
    publicTests,
    publishMatchSetting,
    referenceSolutionBody,
    referenceSolutionImports,
    referenceSolutionPrefix,
    referenceSolutionSuffix,
    router,
    setError,
    setPublishing,
    setStatus,
    setSuccessMessage,
    validateTitle,
  ]);

  const handleUnpublish = useCallback(async () => {
    if (!currentId) return;
    setUnpublishing(true);
    setError(null);
    setSuccessMessage(null);

    const result = await unpublishMatchSetting(currentId);
    if (result?.success === false) {
      setError(
        getApiErrorMessage(result, 'Unable to unpublish match setting.')
      );
      setUnpublishing(false);
      return;
    }

    const data = result?.data || result;
    setUnpublishing(false);
    setStatus(data.status || MatchSettingStatus.DRAFT);
    setSuccessMessage('Match setting saved as draft.');
  }, [
    currentId,
    setError,
    setStatus,
    setSuccessMessage,
    setUnpublishing,
    unpublishMatchSetting,
  ]);

  const handleDuplicate = useCallback(async () => {
    if (!currentId) return;
    setDuplicating(true);
    setError(null);
    setSuccessMessage(null);

    const result = await duplicateMatchSetting(currentId);
    if (result?.success === false) {
      setError(
        getApiErrorMessage(result, 'Unable to duplicate match setting.')
      );
      setDuplicating(false);
      return;
    }

    const data = result?.data || result;
    setDuplicating(false);
    if (data?.id) {
      router.push(`/match-settings/${data.id}`);
    }
  }, [
    currentId,
    duplicateMatchSetting,
    router,
    setDuplicating,
    setError,
    setSuccessMessage,
  ]);

  return {
    handleDuplicate,
    handlePublish,
    handleSaveDraft,
    handleUnpublish,
  };
}
