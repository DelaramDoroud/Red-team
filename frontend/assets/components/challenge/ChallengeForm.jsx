'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import useChallenge from '#js/useChallenge';
import Spinner from '#components/common/Spinner';
import styles from './ChallengeForm.module.scss';

export default function ChallengeForm() {
  const { loading, createChallenge } = useChallenge();
  const [formData, setFormData] = useState({
    title: '',
    duration: '',
    startDate: '',
    startTime: '',
  });
  const [errors, setErrors] = useState({});
  const [matchSettings, setMatchSettings] = useState([
    { id: 1, title: 'Algorithm Challenge 1', ready: true, selected: false },
    { id: 2, title: 'Data Structures Challenge', ready: true, selected: false },
    { id: 3, title: 'SQL Query Challenge', ready: false, selected: false },
    { id: 4, title: 'API Design Challenge', ready: true, selected: false },
  ]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleMatchSettingToggle = (id) => {
    setMatchSettings((prev) =>
      prev.map((setting) =>
        setting.id === id
          ? { ...setting, selected: !setting.selected }
          : setting
      )
    );
    // Clear match settings error if any setting is selected
    if (errors.matchSettings) {
      setErrors((prev) => ({ ...prev, matchSettings: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Title validation
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    // Duration validation
    if (
      formData.duration === '' ||
      formData.duration === null ||
      formData.duration === undefined
    ) {
      newErrors.duration = 'Duration is required';
    } else {
      const durationValue = parseInt(formData.duration, 10);
      if (isNaN(durationValue) || durationValue <= 0) {
        newErrors.duration = 'Duration must be greater than 0';
      }
    }

    // Start Date validation
    if (!formData.startDate) {
      newErrors.startDate = 'Start date is required';
    }

    // Start Time validation
    if (!formData.startTime) {
      newErrors.startTime = 'Start time is required';
    }

    // Match settings validation
    const selectedSettings = matchSettings.filter((s) => s.selected);
    if (selectedSettings.length === 0) {
      newErrors.matchSettings = 'At least one match setting must be selected';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix the form errors');
      return;
    }

    // Combine date and time into ISO datetime
    const startDatetime = new Date(
      `${formData.startDate}T${formData.startTime}`
    ).toISOString();

    const payload = {
      title: formData.title.trim(),
      duration: parseInt(formData.duration, 10),
      startDatetime,
      status: 'draft',
      matchSettings: matchSettings.filter((s) => s.selected).map((s) => s.id),
    };

    const result = await createChallenge(payload);

    if (result?.success) {
      toast.success('Challenge created successfully!');
      // Reset form
      setFormData({
        title: '',
        duration: '',
        startDate: '',
        startTime: '',
      });
      setMatchSettings((prev) =>
        prev.map((setting) => ({ ...setting, selected: false }))
      );
      setErrors({});
    } else {
      toast.error(result?.message || 'Failed to create challenge');
    }
  };

  const selectedCount = matchSettings.filter((s) => s.selected).length;

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles['form-group']}>
        <label htmlFor='title' className={styles.label}>
          Challenge Title *
        </label>
        <input
          type='text'
          id='title'
          name='title'
          value={formData.title}
          onChange={handleInputChange}
          className={`${styles.input} ${errors.title ? styles.error : ''}`}
          placeholder='Enter challenge title'
        />
        {errors.title && (
          <span className={styles['error-message']}>{errors.title}</span>
        )}
      </div>

      <div className={styles['form-row']}>
        <div className={styles['form-group']}>
          <label htmlFor='duration' className={styles.label}>
            Duration (minutes) *
          </label>
          <input
            type='number'
            id='duration'
            name='duration'
            value={formData.duration}
            onChange={handleInputChange}
            className={`${styles.input} ${errors.duration ? styles.error : ''}`}
            placeholder='60'
          />
          {errors.duration && (
            <span className={styles['error-message']}>{errors.duration}</span>
          )}
        </div>

        <div className={styles['form-group']}>
          <label htmlFor='startDate' className={styles.label}>
            Start Date *
          </label>
          <input
            type='date'
            id='startDate'
            name='startDate'
            value={formData.startDate}
            onChange={handleInputChange}
            className={`${styles.input} ${errors.startDate ? styles.error : ''}`}
          />
          {errors.startDate && (
            <span className={styles['error-message']}>{errors.startDate}</span>
          )}
        </div>

        <div className={styles['form-group']}>
          <label htmlFor='startTime' className={styles.label}>
            Start Time *
          </label>
          <input
            type='time'
            id='startTime'
            name='startTime'
            value={formData.startTime}
            onChange={handleInputChange}
            className={`${styles.input} ${errors.startTime ? styles.error : ''}`}
          />
          {errors.startTime && (
            <span className={styles['error-message']}>{errors.startTime}</span>
          )}
        </div>
      </div>

      <div className={styles['form-group']}>
        <label className={styles.label}>
          Match Settings *
          {selectedCount > 0 && (
            <span className={styles['selected-count']}>
              {' '}
              ({selectedCount} selected)
            </span>
          )}
        </label>
        <div className={styles['match-settings-list']}>
          {matchSettings
            .filter((setting) => setting.ready)
            .map((setting) => (
              <div key={setting.id} className={styles['match-setting-item']}>
                <label className={styles['checkbox-label']}>
                  <input
                    type='checkbox'
                    checked={setting.selected}
                    onChange={() => handleMatchSettingToggle(setting.id)}
                    className={styles.checkbox}
                  />
                  <span className={styles['checkbox-text']}>
                    {setting.title}
                  </span>
                </label>
              </div>
            ))}
        </div>
        {errors.matchSettings && (
          <span className={styles['error-message']}>
            {errors.matchSettings}
          </span>
        )}
      </div>

      <div className={styles['form-actions']}>
        <button
          type='submit'
          disabled={loading}
          className={styles['submit-button']}
        >
          {loading ? <Spinner label='Creating...' /> : 'Create Challenge'}
        </button>
      </div>
    </form>
  );
}
