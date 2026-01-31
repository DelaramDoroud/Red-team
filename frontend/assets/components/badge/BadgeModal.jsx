import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';

const FIREWORK_COUNT = 12;
const fireworkColors = [
  'text-pink-500',
  'text-yellow-400',
  'text-blue-500',
  'text-green-500',
  'text-purple-500',
];

// Badge level styles
const levelStyles = {
  bronze: { bg: 'bg-amber-600' },
  silver: { bg: 'bg-gray-400' },
  gold: { bg: 'bg-yellow-400' },
  default: { bg: 'bg-gray-200' }, // no level
};

function BadgeModal({ badge, onClose }) {
  const [showFireworks, setShowFireworks] = useState(false);

  useEffect(() => {
    if (!badge) return;

    setShowFireworks(true);
    const timer = setTimeout(() => setShowFireworks(false), 2500);
    clearTimeout(timer);
  }, [badge]);

  if (!badge) return null;

  const level = badge.level?.toLowerCase() || 'default';
  const style = levelStyles[level];

  // Icon image path
  const iconSrc = `/badge/${badge.iconKey}.png`;

  return (
    <div className='fixed inset-0 flex items-center justify-center z-50'>
      {/* Background overlay */}
      <div className='absolute inset-0 bg-black/50' />

      {/* Fireworks behind modal */}
      {showFireworks && (
        <div className='absolute inset-0 pointer-events-none z-10'>
          {Array.from({ length: FIREWORK_COUNT }).map((_, i) => {
            const size = 10 + Math.random() * 12;
            const x = Math.random() * 100;
            const y = Math.random() * 50 + 10;
            const color = fireworkColors[i % fireworkColors.length];
            const duration = 1000 + Math.random() * 1000;
            const key = `firework-${i}-${Date.now()}-${color}`; // key unica

            return (
              <Star
                key={key}
                className={`${color} absolute`}
                style={{
                  width: `${size}px`,
                  height: `${size}px`,
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
      <div className='relative bg-white rounded-2xl p-6 w-96 text-center shadow-xl z-20 animate-pop overflow-hidden'>
        {/* Header */}
        <div className='flex items-center justify-center gap-2 mb-6'>
          <Star className='w-6 h-6 text-yellow-400 animate-pulse' />
          <h2 className='text-xl font-bold'>Badge Unlocked!</h2>
          <Star className='w-6 h-6 text-yellow-400 animate-pulse' />
        </div>

        {/* Badge circle */}
        <div className='mx-auto w-32 h-32 rounded-full flex items-center justify-center shadow-lg mb-4 relative'>
          {/* Glow */}
          <span
            className={`absolute inset-0 rounded-full ${style.bg} opacity-40 animate-pulse`}
            style={{ filter: 'blur(12px)' }}
          />
          {/* Icon image */}
          <img
            src={iconSrc}
            alt={badge.name}
            className='relative w-20 h-20 animate-pop-scale'
          />
        </div>

        {/* Badge info */}
        <h3 className='text-lg font-semibold'>{badge.name}</h3>
        <p className='text-gray-600 mt-1'>{badge.description}</p>
        {badge.threshold && (
          <p className='text-gray-500 text-sm mt-2'>
            You&apos;ve completed {badge.threshold}{' '}
            {badge.metric.replace('_', ' ').toLowerCase()}!
          </p>
        )}

        {/* Close button */}
        <button
          type='button'
          onClick={onClose}
          className='mt-6 bg-blue-500 text-white px-6 py-2 rounded-full font-semibold hover:bg-blue-600 transition'
        >
          Close
        </button>
      </div>

      {/* Keyframes */}
      <style>{`
				@keyframes fireworkExplosion {
				0% { transform: translate(-50%, -50%) scale(0); opacity: 1; }
				40% { transform: translate(-50%, -50%) scale(1.5); opacity: 1; }
				100% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
				}

				@keyframes popScale {
				0% { transform: scale(0); opacity: 0; }
				50% { transform: scale(1.3); opacity: 1; }
				100% { transform: scale(1); opacity: 1; }
				}

				.animate-pop-scale {
				animation: popScale 0.6s ease-out forwards;
				}
			`}</style>
    </div>
  );
}

export default BadgeModal;
