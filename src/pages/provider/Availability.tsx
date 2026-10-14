import { useMemo, useState } from "react";
import { ArrowLeft, CalendarOff, Plus, Save, Trash2 } from "lucide-react";
import { SlotPicker } from "../../components/SlotPicker";
import { useMe } from "../../lib/hooks";
import { back } from "../../lib/router";
import { attempt, getState } from "../../lib/store";
import { saveAvailability } from "../../lib/domain";
import { generateSlots, templateProblems } from "../../lib/slots";
import { DAY_NAMES, fmtDay, ymd, now } from "../../lib/time";
import type { AvailabilityTemplate } from "../../data/types";

const ORDER = [1, 2, 3, 4, 5, 6, 0];

export function Availability() {
  const { s, myProvider } = useMe();
  const [tpl, setTpl] = useState<AvailabilityTemplate>(() => structuredClone(myProvider?.availability ?? { days: [], blocks: [], slotMins: 60, bufferMins: 0, capacity: 1, minNoticeHrs: 12, horizonDays: 14, daysOff: [] }));
  const [offDate, setOffDate] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const problems = templateProblems(tpl);
  const myBookings = useMemo(() => s.bookings.filter((b) => b.providerId === myProvider?.id), [s.bookings, myProvider?.id]);
  const days = useMemo(() => (problems.length ? [] : generateSlots(tpl, myBookings)), [tpl, myBookings, problems.length]);
  const total = days.reduce((t, d) => t + d.slots.filter((x) => x.remaining > 0).length, 0);
  const dirty = JSON.stringify(tpl) !== JSON.stringify(myProvider?.availability);
  if (!myProvider) return null;

  const set = <K extends keyof AvailabilityTemplate>(k: K, v: AvailabilityTemplate[K]) => setTpl((t) => ({ ...t, [k]: v }));
  const toggleDay = (d: number) => set("days", tpl.days.includes(d) ? tpl.days.filter((x) => x !== d) : [...tpl.days, d]);
  const setBlock = (i: number, key: "start" | "end", v: string) => set("blocks", tpl.blocks.map((b, j) => (j === i ? { ...b, [key]: v } : b)));

  return (
    <div className="stack" style={{ maxWidth: 1000 }}>
      <button className="link-btn" onClick={() => back({ name: "p-services" })} style={{ justifySelf: "start" }}><ArrowLeft size={16} /> Back</button>
      <div>
        <h1 className="page-title">Your hours</h1>
        <p className="section-sub">Set this once. JiranLink turns it into bookable slots and hides any that are taken.</p>
      </div>

      <div className="two-col">
        <div className="stack-sm">
          <section className="card stack-sm">
            <h2 className="section-title" style={{ fontSize: 16 }}>Days you work</h2>
            <div className="chips" role="group" aria-label="Working days">
              {ORDER.map((d) => <button key={d} type="button" className="chip" aria-pressed={tpl.days.includes(d)} onClick={() => toggleDay(d)}>{DAY_NAMES[d]}</button>)}
            </div>
          </section>

          <section className="card stack-sm">
            <h2 className="section-title" style={{ fontSize: 16 }}>Time blocks</h2>
            {tpl.blocks.map((b, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
                <div className="field"><label htmlFor={`bs-${i}`}>From</label><input id={`bs-${i}`} type="time" className="input tnum" value={b.start} step={900} onChange={(e) => setBlock(i, "start", e.target.value)} /></div>
                <div className="field"><label htmlFor={`be-${i}`}>To</label><input id={`be-${i}`} type="time" className="input tnum" value={b.end} step={900} onChange={(e) => setBlock(i, "end", e.target.value)} /></div>
                <button type="button" className="btn btn-quiet btn-sm" aria-label={`Remove block ${i + 1}`} onClick={() => set("blocks", tpl.blocks.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
              </div>
            ))}
            <button type="button" className="btn btn-outline btn-sm" style={{ justifySelf: "start" }} onClick={() => set("blocks", [...tpl.blocks, { start: "18:00", end: "21:00" }])}><Plus size={14} /> Add block</button>
          </section>

          <section className="card stack-sm">
            <h2 className="section-title" style={{ fontSize: 16 }}>Slots</h2>
            <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
              <div className="field">
                <label htmlFor="slot">Each job takes</label>
                <select id="slot" className="input" value={tpl.slotMins} onChange={(e) => set("slotMins", Number(e.target.value))}>
                  {[30, 45, 60, 90, 120, 180, 240].map((m) => <option key={m} value={m}>{m < 60 ? `${m} min` : `${m / 60} hour${m > 60 ? "s" : ""}`}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="buf">Break between jobs</label>
                <select id="buf" className="input" value={tpl.bufferMins} onChange={(e) => set("bufferMins", Number(e.target.value))}>
                  {[0, 15, 30, 45, 60].map((m) => <option key={m} value={m}>{m ? `${m} min` : "None"}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="cap">Bookings per slot</label>
                <input id="cap" className="input tnum" type="number" min={1} max={20} value={tpl.capacity} onChange={(e) => set("capacity", Math.max(0, Number(e.target.value)))} />
                <span className="hint">More than 1 for classes or bulk orders.</span>
              </div>
              <div className="field">
                <label htmlFor="notice">Minimum notice</label>
                <select id="notice" className="input" value={tpl.minNoticeHrs} onChange={(e) => set("minNoticeHrs", Number(e.target.value))}>
                  {[0, 2, 6, 12, 24, 48, 72].map((h) => <option key={h} value={h}>{h ? `${h} hours` : "None"}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="hz">Open for booking</label>
                <select id="hz" className="input" value={tpl.horizonDays} onChange={(e) => set("horizonDays", Number(e.target.value))}>
                  {[7, 14, 21, 30].map((d) => <option key={d} value={d}>Next {d} days</option>)}
                </select>
              </div>
            </div>
          </section>

          <section className="card stack-sm">
            <h2 className="section-title" style={{ fontSize: 16 }}>Days off</h2>
            <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
              <div className="field"><label htmlFor="off">Date</label><input id="off" type="date" className="input" min={ymd(now())} value={offDate} onChange={(e) => setOffDate(e.target.value)} /></div>
              <button type="button" className="btn btn-outline btn-sm" disabled={!offDate || tpl.daysOff.includes(offDate)} onClick={() => { set("daysOff", [...tpl.daysOff, offDate]); setOffDate(""); }}><CalendarOff size={14} /> Add day off</button>
            </div>
            {tpl.daysOff.length > 0 && (
              <div className="chips">
                {tpl.daysOff.map((d) => <button key={d} type="button" className="chip" aria-label={`Remove day off ${d}`} onClick={() => set("daysOff", tpl.daysOff.filter((x) => x !== d))}>{fmtDay(`${d}T12:00:00`)} ✕</button>)}
              </div>
            )}
          </section>
        </div>

        <aside className="card stack-sm" style={{ position: "sticky", top: 84 }}>
          <h2 className="section-title" style={{ fontSize: 16 }}>Preview</h2>
          {problems.length > 0 ? (
            <div className="notice n-warn"><div className="grow">{problems.map((p) => <div key={p}>{p}</div>)}</div></div>
          ) : (
            <>
              <p className="small"><b className="tnum">{total}</b> open slots over the next {tpl.horizonDays} days. This is what residents will see.</p>
              <SlotPicker tpl={tpl} bookings={myBookings} value={preview} onChange={(st) => setPreview(st)} />
            </>
          )}
          <button className="btn btn-primary" disabled={!dirty || problems.length > 0} onClick={() => { if (attempt((st) => saveAvailability(st, myProvider.id, tpl), "Hours saved. Your slots are updated.")) { const saved = getState().providers.find((x) => x.id === myProvider.id); if (saved) setTpl(structuredClone(saved.availability)); } }}><Save size={16} /> Save hours</button>
          {!dirty && <span className="hint">No unsaved changes.</span>}
        </aside>
      </div>
    </div>
  );
}
