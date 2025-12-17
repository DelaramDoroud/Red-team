'use client';

import { useParams } from 'next/navigation';
import useRoleGuard from '#js/useRoleGuard';
import MatchContainer from '../(components)/MatchContainer';

export default function MatchPage() {
  const params = useParams();
  const challengeId = params?.challengeId;
  const { user, isAuthorized } = useRoleGuard({ allowedRoles: ['student'] });
  const studentId = user?.id;

  if (!isAuthorized || !studentId) return null;

  return <MatchContainer challengeId={challengeId} studentId={studentId} />;
}
