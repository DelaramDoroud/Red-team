import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#components/common/card';

export default function ChallengeParticipantsSection({
  joinedStudents,
  showParticipantList,
}) {
  if (!showParticipantList) return null;

  return (
    <Card className='border border-border bg-card text-card-foreground shadow-sm'>
      <CardHeader className='pb-2'>
        <CardTitle className='text-base font-semibold text-foreground'>
          Joined students
        </CardTitle>
        <CardDescription className='text-xs text-muted-foreground'>
          {joinedStudents.length} joined
        </CardDescription>
      </CardHeader>
      <CardContent>
        {joinedStudents.length === 0 ? (
          <p className='text-sm text-muted-foreground'>
            No students have joined yet.
          </p>
        ) : (
          <ul className='grid gap-2 sm:grid-cols-2 lg:grid-cols-3'>
            {joinedStudents.map((student) => (
              <li
                key={student.id}
                className='rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm font-medium text-foreground'
              >
                {student.name}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
