'use client';

import StatusPage from '#components/common/StatusPage';
import { useParams } from '#js/router';
import MatchSettingForm from '#modules/match-settings/form';

export default function MatchSettingDetailPage() {
  const params = useParams();
  const { id } = params || {};
  const matchSettingId = Number(id);

  if (!Number.isFinite(matchSettingId)) {
    return (
      <StatusPage
        title='Match setting not found'
        description='This match setting does not exist.'
        ctaLabel='Back to match settings'
        ctaHref='/match-settings'
      />
    );
  }

  return <MatchSettingForm matchSettingId={matchSettingId} />;
}
