'use client';

import React from 'react';
import styles from './ToggleSwitch.module.css';

export default function ToggleSwitch({ checked, onChange, label }) {
  return (
    // eslint-disable-next-line jsx-a11y/label-has-associated-control
    <label className={styles.switch}>
      <input type='checkbox' checked={checked} onChange={onChange} />
      <span className={styles.slider} />
      {label && <span className={styles.labelText}>{label}</span>}
    </label>
  );
}
