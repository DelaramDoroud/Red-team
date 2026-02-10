import PeerReviewVoteResultCard from '#components/challenge/PeerReviewVoteResultCard';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#components/common/card';
import { buildResultBadge, formatValue } from './resultUtils';

const renderValue = (value) => (
  <span className='whitespace-pre-wrap'>{formatValue(value)}</span>
);

export default function ResultPeerReviewSection({
  peerReviewSectionId,
  styles,
  reviewVotesLoading,
  reviewVotesError,
  voteItems,
  hasPeerReviewTests,
  peerReviewTests,
}) {
  return (
    <Card
      id={peerReviewSectionId}
      className='animate-in fade-in slide-in-from-top-2 duration-300'
    >
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <div className='space-y-1'>
          <CardTitle>Peer Review Results</CardTitle>
          <CardDescription>
            Overview of your performance in the peer review phase.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className='space-y-6 pt-4'>
        <div className={styles.votesPanel}>
          <div className={styles.votesHeader}>
            <div className={styles.votesTitle}>
              <span className={styles.votesIcon}>✓</span>
              Your Peer Review Votes
            </div>
          </div>
          {reviewVotesLoading ? (
            <p className='text-sm text-muted-foreground'>
              Loading your peer review votes...
            </p>
          ) : null}
          {reviewVotesError ? (
            <p className='text-sm text-destructive'>{reviewVotesError}</p>
          ) : null}
          {!reviewVotesLoading &&
          !reviewVotesError &&
          voteItems.length === 0 ? (
            <p className='text-sm text-muted-foreground'>
              No peer review votes available.
            </p>
          ) : null}
          {!reviewVotesLoading && !reviewVotesError && voteItems.length > 0 ? (
            <div className={styles.votesList}>
              {voteItems.map((item) => (
                <PeerReviewVoteResultCard
                  key={item.id}
                  title={item.submissionLabel}
                  vote={item.vote}
                  expectedEvaluation={item.expectedEvaluation}
                  isCorrect={item.isCorrect}
                  testCaseInput={item.testCaseInput}
                  expectedOutput={item.expectedOutput}
                  referenceOutput={item.referenceOutput}
                  actualOutput={item.actualOutput}
                  isExpectedOutputCorrect={item.isExpectedOutputCorrect}
                  isVoteCorrect={item.isVoteCorrect}
                  evaluationStatus={item.evaluationStatus}
                />
              ))}
            </div>
          ) : null}
        </div>

        <div className='space-y-4 animate-in fade-in slide-in-from-top-2 duration-300'>
          <h3 className='text-sm font-semibold'>Received Tests</h3>
          {!hasPeerReviewTests && (
            <p className='text-sm text-muted-foreground'>
              No peer review tests were submitted for your solution.
            </p>
          )}
          {hasPeerReviewTests &&
            peerReviewTests.map((review) => {
              const reviewerName = review.reviewer?.username || 'Anonymous';
              const tests = Array.isArray(review.tests) ? review.tests : [];
              if (tests.length === 0) return null;
              return (
                <div
                  key={`review-${review.id}`}
                  className='rounded-xl border border-border bg-muted/40 p-4 space-y-3'
                >
                  <p className='text-sm font-semibold'>
                    Reviewer: {reviewerName}
                  </p>
                  <div className='space-y-3'>
                    {tests.map((test, index) => {
                      const testKey = JSON.stringify({
                        input: test.input,
                        expectedOutput: test.expectedOutput,
                        notes: test.notes,
                      });
                      const displayIndex = index + 1;
                      return (
                        <div
                          key={testKey}
                          className='rounded-xl border border-border bg-background/80 p-4 dark:bg-slate-950/40'
                        >
                          <div className='flex flex-wrap items-center justify-between gap-2'>
                            <p className='text-sm font-semibold text-foreground'>
                              Test {displayIndex}
                            </p>
                            <span className={buildResultBadge(0, 'neutral')}>
                              Peer Review Test
                            </span>
                          </div>
                          <div className='mt-3 rounded-lg border border-border/60 bg-background/80 p-3 text-xs text-foreground space-y-1 dark:bg-slate-950/40'>
                            <p>
                              <span className='font-semibold'>Input:</span>{' '}
                              {renderValue(test.input)}
                            </p>
                            <p>
                              <span className='font-semibold'>
                                Expected output:
                              </span>{' '}
                              {renderValue(test.expectedOutput)}
                            </p>
                            {test.notes && (
                              <p className='text-amber-700 dark:text-amber-200'>
                                <span className='font-semibold'>Notes:</span>{' '}
                                {test.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>
      </CardContent>
    </Card>
  );
}
