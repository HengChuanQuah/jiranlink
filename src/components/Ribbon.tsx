import { useEffect, useRef } from "react";
import { ArrowRight } from "lucide-react";
import { Logo } from "./ui";

const LINES = ["Verified neighbours", "Your building first, then your taman", "Book a slot in seconds", "Pay safely when the job is done"];
const BASE_SPEED = 52; // pixels per second when the page is still
const CALM_SPEED = 24; // for people who turned animations down: slower, no scroll boost

/**
 * The moving orange band under the home search, like the boards around a football pitch.
 * It runs left to right on its own and speeds up while you scroll. Hover or tap to pause it.
 */
export function Ribbon() {
  const track = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const band = el.parentElement!;
    let paused = false;
    const pause = () => (paused = true);
    const resume = () => (paused = false);
    const toggle = () => (paused = !paused);
    band.addEventListener("mouseenter", pause);
    band.addEventListener("mouseleave", resume);
    band.addEventListener("click", toggle);
    let x = 0;
    let boost = 0;
    let lastY = window.scrollY;
    let last = performance.now();
    let raf = 0;
    const onScroll = () => {
      const dy = window.scrollY - lastY;
      lastY = window.scrollY;
      if (!calm) boost = Math.min(boost + Math.abs(dy) * 4, 1400);
    };
    const tick = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      boost *= Math.pow(0.03, dt); // eases back to the resting speed in about a second
      if (!paused) x += ((calm ? CALM_SPEED : BASE_SPEED) + boost) * dt; // left to right
      const half = el.scrollWidth / 2;
      if (half > 0) x = -((((-x) % half) + half) % half);
      const skew = Math.min(8, boost / 160);
      el.style.transform = `translate3d(${x.toFixed(1)}px,0,0) skewX(${(-skew).toFixed(2)}deg)`;
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      band.removeEventListener("mouseenter", pause);
      band.removeEventListener("mouseleave", resume);
      band.removeEventListener("click", toggle);
    };
  }, []);
  return (
    <div className="ribbon" aria-hidden>
      <span className="ribbon-badge"><Logo size={26} /></span>
      <div className="ribbon-track" ref={track}>
        {[0, 1].map((k) => (
          <span key={k} className="ribbon-set">
            {LINES.map((l) => <span key={l} className="ribbon-item">{l}<ArrowRight size={16} /></span>)}
            {LINES.map((l) => <span key={`${l}-2`} className="ribbon-item">{l}<ArrowRight size={16} /></span>)}
          </span>
        ))}
      </div>
    </div>
  );
}
