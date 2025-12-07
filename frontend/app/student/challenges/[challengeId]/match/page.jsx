'use client';

import { useParams } from 'next/navigation';
import MatchContainer from '../(components)/MatchContainer';

export default function MatchPage() {
  const params = useParams();
  const challengeId = params?.challengeId;
  const studentId = 1;

  return <MatchContainer challengeId={challengeId} studentId={studentId} />;
}
