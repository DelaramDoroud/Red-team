import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#components/common/card';

export default function ChallengeAssignmentsSection({ assignments }) {
  return (
    <div className='space-y-4'>
      {assignments.map((group) => (
        <Card
          key={group.challengeMatchSettingId}
          className='border border-border bg-card text-card-foreground shadow-sm'
        >
          <CardHeader className='pb-2'>
            <CardTitle className='text-lg font-semibold text-foreground'>
              {group.matchSetting?.problemTitle || 'Match setting'}
            </CardTitle>
            <CardDescription className='text-sm text-muted-foreground space-y-1'>
              <span className='block'>
                Match setting ID:{' '}
                {group.matchSetting?.id ?? group.challengeMatchSettingId}
              </span>
              <span className='block'>
                Valid submissions: {group.validSubmissionsCount ?? 0}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='overflow-auto rounded-lg border border-border'>
              <table className='min-w-full table-auto text-sm'>
                <thead className='bg-muted'>
                  <tr className='text-left text-muted-foreground'>
                    <th className='px-4 py-3 font-semibold'>Match ID</th>
                    <th className='px-4 py-3 font-semibold'>Student</th>
                  </tr>
                </thead>
                <tbody>
                  {group.matches.map((match) => (
                    <tr key={match.id} className='border-t border-border/60'>
                      <td className='px-4 py-3 font-medium text-foreground'>
                        {match.id}
                      </td>
                      <td className='px-4 py-3 text-foreground'>
                        {match.student?.username || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {group.peerReviewAssignments?.length ? (
              <details className='mt-4 rounded-lg border border-border/60 bg-muted/40 p-3'>
                <summary className='cursor-pointer text-sm font-semibold text-foreground'>
                  Peer review assignments
                </summary>
                <div className='mt-3 space-y-3'>
                  {group.peerReviewAssignments.map((assignment) => {
                    const revieweeNames = assignment.reviewees
                      .map((reviewee) => reviewee.username)
                      .join(', ');
                    return (
                      <div
                        key={assignment.reviewer.participantId}
                        className='text-sm'
                      >
                        <p className='font-semibold text-foreground'>
                          {assignment.reviewer.username}
                        </p>
                        <p className='text-muted-foreground wrap-break-word'>
                          Reviews: {revieweeNames || '—'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </details>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
