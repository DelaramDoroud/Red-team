import { useEffect, useRef, useState } from 'react';

function Timer({ duration, challengeId, onFinish }) {
  const [timeLeft, setTimeLeft] = useState(null);
  const hasFinishedRef = useRef(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    const durationSeconds = duration * 60;

    // Storage key
    const storageKey = `challenge-start-${challengeId}`;

    // Get or set start time
    let startTime = localStorage.getItem(storageKey);
    if (!startTime) {
      startTime = Date.now();
      localStorage.setItem(storageKey, startTime);
    } else {
      startTime = Number(startTime);
    }

    const endTime = startTime + durationSeconds * 1000;

    // Set initial timeLeft immediately
    const initialDiff = Math.max(Math.floor((endTime - Date.now()) / 1000), 0);
    setTimeLeft(initialDiff);

    hasFinishedRef.current = false;

    intervalRef.current = setInterval(() => {
      const diff = Math.max(Math.floor((endTime - Date.now()) / 1000), 0);
      setTimeLeft(diff);

      if (diff <= 0) {
        clearInterval(intervalRef.current);
        if (!hasFinishedRef.current && typeof onFinish === 'function') {
          hasFinishedRef.current = true;
          onFinish();
        }
      }
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, [duration, challengeId, onFinish]);

  function formatTime(seconds) {
    if (seconds === null) return '--:--:--';

    const hours = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const mins = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const secs = String(seconds % 60).padStart(2, '0');

    return `${hours}:${mins}:${secs}`;
  }

  return <div>Timer: {formatTime(timeLeft)}</div>;
}

export default Timer;
