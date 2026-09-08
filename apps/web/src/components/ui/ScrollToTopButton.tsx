import { useEffect, useState } from "react";

import { Icon } from "./Icon";

const REVEAL_AFTER_PX = 360;

/**
 * Floating "back to top" control. Fixed to the bottom of the viewport, it fades
 * in once the page has scrolled past {@link REVEAL_AFTER_PX} and returns focus to
 * the main content after scrolling up.
 */
export function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => setVisible(window.scrollY > REVEAL_AFTER_PX);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.getElementById("app-content")?.focus();
  };

  return (
    <button
      type="button"
      className="scroll-top-button"
      id="scroll-top-button"
      aria-label="Sayfanın başına dön"
      hidden={!visible}
      onClick={scrollToTop}
    >
      <Icon name="chevron-up" />
    </button>
  );
}
