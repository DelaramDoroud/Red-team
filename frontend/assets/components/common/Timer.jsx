'use client';

import { useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '#js/store/hooks';
import { setChallengeStartTime } from '#js/store/slices/ui';

const resolveTimestamp = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
};

export default function Timer({
  duration,
  challengeId,
  startTime,
  onFinish,
  label = 'Timer:',
}) {
  const COUNTDOWN_DURATION = 3;
  const dispatch = useAppDispatch();
  const userId = useAppSelector((state) => state.auth.user?.id);

  const storedStartTime = useAppSelector((state) => {
    if (!userId) return null;
    return state.ui.challengeTimers?.[userId]?.[challengeId] || null;
  });

  const endTimeRef = useRef(null);
  const finishedRef = useRef(false);
  const countdownIntervalRef = useRef(null);
  const mainIntervalRef = useRef(null);
  const countdownRemainingRef = useRef(null);

  const [countdownRemaining, setCountdownRemaining] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [showCountdown, setShowCountdown] = useState(false);

  useEffect(() => {
    countdownRemainingRef.current = countdownRemaining;
  }, [countdownRemaining]);

  useEffect(() => {
    if (!userId) return undefined;

    const explicitStartTime = resolveTimestamp(startTime);
    let baseStartTime = explicitStartTime ?? storedStartTime;

    if (!baseStartTime) {
      baseStartTime = Date.now();
    }

    if (
      !storedStartTime ||
      (explicitStartTime && storedStartTime !== explicitStartTime)
    ) {
      dispatch(
        setChallengeStartTime({
          userId,
          challengeId,
          startTime: baseStartTime,
        })
      );
    }

    const now = Date.now();
    const effectiveStartTime = baseStartTime + COUNTDOWN_DURATION * 1000;
    const countdownSec = Math.ceil((effectiveStartTime - now) / 1000);

    if (countdownSec > 0) {
      setCountdownRemaining(countdownSec);
      setShowCountdown(true);
    } else {
      setCountdownRemaining(0);
      setShowCountdown(false);
    }

    if (duration && duration > 0) {
      endTimeRef.current = effectiveStartTime + duration * 60 * 1000;
    }
    return undefined;
  }, [userId, challengeId, storedStartTime, dispatch, duration, startTime]);

  useEffect(() => {
    if (!showCountdown || countdownRemainingRef.current <= 0) return undefined;

    const tickCountdown = () => {
      setCountdownRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current);
          setShowCountdown(false);
          return 0;
        }
        return prev - 1;
      });
    };

    countdownIntervalRef.current = setInterval(tickCountdown, 1000);
    return () => clearInterval(countdownIntervalRef.current);
  }, [showCountdown]);

  useEffect(() => {
    if (!endTimeRef.current) return undefined;

    const tick = () => {
      const diff = Math.floor((endTimeRef.current - Date.now()) / 1000);
      if (diff <= 0) {
        setTimeLeft(0);
        if (!finishedRef.current) {
          finishedRef.current = true;
          onFinish?.();
        }
        clearInterval(mainIntervalRef.current);
        return undefined;
      }
      setTimeLeft(diff);
      return undefined;
    };

    tick();
    mainIntervalRef.current = setInterval(tick, 1000);

    return () => clearInterval(mainIntervalRef.current);
  }, [onFinish]);

  const formatTime = (seconds) => {
    if (seconds === null) return '--:--:--';
    const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  return (
    <>
      {showCountdown && countdownRemaining > 0 && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60'>
          <div className='bg-card rounded-2xl px-10 py-8 text-center shadow-xl border border-border'>
            <p className='text-sm text-muted-foreground mb-2'>Get ready…</p>
            <p className='text-6xl font-bold mb-4'>{countdownRemaining}</p>
            <p className='text-sm text-muted-foreground'>
              The challenge is about to start.
            </p>
          </div>
        </div>
      )}

      {timeLeft !== null && (
        <div data-testid='timer-value' className='font-mono tabular-nums'>
          {label} {formatTime(timeLeft)}
        </div>
      )}
    </>
  );
}
