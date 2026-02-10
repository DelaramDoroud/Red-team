import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#components/common/card';
import logo from '#img/logo.jpg';

export function MatchLoadingState() {
  return (
    <div className='max-w-2xl mx-auto py-10'>
      <Card>
        <CardContent className='py-10 text-center text-sm text-muted-foreground'>
          Loading your match...
        </CardContent>
      </Card>
    </div>
  );
}

export function MatchLobbyState() {
  return (
    <div className='max-w-2xl mx-auto py-10'>
      <Card>
        <CardHeader>
          <CardTitle>Challenge lobby</CardTitle>
          <CardDescription>
            You joined successfully. Please wait for your teacher to start the
            coding phase.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className='text-sm text-muted-foreground'>
            Keep this page open. A 5-second countdown will start as soon as the
            challenge begins.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export function MatchUnavailableState({ error }) {
  return (
    <div className='max-w-2xl mx-auto py-10'>
      <Card>
        <CardHeader>
          <CardTitle>Match unavailable</CardTitle>
          <CardDescription>
            You cannot access this match right now.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className='text-sm text-red-500 dark:text-red-400'>
            {error?.message ||
              (typeof error === 'string' ? error : 'An error occurred')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export function MatchMissingState() {
  return (
    <div className='max-w-2xl mx-auto py-10'>
      <Card>
        <CardContent>
          <p className='text-sm pt-4'>
            Something went wrong while loading this match.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export function MatchFinishedState({
  finalCode,
  finalizationMessage,
  isFinalizationPending,
  message,
  peerReviewNotice,
  peerReviewPendingMessage,
  submissionError,
}) {
  let displayMessage = isFinalizationPending
    ? finalizationMessage
    : message || submissionError;
  if (!displayMessage) {
    displayMessage = 'The coding phase has ended.';
  }

  const finalNotice =
    peerReviewPendingMessage ||
    "Wait for the peer review phase to start so you can review your classmates' code.";

  return (
    <div
      className='max-w-4xl mx-auto py-10 space-y-4'
      data-testid='challenge-finished'
    >
      <Card>
        <CardHeader>
          <CardTitle>
            Coding phase finished. Wait for peer review to start.
          </CardTitle>
          <CardDescription data-testid='message'>
            {displayMessage}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {peerReviewNotice ? (
            <p className='text-sm font-medium text-amber-700 mb-4'>
              {peerReviewNotice}
            </p>
          ) : null}
          {isFinalizationPending ? (
            <div className='mb-4 flex items-center gap-3 text-sm text-muted-foreground'>
              <img
                src={logo.src}
                alt='CodyMatch logo'
                className='h-8 w-8 animate-spin'
              />
              <span>Finalizing your submission...</span>
            </div>
          ) : null}
          <p className='text-sm font-medium text-slate-600 mb-4'>
            {finalNotice}
          </p>
          <h3 className='font-semibold mb-2'>Your submitted code:</h3>
          <pre className='bg-gray-100 dark:bg-gray-800 p-4 rounded-md overflow-x-auto text-sm'>
            {finalCode || ''}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}

export function MatchCompletedState({
  finalizationMessage,
  isFinalizationPending,
  message,
  peerReviewNotice,
  peerReviewPendingMessage,
}) {
  const finalNotice =
    peerReviewPendingMessage ||
    "Wait for the peer review phase to start so you can review your classmates' code.";
  const finalDescription = isFinalizationPending
    ? finalizationMessage
    : message ||
      'The coding phase has ended. Your submission has been finalized.';

  return (
    <div className='max-w-2xl mx-auto py-10'>
      <Card>
        <CardHeader>
          <CardTitle>
            Coding phase finished. Wait for peer review to start.
          </CardTitle>
          <CardDescription>{finalDescription}</CardDescription>
        </CardHeader>
        {peerReviewNotice ? (
          <CardContent>
            <p className='text-sm font-medium text-amber-700'>
              {peerReviewNotice}
            </p>
          </CardContent>
        ) : null}
        {isFinalizationPending ? (
          <CardContent>
            <div className='flex items-center gap-3 text-sm text-muted-foreground'>
              <img
                src={logo.src}
                alt='CodyMatch logo'
                className='h-8 w-8 animate-spin'
              />
              <span>Finalizing your submission...</span>
            </div>
          </CardContent>
        ) : null}
        <CardContent>
          <p className='text-sm font-medium text-slate-600'>{finalNotice}</p>
        </CardContent>
      </Card>
    </div>
  );
}
