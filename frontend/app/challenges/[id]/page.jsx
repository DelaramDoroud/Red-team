'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '#components/common/Button';
import { Badge } from '#components/common/Badge';
import Spinner from '#components/common/Spinner';
import useChallenge from '#js/useChallenge';
import styles from './page.module.css';

const formatDateTime = (value) => {
  if (!value) return 'TBD';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'TBD';
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function ChallengeDetailsPage() {
  const { id: challengeId } = useParams();
  const { getChallenges, loading } = useChallenge();

  const [challenge, setChallenge] = useState(null);
  const [error, setError] = useState(null);

  const loadChallenge = useCallback(async () => {
    if (!challengeId) return;
    setError(null);
    const result = await getChallenges();
    if (result?.success === false) {
      setChallenge(null);
      setError(result.message || 'Unable to load challenge');
      return;
    }
    const list = Array.isArray(result)
      ? result
      : Array.isArray(result?.data)
        ? result.data
        : [];

    const found = list.find(
      (item) => String(item.id) === String(challengeId)
    );

    if (!found) {
      setChallenge(null);
      setError('Challenge not found');
      return;
    }

    setChallenge(found);
  }, [challengeId, getChallenges]);

  useEffect(() => {
    loadChallenge();
  }, [loadChallenge]);

  const matchSettings = useMemo(
    () => challenge?.matchSettings || [],
    [challenge]
  );

  const dateWindow = challenge
    ? `${formatDateTime(challenge.startDatetime)} → ${formatDateTime(
        challenge.endDatetime
      )}`
    : 'Review the timeline and assign students when you are ready.';

  if (loading && !challenge && !error) {
    return (
      <div className={styles.center}>
        <Spinner label='Loading challenge…' />
      </div>
    );
  }

  return (
    <section className={styles.page}>
      <div className={styles.breadcrumbs}>
        <Link href='/challenges'>Challenges</Link>
        <span className={styles.separator} aria-hidden>
          /
        </span>
        <span className={styles.current}>
          {challenge?.title || `Challenge ${challengeId}`}
        </span>
      </div>

      <header className={styles.header}>
        <div className={styles.titles}>
          <p className={styles.kicker}>Challenge #{challengeId}</p>
          <h1>{challenge?.title || 'Challenge details'}</h1>
          <p className={styles.subtitle}>{dateWindow}</p>
        </div>
        <div className={styles.actions}>
          <Button variant='outline' onClick={loadChallenge}>
            Refresh
          </Button>
          <Button size='lg' type='button' className={styles.assignButton}>
            Assign
          </Button>
        </div>
      </header>

      {error && (
        <div className={styles.errorBox}>
          <p>{error}</p>
          <Link href='/challenges' className={styles.backLink}>
            Back to all challenges
          </Link>
        </div>
      )}

      {challenge && (
        <>
          <div className={styles.metaGrid}>
            <div className={styles.metaCard}>
              <p className={styles.metaLabel}>Start</p>
              <p className={styles.metaValue}>
                {formatDateTime(challenge.startDatetime)}
              </p>
            </div>
            <div className={styles.metaCard}>
              <p className={styles.metaLabel}>End</p>
              <p className={styles.metaValue}>
                {formatDateTime(challenge.endDatetime)}
              </p>
            </div>
            <div className={styles.metaCard}>
              <p className={styles.metaLabel}>Duration</p>
              <p className={styles.metaValue}>
                {challenge.duration ? `${challenge.duration} min` : '—'}
              </p>
            </div>
            <div className={styles.metaCard}>
              <p className={styles.metaLabel}>Status</p>
              <span className={styles.statusPill}>
                {challenge.status || 'unknown'}
              </span>
            </div>
          </div>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.kicker}>Match settings</p>
                <h2>Problems linked to this challenge</h2>
              </div>
              <Badge variant='outline'>
                {matchSettings.length}{' '}
                {matchSettings.length === 1 ? 'item' : 'items'}
              </Badge>
            </div>

            {matchSettings.length > 0 ? (
              <ul className={styles.settingList}>
                {matchSettings.map((setting) => (
                  <li
                    key={setting.id ?? setting.problemTitle}
                    className={styles.settingItem}
                  >
                    <div>
                      <p className={styles.settingTitle}>
                        {setting.problemTitle || 'Match setting'}
                      </p>
                      <p className={styles.settingMeta}>
                        Status: {setting.status || 'unknown'}
                      </p>
                    </div>
                    <span className={styles.settingId}>
                      #{setting.id ?? '—'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>No match settings attached yet.</p>
            )}
          </section>
        </>
      )}
    </section>
  );
}
