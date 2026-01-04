'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import useMatchSettings from '#js/useMatchSetting';
import useChallenge from '#js/useChallenge';
import ToggleSwitch from '#components/common/ToggleSwitch';
import Pagination from '#components/common/Pagination';
import { Button } from '#components/common/Button';
import AlertDialog from '#components/common/AlertDialog';
import * as Constants from '#js/constants';
import useRoleGuard from '#js/useRoleGuard';
import styles from './page.module.css';

const parsePositiveInt = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const isValidYearValue = (value) => {
  if (typeof value !== 'string') return false;
  return /^20\d{2}-/.test(value);
};

const normalizeDateTimeInput = (value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;

  const slashMatch = trimmed.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4,})(?:,\s*(\d{1,2})(?::(\d{2}))?\s*([AaPp][Mm])?)?$/
  );
  if (slashMatch) {
    const [, part1, part2, yearRaw, hourRaw, minuteRaw, meridianRaw] =
      slashMatch;
    const year = yearRaw.slice(0, 4);
    let month = Number.parseInt(part1, 10);
    let day = Number.parseInt(part2, 10);

    if (month > 12 && day <= 12) {
      const swap = day;
      day = month;
      month = swap;
    }

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      let hour = hourRaw ? Number.parseInt(hourRaw, 10) : 0;
      const minute = minuteRaw ? Number.parseInt(minuteRaw, 10) : 0;
      const meridian = meridianRaw?.toUpperCase();
      if (meridian === 'PM' && hour < 12) hour += 12;
      if (meridian === 'AM' && hour === 12) hour = 0;
      const pad = (num) => String(num).padStart(2, '0');
      return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;
    }
  }

  const yearMatch = trimmed.match(/^(\d{4,})(.*)$/);
  if (yearMatch && yearMatch[1].length > 4) {
    return `${yearMatch[1].slice(0, 4)}${yearMatch[2] || ''}`;
  }

  return value;
};

export default function NewChallengePage() {
  const { isAuthorized } = useRoleGuard({
    allowedRoles: ['teacher', 'admin'],
  });
  const router = useRouter();
  const { getMatchSettingsReady } = useMatchSettings();
  const { createChallenge } = useChallenge();
  const mountedRef = useRef(false);
  const [challenge, setChallenge] = useState({
    title: '',
    startDatetime: '',
    endDatetime: '',
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

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;
  const totalPages = Math.ceil(matchSettings.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentItems = matchSettings.slice(startIndex, endIndex);

  const toggleSetting = (id) => {
    setChallenge((prev) => ({
      ...prev,
      matchSettingIds: prev.matchSettingIds.includes(id)
        ? prev.matchSettingIds.filter((s) => s !== id)
        : [...prev.matchSettingIds, id],
    }));
  };

  const handleDataField = (event) => {
    const newChallenge = { ...challenge };
    let { value } = event.target;

    if (
      event.target.name === 'startDatetime' ||
      event.target.name === 'endDatetime'
    ) {
      value = normalizeDateTimeInput(value);
    }

    if (
      event.target.name === 'duration' ||
      event.target.name === 'durationPeerReview' ||
      event.target.name === 'allowedNumberOfReview'
    ) {
      newChallenge[event.target.name] = value;
    } else {
      newChallenge[event.target.name] = value;
    }
    if (
      event.target.name === 'startDatetime' ||
      event.target.name === 'duration' ||
      event.target.name === 'durationPeerReview'
    ) {
      const startVal = newChallenge.startDatetime;
      const durationVal = parsePositiveInt(newChallenge.duration);
      const durationPeerReviewVal = parsePositiveInt(
        newChallenge.durationPeerReview
      );
      if (startVal && durationVal !== null && durationPeerReviewVal !== null) {
        const start = new Date(startVal);
        if (!Number.isNaN(start.getTime())) {
          const durationMs = (durationVal || 0) * 60 * 1000;
          const durationPeerReviewMs = (durationPeerReviewVal || 0) * 60 * 1000;
          const minEndDate = new Date(
            start.getTime() + durationMs + durationPeerReviewMs
          );

          const year = minEndDate.getFullYear();
          const month = String(minEndDate.getMonth() + 1).padStart(2, '0');
          const day = String(minEndDate.getDate()).padStart(2, '0');
          const hours = String(minEndDate.getHours()).padStart(2, '0');
          const minutes = String(minEndDate.getMinutes()).padStart(2, '0');

          newChallenge.endDatetime = `${year}-${month}-${day}T${hours}:${minutes}`;
        }
      }
    }
    setChallenge(newChallenge);
  };

  const toISODateTime = (localDateTime) => {
    if (!localDateTime) return null;
    const dt = new Date(localDateTime);
    return dt.toISOString();
  };

  const parseCreateError = (result) => {
    const fallback = { message: 'An unknown error occurred', code: null };
    if (!result?.message) return fallback;
    if (typeof result.message !== 'string') {
      return fallback;
    }
    if (!result.message.startsWith(Constants.NETWORK_RESPONSE_NOT_OK)) {
      return { message: result.message, code: null };
    }
    const rawMessage = result.message.slice(
      Constants.NETWORK_RESPONSE_NOT_OK.length
    );
    try {
      const jsonError = JSON.parse(rawMessage);
      const errorCode = jsonError?.error?.code || null;
      if (jsonError?.error?.errors?.length > 0) {
        return { message: jsonError.error.errors[0].message, code: errorCode };
      }
      if (jsonError?.message) {
        return { message: jsonError.message, code: errorCode };
      }
      if (jsonError?.error?.message) {
        return { message: jsonError.error.message, code: errorCode };
      }
      return fallback;
    } catch {
      return { message: fallback.message, code: null };
    }
  };

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
      } catch (err) {
        if (mountedRef.current) setError('Error loading match settings');
      }
    };
    loadData();
    return () => {
      mountedRef.current = false;
    };
  }, [getMatchSettingsReady]);

  const getMinDateTime = () => {
    const now = new Date();
    now.setSeconds(0, 0);
    // Adjust to local time string
    const offsetMs = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offsetMs).toISOString().slice(0, 16);
  };

  const getMinEndDate = () => {
    if (!challenge.startDatetime) return getMinDateTime();
    const start = new Date(challenge.startDatetime);
    if (Number.isNaN(start.getTime())) return getMinDateTime();
    const durationMs = (parsePositiveInt(challenge.duration) || 0) * 60 * 1000;
    const durationPeerReviewMs =
      (parsePositiveInt(challenge.durationPeerReview) || 0) * 60 * 1000;
    const minEndDate = new Date(start.getTime() + durationMs);
    minEndDate.setTime(minEndDate.getTime() + durationPeerReviewMs);
    const year = minEndDate.getFullYear();
    const month = String(minEndDate.getMonth() + 1).padStart(2, '0');
    const day = String(minEndDate.getDate()).padStart(2, '0');
    const hours = String(minEndDate.getHours()).padStart(2, '0');
    const minutes = String(minEndDate.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // console.log("Challenge to save: ", challenge);
    if (!isAuthorized) return;
    setSuccessMessage(null);
    setError(null);

    const form = e.currentTarget;
    const titleInput = form?.querySelector?.('#title');
    const trimmedTitle = challenge.title.trim();
    if (titleInput && titleInput.value !== trimmedTitle) {
      titleInput.value = trimmedTitle;
    }
    if (trimmedTitle !== challenge.title) {
      setChallenge((prev) => ({
        ...prev,
        title: trimmedTitle,
      }));
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

    const isValid = form?.checkValidity ? form.checkValidity() : true;
    if (!isValid) {
      form?.reportValidity?.();
      return;
    }
    if (!challenge.matchSettingIds || challenge.matchSettingIds.length === 0) {
      setError('Select at least one match setting');
      return;
    }
    const durationValue = parsePositiveInt(challenge.duration) ?? 0;
    const durationPeerReviewValue =
      parsePositiveInt(challenge.durationPeerReview) ?? 0;
    const allowedNumberValue =
      parsePositiveInt(challenge.allowedNumberOfReview) ?? 0;
    setIsSubmitting(true);
    const payload = {
      ...challenge,
      title: trimmedTitle,
      duration: durationValue,
      durationPeerReview: durationPeerReviewValue,
      allowedNumberOfReview: allowedNumberValue,
      startDatetime: toISODateTime(challenge.startDatetime),
      endDatetime: toISODateTime(challenge.endDatetime),
    };
    try {
      const result = await createChallenge(payload);
      // console.log("Result: ", result)
      if (result?.success) {
        setSuccessMessage('Challenge created successfully! Redirecting...');
        // console.log("Challenge:", result);
        setTimeout(() => {
          router.push('/challenges');
        }, 3000);
        return;
      }
      const { message, code } = parseCreateError(result);
      if (code === 'challenge_overlap') {
        setOverlapPayload(payload);
        setOverlapDialogOpen(true);
        setIsSubmitting(false);
        return;
      }
      setError(message);
      setIsSubmitting(false);
    } catch (err) {
      // console.error(err);
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
      const overrideError = parseCreateError(overrideResult);
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

  const durationValue = parsePositiveInt(challenge.duration);
  const durationPeerReviewValue = parsePositiveInt(
    challenge.durationPeerReview
  );
  const canPickEndDate =
    Boolean(challenge.startDatetime) &&
    Number.isInteger(durationValue) &&
    durationValue >= 2 &&
    Number.isInteger(durationPeerReviewValue) &&
    durationPeerReviewValue >= 2;

  return (
    <main role='main' className={styles.main} aria-labelledby='page-title'>
      <div className={styles.header}>
        <h1 id='page-title'>Create New Challenge</h1>
        <p>Fill out the form below to create a new challenge.</p>
      </div>
      <form
        data-testid='challenge-form'
        onSubmit={handleSubmit}
        className={styles.card}
      >
        <div className={styles.field}>
          <label htmlFor='title'>
            Challenge Name
            <input
              id='title'
              type='text'
              value={challenge.title}
              onChange={handleDataField}
              name='title'
              className={styles.input}
              required
            />
          </label>
        </div>
        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor='startDatetime'>
              Start Date/Time
              <input
                id='startDatetime'
                type='datetime-local'
                name='startDatetime'
                value={challenge.startDatetime}
                onChange={handleDataField}
                className={styles.datetime}
                min={getMinDateTime()}
                required
              />
            </label>
          </div>
          <div className={styles.field}>
            <label htmlFor='endDatetime'>
              End Date/Time
              <input
                id='endDatetime'
                type='datetime-local'
                name='endDatetime'
                value={challenge.endDatetime}
                onChange={handleDataField}
                className={styles.datetime}
                min={getMinEndDate()}
                required
                disabled={!canPickEndDate}
              />
            </label>
          </div>
        </div>
        <div>
          <div className={styles.row}>
            <div className={styles.field}>
              <label htmlFor='duration'>
                Duration (min)
                <input
                  id='duration'
                  type='number'
                  name='duration'
                  value={challenge.duration}
                  onChange={handleDataField}
                  className={styles.number}
                  min={2}
                  required
                />
              </label>
            </div>
            <div className={styles.field}>
              <label htmlFor='durationPeerReview'>
                Duration Peer Review (min)
                <input
                  id='durationPeerReview'
                  type='number'
                  name='durationPeerReview'
                  value={challenge.durationPeerReview}
                  onChange={handleDataField}
                  className={styles.number}
                  min={2}
                  required
                />
              </label>
            </div>
          </div>
        </div>
        <div>
          <div className={styles.row}>
            <div className={styles.field}>
              <label htmlFor='allowedNumberOfReview'>
                Expected Reviews per Submission
                <input
                  id='allowedNumberOfReview'
                  type='number'
                  name='allowedNumberOfReview'
                  value={challenge.allowedNumberOfReview}
                  onChange={handleDataField}
                  className={`${styles.number} ${styles.expectedReviewInput}`}
                  min={2}
                  required
                />
              </label>
            </div>
          </div>
        </div>
        <div className={styles.field}>
          <span>Status</span>
          <ToggleSwitch
            checked={challenge.status === Constants.ChallengeStatus.PUBLIC}
            label={
              challenge.status === Constants.ChallengeStatus.PUBLIC
                ? 'Public'
                : 'Private'
            }
            onChange={() =>
              setChallenge((prev) => ({
                ...prev,
                status:
                  prev.status === Constants.ChallengeStatus.PUBLIC
                    ? Constants.ChallengeStatus.PRIVATE
                    : Constants.ChallengeStatus.PUBLIC,
              }))
            }
          />
        </div>
        <div className={styles.field}>
          <strong>
            Selected Match Settings: {challenge?.matchSettingIds?.length}
          </strong>
        </div>

        <table className={styles.table}>
          <thead>
            <tr>
              <th>Select</th>
              <th>Title</th>
            </tr>
          </thead>
          <tbody>
            {currentItems.map((match) => {
              const isSelected = challenge.matchSettingIds.includes(match.id);
              const handleRowToggle = () => toggleSetting(match.id);
              const handleRowKeyDown = (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  handleRowToggle();
                }
              };

              return (
                <tr
                  key={match.id}
                  role='button'
                  tabIndex={0}
                  onClick={handleRowToggle}
                  onKeyDown={handleRowKeyDown}
                >
                  <td style={{ textAlign: 'center' }}>
                    <input
                      aria-label='select setting'
                      type='checkbox'
                      checked={isSelected}
                      onChange={handleRowToggle}
                      onClick={(event) => event.stopPropagation()}
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>{match.problemTitle}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />

        <div className={styles.submitWrapper}>
          <div className={styles.feedback} aria-live='polite'>
            {error && (
              <span className={styles.feedbackError} role='alert'>
                {error}
              </span>
            )}
            {!error && successMessage && (
              <span className={styles.feedbackSuccess} role='status'>
                {successMessage}
              </span>
            )}
          </div>
          <Button
            data-testid='create-challenge-button'
            type='submit'
            disabled={isSubmitting}
            aria-busy={isSubmitting}
            name='submit'
            title='Create this challenge'
          >
            {isSubmitting && <span className={styles.spinner} aria-hidden />}
            {isSubmitting ? 'Creating…' : 'Create'}
          </Button>
        </div>
      </form>
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
    </main>
  );
}
