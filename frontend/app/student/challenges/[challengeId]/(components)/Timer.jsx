import { useEffect, useRef, useState } from 'react';
import { useDuration } from '../(context)/DurationContext';

function Timer({ duration, challengeId, onFinish }) {
  const { startPhaseOneDateTime } = useDuration() || {};
  const [timeLeft, setTimeLeft] = useState(null);
  const hasFinishedRef = useRef(false);

  useEffect(() => {
    // Reset timer state when challenge changes (each challenge has independent timer state)
    hasFinishedRef.current = false;
    setTimeLeft(null);

    if (!duration || duration <= 0) {
      return undefined;
    }

    const durationSeconds = duration * 60; // convert minutes → seconds

    // Use server's startPhaseOneDateTime if available, otherwise fallback to localStorage
    let startTime;

    if (startPhaseOneDateTime) {
      // Use server's actual challenge start time (challenge-specific)
      startTime = new Date(startPhaseOneDateTime).getTime();
    } else {
      // Fallback: Create a unique storage key for this challenge (challenge-specific)
      const storageKey = `challenge-start-${challengeId}`;
      const storedStartTime = localStorage.getItem(storageKey);

      if (!storedStartTime) {
        // first time entering challenge → store Date.now()
        startTime = Date.now();
        localStorage.setItem(storageKey, startTime);
      } else {
        startTime = Number(storedStartTime);
      }
    }

    // Calculate endTime from start time (challenge-specific)
    const endTime = startTime + durationSeconds * 1000;
    // 4. Create timer interval
    const intervalId = setInterval(() => {
      const diff = Math.floor((endTime - Date.now()) / 1000);

      if (diff <= 0) {
        setTimeLeft(0);
        clearInterval(intervalId);
        if (!hasFinishedRef.current && typeof onFinish === 'function') {
          hasFinishedRef.current = true;
          onFinish();
        }
      } else {
        setTimeLeft(diff);
      }
    }, 1000);

    // cleanup
    return () => clearInterval(intervalId);
  }, [duration, challengeId, onFinish, startPhaseOneDateTime]); // rerun if challenge changes or server start time updates

  function formatTime(seconds) {
    if (seconds === null) return '--:--:--';

    const hours = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const mins = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const secs = String(seconds % 60).padStart(2, '0');

    return `${hours}:${mins}:${secs}`;
  }

  return <div data-testid='timer-value'>Timer: {formatTime(timeLeft)}</div>;
}

export default Timer;
