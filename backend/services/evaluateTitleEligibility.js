import Title from '#root/models/title.js';

export async function evaluateTitleEligibility({ profileData }) {
  if (!profileData?.stats) {
    return { eligible: false, newTitle: null };
  }

  const titles = await Title.findAll({
    order: [['rank', 'ASC']],
    raw: true,
  });

  if (!titles.length) {
    return { eligible: false, newTitle: null };
  }
  const currentRank = profileData.title
    ? (titles.find((t) => t.name === profileData.title.name)?.rank ?? 1)
    : 1;

  const nextTitle = titles.find((t) => t.rank === currentRank + 1);

  if (!nextTitle) {
    return { eligible: false, newTitle: null };
  }

  const { totalChallenges, avgTotalScore, badgesEarned } = profileData.stats;

  const eligible =
    totalChallenges >= nextTitle.minChallenges &&
    avgTotalScore >= nextTitle.minAvgScore &&
    badgesEarned >= nextTitle.minBadges;

  if (!eligible) {
    return { eligible: false, newTitle: null };
  }

  return {
    eligible: true,
    newTitle: {
      id: nextTitle.id,
      name: nextTitle.name,
      description: nextTitle.description,
      rank: nextTitle.rank,
      minChallenges: nextTitle.minChallenges,
      minAvgScore: nextTitle.minAvgScore,
      minBadges: nextTitle.minBadges,
    },
  };
}
