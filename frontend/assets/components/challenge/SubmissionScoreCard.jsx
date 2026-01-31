'use client';

import { formatDateTime } from '#js/date';
import styles from './SubmissionScoreCard.module.css';

export default function SubmissionScoreCard({ scoreData }) {
  const { totalScore, codeReviewScore, implementationScore, updatedAt } =
    scoreData || {};

  const formattedDate = updatedAt ? formatDateTime(updatedAt) : '—';

  return (
    <div className={styles.container}>
      {/* 1. HERO SECTION (Top Card) */}
      <div className={styles.heroCard}>
        <h1 className={styles.totalScoreValue}>
          {totalScore !== undefined ? totalScore : '-'}
        </h1>
        <span className={styles.totalLabel}>Total Score out of 100</span>

        <div className={styles.heroDivider} />

        <div className={styles.heroSubScores}>
          <div className={styles.subScoreItem}>
            <span className={styles.subValue}>
              {codeReviewScore !== undefined ? codeReviewScore : '-'}
            </span>
            <span className={styles.subLabel}>Code Review Score</span>
          </div>
          <div className={styles.subScoreItem}>
            <span className={styles.subValue}>
              {implementationScore !== undefined ? implementationScore : '-'}
            </span>
            <span className={styles.subLabel}>Implementation Score</span>
          </div>
        </div>

        <div className={styles.timestamp}>Scored on {formattedDate}</div>
      </div>

      {/* 2. BREAKDOWN SECTION (Grid) */}
      <div className={styles.breakdownGrid}>
        {/* Code Review Card */}
        <div className={styles.detailCard}>
          <div className={styles.cardHeader}>
            <div className={`${styles.iconBox} ${styles.iconReview}`}>CR</div>
            <div className={styles.headerInfo}>
              <h3>Code Review</h3>
              <span>Peer Review Accuracy</span>
            </div>
            <div className={styles.headerScore}>
              {codeReviewScore !== undefined ? codeReviewScore : '-'}
              <span className={styles.headerMax}>/50</span>
            </div>
          </div>
          <p className={styles.description}>
            The portion of the total score based on the accuracy of your peer
            review votes (error-spotting and endorsements) across all reviews
            submitted.
          </p>
        </div>

        {/* Implementation Card */}
        <div className={styles.detailCard}>
          <div className={styles.cardHeader}>
            <div className={`${styles.iconBox} ${styles.iconImpl}`}>IM</div>
            <div className={styles.headerInfo}>
              <h3>Implementation</h3>
              <span>Solution Correctness</span>
            </div>
            <div className={styles.headerScore}>
              {implementationScore !== undefined ? implementationScore : '-'}
              <span className={styles.headerMax}>/50</span>
            </div>
          </div>
          <p className={styles.description}>
            Based on teacher test cases passed, minus penalties from valid peer
            test cases that exposed real bugs in your solution.
          </p>
        </div>
      </div>
    </div>
  );
}
