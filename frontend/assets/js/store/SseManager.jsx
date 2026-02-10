'use client';

import { useEffect } from 'react';
import { API_REST_BASE } from '#js/constants';
import { useAppDispatch } from '#js/store/hooks';
import {
  eventReceived,
  streamConnected,
  streamDisconnected,
} from '#js/store/slices/events';

const LISTENED_EVENT_TYPES = [
  'challenge-updated',
  'challenge-participant-joined',
  'finalization-updated',
];

const parsePayload = (rawData) => {
  if (!rawData) return null;
  try {
    return JSON.parse(rawData);
  } catch {
    return rawData;
  }
};

export default function SseManager() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (typeof EventSource === 'undefined') {
      dispatch(streamDisconnected());
      return undefined;
    }

    const source = new EventSource(`${API_REST_BASE}/events`, {
      withCredentials: true,
    });

    source.onopen = () => {
      dispatch(streamConnected());
    };

    source.onerror = () => {
      dispatch(streamDisconnected());
    };

    const handleEvent = (eventType) => (event) => {
      dispatch(
        eventReceived({
          eventType,
          payload: parsePayload(event?.data),
        })
      );
    };

    source.onmessage = handleEvent('message');
    LISTENED_EVENT_TYPES.forEach((eventType) => {
      source.addEventListener(eventType, handleEvent(eventType));
    });

    return () => {
      source.close();
      dispatch(streamDisconnected());
    };
  }, [dispatch]);

  return null;
}
