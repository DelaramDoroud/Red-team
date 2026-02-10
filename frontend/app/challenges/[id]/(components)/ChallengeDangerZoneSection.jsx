import { Button } from '#components/common/Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#components/common/card';

export default function ChallengeDangerZoneSection({
  dangerPending,
  loading,
  setDangerAction,
  showDangerZone,
  showEndChallengeButton,
  showEndCodingPhaseButton,
  showEndPeerReviewButton,
}) {
  if (!showDangerZone) return null;

  return (
    <Card className='border border-destructive/40 bg-destructive/5'>
      <CardHeader className='pb-2'>
        <CardTitle className='text-base font-semibold text-destructive'>
          Danger zone
        </CardTitle>
        <CardDescription className='text-sm text-destructive/80'>
          These actions end phases early and cannot be undone.
        </CardDescription>
      </CardHeader>
      <CardContent className='flex flex-wrap gap-2'>
        {showEndCodingPhaseButton ? (
          <Button
            type='button'
            variant='destructive'
            onClick={() => setDangerAction('endCoding')}
            disabled={loading || dangerPending}
          >
            End coding phase
          </Button>
        ) : null}
        {showEndPeerReviewButton ? (
          <Button
            type='button'
            variant='destructive'
            onClick={() => setDangerAction('endPeerReview')}
            disabled={loading || dangerPending}
          >
            End peer review
          </Button>
        ) : null}
        {showEndChallengeButton ? (
          <Button
            type='button'
            variant='destructive'
            onClick={() => setDangerAction('endChallenge')}
            disabled={loading || dangerPending}
          >
            End challenge
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
