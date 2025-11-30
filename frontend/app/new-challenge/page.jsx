'use client';

import { useCallback, useEffect, useState } from 'react';
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

    newChallenge[event.target.name] =
      event.target.name === 'duration'
        ? parseInt(event.target.value, 10)
        : event.target.value;

    if (
      event.target.name === 'startDatetime' ||
      event.target.name === 'duration'
    ) {
      const startVal = newChallenge.startDatetime;
      const durationVal = newChallenge.duration;

      if (startVal && durationVal) {
        const start = new Date(startVal);
        if (!Number.isNaN(start.getTime())) {
          const durationMs = (durationVal || 0) * 60 * 1000;
          const minEndDate = new Date(start.getTime() + durationMs);

          const year = minEndDate.getFullYear();
          const month = String(minEndDate.getMonth() + 1).padStart(2, '0');
          const day = String(minEndDate.getDate()).padStart(2, '0');
          const hours = String(minEndDate.getHours()).padStart(2, '0');
          const minutes = String(minEndDate.getMinutes()).padStart(2, '0');
          const minEndStr = `${year}-${month}-${day}T${hours}:${minutes}`;

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
    const dt = new Date(localDateTime);
    return dt.toISOString();
  };

  const load = useCallback(async () => {
    setError(null);
    const result = await getMatchSettingsReady();
    if (result?.success === false) {
      setError(result.message || 'Unable to load challenges');
      setMatchSettings([]);
      return;
    }
    if (Array.isArray(result)) {
      setMatchSettings(result.matchSettings);
    } else if (Array.isArray(result?.data)) {
      setMatchSettings(result.data);
    } else {
      setMatchSettings([]);
    }
  }, [getMatchSettingsReady]);

  useEffect(() => {
    load();
  }, [load]);

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

    const durationMs = (challenge.duration || 0) * 60 * 1000;
    const minEndDate = new Date(start.getTime() + durationMs);

    // Format to local ISO string
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
    setError(null);
    if (challenge.matchSettingIds.length === 0) {
      setError('Select at least one match setting.');
    } else {
      const start = new Date(challenge.startDatetime);
      const end = new Date(challenge.endDatetime);
      const peerStart = new Date(challenge.peerReviewStartDate);
      const peerEnd = new Date(challenge.peerReviewEndDate);
      if (start > end) {
        setError('End date/time cannot be before start date/time.');
      } else if (end > peerStart) {
        setError('Peer review start cannot be before challenge end.');
      } else if (peerStart > peerEnd) {
        setError('Peer review end cannot be before peer review start.');
      } else {
        const payload = {
          ...challenge,
          startDatetime: toISODateTime(challenge.startDatetime),
          endDatetime: toISODateTime(challenge.endDatetime),
          peerReviewStartDate: toISODateTime(challenge.peerReviewStartDate),
          peerReviewEndDate: toISODateTime(challenge.peerReviewEndDate),
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
          } else {
            let errorMsg = 'An unknown error occurred';
            const message = result?.message.slice(
              Constants.NETWORK_RESPONSE_NOT_OK.length
            );
            const jsonError = JSON.parse(message);
            if (jsonError.error?.errors?.length > 0) {
              errorMsg = jsonError.error.errors[0].message;
            } else if (jsonError?.message) {
              errorMsg = jsonError.message;
            } else if (jsonError?.error?.message) {
              errorMsg = jsonError?.error?.message;
            }
            setError(errorMsg);
          }
        } catch (err) {
          // console.error(err);
          setError(`Error: ${err.message}`);
        }
      }
    }
  };

  return (
    <>
      {error && <div className={styles.errorBox}>{error}</div>}
      {successMessage && (
        <div className={styles.successBox}>{successMessage}</div>
      )}
      <main className={styles.main}>
        <h1>Create New Challenge</h1>
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
                  min={getMinDateTime()}
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
                  value={challenge.duration}
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
                min={getMinEndDate()}
                onChange={handleDataField}
                className={styles.datetime}
                required
                disabled={!challenge.startDatetime || !challenge.duration}
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
                min={getMinDateTime()}
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
                min={getMinDateTime()}
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
            <button type='submit' className={styles.submitButton}>
              Create
            </button>
          </div>
        </form>
      </main>
    </>
  );
}
