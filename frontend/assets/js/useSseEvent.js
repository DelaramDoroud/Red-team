'use client';

import { useEffect } from 'react';
import { useAppSelector } from '#js/store/hooks';

export default function useSseEvent(eventType, onEvent) {
  const eventRecord = useAppSelector(
    (state) => state.events?.byType?.[eventType] || null
  );
  const sequence = eventRecord?.sequence || 0;

  useEffect(() => {
    if (!sequence) return;
    onEvent(eventRecord?.payload ?? null);
  }, [eventRecord?.payload, onEvent, sequence]);
}
