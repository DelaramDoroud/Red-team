'use client';

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  connectionStatus: 'idle',
  lastEvent: null,
  byType: {},
};

const eventsSlice = createSlice({
  name: 'events',
  initialState,
  reducers: {
    streamConnected: (state) => ({
      ...state,
      connectionStatus: 'connected',
    }),
    streamDisconnected: (state) => ({
      ...state,
      connectionStatus: 'disconnected',
    }),
    eventReceived: (state, action) => {
      const eventType = action.payload?.eventType || 'message';
      const payload = action.payload?.payload ?? null;
      const previous = state.byType[eventType] || {
        sequence: 0,
      };
      const nextEvent = {
        sequence: previous.sequence + 1,
        payload,
        receivedAt: Date.now(),
      };
      return {
        ...state,
        lastEvent: {
          eventType,
          ...nextEvent,
        },
        byType: {
          ...state.byType,
          [eventType]: nextEvent,
        },
      };
    },
    resetEventStream: () => initialState,
  },
});

export const {
  streamConnected,
  streamDisconnected,
  eventReceived,
  resetEventStream,
} = eventsSlice.actions;

export const eventsReducer = eventsSlice.reducer;
