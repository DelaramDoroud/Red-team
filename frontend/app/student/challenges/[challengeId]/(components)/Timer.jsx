'use client';

import { useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '#js/store/hooks';
import { setChallengeStartTime } from '#js/store/slices/ui';
import { useDuration } from '../(context)/DurationContext';

function Timer({ duration, challengeId, onFinish }) {
  const { startPhaseOneDateTime } = useDuration() || {};
  const dispatch = useAppDispatch();
  const userId = useAppSelector((state) => state.auth.user?.id);
  const storedStartTime = useAppSelector((state) => {
    if (!userId) return null;
    return state.ui.challengeTimers?.[userId]?.[challengeId] || null;
  });

  const endTimeRef = useRef(null);
  const finishedRef = useRef(false);
  const intervalRef = useRef(null);

  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    if (!duration || duration <= 0) return undefined;

    finishedRef.current = false;
    clearInterval(intervalRef.current);

    const durationSeconds = duration * 60;

    // Use server's startPhaseOneDateTime if available, otherwise fallback to persisted store
    let startTime = null;
    if (startPhaseOneDateTime) {
      // Use server's actual challenge start time (challenge-specific)
      startTime = new Date(startPhaseOneDateTime).getTime();
      if (userId && storedStartTime !== startTime)
        dispatch(setChallengeStartTime({ userId, challengeId, startTime }));
    } else if (storedStartTime) {
      startTime = storedStartTime;
    } else {
      startTime = Date.now();
      if (userId) {
        dispatch(setChallengeStartTime({ userId, challengeId, startTime }));
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
  }, [
    duration,
    challengeId,
    startPhaseOneDateTime,
    onFinish,
    dispatch,
    storedStartTime,
    userId,
  ]);

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
