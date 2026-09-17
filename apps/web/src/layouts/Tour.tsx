import { useEffect, useLayoutEffect, useState } from "react";

import { Button, Icon, IconButton } from "../components/ui";

export interface TourStep {
  /** CSS selector for the element to spotlight, or `null` for a centered step. */
  selector: string | null;
  title: string;
  body: string;
}

// Matches the app-wide mobile breakpoint (DesignSystem/app.css, shared.css).
// Below it the sidebar is an off-canvas drawer too narrow to leave room for a
// side-anchored popover, so mobile steps fall back to a centered card instead
// of spotlighting the (mostly hidden) target.
const MOBILE_QUERY = "(max-width: 760px)";
const POPOVER_WIDTH = 280;
const POPOVER_GAP = 16;
const VIEWPORT_MARGIN = 16;

interface Position {
  top: number;
  left: number;
}

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches,
  );

  useEffect(() => {
    const query = window.matchMedia(MOBILE_QUERY);
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return isMobile;
}

export interface TourProps {
  active: boolean;
  steps: readonly TourStep[];
  onFinish: () => void;
}

/**
 * Reusable step-by-step spotlight tour. Used both for the main nav tour
 * (OnboardingTour.tsx) and for each page's own content tour (PageTour.tsx) —
 * every instance owns its own step index, so multiple `Tour`s never conflict
 * as long as only one is `active` at a time.
 */
export function Tour({ active, steps, onFinish }: TourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [position, setPosition] = useState<Position | null>(null);
  const isMobile = useIsMobile();

  // React's sanctioned "adjust state during render" pattern (see
  // SearchableSelect) rather than an effect: resetting stepIndex only needs
  // to happen once per activation, not to synchronize with anything external.
  const [wasActive, setWasActive] = useState(active);
  if (active !== wasActive) {
    setWasActive(active);
    if (active) setStepIndex(0);
  }

  const step = steps[stepIndex];
  const spotlightSelector = active && !isMobile ? step?.selector ?? null : null;

  useLayoutEffect(() => {
    const target = spotlightSelector ? document.querySelector<HTMLElement>(spotlightSelector) : null;

    const measure = () => {
      if (!target) {
        setPosition(null);
        return;
      }
      const rect = target.getBoundingClientRect();
      const spaceRight = window.innerWidth - rect.right;
      const rawLeft =
        spaceRight >= POPOVER_WIDTH + POPOVER_GAP ? rect.right + POPOVER_GAP : rect.left;
      // Clamp on both axes regardless of which branch chose the raw value —
      // a target near the right edge of the page (a page's own "+ ekle"
      // button, unlike the always-left-aligned nav items this logic was
      // first written for) can otherwise place the card partly or fully
      // off-screen and unclickable.
      const left = Math.min(
        Math.max(rawLeft, VIEWPORT_MARGIN),
        window.innerWidth - POPOVER_WIDTH - VIEWPORT_MARGIN,
      );
      const top = Math.min(
        Math.max(rect.top, VIEWPORT_MARGIN),
        window.innerHeight - 220,
      );
      setPosition({ top, left });
    };

    // Long pages (e.g. Settings' stacked collapsible groups) can have a step's
    // target scrolled out of view entirely — bring it into the viewport
    // before measuring, or the popover ends up parked wherever the previous
    // step's clamp happened to land, pointing at nothing visible.
    target?.scrollIntoView({ block: "center", behavior: "instant" });
    target?.classList.add("tour-spotlight-target");
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      target?.classList.remove("tour-spotlight-target");
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [spotlightSelector]);

  if (!active || !step) return null;

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;
  const showSpotlight = Boolean(spotlightSelector && position);

  return (
    <div className="onboarding-tour" role="dialog" aria-modal="true" aria-labelledby="onboarding-tour-title">
      <div className={`onboarding-tour-backdrop${showSpotlight ? " transparent" : ""}`} />
      <div
        className={`onboarding-tour-card${showSpotlight ? "" : " centered"}`}
        style={showSpotlight && position ? { top: position.top, left: position.left } : undefined}
      >
        <div className="onboarding-tour-head">
          <p className="eyebrow">{stepIndex + 1}/{steps.length}</p>
          <IconButton variant="icon-subtle" aria-label="Turu kapat" onClick={onFinish}>
            <Icon name="close" />
          </IconButton>
        </div>
        <h2 id="onboarding-tour-title">{step.title}</h2>
        <p>{step.body}</p>
        <div className="onboarding-tour-actions">
          {!isFirst ? (
            <Button variant="secondary" onClick={() => setStepIndex((index) => index - 1)}>
              Geri
            </Button>
          ) : null}
          <Button variant="primary" onClick={() => (isLast ? onFinish() : setStepIndex((index) => index + 1))}>
            {isLast ? "Turu bitir" : "İleri"}
          </Button>
        </div>
      </div>
    </div>
  );
}
