// Client-side persistence of the registration choice across email verification.
// This is a UX hint only. Authorization and identity are always re-derived by
// the trusted server endpoint after a real authenticated session exists.
const KEY = 'entiz_pending_onboarding';

export type OnboardingChoice = 'buyer' | 'seller' | 'business';

export function setPendingOnboarding(choice: OnboardingChoice) {
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    // Storage unavailable: onboarding can still be resumed explicitly later.
  }
}

function getPendingOnboarding(): OnboardingChoice | null {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'buyer' || value === 'seller' || value === 'business' ? value : null;
  } catch {
    return null;
  }
}

function clearPendingOnboarding() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Ignore unavailable browser storage.
  }
}

export async function completePendingOnboarding(): Promise<void> {
  const choice = getPendingOnboarding();
  if (!choice) return;

  try {
    const res = await fetch(`/api/onboarding/${choice}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (res.ok) clearPendingOnboarding();
  } catch {
    // Keep the pending marker and retry after a later successful sign-in.
  }
}
