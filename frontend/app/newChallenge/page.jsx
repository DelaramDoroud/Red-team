'use client';

import { useCallback, useEffect, useState } from 'react';
import useMatchSettings from '#js/useMatchSetting.js';
import styles from './page.module.scss';
import ToggleSwitch from '#components/common/ToggleSwitch.jsx';
import Pagination from '#components/common/Pagination.jsx';

export default function NewChallengePage() {
    const { loading, getMatchSettings } = useMatchSettings();
    const [challenge, setChallenge] = useState({
        title: "",
        startDateTime: "",
        duration: 30,
        matchSettings: [],
        status: "public"
    });
    const [matchSettings, setMatchSettings] = useState([]);
    const [error, setError] = useState(null);
    
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 5;
    const totalPages = Math.ceil(matchSettings.length / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const currentItems = matchSettings.slice(startIndex, endIndex);

    const toggleSetting = (id) => {
        setChallenge(prev => {
            const selected = prev.matchSettings;
            const newSelected = selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id];
            return { ...prev, matchSettings: newSelected };
        });
    };

    const handleDataField = (event) => {
        let newChallenge = {... challenge};
        newChallenge[event.target.name] = event.target.value;
        setChallenge(newChallenge);
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
        console.log("Challenge to save: ", challenge);
        setError(null);
        if (challenge.matchSettings.length === 0) {
            setError("Seleziona almeno un match setting per creare la sfida.");
        }else{
            // Call API to save challenge
        }
    };

    return <>
        {error && <div className={styles.errorBox}>{error}</div>}
        <main style={{ padding: '2rem', maxWidth: 700, margin: '0 auto' }}>
            <h1>Create New Challenge</h1>
            <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '1rem' }}>
                    <label>Challenge Name</label>
                    <input type="text" value={challenge.title} onChange={handleDataField} name="title"
                    style={{ display: 'block', width: '100%', padding: '0.5rem' }} required/>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                    <div style={{ flex: 1 }}>
                        <label>Start Date/Time</label>
                        <input type="datetime-local" value={challenge.startDateTime} onChange={handleDataField} name="startDateTime"
                        style={{ display: 'block', width: '100%', padding: '0.5rem' }} required/>
                    </div>
                    <div style={{ width: 120 }}>
                        <label>Duration (min)</label>
                        <input type="number" value={challenge.duration} onChange={handleDataField} name="duration"
                        style={{ display: 'block', width: '100%', padding: '0.5rem' }} min={1} required/>
                    </div>
                </div>
                <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span>Status</span>
                    <ToggleSwitch checked={challenge.status === 'public'} label={challenge.status === 'public' ? 'Public' : 'Private'}
                    onChange={() => setChallenge(prev => ({...prev, status: prev.status === "public" ? "private" : "public"}))}/>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                    <strong>Selected Match Settings: {challenge.matchSettings.length}</strong>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
                    <thead>
                        <tr>
                            <th style={{ borderBottom: '1px solid #ccc' }}>Select</th>
                            <th style={{ borderBottom: '1px solid #ccc' }}>Title</th>
                        </tr>
                    </thead>
                    <tbody>
                        {currentItems.map((match) => (
                            <tr key={match.id}>
                                <td style={{ textAlign: 'center', padding: '0.5rem' }}>
                                    <input type="checkbox" checked={challenge.matchSettings.includes(match.id)}
                                    onChange={() => toggleSetting(match.id)}/>
                                </td>
                                <td style={{ textAlign: 'center', padding: '0.5rem' }}>{match.problemTitle}</td>
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
    </>
}
