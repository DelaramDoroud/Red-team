// services/title/evaluateTitleEligibility.js
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

  // 1. current rank (from DB-backed profile)
  const currentRank = profileData.title
    ? (titles.find((t) => t.name === profileData.title.name)?.rank ?? 1)
    : 1;
    console.log("_____________CURRENT RANK_____________", currentRank);
    

  // 2. ONLY next title
  const nextTitle = titles.find((t) => t.rank === currentRank + 1);
  console.log("_____________NEXT TITLE____________", nextTitle);

  if (!nextTitle) {
    return { eligible: false, newTitle: null };
  }

  // 3. stats
  const { totalChallenges, avgTotalScore, badgesEarned } = profileData.stats;
    console.log("_____________STATS_____________", { totalChallenges, avgTotalScore, badgesEarned });

  // 4. eligibility check (>= is correct ✔)
  const eligible =
    totalChallenges >= nextTitle.minChallenges &&
    avgTotalScore >= nextTitle.minAvgScore &&
    badgesEarned >= nextTitle.minBadges;
    console.log("__________ NEXT TITLE MIN CHALLENGES_______________", nextTitle.minChallenges);
    console.log("__________ NEXT TITLE MIN AVG SCORE_______________", nextTitle.minAvgScore);
    console.log("__________ NEXT TITLE MIN BADGES_________________", nextTitle.minBadges);
        console.log("_____________ELIGIBLE?_____________", eligible);
    

  if (!eligible) {
    return { eligible: false, newTitle: null };
  }

  // 5. success
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
