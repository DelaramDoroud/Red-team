import { Button } from '#components/common/Button';

export default function PeerReviewSummaryToastCard({ onClose, summary }) {
  return (
    <div className='pointer-events-auto w-[360px] max-w-[92vw] rounded-2xl border-2 border-primary/20 bg-background shadow-xl shadow-primary/20 ring-1 ring-offset-2 ring-primary/50 p-1'>
      <div className='p-4'>
        <div className='flex items-start justify-between gap-3'>
          <div className='mb-2 pb-2'>
            <p className='text-sm font-semibold text-primary'>Summary</p>
            <p className='text-xs text-muted-foreground mt-0.5'>
              Overview of your submitted votes
            </p>
          </div>
          <div className='relative -top-3 -right-3'>
            <Button
              type='button'
              onClick={onClose}
              variant='destructive'
              size='sm'
            >
              ⤬
            </Button>
          </div>
        </div>
        <div className='mt-3 rounded-xl border border-secondary bg-muted/40 p-3'>
          <p className='text-sm font-semibold text-foreground'>
            Voted {summary.voted} of {summary.total}
          </p>
        </div>
        <div className='mt-3 space-y-2 text-sm'>
          <div className='flex items-center justify-between rounded-xl border border-border px-3 py-2'>
            <span>Correct</span>
            <span className='font-semibold'>{summary.correct}</span>
          </div>
          <div className='flex items-center justify-between rounded-xl border border-border px-3 py-2'>
            <span>Incorrect</span>
            <span className='font-semibold'>{summary.incorrect}</span>
          </div>
          <div className='flex items-center justify-between rounded-xl border border-border px-3 py-2'>
            <span>Abstain</span>
            <span className='font-semibold'>{summary.abstain}</span>
          </div>
          <div className='flex items-center justify-between rounded-xl border border-border px-3 py-2'>
            <span>Unvoted</span>
            <span className='font-semibold'>{summary.unvoted}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
