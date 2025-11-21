'use client';

import { useCallback, useEffect, useState } from 'react';
import useMatchSetting from '#js/useMatchSetting.js';

export default function NewChallengePage() {

    const { loading, getMatchSettings } = useMatchSetting();
    const [matchSettings, setMatchSettings] = useState([]);
    const [challengeName, setChallengeName] = useState('');
    const [startDateTime, setStartDateTime] = useState('');
    const [duration, setDuration] = useState(30);
    const [selectedSettings, setSelectedSettings] = useState([]);
    const [error, setError] = useState(null);

    const toggleSetting = (id) => {
        if (selectedSettings.includes(id)) {
            setSelectedSettings(selectedSettings.filter((s) => s !== id));
        } else {
            setSelectedSettings([...selectedSettings, id]);
        }
    };
    
    const load = useCallback(async () => {
        setError(null);
        const result = await getMatchSettings();
        if (result?.success === false) {
            setError(result.message || 'Unable to load challenges');
            setMatchSettings([]);
            return;
        }
        if (Array.isArray(result)) {
            setMatchSettings(result.matchSettings);
            console.log(result)
        } else if (Array.isArray(result?.data)) {
            setMatchSettings(result.data);
        } else {
            setMatchSettings([]);
        }
    }, [getMatchSettings]);

    useEffect(() => {
        load();
    }, [load]);

    const handleSubmit = (e) => {
        e.preventDefault();
        const payload = {
        title: challengeName,
        startDatetime: startDateTime,
        duration,
        matchSettingIds: selectedSettings,
        };
        console.log('Creating challenge', payload);
    };

    return (
        <main style={{ padding: '2rem', maxWidth: 700, margin: '0 auto' }}>
            <h1>Create New Challenge</h1>
            <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '1rem' }}>
                    <label>Challenge Name</label>
                    <input type="text" value={challengeName} style={{ display: 'block', width: '100%', padding: '0.5rem' }}
                    onChange={(e) => setChallengeName(e.target.value)} required/>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                    <div style={{ flex: 1 }}>
                        <label>Start Date/Time</label>
                        <input type="datetime-local" value={startDateTime} style={{ display: 'block', width: '100%', padding: '0.5rem' }}
                        onChange={(e) => setStartDateTime(e.target.value)} required />
                    </div>
                    <div style={{ width: 120 }}>
                        <label>Duration (min)</label>
                        <input type="number" value={duration} style={{ display: 'block', width: '100%', padding: '0.5rem' }}
                        onChange={(e) => setDuration(Number(e.target.value))} min={1} required />
                    </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                    <strong>Selected Match Settings: {selectedSettings.length}</strong>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
                <thead>
                    <tr>
                        <th style={{ borderBottom: '1px solid #ccc' }}>Select</th>
                        <th style={{ borderBottom: '1px solid #ccc' }}>Title</th>
                    </tr>
                </thead>
                <tbody>
                    {matchSettings.map((ms) => (
                        <tr key={ms.id}>
                            <td style={{ textAlign: 'center', padding: '0.5rem' }}>
                                <input type="checkbox" checked={selectedSettings.includes(ms.id)}
                                onChange={() => toggleSetting(ms.id)}/>
                            </td>
                            <td style={{ padding: '0.5rem' }}>{ms.problemTitle}</td>
                        </tr>
                    ))}
                </tbody>
                </table>

                <button type="submit" style={{padding: '0.75rem 1.5rem', backgroundColor: '#2563eb',
                color: 'white', border: 'none', borderRadius: '0.375rem', cursor: 'pointer'}} >
                    Create
                </button>
            </form>
        </main>
    );
}
