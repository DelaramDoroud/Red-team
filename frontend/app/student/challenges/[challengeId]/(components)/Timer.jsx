import { useEffect, useRef, useState } from 'react';

function Timer({ duration, challengeId, startTime, onFinish }) {
  const [timeLeft, setTimeLeft] = useState(null);
  const hasFinishedRef = useRef(false);

  useEffect(() => {
    const durationSeconds = Math.max(0, Number(duration) || 0) * 60;
    const startMs = (() => {
      const parsed = startTime ? new Date(startTime).getTime() : NaN;
      return Number.isNaN(parsed) ? Date.now() : parsed;
    })();
    const endTime = startMs + durationSeconds * 1000;
    hasFinishedRef.current = false;

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

    return () => clearInterval(intervalId);
  }, [duration, challengeId, startTime, onFinish]);

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
