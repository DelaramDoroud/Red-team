import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#components/common/card';
import { formatDateTime } from '#js/date';

export default function ResultOtherSubmissionsSection({ otherSubmissions }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Other participant solutions</CardTitle>
        <CardDescription>
          Explore how classmates solved the same problem.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        {otherSubmissions.length === 0 && (
          <p className='text-sm text-muted-foreground'>
            No other submissions available.
          </p>
        )}
        {otherSubmissions.map((submission) => {
          const authorName = submission.student?.username || 'Student';
          return (
            <div
              key={`submission-${submission.id}`}
              className='rounded-xl border border-border bg-muted/40 p-4 space-y-2'
            >
              <div className='flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between'>
                <p className='text-sm font-semibold'>{authorName}</p>
                {submission.createdAt && (
                  <p className='text-xs text-muted-foreground'>
                    {formatDateTime(submission.createdAt)}
                  </p>
                )}
              </div>
              <pre className='max-h-[240px] w-full overflow-auto rounded-lg border border-border bg-background p-4 text-xs'>
                {submission.code || ''}
              </pre>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
