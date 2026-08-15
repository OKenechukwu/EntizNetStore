// Client-side persistence of the user's registration choice (buyer/seller)
// across the email-verification / sign-in gap. This is a UX hint ONLY — it is
// never used for authorization. The trusted /api/onboarding/* endpoints derive
// the profile ID from the server-validated auth user and are idempotent.
const KEY = "entiz_pending_onboarding";

export type OnboardingChoice = "buyer" | "seller";

export function setPendingOnboarding(choice: OnboardingChoice) {
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    // storage unavailable — onboarding can still be completed later
  }
}

function getPendingOnboarding(): OnboardingChoice | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "buyer" || v === "seller" ? v : null;
  } catch {
    return null;
  }
}

function clearPendingOnboarding() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/**
 * Call after an authenticated session exists. If a registration choice is
 * pending, invokes the matching trusted onboarding endpoint (idempotent,
 * server-derived identity) and clears the pending flag on success.
 */
export async function completePendingOnboarding(): Promise<void> {
  const choice = getPendingOnboarding();
  if (!choice) return;
  try {
    const res = await fetch(`/api/onboarding/${choice}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.ok) clearPendingOnboarding();
  } catch {
    // keep the pending flag; retried on next successful sign-in
  }
}
