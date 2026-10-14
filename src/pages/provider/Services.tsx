import { useState } from "react";
import { CalendarDays, Globe, Pencil, Plus, Trash2 } from "lucide-react";
import { CatIcon, Empty, Sheet, categoryName } from "../../components/ui";
import { CATEGORIES, GROUPS, categoryById } from "../../data/categories";
import { useMe } from "../../lib/hooks";
import { navigate } from "../../lib/router";
import { attempt } from "../../lib/store";
import { removeService, saveService, type ServiceInput } from "../../lib/domain";
import { rm } from "../../lib/time";
import type { Service } from "../../data/types";

const blank: ServiceInput = { categoryId: "", title: "", description: "", priceMin: 0, priceMax: 0, priceUnit: "per visit", online: false };

export function Services() {
  const { s, myProvider } = useMe();
  const [editing, setEditing] = useState<ServiceInput | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Service | null>(null);
  if (!myProvider) return <div className="card-flat"><Empty icon={<Plus size={24} />} title="Become a provider first"><button className="btn btn-primary" onClick={() => navigate({ name: "profile" })}>Get started</button></Empty></div>;
  const services = s.services.filter((x) => x.providerId === myProvider.id);

  return (
    <div className="stack" style={{ maxWidth: 860 }}>
      <div className="toolbar">
        <div>
          <h1 className="page-title">Your services</h1>
          <p className="section-sub">Each service gets booked into the hours you set.</p>
        </div>
        <div className="btn-row">
          <button className="btn btn-outline" onClick={() => navigate({ name: "p-availability" })}><CalendarDays size={16} /> Set your hours</button>
          <button className="btn btn-primary" onClick={() => setEditing({ ...blank })}><Plus size={16} /> Add service</button>
        </div>
      </div>

      {services.length === 0 && <div className="card-flat"><Empty icon={<Plus size={24} />} title="No services yet">Add what you offer. Price ranges are fine; you confirm the final price when you accept a job.</Empty></div>}

      <div className="card" style={{ paddingBlock: services.length ? 4 : 0, display: services.length ? undefined : "none" }}>
        {services.map((sv) => (
          <div key={sv.id} className="svc-row">
            <div style={{ display: "flex", gap: 12, minWidth: 0 }}>
              <span className="cat-icon" style={{ flex: "none" }}><CatIcon id={sv.categoryId} size={20} /></span>
              <div style={{ minWidth: 0, display: "grid", gap: 3 }}>
                <div className="strong">{sv.title} {sv.online && <span className="badge b-plain" style={{ marginLeft: 4 }}><Globe size={11} /> Online</span>}</div>
                <div className="small muted">{categoryName(sv.categoryId)}{sv.description ? ` · ${sv.description}` : ""}</div>
                <div className="price small">{sv.priceMin === sv.priceMax ? rm(sv.priceMin) : `${rm(sv.priceMin)} to ${rm(sv.priceMax)}`} {sv.priceUnit}</div>
              </div>
            </div>
            <div className="btn-row" style={{ flex: "none" }}>
              <button className="btn btn-quiet btn-sm" aria-label={`Edit ${sv.title}`} onClick={() => setEditing({ ...sv })}><Pencil size={14} /> Edit</button>
              <button className="btn btn-quiet btn-sm" aria-label={`Remove ${sv.title}`} onClick={() => setConfirmDelete(sv)}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>

      {editing && <ServiceEditor initial={editing} onClose={() => setEditing(null)} />}
      {confirmDelete && (
        <Sheet title="Remove this service?" onClose={() => setConfirmDelete(null)}>
          <p>"{confirmDelete.title}" will no longer show in search. Past reviews stay on your profile.</p>
          <div className="btn-row">
            <button className="btn btn-danger" onClick={() => { if (attempt((st) => removeService(st, myProvider.id, confirmDelete.id), "Service removed")) setConfirmDelete(null); }}>Remove service</button>
            <button className="btn btn-quiet" onClick={() => setConfirmDelete(null)}>Keep it</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function ServiceEditor({ initial, onClose }: { initial: ServiceInput; onClose: () => void }) {
  const { myProvider } = useMe();
  const [f, setF] = useState<ServiceInput>(initial);
  const cat = categoryById(f.categoryId);
  const set = <K extends keyof ServiceInput>(k: K, v: ServiceInput[K]) => setF((x) => ({ ...x, [k]: v }));
  const save = () => {
    if (attempt((st) => saveService(st, myProvider!.id, { ...f, priceMax: f.priceMax || f.priceMin }), initial.id ? "Service updated" : "Service added")) onClose();
  };
  return (
    <Sheet title={initial.id ? "Edit service" : "Add a service"} onClose={onClose}>
      <form className="stack-sm" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div className="field">
          <label htmlFor="sv-cat">Category</label>
          <select id="sv-cat" className="input" value={f.categoryId} onChange={(e) => { const c = categoryById(e.target.value); setF((x) => ({ ...x, categoryId: e.target.value, online: c?.onlineCapable ? x.online : false })); }}>
            <option value="">Choose a category</option>
            {GROUPS.map((g) => (
              <optgroup key={g.id} label={g.label}>
                {CATEGORIES.filter((c) => c.group === g.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </optgroup>
            ))}
          </select>
          {cat?.licensed && <span className="hint">Residents will see a note to check your licence for this kind of work.</span>}
        </div>
        <div className="field"><label htmlFor="sv-title">Service name</label><input id="sv-title" className="input" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Aircond service, 1 unit" /></div>
        <div className="field"><label htmlFor="sv-desc">What's included</label><textarea id="sv-desc" className="input" rows={2} value={f.description} onChange={(e) => set("description", e.target.value)} /></div>
        <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" }}>
          <div className="field"><label htmlFor="sv-min">From (RM)</label><input id="sv-min" className="input tnum" type="number" min={1} value={f.priceMin || ""} onChange={(e) => set("priceMin", Number(e.target.value))} /></div>
          <div className="field"><label htmlFor="sv-max">Up to (RM)</label><input id="sv-max" className="input tnum" type="number" min={1} value={f.priceMax || ""} onChange={(e) => set("priceMax", Number(e.target.value))} placeholder="Same" /></div>
          <div className="field"><label htmlFor="sv-unit">Price is</label><input id="sv-unit" className="input" value={f.priceUnit} onChange={(e) => set("priceUnit", e.target.value)} /></div>
        </div>
        {cat?.onlineCapable && (
          <label className="check"><input type="checkbox" checked={f.online} onChange={(e) => set("online", e.target.checked)} /> Done online (shown to residents anywhere, not just nearby)</label>
        )}
        <div className="btn-row"><button type="submit" className="btn btn-primary">{initial.id ? "Save changes" : "Add service"}</button><button type="button" className="btn btn-quiet" onClick={onClose}>Cancel</button></div>
      </form>
    </Sheet>
  );
}
