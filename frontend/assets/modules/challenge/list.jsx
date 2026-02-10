'use client';

import { Button } from '#components/common/Button';
import Spinner from '#components/common/Spinner';
import ChallengeListCardGrid from './ChallengeListCardGrid';
import styles from './list.module.css';
import { getNoticeClassName } from './listHelpers';
import useChallengeListState from './useChallengeListState';

function ChallengeGroup({ title, hint, items, emptyText, cardGrid }) {
  return (
    <div className={styles.group}>
      <div className={styles.groupHeader}>
        <h3 className={styles.groupTitle}>{title}</h3>
        <span className={styles.groupHint}>{hint}</span>
      </div>
      {items.length ? cardGrid : <p className={styles.empty}>{emptyText}</p>}
    </div>
  );
}

export default function ChallengeList({ scope = 'main' }) {
  const state = useChallengeListState(scope);

  if (state.loading && !state.challenges.length && !state.error) {
    return (
      <div className={styles.center}>
        <Spinner label='Loading challenges…' />
      </div>
    );
  }

  const sharedGridProps = {
    styles,
    participantsMap: state.participantsMap,
    pending: state.pending,
    reviewErrors: state.reviewErrors,
    publishEligibility: state.publishEligibility,
    publishValidationLoading: state.publishValidationLoading,
    publishValidationError: state.publishValidationError,
    onPublish: state.handlePublish,
    onAssignWithValidation: state.handleAssignWithValidation,
    onStartWithValidation: state.handleStartWithValidation,
    onAssignReviews: state.handleAssignReviews,
    onStartPeerReview: state.handleStartPeerReview,
    onAllowedNumberChange: state.handleAllowedNumberChange,
    isPrivateView: state.isPrivateView,
  };

  if (state.isPrivateView) {
    return (
      <section className={styles.section}>
        <div className={styles.header}>
          <h2>Private challenges</h2>
          <div className={styles.headerActions}>
            <Button
              variant='outline'
              onClick={state.load}
              title='Refresh challenges'
            >
              Refresh
            </Button>
          </div>
        </div>
        {state.error && <p className={styles.error}>{state.error}</p>}
        {state.publishValidationError && (
          <p className={styles.error}>{state.publishValidationError}</p>
        )}
        {state.assignNotice && (
          <p
            className={`${styles.notice} ${getNoticeClassName(
              styles,
              state.assignNotice.tone
            )}`}
          >
            {state.assignNotice.text}
          </p>
        )}
        {!state.error && !state.loading && !state.challenges.length && (
          <p className={styles.empty}>
            No challenges yet. Try creating one from the backend.
          </p>
        )}
        <ChallengeGroup
          title='Private challenges'
          hint={
            state.privateChallenges.length
              ? 'Not visible to students'
              : 'None yet'
          }
          items={state.privateChallenges}
          emptyText='No private challenges yet.'
          cardGrid={
            <ChallengeListCardGrid
              {...sharedGridProps}
              items={state.privateChallenges}
            />
          }
        />
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2>Challenges</h2>
        <div className={styles.headerActions}>
          <Button
            variant='outline'
            onClick={state.load}
            title='Refresh challenges'
          >
            Refresh
          </Button>
        </div>
      </div>
      {state.error && <p className={styles.error}>{state.error}</p>}
      {state.assignNotice && (
        <p
          className={`${styles.notice} ${getNoticeClassName(
            styles,
            state.assignNotice.tone
          )}`}
        >
          {state.assignNotice.text}
        </p>
      )}
      {!state.error && !state.loading && !state.challenges.length && (
        <p className={styles.empty}>
          No challenges yet. Try creating one from the backend.
        </p>
      )}
      <ChallengeGroup
        title='Active'
        hint={state.activeChallenges.length ? 'In progress' : 'None running'}
        items={state.activeChallenges}
        emptyText='No active challenges right now.'
        cardGrid={
          <ChallengeListCardGrid
            {...sharedGridProps}
            items={state.activeChallenges}
          />
        }
      />
      <ChallengeGroup
        title='Upcoming'
        hint={state.upcomingChallenges.length ? 'Scheduled' : 'None scheduled'}
        items={state.upcomingChallenges}
        emptyText='No upcoming challenges.'
        cardGrid={
          <ChallengeListCardGrid
            {...sharedGridProps}
            items={state.upcomingChallenges}
          />
        }
      />
      <ChallengeGroup
        title='Ended'
        hint={state.endedChallenges.length ? 'Completed' : 'No history yet'}
        items={state.endedChallenges}
        emptyText='No ended challenges yet.'
        cardGrid={
          <ChallengeListCardGrid
            {...sharedGridProps}
            items={state.endedChallenges}
          />
        }
      />
    </section>
  );
}
