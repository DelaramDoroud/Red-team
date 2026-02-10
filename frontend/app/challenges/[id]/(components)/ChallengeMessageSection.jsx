import { Card, CardContent } from '#components/common/card';

const peerReviewTones = {
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-700',
  error: 'border-destructive/30 bg-destructive/5 text-destructive',
};

export default function ChallengeMessageSection({
  error,
  peerReviewMessages,
  showStartPeerReviewButton,
}) {
  return (
    <>
      {error ? (
        <Card className='border border-destructive/30 bg-destructive/5 text-destructive'>
          <CardContent className='py-4'>
            <p className='text-sm'>{error}</p>
          </CardContent>
        </Card>
      ) : null}

      {showStartPeerReviewButton ? (
        <Card className='border border-emerald-500/30 bg-emerald-500/10 text-emerald-700'>
          <CardContent className='py-4'>
            <p className='text-sm font-medium'>
              Peer review assignments are ready. You can start the peer review
              phase when you are ready.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {peerReviewMessages.length > 0 ? (
        <div className='space-y-2'>
          {peerReviewMessages.map((message) => (
            <Card
              key={`${message.tone}-${message.text}`}
              className={`border ${peerReviewTones[message.tone] || peerReviewTones.error}`}
            >
              <CardContent className='py-3'>
                <p className='text-sm font-medium'>{message.text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </>
  );
}
