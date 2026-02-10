import { Badge } from '#components/common/Badge';
import { Button } from '#components/common/Button';
import Link from '#components/common/RouterLink';
import { MatchSettingStatus } from '#js/constants';

export default function MatchSettingFormHeader({
  currentId,
  duplicating,
  handleDuplicate,
  isNew,
  status,
  statusLabel,
  statusVariant,
  styles,
}) {
  return (
    <header className={styles.header}>
      <div className={styles.headerRow}>
        <div className={styles.titleGroup}>
          <p className={styles.eyebrow}>Match settings</p>
          <h1 className={styles.title}>
            {isNew ? 'Create match setting' : 'Edit match setting'}
          </h1>
        </div>
        <div className={styles.headerActions}>
          <Button variant='outline' asChild>
            <Link href='/match-settings'>Back to list</Link>
          </Button>
          {currentId ? (
            <Button
              variant='secondary'
              onClick={handleDuplicate}
              disabled={duplicating}
            >
              {duplicating ? 'Duplicating…' : 'Duplicate'}
            </Button>
          ) : null}
        </div>
      </div>
      <div className={styles.metaRow}>
        <Badge variant={statusVariant}>{statusLabel}</Badge>
        {status === MatchSettingStatus.READY ? (
          <span className={styles.statusNote}>
            Unpublish to edit this match setting.
          </span>
        ) : null}
      </div>
    </header>
  );
}
