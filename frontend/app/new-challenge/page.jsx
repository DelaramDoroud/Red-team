'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import useMatchSettings from '#js/useMatchSetting';
import useChallenge from '#js/useChallenge';
import ToggleSwitch from '#components/common/ToggleSwitch';
import Pagination from '#components/common/Pagination';
import * as Constants from '#js/constants';
import styles from './page.module.css';

export default function NewChallengePage() {
  const router = useRouter();
  const { getMatchSettingsReady } = useMatchSettings();
  const { createChallenge } = useChallenge();

  const [challenge, setChallenge] = useState({
    title: '',
    startDatetime: '',
    endDatetime: '',
    duration: 30,
    matchSettingIds: [],
    status: Constants.ChallengeStatus.PUBLIC,
    peerReviewStartDate: '',
    peerReviewEndDate: '',
  });
  const [matchSettings, setMatchSettings] = useState([]);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;
  const safeMatchSettings = matchSettings || [];
  const currentItems = safeMatchSettings.slice(
    (currentPage - 1) * pageSize,
    (currentPage - 1) * pageSize + pageSize
  );
  const totalPages = Math.ceil(safeMatchSettings.length / pageSize);

  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    const loadData = async () => {
      setError(null);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleSetting = (id) => {
    setChallenge((prev) => ({
      ...prev,
      matchSettingIds: prev.matchSettingIds.includes(id)
        ? prev.matchSettingIds.filter((s) => s !== id)
        : [...prev.matchSettingIds, id],
    }));
  };

  const handleDataField = (event) => {
    const { name, value } = event.target;
    const newChallenge = { ...challenge };

    if (name === 'duration') {
      newChallenge[name] = value === '' ? '' : parseInt(value, 10);
    } else {
      newChallenge[name] = value;
    }

    if (name === 'startDatetime' || name === 'duration') {
      const startVal = newChallenge.startDatetime;
      const durationVal =
        newChallenge.duration === '' || Number.isNaN(newChallenge.duration)
          ? 0
          : newChallenge.duration;

      if (startVal) {
        const start = new Date(startVal);
        if (!Number.isNaN(start.getTime())) {
          const durationMs = durationVal * 60 * 1000;
          const minEndDate = new Date(start.getTime() + durationMs);
          const minEndStr = minEndDate.toISOString().slice(0, 16);

          if (
            !newChallenge.endDatetime ||
            newChallenge.endDatetime < minEndStr
          ) {
            newChallenge.endDatetime = minEndStr;
          }
        }
      }
    }
    setChallenge(newChallenge);
  };

  const toISODateTime = (localDateTime) => {
    if (!localDateTime) return null;
    return new Date(localDateTime).toISOString();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!challenge.matchSettingIds || challenge.matchSettingIds.length === 0) {
      setError('Select at least one match setting');
      return;
    }

    const start = new Date(challenge.startDatetime);
    const end = new Date(challenge.endDatetime);
    const peerStart = new Date(challenge.peerReviewStartDate);
    const peerEnd = new Date(challenge.peerReviewEndDate);

    if (start > end) {
      setError('End date/time cannot be before start date/time.');
      return;
    }
    if (end > peerStart) {
      setError('Peer review start cannot be before challenge end.');
      return;
    }
    if (peerStart > peerEnd) {
      setError('Peer review end cannot be before peer review start.');
      return;
    }

    setIsSubmitting(true);
    const payload = {
      ...challenge,
      startDatetime: toISODateTime(challenge.startDatetime),
      endDatetime: toISODateTime(challenge.endDatetime),
      peerReviewStartDate: toISODateTime(challenge.peerReviewStartDate),
      peerReviewEndDate: toISODateTime(challenge.peerReviewEndDate),
    };

    try {
      const result = await createChallenge(payload);

      if (result?.success) {
        setSuccessMessage('Challenge created successfully! Redirecting...');
        setTimeout(() => router.push('/challenges'), 3000);
      } else {
        setError(result?.message || 'Error occurred');
        setIsSubmitting(false);
      }
    } catch (err) {
      setError(`Error: ${err.message}`);
      setIsSubmitting(false);
    }
  };

  const getVal = (val) =>
    Number.isNaN(val) || val === null || val === undefined ? '' : val;

  return (
    <main className={styles.main} aria-labelledby='page-title'>
      <div className={styles.header}>
        <h1 id='page-title'>Create New Challenge</h1>
        <p>Fill out the form below to create a new challenge.</p>
      </div>
      <form onSubmit={handleSubmit} className={styles.card}>
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
                value={challenge.startDatetime}
                onChange={handleDataField}
                name='startDatetime'
                className={styles.datetime}
                required
              />
            </label>
          </div>
          <div className={styles.field}>
            <label htmlFor='duration'>
              Duration (min)
              <input
                id='duration'
                type='number'
                value={getVal(challenge.duration)}
                onChange={handleDataField}
                name='duration'
                className={styles.number}
                min={1}
                required
              />
            </label>
          </div>
        </div>
        <div className={styles.field}>
          <label htmlFor='endDatetime'>
            End Date/Time
            <input
              id='endDatetime'
              type='datetime-local'
              value={challenge.endDatetime}
              name='endDatetime'
              onChange={handleDataField}
              className={styles.datetime}
              required
            />
          </label>
        </div>
        <div className={styles.field}>
          <label htmlFor='peerReviewStartDate'>
            Peer Review Start
            <input
              id='peerReviewStartDate'
              type='datetime-local'
              value={challenge.peerReviewStartDate}
              name='peerReviewStartDate'
              onChange={handleDataField}
              className={styles.datetime}
              required
            />
          </label>
        </div>
        <div className={styles.field}>
          <label htmlFor='peerReviewEndDate'>
            Peer Review End
            <input
              id='peerReviewEndDate'
              type='datetime-local'
              value={challenge.peerReviewEndDate}
              name='peerReviewEndDate'
              onChange={handleDataField}
              className={styles.datetime}
              required
            />
          </label>
        </div>
        <div className={styles.field}>
          <span>Status</span>
          <ToggleSwitch
            checked={challenge.status === Constants.ChallengeStatus.PUBLIC}
            label='Public'
            onChange={() =>
              setChallenge((p) => ({
                ...p,
                status: p.status === 'public' ? 'private' : 'public',
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
            {currentItems.map((match) => (
              <tr key={match.id}>
                <td style={{ textAlign: 'center' }}>
                  <input
                    aria-label='select setting'
                    type='checkbox'
                    checked={challenge.matchSettingIds.includes(match.id)}
                    onChange={() => toggleSetting(match.id)}
                  />
                </td>
                <td style={{ textAlign: 'center' }}>{match.problemTitle}</td>
              </tr>
            ))}
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
              <span
                className={styles.feedbackError}
                style={{ color: 'red', display: 'block' }}
              >
                ERROR: {error}
              </span>
            )}
            {!error && successMessage && (
              <span className={styles.feedbackSuccess}>{successMessage}</span>
            )}
          </div>
          <button
            type='submit'
            className={styles.submitButton}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </main>
  );
}
