'use client';

import { useMemo } from 'react';
import { cn } from '#js/utils';
import styles from './ChallengeSelector.module.css';

const getDisplayLabel = (item, index) => {
  if (item?.label) return item.label;
  if (item?.title && item?.sequence != null) {
    return `Challenge #${item.sequence}: ${item.title}`;
  }
  if (item?.title) return `Challenge #${index + 1}: ${item.title}`;
  return `Challenge #${index + 1}`;
};

export default function ChallengeSelector({
  challenges = [],
  activeId,
  onSelect,
  label = 'Select a Challenge',
  className,
}) {
  const activeKey =
    activeId ??
    (Array.isArray(challenges) && challenges.length ? challenges[0].id : null);

  const items = useMemo(
    () =>
      Array.isArray(challenges)
        ? challenges.map((challenge, index) => ({
            ...challenge,
            displayLabel: getDisplayLabel(challenge, index),
          }))
        : [],
    [challenges]
  );

  if (!items.length) {
    return (
      <div className={cn(styles.selector, className)}>
        <div className={styles.heading}>
          <span className={styles.headingDot} aria-hidden='true' />
          <span>{label}</span>
          <span className={styles.headingRule} aria-hidden='true' />
        </div>
        <div className={styles.empty}>No challenges available yet.</div>
      </div>
    );
  }

  return (
    <div className={cn(styles.selector, className)}>
      <div className={styles.heading}>
        <span className={styles.headingDot} aria-hidden='true' />
        <span>{label}</span>
        <span className={styles.headingRule} aria-hidden='true' />
      </div>
      <div className={styles.tabRail} role='tablist' aria-label={label}>
        {items.map((challenge) => {
          const isActive = challenge.id === activeKey;
          return (
            <button
              key={challenge.id ?? challenge.displayLabel}
              type='button'
              className={cn(styles.tab, isActive && styles.tabActive)}
              role='tab'
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onSelect?.(challenge)}
            >
              {challenge.displayLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}
