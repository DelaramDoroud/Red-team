'use client';

import { useEffect, useRef, useState } from 'react';
import { useDuration } from '../../../app/student/challenges/[challengeId]/(context)/DurationContext';

function Timer({ duration, challengeId, onFinish }) {
  const { startPhaseOneDateTime } = useDuration() || {};

  const endTimeRef = useRef(null);
  const finishedRef = useRef(false);
  const intervalRef = useRef(null);

  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    if (!duration || duration <= 0) return undefined;

    finishedRef.current = false;
    clearInterval(intervalRef.current);

    const durationSeconds = duration * 60;

    // Use server's startPhaseOneDateTime if available, otherwise fallback to localStorage
    let startTime;
    if (startPhaseOneDateTime) {
      // Use server's actual challenge start time (challenge-specific)
      startTime = new Date(startPhaseOneDateTime).getTime();
    } else {
      // Fallback: Create a unique storage key for this challenge (challenge-specific)
      const storageKey = `challenge-start-${challengeId}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        startTime = Number(stored);
      } else {
        startTime = Date.now();
        localStorage.setItem(storageKey, startTime);
      }
    }

    endTimeRef.current = startTime + durationSeconds * 1000;

    const tick = () => {
      const diff = Math.floor((endTimeRef.current - Date.now()) / 1000);

      if (diff <= 0) {
        setTimeLeft(0);

        if (!finishedRef.current) {
          finishedRef.current = true;
          onFinish?.();
        }

        clearInterval(intervalRef.current);
        return;
      }

      setTimeLeft(diff);
    };

    tick(); // immediate
    intervalRef.current = setInterval(tick, 1000);

    return () => clearInterval(intervalRef.current);
  }, [duration, challengeId, startPhaseOneDateTime, onFinish]);

  const formatTime = (seconds) => {
    if (seconds === null) return '--:--:--';

    const hours = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const mins = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const secs = String(seconds % 60).padStart(2, '0');

    return `${hours}:${mins}:${secs}`;
  };

  return (
    <div data-testid='timer-value' className='font-mono tabular-nums'>
      Timer: {formatTime(timeLeft)}
    </div>
  );
}

export default Timer;
