import { useEffect, useState } from "react";

// Single source of truth for the mobile breakpoint.
// Keep in sync with the CSS @media queries in index.html.
export const MOBILE_BREAKPOINT = 900;

/**
 * Returns true when the viewport is at or below the mobile breakpoint.
 * Updates on resize / orientation change. SSR-safe (defaults to false).
 */
export function useIsMobile(breakpoint = MOBILE_BREAKPOINT) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(`(max-width: ${breakpoint}px)`).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const onChange = (e) => setIsMobile(e.matches);
    // addEventListener is the modern API; addListener is the Safari <14 fallback.
    if (mql.addEventListener) mql.addEventListener("change", onChange);
    else mql.addListener(onChange);
    setIsMobile(mql.matches);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", onChange);
      else mql.removeListener(onChange);
    };
  }, [breakpoint]);

  return isMobile;
}
