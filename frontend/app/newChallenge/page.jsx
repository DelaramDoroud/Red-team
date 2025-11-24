'use client';

import { useCallback, useEffect, useState } from 'react';
import useMatchSettings from '#js/useMatchSetting.js';
import useChallenge from '#js/useChallenge';
import styles from './page.module.scss';
import * as Constans from '#constants/Constants.js';
import ToggleSwitch from '#components/common/ToggleSwitch.jsx';
import Pagination from '#components/common/Pagination.jsx';
import { useRouter } from 'next/navigation';

export default function NewChallengePage() {
    const router = useRouter();
    const { loading, getMatchSettingsReady } = useMatchSettings();
    const { createChallenge, loadingChallenge } = useChallenge();

    const [challenge, setChallenge] = useState({
        title: "", startDatetime: "", endDatetime: "", duration: 30, matchSettingIds: [],
        status: "public", peerReviewStartDate: "", peerReviewEndDate: ""
    });
    const [matchSettings, setMatchSettings] = useState([]);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 5;
    const totalPages = Math.ceil(matchSettings.length / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const currentItems = matchSettings.slice(startIndex, endIndex);

    const toggleSetting = (id) => {
        setChallenge(prev => ({...prev,  matchSettingIds: prev.matchSettingIds.includes(id) ? 
            prev.matchSettingIds.filter(s => s !== id) : [...prev.matchSettingIds, id]
        }));
    };

    const handleDataField = (event) => {
        let newChallenge = {... challenge};
        newChallenge[event.target.name] = event.target.value;
        setChallenge(newChallenge);
    };

    const toISODateTime = (localDateTime) => {
        if (!localDateTime) return null;
        const dt = new Date(localDateTime);
        return dt.toISOString();
    };

    const load = useCallback(async () => {
        setError(null);
        const result = await getMatchSettingsReady();
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
    }, [getMatchSettingsReady]);

    useEffect(() => {
        load();
    }, [load]);

    const getMinDateTime = () => {
        const now = new Date();
        now.setSeconds(0, 0);
        return now.toISOString().slice(0,16);
    };


    const handleSubmit = async (e) => {
        e.preventDefault();
        console.log("Challenge to save: ", challenge);
        setError(null);
        if (challenge.matchSettingIds.length === 0) {
            setError("Select at least one match setting.");
        }else{
            const start = new Date(challenge.startDatetime);
            const end = new Date(challenge.endDatetime);
            const peerStart = new Date(challenge.peerReviewStartDate);
            const peerEnd = new Date(challenge.peerReviewEndDate);
            if (start > end) {
                setError("End date/time cannot be before start date/time.");
            }else if (end > peerStart) {
                setError("Peer review start cannot be before challenge end.");
            }else if (peerStart > peerEnd) {
                setError("Peer review end cannot be before peer review start.");
            }else{
                const payload = {
                    ...challenge,
                    startDatetime: toISODateTime(challenge.startDatetime),
                    endDatetime: toISODateTime(challenge.endDatetime),
                    peerReviewStartDate: toISODateTime(challenge.peerReviewStartDate),
                    peerReviewEndDate: toISODateTime(challenge.peerReviewEndDate),
                };
                try {
                    const result = await createChallenge(payload);
                    console.log("Result: ", result)
                    if (result?.success) {
                        setSuccessMessage("Challenge created successfully! Redirecting...");
                        console.log("Challenge:", result);
                        setTimeout(() => {
                            router.push('/challenges');
                        }, 3000);
                    } else {
                        let errorMsg = "An unknown error occurred";
                        let message = result?.message.slice(Constans.NETWORK_RESPONSE_NOT_OK.length);
                        let jsonError = JSON.parse(message);
                        if (jsonError.error?.errors?.length > 0) {
                                errorMsg = jsonError.error.errors[0].message;
                        } else if (jsonError?.message) {
                            errorMsg = jsonError.message;
                        }
                        setError(errorMsg);
                    }
                } catch (err) {
                    console.error(err);
                    setError("Error: " + err.message);
                }
            }
        }
    };

    return <>
        {error && <div className={styles.errorBox}>{error}</div>}
        {successMessage && <div className={styles.successBox}>{successMessage}</div>}
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
                        <input type="datetime-local" value={challenge.startDatetime} onChange={handleDataField} name="startDatetime"
                        style={{ display: 'block', width: '100%', padding: '0.5rem' }} min={getMinDateTime()} required/>
                    </div>
                    <div style={{ width: 120 }}>
                        <label>Duration (min)</label>
                        <input type="number" value={challenge.duration} onChange={handleDataField} name="duration"
                        style={{ display: 'block', width: '100%', padding: '0.5rem' }} min={1} required/>
                    </div>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                    <label>End Date/Time</label>
                    <input type="datetime-local" value={challenge.endDatetime} name="endDatetime" min={getMinDateTime()}
                    onChange={handleDataField} style={{ display: 'block', width: '100%', padding: '0.5rem' }} required/>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                    <label>Peer Review Start</label>
                    <input type="datetime-local" value={challenge.peerReviewStartDate} name="peerReviewStartDate" min={getMinDateTime()}
                    onChange={handleDataField} style={{ display: 'block', width: '100%', padding: '0.5rem' }} required/>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                    <label>Peer Review End</label>
                    <input type="datetime-local" value={challenge.peerReviewEndDate} name="peerReviewEndDate" min={getMinDateTime()}
                    onChange={handleDataField} style={{ display: 'block', width: '100%', padding: '0.5rem' }} required/>
                </div>
                <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span>Status</span>
                    <ToggleSwitch checked={challenge.status === 'public'} label={challenge.status === 'public' ? 'Public' : 'Private'}
                    onChange={() => setChallenge(prev => ({...prev, status: prev.status === "public" ? "private" : "public"}))}/>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                    <strong>Selected Match Settings: {challenge?.matchSettingIds?.length}</strong>
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
                                    <input type="checkbox" checked={challenge.matchSettingIds.includes(match.id)}
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
