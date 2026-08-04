export function netGrowth(joined: number, left: number): number {
  return joined - left;
}

export function activeMemberRate(activeMembers: number, totalMembers: number): number {
  if (totalMembers <= 0) return 0;
  return Math.round((activeMembers / totalMembers) * 10_000) / 100;
}

export function campaignEfficiency(conversions: number, clicks: number): number {
  if (clicks <= 0) return 0;
  return Math.round((conversions / clicks) * 10_000) / 100;
}
