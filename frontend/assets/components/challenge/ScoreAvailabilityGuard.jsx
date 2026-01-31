'use client';

import { useState, useEffect, useCallback } from 'react';
import Spinner from '../common/Spinner';
import styles from './ScoreAvailabilityGuard.module.css';

const SCORING_STATUS = {
  PEER_REVIEW_NOT_ENDED: 'PEER_REVIEW_NOT_ENDED',
  SCORING_IN_PROGRESS: 'SCORING_IN_PROGRESS',
  READY: 'READY',
};

export default function ScoreAvailabilityGuard({ challengeId, children }) {
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  // FIX 1: useCallback per stabilizzare la funzione e includerla nelle dipendenze
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/rest/challenges/${challengeId}/scoring-status`
      );
      if (res.ok) {
        const data = await res.json();
        setStatus(data.state);
        setMessage(data.message);
      }
    } catch (err) {
      console.error('Error fetching scoring status:', err);
    } finally {
      setLoading(false);
    }
  }, [challengeId]);

  useEffect(() => {
    fetchStatus();

    // POLLING: Se il calcolo è in corso, controlla ogni 5 secondi
    let interval;
    if (status === SCORING_STATUS.SCORING_IN_PROGRESS) {
      interval = setInterval(fetchStatus, 5000);
    }
    return () => clearInterval(interval);
  }, [fetchStatus, status]); // Ora fetchStatus è una dipendenza sicura

  // 1. Loading Iniziale
  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <Spinner />
      </div>
    );
  }

  // 2. Peer Review non finita
  if (status === SCORING_STATUS.PEER_REVIEW_NOT_ENDED) {
    return (
      <div className={`${styles.alert} ${styles.alertWarning}`}>
        <h3>Scoring not available</h3>
        <p>
          {message ||
            'Scoring is not available yet. Please wait until the peer review phase has ended.'}
        </p>
      </div>
    );
  }

  // 3. Calcolo in corso (Mostra Spinner + Messaggio)
  if (status === SCORING_STATUS.SCORING_IN_PROGRESS) {
    return (
      <div className={styles.computingContainer}>
        <Spinner />
        <p className={styles.computingText}>
          {message ||
            'Scoring is not available yet. Please wait until scoring is computed.'}
        </p>
      </div>
    );
  }

  // 4. READY -> Renderizza i figli

  if (status === SCORING_STATUS.READY) {
    return children;
  }

  return null;
}
