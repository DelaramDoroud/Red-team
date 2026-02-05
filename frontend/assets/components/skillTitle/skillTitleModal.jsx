import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';

const FIREWORK_COUNT = 14;
const fireworkColors = [
  'text-purple-500',
  'text-pink-500',
  'text-yellow-400',
  'text-blue-500',
];

function skillTitleModal({ title, onClose }) {
  const [showFireworks, setShowFireworks] = useState(false);

  useEffect(() => {
    if (!title) return;

    setShowFireworks(true);
    const timer = setTimeout(() => setShowFireworks(false), 2500);
    return () => clearTimeout(timer);
  }, [title]);

  if (!title) return null;

  return (
    <div className='fixed inset-0 flex items-center justify-center z-50'>
      {/* Background overlay */}
      <div className='absolute inset-0 bg-black/60' />

      {/* Fireworks */}
      {showFireworks && (
        <div className='absolute inset-0 pointer-events-none z-10'>
          {Array.from({ length: FIREWORK_COUNT }).map((_, i) => {
            const size = 12 + Math.random() * 14;
            const x = Math.random() * 100;
            const y = Math.random() * 50 + 10;
            const color = fireworkColors[i % fireworkColors.length];
            const duration = 900 + Math.random() * 1200;

            return (
              <Star
                key={`fw-${i}-${Date.now()}`}
                className={`${color} absolute`}
                style={{
                  width: size,
                  height: size,
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: 'translate(-50%, -50%) scale(0)',
                  animation: `fireworkExplosion ${duration}ms ease-out forwards`,
                  animationDelay: `${Math.random() * 500}ms`,
                }}
              />
            );
          })}
        </div>
      )}

      {/* Modal */}
      <div className='relative bg-white rounded-2xl p-8 w-[420px] text-center shadow-xl z-20 animate-pop'>
        {/* Header */}
        <h2 className='text-2xl font-bold mb-6'>
          🎉 TITLE UNLOCKED!
        </h2>

        {/* Title box */}
        <div className='mx-auto w-48 h-32 rounded-xl bg-purple-500 text-white flex items-center justify-center text-2xl font-semibold shadow-lg mb-4 animate-pop-scale'>
          {title.name}
        </div>

        {/* Description */}
        <p className='text-gray-600 mb-4'>
          {title.description}
        </p>

        {/* Requirements */}
        {title.requirements?.length > 0 && (
          <div className='text-left bg-gray-50 rounded-xl p-4 mb-4'>
            <h4 className='font-semibold mb-2'>Requirements Achieved:</h4>
            <ul className='text-sm text-gray-700 space-y-1'>
              {title.requirements.map((req, i) => (
                <li key={i}>✔ {req}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Permanence note */}
        <p className='text-xs text-blue-600 mb-4'>
          🎯 Titles are permanent and never decrease.
        </p>

        {/* Close */}
        <button
          type='button'
          onClick={onClose}
          className='mt-2 bg-blue-500 text-white px-8 py-2 rounded-full font-semibold hover:bg-blue-600 transition'
        >
          Continue
        </button>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes fireworkExplosion {
          0% { transform: translate(-50%, -50%) scale(0); opacity: 1; }
          40% { transform: translate(-50%, -50%) scale(1.5); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
        }

        @keyframes popScale {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }

        .animate-pop-scale {
          animation: popScale 0.6s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

export default skillTitleModal;
