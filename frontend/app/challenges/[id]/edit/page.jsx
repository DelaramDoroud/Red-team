'use client';

import { useRef, useState } from 'react';
import AlertDialog from '#components/common/AlertDialog';
import Spinner from '#components/common/Spinner';
import {
  buildDefaultDateTimes,
  buildMinimumEndDate,
  isValidYearValue,
  parsePositiveInt,
} from '#js/challenge-form-utils';
import * as Constants from '#js/constants';
import { useParams, useRouter } from '#js/router';
import useChallenge from '#js/useChallenge';
import useMatchSettings from '#js/useMatchSetting';
import useRoleGuard from '#js/useRoleGuard';
import styles from '../../../new-challenge/page.module.css';
import ChallengeForm from '../../challenge-form/ChallengeForm';
import {
  parseChallengeMutationError,
  toISODateTime,
} from '../../challenge-form/errorUtils';
import useChallengeFormState from '../../challenge-form/useChallengeFormState';
import useEditChallengeLoader from '../../challenge-form/useEditChallengeLoader';

export default function EditChallengePage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthorized } = useRoleGuard({
    allowedRoles: ['teacher', 'admin'],
  });
  const { getMatchSettings, getMatchSetting } = useMatchSettings();
  const { getChallengeById, updateChallenge } = useChallenge();

  const challengeId = params?.id;
  const defaultDateTimes = buildDefaultDateTimes({
    durationMinutes: 30,
    peerReviewMinutes: 30,
  });

  const [challenge, setChallenge] = useState({
    title: '',
    startDatetime: defaultDateTimes.startDatetime,
    endDatetime: defaultDateTimes.endDatetime,
    startDatetimeInput: defaultDateTimes.startDatetimeInput,
    endDatetimeInput: defaultDateTimes.endDatetimeInput,
    duration: '30',
    allowedNumberOfReview: '5',
    matchSettingIds: [],
    status: Constants.ChallengeStatus.PRIVATE,
    durationPeerReview: '30',
  });
  const [matchSettings, setMatchSettings] = useState([]);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [loadingChallenge, setLoadingChallenge] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [overlapDialogOpen, setOverlapDialogOpen] = useState(false);
  const [overlapPayload, setOverlapPayload] = useState(null);
  const [initialStatus, setInitialStatus] = useState(null);

  const startPickerRef = useRef(null);
  const endPickerRef = useRef(null);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;
  const totalPages = Math.ceil(matchSettings.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentItems = matchSettings.slice(startIndex, endIndex);

  const {
    toggleSetting,
    toggleStatus,
    handleDataField,
    handleDatePickerChange,
    handleDateBlur,
    openPicker,
    canPickEndDate,
    getMinDateTimeValue,
    getMinEndDateValue,
  } = useChallengeFormState({
    challenge,
    setChallenge,
    canToggleStatus:
      !loadingChallenge && initialStatus === Constants.ChallengeStatus.PRIVATE,
  });

  useEditChallengeLoader({
    challengeId,
    getChallengeById,
    getMatchSetting,
    getMatchSettings,
    isAuthorized,
    setChallenge,
    setError,
    setInitialStatus,
    setLoadingChallenge,
    setMatchSettings,
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!isAuthorized) return;
    if (initialStatus !== Constants.ChallengeStatus.PRIVATE) return;

    setSuccessMessage(null);
    setError(null);

    const form = event.currentTarget;
    const titleInput = form?.querySelector?.('#title');
    const trimmedTitle = challenge.title.trim();
    if (titleInput && titleInput.value !== trimmedTitle) {
      titleInput.value = trimmedTitle;
    }
    if (trimmedTitle !== challenge.title) {
      setChallenge((prev) => ({ ...prev, title: trimmedTitle }));
    }

    const startInput = form?.querySelector?.('#startDatetime');
    const endInput = form?.querySelector?.('#endDatetime');

    if (startInput) startInput.setCustomValidity('');
    if (endInput) endInput.setCustomValidity('');

    if (
      startInput &&
      challenge.startDatetime &&
      !isValidYearValue(challenge.startDatetime)
    ) {
      startInput.setCustomValidity('Invalid date.');
    }
    if (
      endInput &&
      challenge.endDatetime &&
      !isValidYearValue(challenge.endDatetime)
    ) {
      endInput.setCustomValidity('Invalid date.');
    }

    const minEndDate = buildMinimumEndDate(challenge);
    if (endInput && challenge.endDatetime && minEndDate) {
      const endDate = new Date(challenge.endDatetime);
      if (Number.isNaN(endDate.getTime()) || endDate < minEndDate) {
        endInput.setCustomValidity(
          'End date/time must cover the coding and peer review durations.'
        );
      }
    }

    const isValid = form?.checkValidity ? form.checkValidity() : true;
    if (!isValid) {
      form?.reportValidity?.();
      return;
    }

    if (!challenge.matchSettingIds || challenge.matchSettingIds.length === 0) {
      setError('Select at least one match setting');
      return;
    }

    const payload = {
      ...challenge,
      title: trimmedTitle,
      duration: parsePositiveInt(challenge.duration) ?? 0,
      durationPeerReview: parsePositiveInt(challenge.durationPeerReview) ?? 0,
      allowedNumberOfReview:
        parsePositiveInt(challenge.allowedNumberOfReview) ?? 0,
      startDatetime: toISODateTime(challenge.startDatetime),
      endDatetime: toISODateTime(challenge.endDatetime),
    };

    setIsSubmitting(true);

    try {
      const result = await updateChallenge(challengeId, payload);
      if (result?.success) {
        setSuccessMessage('Challenge updated successfully! Redirecting...');
        setTimeout(() => {
          router.push(`/challenges/${challengeId}`);
        }, 2000);
        return;
      }

      const { message, code } = parseChallengeMutationError(result);
      if (code === 'challenge_overlap') {
        setOverlapPayload(payload);
        setOverlapDialogOpen(true);
        setIsSubmitting(false);
        return;
      }

      setError(message);
      setIsSubmitting(false);
    } catch (err) {
      setError(`Error: ${err.message}`);
      setIsSubmitting(false);
    }
  };

  const handleOverlapConfirm = async () => {
    if (!overlapPayload) return;

    setOverlapDialogOpen(false);
    setIsSubmitting(true);
    setError(null);

    try {
      const overridePayload = {
        ...overlapPayload,
        status: Constants.ChallengeStatus.PRIVATE,
        allowOverlap: true,
      };
      const overrideResult = await updateChallenge(
        challengeId,
        overridePayload
      );

      if (overrideResult?.success) {
        setChallenge((prev) => ({
          ...prev,
          status: Constants.ChallengeStatus.PRIVATE,
        }));
        setSuccessMessage(
          'Challenge saved as private because it overlaps another challenge. Redirecting...'
        );
        setTimeout(() => {
          router.push(`/challenges/${challengeId}`);
        }, 2000);
        return;
      }

      const overrideError = parseChallengeMutationError(overrideResult);
      setError(overrideError.message);
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
      setOverlapPayload(null);
    }
  };

  const handleOverlapCancel = () => {
    setOverlapDialogOpen(false);
    setOverlapPayload(null);
    setError('Challenge update cancelled.');
  };

  const formDisabled =
    loadingChallenge || initialStatus !== Constants.ChallengeStatus.PRIVATE;

  if (!isAuthorized) return null;

  if (loadingChallenge) {
    return (
      <div className={styles.main}>
        <div className={styles.card}>
          <Spinner label='Loading challenge details...' />
        </div>
      </div>
    );
  }

  return (
    <>
      <ChallengeForm
        canPickEndDate={canPickEndDate}
        challenge={challenge}
        currentItems={currentItems}
        currentPage={currentPage}
        error={error}
        formDisabled={formDisabled}
        getMinDateTimeValue={getMinDateTimeValue}
        getMinEndDateValue={getMinEndDateValue}
        headingDescription='Update the challenge details below.'
        headingTitle='Edit Challenge'
        isSubmitting={isSubmitting}
        onDateBlur={handleDateBlur}
        onDatePickerChange={handleDatePickerChange}
        onFieldChange={handleDataField}
        onPageChange={setCurrentPage}
        onSubmit={handleSubmit}
        openPicker={openPicker}
        startPickerRef={startPickerRef}
        endPickerRef={endPickerRef}
        styles={styles}
        submitLabel='Save changes'
        submitLoadingLabel='Saving...'
        submitTestId='update-challenge-button'
        submitTitle='Update this challenge'
        successMessage={successMessage}
        toggleSetting={toggleSetting}
        toggleStatus={toggleStatus}
        totalPages={totalPages}
      />
      <AlertDialog
        open={overlapDialogOpen}
        title='Overlap detected'
        description='This challenge overlaps with an existing one. Save it anyway? It will remain private.'
        confirmLabel='Save as private'
        cancelLabel='Cancel'
        confirmVariant='primary'
        cancelVariant='outline'
        confirmDisabled={isSubmitting}
        cancelDisabled={isSubmitting}
        onConfirm={handleOverlapConfirm}
        onCancel={handleOverlapCancel}
      />
    </>
  );
}
