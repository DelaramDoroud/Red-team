import { Button } from '#components/common/Button';
import { MatchSettingStatus } from '#js/constants';

export default function MatchSettingActionsFooter({
  error,
  handlePublish,
  handleSaveDraft,
  handleUnpublish,
  isEditable,
  publishing,
  saving,
  status,
  styles,
  successMessage,
  unpublishing,
}) {
  return (
    <div className={styles.actionsRow}>
      {error ? <div className={styles.error}>{error}</div> : null}
      {!error && successMessage ? (
        <div className={styles.success}>{successMessage}</div>
      ) : null}
      <div className={styles.actionButtons}>
        {status === MatchSettingStatus.READY ? (
          <Button
            type='button'
            variant='secondary'
            onClick={handleUnpublish}
            disabled={unpublishing}
          >
            {unpublishing ? 'Unpublishing…' : 'Unpublish'}
          </Button>
        ) : null}
        {status !== MatchSettingStatus.READY ? (
          <>
            <Button
              type='button'
              variant='outline'
              onClick={handleSaveDraft}
              disabled={saving || publishing || !isEditable}
            >
              {saving ? 'Saving…' : 'Save draft'}
            </Button>
            <Button
              type='button'
              onClick={handlePublish}
              disabled={publishing || saving || !isEditable}
            >
              {publishing ? 'Publishing…' : 'Publish'}
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
