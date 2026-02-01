'use client';

import { useMemo, useState } from 'react';
import ChallengeSelector from '#components/challenge/ChallengeSelector';
import { Button } from '#components/common/Button';
import styles from './page.module.css';

const MOCK_CHALLENGES = [
  { id: 1, title: 'Binary Search', sequence: 1 },
  { id: 2, title: 'Linked Lists', sequence: 2 },
  { id: 3, title: 'Hash Tables', sequence: 3 },
  { id: 4, title: 'Tree Traversal', sequence: 4 },
];

const MOCK_SUMMARY = {
  participants: 14,
  averageScore: 84.3,
  rank: 12,
};

const MOCK_ROWS = [
  {
    id: 1,
    rank: 1,
    name: 'Emma Rodriguez',
    role: 'Expert',
    total: 97,
    impl: 48,
    review: 49,
    badges: ['🏅', '⚡'],
  },
  {
    id: 2,
    rank: 2,
    name: 'Michael Chen',
    role: 'Expert',
    total: 95,
    impl: 47,
    review: 48,
    badges: ['🥈', '⚡'],
  },
  {
    id: 3,
    rank: 3,
    name: 'Sarah Johnson',
    role: 'Specialist',
    total: 93,
    impl: 46,
    review: 47,
    badges: ['🥉', '🏅'],
  },
  {
    id: 4,
    rank: 4,
    name: 'David Kim',
    role: 'Specialist',
    total: 91,
    impl: 45,
    review: 46,
    badges: ['✅'],
  },
  {
    id: 5,
    rank: 5,
    name: 'Lisa Wang',
    role: 'Specialist',
    total: 89,
    impl: 44,
    review: 45,
    badges: ['🏅'],
  },
  {
    id: 6,
    rank: 6,
    name: 'James Martinez',
    role: 'Specialist',
    total: 87,
    impl: 43,
    review: 44,
    badges: ['🔒'],
  },
  {
    id: 7,
    rank: 7,
    name: 'Anna Lee',
    role: 'Pupil',
    total: 85,
    impl: 42,
    review: 43,
    badges: ['🏅'],
  },
  {
    id: 8,
    rank: 8,
    name: 'Chris Taylor',
    role: 'Pupil',
    total: 83,
    impl: 41,
    review: 42,
    badges: ['🏅'],
  },
  {
    id: 9,
    rank: 9,
    name: 'Sophie Brown',
    role: 'Pupil',
    total: 81,
    impl: 40,
    review: 41,
    badges: ['🏅'],
  },
  {
    id: 10,
    rank: 10,
    name: 'Ryan Davis',
    role: 'Pupil',
    total: 79,
    impl: 39,
    review: 40,
    badges: ['🏅'],
  },
];

const MOCK_PERSONAL = {
  rank: 12,
  total: 75,
  implementation: 38,
  review: 37,
  nextRankGap: 2,
};

export default function StudentLeaderboardPage() {
  const [activeChallenge, setActiveChallenge] = useState(MOCK_CHALLENGES[0]);

  const summary = useMemo(
    () => ({
      ...MOCK_SUMMARY,
      challengeTitle: activeChallenge?.title ?? 'Challenge',
    }),
    [activeChallenge]
  );

  return (
    <div className={styles.page}>
      <ChallengeSelector
        challenges={MOCK_CHALLENGES}
        activeId={activeChallenge?.id}
        onSelect={setActiveChallenge}
      />

      <section className={styles.summaryCard}>
        <div className={styles.summaryHeader}>
          <div>
            <div className={styles.summaryTitle}>
              <span role='img' aria-label='trophy'>
                🏆
              </span>
              Challenge #{activeChallenge?.sequence}: {summary.challengeTitle}
            </div>
            <div className={styles.summarySubtitle}>
              Rankings updated in real-time
            </div>
          </div>
        </div>
        <div className={styles.summaryGrid}>
          <div className={styles.summaryItem}>
            <div className={styles.summaryValue}>{summary.participants}</div>
            <div className={styles.summaryLabel}>Total Participants</div>
          </div>
          <div className={styles.summaryItem}>
            <div className={styles.summaryValue}>{summary.averageScore}</div>
            <div className={styles.summaryLabel}>Average Score</div>
          </div>
          <div className={styles.summaryItem}>
            <div className={styles.summaryValue}>#{summary.rank}</div>
            <div className={styles.summaryLabel}>Your Rank</div>
          </div>
        </div>
      </section>

      <section className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <div className={styles.tableTitle}>Rankings</div>
          <div className={styles.tableHint}>Top performers this challenge</div>
        </div>
        <div className={styles.table}>
          <div className={styles.tableRowHead}>
            <div>Rank</div>
            <div>Student</div>
            <div>Total</div>
            <div>Impl.</div>
            <div>Review</div>
            <div>Badges</div>
          </div>
          {MOCK_ROWS.map((row) => (
            <div key={row.id} className={styles.tableRow}>
              <div className={styles.rankCell}>#{row.rank}</div>
              <div className={styles.studentCell}>
                <div className={styles.studentName}>{row.name}</div>
                <div className={styles.studentRole}>{row.role}</div>
              </div>
              <div className={styles.scoreCell}>
                <div className={styles.scoreValue}>{row.total}</div>
                <div className={styles.scoreMax}>/ 100</div>
              </div>
              <div className={styles.scoreCell}>
                <div className={styles.scoreValue}>{row.impl}</div>
                <div className={styles.scoreMax}>/ 50</div>
              </div>
              <div className={styles.scoreCell}>
                <div className={styles.scoreValue}>{row.review}</div>
                <div className={styles.scoreMax}>/ 50</div>
              </div>
              <div className={styles.badgesCell}>
                {row.badges.map((badge) => (
                  <span key={`${row.id}-${badge}`}>{badge}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className={styles.pagination}>
          <Button size='sm' variant='outline'>
            1
          </Button>
          <Button size='sm' variant='outline'>
            2
          </Button>
          <Button size='sm' variant='outline'>
            Next →
          </Button>
        </div>
      </section>

      <section className={styles.personalCard}>
        <div className={styles.personalHeader}>
          <div className={styles.personalTitle}>Your Position</div>
          <div className={styles.personalHint}>
            Gap to #11: need {MOCK_PERSONAL.nextRankGap} more points
          </div>
        </div>
        <div className={styles.personalGrid}>
          <div className={styles.personalItem}>
            <div className={styles.personalLabel}>Current Rank</div>
            <div className={styles.personalValue}>#{MOCK_PERSONAL.rank}</div>
          </div>
          <div className={styles.personalItem}>
            <div className={styles.personalLabel}>Total Score</div>
            <div className={styles.personalValue}>
              {MOCK_PERSONAL.total}/100
            </div>
          </div>
          <div className={styles.personalItem}>
            <div className={styles.personalLabel}>Implementation</div>
            <div className={styles.personalValue}>
              {MOCK_PERSONAL.implementation}/50
            </div>
          </div>
          <div className={styles.personalItem}>
            <div className={styles.personalLabel}>Code Review</div>
            <div className={styles.personalValue}>
              {MOCK_PERSONAL.review}/50
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
