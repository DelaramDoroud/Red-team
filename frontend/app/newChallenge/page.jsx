'use client';

import { useCallback, useEffect, useState } from 'react';
import useMatchSettings from '#js/useMatchSetting.js';
import styles from './page.module.scss';
import ToggleSwitch from '#components/common/ToggleSwitch.jsx';
import Pagination from '#components/common/Pagination.jsx';

export default function NewChallengePage() {
    const { loading, getMatchSettings } = useMatchSettings();
    const [matchSettings, setMatchSettings] = useState([]);
    const [challengeName, setChallengeName] = useState('');
    const [startDateTime, setStartDateTime] = useState('');
    const [duration, setDuration] = useState(30);
    const [selectedSettings, setSelectedSettings] = useState([]);
    const [status, setStatus] = useState('public');
    const [error, setError] = useState(null);

    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 5;

    const totalPages = Math.ceil(matchSettings.length / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const currentItems = matchSettings.slice(startIndex, endIndex);

    const toggleSetting = (id) => {
        if (selectedSettings.includes(id)) {
            setSelectedSettings(selectedSettings.filter((s) => s !== id));
        } else {
            setSelectedSettings([...selectedSettings, id]);
        }
    };

    const toggleStatus = () => {
        setStatus((prev) => (prev === 'private' ? 'public' : 'private'));
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
            status,
        };
        console.log('Creating challenge', payload);
    };

    return (
        <main style={{ padding: '2rem', maxWidth: 700, margin: '0 auto' }}>
            <h1>Create New Challenge</h1>
            <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '1rem' }}>
                    <label>Challenge Name</label>
                    <input type="text" value={challengeName} required
                    style={{ display: 'block', width: '100%', padding: '0.5rem' }}
                    onChange={(e) => setChallengeName(e.target.value)} />
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                    <div style={{ flex: 1 }}>
                        <label>Start Date/Time</label>
                        <input type="datetime-local" value={startDateTime} 
                        style={{ display: 'block', width: '100%', padding: '0.5rem' }}
                        onChange={(e) => setStartDateTime(e.target.value)} required/>
                    </div>
                    <div style={{ width: 120 }}>
                        <label>Duration (min)</label>
                        <input type="number" value={duration} style={{ display: 'block', width: '100%', padding: '0.5rem' }}
                        onChange={(e) => setDuration(Number(e.target.value))} min={1} required/>
                    </div>
                </div>
                <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span>Status</span>
                    <ToggleSwitch checked={status === 'public'}
                    onChange={() => setStatus(status === 'private' ? 'public' : 'private')}
                    label={status === 'public' ? 'Public' : 'Private'}/>
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
                        {currentItems.map((ms) => (
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
                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage}/>

                <div className={styles.submitWrapper}>
                    <button type="submit" className={styles.submitButton}>
                        Create
                    </button>
                </div>
            </form>
        </main>
    );
}
