import { useEffect, useRef, useState } from 'react';

function Timer({ duration, challengeId, onFinish }) {
  const [timeLeft, setTimeLeft] = useState(null);
  const hasFinishedRef = useRef(false);
  useEffect(() => {
    const durationSeconds = duration * 60; // convert minutes → seconds

    // 1. Create a unique storage key for this challenge
    const storageKey = `challenge-start-${challengeId}`;

    // 2. Check if we already have a startTime saved
    let startTime = localStorage.getItem(storageKey);

    if (!startTime) {
      // first time entering challenge → store Date.now()
      startTime = Date.now();
      localStorage.setItem(storageKey, startTime);
    } else {
      startTime = Number(startTime);
    }

    // 3. Calculate endTime from stored start time
    const endTime = startTime + durationSeconds * 1000;
    hasFinishedRef.current = false;
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
  }, [duration, challengeId, onFinish]); // rerun if challenge changes

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
