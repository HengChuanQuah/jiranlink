import { useEffect, type RefObject } from "react";

const calm = () => typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Scroll reveal: anything marked data-reveal fades and rises into place the first time it scrolls into view.
 * Children of data-reveal-stagger arrive one after another. Content is only hidden once this is running,
 * so nothing disappears if the browser can't animate.
 */
export function useScrollReveal() {
  useEffect(() => {
    if (calm() || typeof IntersectionObserver === "undefined") return;
    const root = document.documentElement;
    root.classList.add("reveal-on");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    const scan = () => {
      document.querySelectorAll<HTMLElement>("[data-reveal]:not(.in), [data-reveal-stagger]:not(.in)").forEach((el) => {
        if (el.dataset.revealSeen) return;
        el.dataset.revealSeen = "1";
        if (el.hasAttribute("data-reveal-stagger")) Array.from(el.children).forEach((c, i) => (c as HTMLElement).style.setProperty("--d", `${Math.min(i, 8) * 70}ms`));
        io.observe(el);
      });
    };
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      io.disconnect();
    };
  }, []);
}

/** Hero parallax: the photo drifts slower than the page and the text eases away as you scroll. */
export function useParallax(photo: RefObject<HTMLElement>, text: RefObject<HTMLElement>) {
  useEffect(() => {
    if (calm()) return;
    let raf = 0;
    const apply = () => {
      raf = 0;
      const y = Math.min(window.scrollY, 900);
      if (photo.current) photo.current.style.transform = `translate3d(0, ${(y * 0.35).toFixed(1)}px, 0)`;
      if (text.current) {
        text.current.style.transform = `translate3d(0, ${(y * 0.12).toFixed(1)}px, 0)`;
        text.current.style.opacity = String(Math.max(0, 1 - y / 520));
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    apply();
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [photo, text]);
}

/** Curved carousel: cards near the edges sink and tilt, as if laid on an arc, and straighten in the middle. */
export function useArcCarousel(scroller: RefObject<HTMLElement>, dep: unknown) {
  useEffect(() => {
    const el = scroller.current;
    if (!el || calm()) return;
    let raf = 0;
    const apply = () => {
      raf = 0;
      const box = el.getBoundingClientRect();
      const mid = box.left + box.width / 2;
      const half = Math.max(1, box.width / 2);
      for (const c of Array.from(el.children) as HTMLElement[]) {
        const r = c.getBoundingClientRect();
        const d = Math.max(-1.6, Math.min(1.6, (r.left + r.width / 2 - mid) / half));
        c.style.transform = `translateY(${(d * d * 16).toFixed(1)}px) rotate(${(d * 3.5).toFixed(2)}deg)`;
      }
    };
    const onMove = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    el.addEventListener("scroll", onMove, { passive: true });
    window.addEventListener("resize", onMove);
    apply();
    return () => {
      el.removeEventListener("scroll", onMove);
      window.removeEventListener("resize", onMove);
      cancelAnimationFrame(raf);
    };
  }, [scroller, dep]);
}
