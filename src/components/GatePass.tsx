import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { GatePass } from "../data/types";
import { fmtDay, fmtTime } from "../lib/time";
import { Sheet } from "./ui";

export function GatePassSheet({ pass, onClose }: { pass: GatePass; onClose: () => void }) {
  const [qr, setQr] = useState("");
  useEffect(() => {
    QRCode.toDataURL(JSON.stringify({ demo: true, pass: pass.id, zone: pass.zoneName, from: pass.validFrom, to: pass.validTo }), { margin: 1, width: 360 })
      .then(setQr)
      .catch(() => setQr(""));
  }, [pass]);
  return (
    <Sheet title="Visitor pass" onClose={onClose}>
      <div className="pass">
        <div className="pass-top">
          <span className="tiny strong" style={{ letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.9 }}>{pass.zoneName} guardhouse</span>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20 }}>{pass.visitorName}</span>
          <span className="small">Visiting {pass.hostLabel}</span>
        </div>
        <div className="pass-body">
          {qr ? <img className="qr" src={qr} alt="Visitor pass QR code (demo)" /> : <div className="qr" />}
          <div className="strong tnum">{fmtDay(pass.validFrom)}, {fmtTime(pass.validFrom)} to {fmtTime(pass.validTo)}</div>
          <span className="demo-tag">Simulated pass. A real pilot would link to the guardhouse visitor system.</span>
        </div>
      </div>
      <p className="small muted">Issued automatically when the booking was confirmed, because the provider lives outside this gated area. Valid 30 minutes either side of the slot. The unit number is never shown.</p>
    </Sheet>
  );
}
