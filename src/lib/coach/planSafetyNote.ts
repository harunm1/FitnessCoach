// One-line note shown with a plan when the profile lists an injury or condition: get checked by a professional before starting.
// Computed from the profile, not stored, so it follows the profile when it changes.
// Akrimi et al. (Sports 13(4):92, 2025, doi:10.3390/sports13040092) had coaching
// experts rate ChatGPT-4o exercise plans for people with type 2 diabetes for safety.

export const PLAN_SAFETY_NOTE =
  "You listed an injury or health condition, so have a doctor or physiotherapist look over this plan before you start.";

// Answers that mean "nothing to report".
const NOTHING = /^(none|no|nope|nothing|n\/?a|-+)\.?$/i;

export function planSafetyNote(profile: {
  injuries: string | null;
}): string | null {
  const listed = (profile.injuries ?? "").trim();
  return listed === "" || NOTHING.test(listed) ? null : PLAN_SAFETY_NOTE;
}
