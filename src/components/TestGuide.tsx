import { useState } from "react";
import { FlaskConical } from "lucide-react";
import { Sheet } from "./ui";

export const BUILD_LABEL = "Test build v3";

/** Floating "How to test" button with the demo script and codes, for team testing. */
export function TestGuide() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="test-pill" onClick={() => setOpen(true)} aria-label={`${BUILD_LABEL}. How to test`}>
        <FlaskConical size={14} /> {BUILD_LABEL} · How to test
      </button>
      {open && (
        <Sheet title="How to test JiranLink" onClose={() => setOpen(false)}>
          <p className="small muted">Everything is sample data and saved only in your browser. Use the button with the name (top right) to switch between residents, providers and the township team. You play both sides of a booking yourself.</p>
          <ol className="stack-sm" style={{ paddingLeft: 20, margin: 0 }}>
            <li><b>Aisyah</b>: on Home, type <i>nak order kek birthday anak</i>. Open Kak Ani, book a slot, send.</li>
            <li><b>Kak Ani</b>: Jobs, open the request, Accept with a price.</li>
            <li><b>Aisyah</b>: Bookings, confirm, Pay now (demo payment), then Job done.</li>
            <li><b>Kak Ani</b>: Job done. <b>Aisyah</b>: leave a review.</li>
            <li><b>Priya</b>: try <i>walk my dog</i>, then book Faizal for <i>aircond tak sejuk</i> to see the visitor pass and pay after.</li>
            <li><b>Mr Tan</b>: try <i>cuci rumah</i> and look for the "Top rated" card.</li>
            <li><b>Ask JiranLink</b> (bottom right, as a resident): ask things like <i>paip bawah sinki bocor</i> or <i>how do I post a request?</i></li>
            <li><b>Township team</b>: approve residents, handle reports, change settings, run the AI check.</li>
          </ol>
          <dl className="kv">
            <dt>Phone code</dt><dd className="tnum">123456</dd>
            <dt>Invite codes</dt><dd>ELM-GRN-1024 (Elmina Green), QRZ-12A-0705 (Quarza), MLW-N-0331 (Taman Melawati north)</dd>
            <dt>Past-customer code</dt><dd>ANI-OLD-7Q2 (Kak Ani, Elmina residents)</dd>
          </dl>
          <p className="small"><b>Found a bug?</b> Send a screenshot to the team chat with the persona you were using, what you tapped, and what you expected. Mention "{BUILD_LABEL}".</p>
          <p className="hint">Start over any time: Me, then Reset demo.</p>
        </Sheet>
      )}
    </>
  );
}
