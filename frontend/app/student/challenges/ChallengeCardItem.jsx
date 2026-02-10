import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#components/common/card';
import { ChallengeStatus, getChallengeStatusLabel } from '#js/constants';
import { formatDateTime } from '#js/date';
import { statusStyles } from './challengePageUtils';

export function ChallengeStatusBadge({ status }) {
  const styles = statusStyles[status] || statusStyles[ChallengeStatus.PRIVATE];

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ring-1 ${styles}`}
    >
      {getChallengeStatusLabel(status)}
    </span>
  );
}

export function EmptyChallengeCard({ message }) {
  return (
    <Card className='border border-dashed border-border bg-card'>
      <CardContent className='py-6'>
        <p className='text-muted-foreground text-sm'>{message}</p>
      </CardContent>
    </Card>
  );
}

export function ChallengeCardItem({
  challenge,
  statusLabel,
  statusBadge,
  actionNode,
}) {
  return (
    <Card key={challenge.id} className='border border-border bg-card shadow-sm'>
      <CardHeader className='pb-4'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
          <div className='space-y-1.5'>
            <CardTitle className='text-xl font-semibold'>
              {challenge.title}
            </CardTitle>
            <CardDescription className='text-muted-foreground'>
              {statusLabel}
            </CardDescription>
          </div>
          {statusBadge}
        </div>
      </CardHeader>

      <CardContent>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
          <dl className='flex flex-wrap gap-6 text-sm text-muted-foreground'>
            <div className='space-y-1'>
              <dt className='text-xs font-semibold uppercase tracking-wide'>
                Start
              </dt>
              <dd className='text-foreground font-medium'>
                {formatDateTime(
                  challenge.startCodingPhaseDateTime || challenge.startDatetime
                )}
              </dd>
            </div>
            <div className='space-y-1'>
              <dt className='text-xs font-semibold uppercase tracking-wide'>
                Duration
              </dt>
              <dd className='text-foreground font-medium'>
                {challenge.duration} min
              </dd>
            </div>
          </dl>

          <div className='flex flex-wrap gap-3 justify-end'>{actionNode}</div>
        </div>
      </CardContent>
    </Card>
  );
}
