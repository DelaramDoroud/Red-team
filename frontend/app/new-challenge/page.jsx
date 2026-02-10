'use client';

import { useEffect, useRef, useState } from 'react';
import AlertDialog from '#components/common/AlertDialog';
import {
  buildDefaultDateTimes,
  buildMinimumEndDate,
  isValidYearValue,
  parsePositiveInt,
} from '#js/challenge-form-utils';
import * as Constants from '#js/constants';
import { useRouter } from '#js/router';
import useChallenge from '#js/useChallenge';
import useMatchSettings from '#js/useMatchSetting';
import useRoleGuard from '#js/useRoleGuard';
import ChallengeForm from '../challenges/challenge-form/ChallengeForm';
import {
  parseChallengeMutationError,
  toISODateTime,
} from '../challenges/challenge-form/errorUtils';
import useChallengeFormState from '../challenges/challenge-form/useChallengeFormState';
import styles from './page.module.css';

export default function NewChallengePage() {
  const defaultDateTimes = buildDefaultDateTimes({
    durationMinutes: 30,
    peerReviewMinutes: 30,
  });
  const { isAuthorized } = useRoleGuard({
    allowedRoles: ['teacher', 'admin'],
  });
  const router = useRouter();
  const { getMatchSettingsReady } = useMatchSettings();
  const { createChallenge } = useChallenge();
  const mountedRef = useRef(false);

  const [challenge, setChallenge] = useState({
    title: '',
    startDatetime: defaultDateTimes.startDatetime,
    endDatetime: defaultDateTimes.endDatetime,
    startDatetimeInput: defaultDateTimes.startDatetimeInput,
    endDatetimeInput: defaultDateTimes.endDatetimeInput,
    duration: '30',
    allowedNumberOfReview: '5',
    matchSettingIds: [],
    status: Constants.ChallengeStatus.PUBLIC,
    durationPeerReview: '30',
  });
  const [matchSettings, setMatchSettings] = useState([]);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [overlapDialogOpen, setOverlapDialogOpen] = useState(false);
  const [overlapPayload, setOverlapPayload] = useState(null);

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
  });

  useEffect(() => {
    mountedRef.current = true;

    const loadData = async () => {
      try {
        const result = await getMatchSettingsReady();
        if (!mountedRef.current) return;

        if (result?.success === false) {
          setMatchSettings([]);
        } else if (Array.isArray(result)) {
          setMatchSettings(result);
        } else if (Array.isArray(result?.data)) {
          setMatchSettings(result.data);
        } else {
          setMatchSettings([]);
        }
      } catch {
        if (mountedRef.current) {
          setError('Error loading match settings');
        }
      }
    };

    loadData();

    return () => {
      mountedRef.current = false;
    };
  }, [getMatchSettingsReady]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!isAuthorized) return;

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
      const result = await createChallenge(payload);
      if (result?.success) {
        setSuccessMessage('Challenge created successfully! Redirecting...');
        setTimeout(() => {
          router.push('/challenges');
        }, 3000);
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

  if (!isAuthorized) return null;

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

      const overrideResult = await createChallenge(overridePayload);
      if (overrideResult?.success) {
        setChallenge((prev) => ({
          ...prev,
          status: Constants.ChallengeStatus.PRIVATE,
        }));
        setSuccessMessage(
          'Challenge created as private because it overlaps another challenge. Redirecting...'
        );
        setTimeout(() => {
          router.push('/challenges');
        }, 3000);
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
    setError('Challenge creation cancelled.');
  };

  return (
    <>
      <ChallengeForm
        canPickEndDate={canPickEndDate}
        challenge={challenge}
        currentItems={currentItems}
        currentPage={currentPage}
        error={error}
        formDisabled={false}
        getMinDateTimeValue={getMinDateTimeValue}
        getMinEndDateValue={getMinEndDateValue}
        headingDescription='Fill out the form below to create a new challenge.'
        headingTitle='Create New Challenge'
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
        submitLabel='Create'
        submitLoadingLabel='Creating…'
        submitTestId='create-challenge-button'
        submitTitle='Create this challenge'
        successMessage={successMessage}
        toggleSetting={toggleSetting}
        toggleStatus={toggleStatus}
        totalPages={totalPages}
      />
      <AlertDialog
        open={overlapDialogOpen}
        title='Overlap detected'
        description='This challenge overlaps with an existing one. Create it anyway? It will be saved as private.'
        confirmLabel='Create as private'
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
