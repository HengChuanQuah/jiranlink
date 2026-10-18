import { useEffect, useRef } from "react";
import { ArrowRight } from "lucide-react";
import { Logo } from "./ui";

const LINES = ["Verified neighbours", "Your building first, then your taman", "Book a slot in seconds", "Pay safely when the job is done"];
const BASE_SPEED = 46; // pixels per second when the page is still

/**
 * The orange band pinned to the bottom of the screen, like the Sime Darby Property website.
 * It drifts on its own, speeds up while you scroll, and follows the scroll direction.
 */
export function Ribbon() {
  const track = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = track.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let x = 0;
    let boost = 0;
    let dir = 1;
    let lastY = window.scrollY;
    let last = performance.now();
    let raf = 0;
    const onScroll = () => {
      const dy = window.scrollY - lastY;
      lastY = window.scrollY;
      if (dy) dir = dy > 0 ? 1 : -1;
      boost = Math.min(boost + Math.abs(dy) * 4, 1400);
    };
    const tick = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      boost *= Math.pow(0.03, dt); // eases back to the resting speed in about a second
      x -= (BASE_SPEED + boost) * dir * dt;
      const half = el.scrollWidth / 2;
      if (half > 0) x = -((((-x) % half) + half) % half);
      const skew = Math.max(-8, Math.min(8, (boost / 160) * dir));
      el.style.transform = `translate3d(${x.toFixed(1)}px,0,0) skewX(${(-skew).toFixed(2)}deg)`;
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
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
