'use client';

import { useCallback } from 'react';
import useFetchData from '#js/useFetchData';
import * as Constants from '#constants/Constants.js';

const API_BASE = Constants.API_BACKEND;

export default function useMatchSettings() {
    const { fetchData, loading } = useFetchData();

    const getMatchSettings = useCallback(async () => {
        const url = `${API_BASE}/matchSettings`;
        return fetchData(url);
    }, [fetchData]);

    return {
        loading,
        getMatchSettings,
    };
}
