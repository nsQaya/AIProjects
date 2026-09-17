import { useState } from "react";

import { useAuth } from "../auth/AuthProvider";
import type { OnboardingPageKey } from "../platform/auth/auth-schemas";
import { Tour, type TourStep } from "./Tour";

export interface PageTourProps {
  page: OnboardingPageKey;
  steps: readonly TourStep[];
}

/**
 * A page's own content tour — separate from the main nav tour
 * (OnboardingTour.tsx), which introduces *where* things are. This one runs
 * the first time the user actually lands on that page, once the nav tour is
 * out of the way, and explains what's on the page itself. Each page mounts
 * its own `<PageTour>` with its own step list; server-tracked completion
 * (`onboardingPagesCompleted`) means it only ever shows once per account.
 */
export function PageTour({ page, steps }: PageTourProps) {
  const { completePageTour, session } = useAuth();
  const [dismissedLocally, setDismissedLocally] = useState(false);

  if (!session) return null;

  const navTourDone = Boolean(session.user.onboardingCompletedAt);
  const alreadySeen = session.user.onboardingPagesCompleted?.includes(page) ?? false;
  const active = navTourDone && !alreadySeen && !dismissedLocally;

  const finish = () => {
    setDismissedLocally(true);
    void completePageTour(page).catch(() => {});
  };

  return <Tour active={active} steps={steps} onFinish={finish} />;
}
