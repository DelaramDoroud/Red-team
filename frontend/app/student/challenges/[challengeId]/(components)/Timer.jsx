import {useEffect, useState} from 'react';

function Timer({ duration }) {
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    // if (!duration) return;

    const endTime = Date.now() + 120 * 1000;
    
    // setTimeLeft(duration);

    const intervalId = setInterval(() => {
      const diff = Math.floor((endTime - Date.now()) / 1000);

      if (diff <= 0) {
        setTimeLeft(0);
        clearInterval(intervalId);
      } else {
        setTimeLeft(diff);
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [120]);

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
