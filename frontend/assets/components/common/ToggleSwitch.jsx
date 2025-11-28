'use client';

import React from 'react';
import styles from './ToggleSwitch.module.scss';

export default function ToggleSwitch({ checked, onChange, label }) {
  return (
    <label className={styles.switch}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className={styles.slider}></span>
      {label && <span className={styles.labelText}>{label}</span>}
    </label>
  );
}
