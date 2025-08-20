export function isPremiumPlan(plan) {
  if (!plan) return false;
  const p = String(plan).toUpperCase();
  return p !== 'FREE'; // treat anything not FREE as premium
}
