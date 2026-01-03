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
    duration: 30,
    allowedNumberOfReview: 5,
    matchSettingIds: [],
    status: Constants.ChallengeStatus.PUBLIC,
    durationPeerReview: 30,
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

    if (
      event.target.name === 'duration' ||
      event.target.name === 'durationPeerReview' ||
      event.target.name === 'allowedNumberOfReview'
    ) {
      const val = parseInt(event.target.value, 10);
      newChallenge[event.target.name] = Number.isNaN(val) ? 0 : val;
    } else {
      newChallenge[event.target.name] = event.target.value;
    }
    if (
      event.target.name === 'startDatetime' ||
      event.target.name === 'duration' ||
      event.target.name === 'durationPeerReview'
    ) {
      const startVal = newChallenge.startDatetime;
      const durationVal = newChallenge.duration;
      const durationPeerReviewVal = newChallenge.durationPeerReview;
      if (startVal && durationVal && durationPeerReviewVal) {
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
    const durationMs =
      (challenge.duration + challenge.durationPeerReview || 0) * 60 * 1000;
    const minEndDate = new Date(start.getTime() + durationMs);
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
    if (
      !Number.isInteger(challenge.allowedNumberOfReview) ||
      challenge.allowedNumberOfReview < 2
    ) {
      setError(
        'Expected Reviews per Submission must be an integer greater than or equal to 2.'
      );
      return;
    }
    if (!challenge.matchSettingIds || challenge.matchSettingIds.length === 0) {
      setError('Select at least one match setting');
      return;
    }
    setError(null);
    const start = new Date(challenge.startDatetime);
    const end = new Date(challenge.endDatetime);
    const finalTime = new Date(
      start.getTime() +
        (challenge.duration + challenge.durationPeerReview) * 60000
    );

    if (start > end) {
      setError('End date/time cannot be before start date/time.');
    } else if (finalTime > end) {
      setError(
        'End date/time must accommodate challenge and peer review durations'
      );
    } else {
      setIsSubmitting(true);
      const payload = {
        ...challenge,
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
                disabled={!challenge.startDatetime || !challenge.duration}
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
                  min={1}
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
                  min={1}
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
