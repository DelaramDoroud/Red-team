import { Card } from '#components/common/card';
import { Badge } from '#components/common/Badge';

export default function ResultPage() {
  return (
    <div className='max-w-4xl mx-auto mt-12 px-4'>
      <Card>
        <div className='flex flex-col items-center text-center gap-4 py-10'>
          <Badge variant='info'>Work in progress</Badge>

          <h1 className='text-xl font-semibold'>
            Results page is under development
          </h1>

          <p className='text-sm max-w-md'>
            The final scoring summary and detailed evaluation will be available
            here once implementation is complete.
          </p>
        </div>
      </Card>
    </div>
  );
}
