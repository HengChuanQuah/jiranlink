import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Globe, Info, LayoutList, Map as MapIcon, MapPin as PinIcon, Megaphone, Sparkles, X } from "lucide-react";
import { HeroSearch } from "./Home";
import { aiReady } from "../../ai/adapter";
import { ProviderCard } from "../../components/ProviderCard";
import { MapView, type MapPin } from "../../components/MapView";
import { Avatar, CatIcon, Empty, RatingLine, categoryName } from "../../components/ui";
import { CATEGORIES, GROUPS, categoryById, type CategoryGroup } from "../../data/categories";
import { ZONES } from "../../data/geo";
import { understand, understandFast, thresholdsFrom, categoriesInGroup, type AgentResult } from "../../ai/agent";
import { blurPoint, distanceLabel, zonesFor } from "../../lib/geo";
import { rm } from "../../lib/time";
import { useMe } from "../../lib/hooks";
import { navigate } from "../../lib/router";
import { searchProviders, type SearchResult, type SortMode } from "../../lib/search";

function initialsOf(name: string) {
  return name.replace(/[^A-Za-z ]/g, "").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export function Search({ q, categoryIds }: { q?: string; categoryIds?: string[] }) {
  const { s, me } = useMe();
  const [agent, setAgent] = useState<AgentResult | null>(() => (q ? understandFast(q, thresholdsFrom(s.config)) : null));
  const [thinking, setThinking] = useState(false);
  const [picked, setPicked] = useState<string[] | null>(categoryIds ?? null);
  const [group, setGroup] = useState<CategoryGroup | null>(null);
  const [sort, setSort] = useState<SortMode>("nearest");
  const [view, setView] = useState<"list" | "map">("map");
  const [selected, setSelected] = useState<string | null>(null);
  const [hot, setHot] = useState<string | null>(null);

  // Ask the LLM only when keywords are not confident and a provider is configured.
  useEffect(() => {
    if (!q || categoryIds || !agent || agent.decision.kind === "confident" || !aiReady(s.config)) return;
    let live = true;
    setThinking(true);
    understand(q, s.config).then((r) => {
      if (!live) return;
      setAgent(r);
      setThinking(false);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const decision = agent?.decision;
  const activeCats: string[] = useMemo(() => {
    if (picked) return picked;
    if (!decision) return [];
    if (decision.kind === "confident") return [decision.categoryId];
    if (decision.kind === "ambiguous") return [decision.categoryIds[0]];
    return [];
  }, [picked, decision]);

  const out = useMemo(() => (activeCats.length ? searchProviders(s, { resident: me, categoryIds: activeCats, sort }) : null), [s, me, activeCats, sort]);
  const countFor = (id: string) => {
    const r = searchProviders(s, { resident: me, categoryIds: [id] });
    return r.results.length + r.online.length;
  };

  const zones = zonesFor(me.home);
  const myTownship = zones.township?.townshipId;
  const mapZones = ZONES.filter((z) => z.townshipId === myTownship);
  const mapped = useMemo(() => (out ? [...out.results, ...(out.exception ? [out.exception] : [])] : []), [out]);
  const pins: MapPin[] = useMemo(() => mapped.map((r) => ({
    id: r.provider.id, point: r.provider.homeBased ? blurPoint(r.provider.exact) : r.provider.exact, area: r.provider.homeBased,
    label: initialsOf(r.provider.displayName), price: rm(r.service.priceMin), hue: r.provider.hue,
  })), [mapped]);
  const selectedResult = mapped.find((r) => r.provider.id === selected) ?? null;
  const pickOnMap = (id: string) => {
    setSelected(id);
    // Bring the matching card into view on wide screens, where the list sits beside the map.
    if (window.matchMedia("(min-width: 980px)").matches) {
      document.querySelector(`[data-pcard="${id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const open = (r: SearchResult) => navigate({ name: "provider", id: r.provider.id, q });
  const licensed = activeCats.some((c) => categoryById(c)?.licensed);
  const ringSteps: { label: string; ring: number }[] = [
    ...(zones.building ? [{ label: "Your building", ring: 0 }] : []),
    ...(zones.precinct ? [{ label: zones.precinct.name, ring: 1 }] : []),
    ...(zones.township ? [{ label: zones.township.name, ring: 2 }] : []),
    ...s.config.ringsKm.map((k, i) => ({ label: `${k} km`, ring: 3 + i })),
  ];

  return (
    <div className="stack">
      <div className="stack-sm">
        <h1 className="page-title">{activeCats.length === 1 ? `${categoryName(activeCats[0])} near you` : activeCats.length > 1 ? "Services near you" : q ? "Which service do you need?" : "All services"}</h1>
        <HeroSearch initial={q ?? ""} compact key={q ?? ""} />
      </div>

      {q && agent && (
        <section className="agent" aria-live="polite" aria-label="What JiranLink understood">
          <div className="agent-head">
            <div className="agent-mark"><Sparkles size={18} /></div>
            <div className="stack-sm" style={{ gap: 6, minWidth: 0 }}>
              {decision?.kind === "confident" && !picked && <p className="agent-text">Looking for <b>{categoryName(decision.categoryId)}</b>{agent.hints.timeText ? <>, <b>{agent.hints.timeText.toLowerCase()}</b></> : null}.</p>}
              {decision?.kind === "ambiguous" && !picked && <p className="agent-text">This could be a few things. Showing <b>{categoryName(activeCats[0])}</b> first. Tap another if it fits better.</p>}
              {decision?.kind === "lost" && !picked && <p className="agent-text"><b>{decision.question}</b> One tap and I'll show who can help.</p>}
              {picked && <p className="agent-text">Showing <b>{picked.map(categoryName).join(", ")}</b>.</p>}
              <div className="badges">
                {agent.hints.timeText && <span className="badge b-plain">When: {agent.hints.timeText}</span>}
                {agent.hints.quantity && <span className="badge b-plain">Quantity: {agent.hints.quantity}</span>}
                {agent.hints.online && <span className="badge b-plain"><Globe size={12} /> Online preferred</span>}
                {thinking && <span className="badge b-new">Checking with AI…</span>}
                {agent.usedLlm && !thinking && <span className="badge b-new">AI assisted</span>}
              </div>
              {agent.scores[0]?.matched.length > 0 && decision?.kind !== "lost" && (
                <p className="explain"><Info size={14} style={{ flex: "none", marginTop: 2 }} /> Understood from: {agent.scores[0].matched.slice(0, 4).map((m) => `"${m}"`).join(", ")}</p>
              )}
              {agent.llmError && <p className="explain"><AlertTriangle size={14} /> AI check skipped: {agent.llmError} Results use keywords only.</p>}
            </div>
          </div>

          {decision?.kind === "ambiguous" && (
            <div className="chips" role="group" aria-label="Pick the closest service">
              {decision.categoryIds.map((id) => (
                <button key={id} className="chip" aria-pressed={activeCats[0] === id} onClick={() => setPicked([id])}>
                  <CatIcon id={id} size={16} /> {categoryName(id)} <span className="count">{countFor(id)}</span>
                </button>
              ))}
            </div>
          )}
          {decision?.kind === "lost" && (
            <div className="stack-sm">
              <div className="chips" role="group" aria-label="Choose a type of service">
                {decision.options.map((o) => (
                  <button key={o.group} className="chip" aria-pressed={group === o.group} onClick={() => setGroup(o.group)}>{o.label}</button>
                ))}
              </div>
              {group && (
                <div className="chips" role="group" aria-label="Choose a service">
                  {categoriesInGroup(group).map((id) => (
                    <button key={id} className="chip" aria-pressed={picked?.[0] === id} onClick={() => setPicked([id])}>
                      <CatIcon id={id} size={16} /> {categoryName(id)} <span className="count">{countFor(id)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {decision?.kind === "confident" && (agent.scores.slice(1, 3).some((x) => x.score >= 0.3) || !!picked) && (
            <div className="chips" aria-label="Other possible services">
              <span className="small muted" style={{ alignSelf: "center" }}>Not quite?</span>
              {agent.scores.slice(1, 3).filter((x) => x.score >= 0.3).map((x) => (
                <button key={x.id} className="chip" aria-pressed={picked?.[0] === x.id} onClick={() => setPicked([x.id])}>{categoryName(x.id)}</button>
              ))}
              {picked && <button className="chip" onClick={() => setPicked(null)}>{categoryName((decision as { categoryId: string }).categoryId)}</button>}
            </div>
          )}
        </section>
      )}

      {!q && !activeCats.length && (
        <section className="stack">
          {GROUPS.map((g) => (
            <div key={g.id} className="stack-sm">
              <h2 className="section-title" style={{ fontSize: 18 }}>{g.label}</h2>
              <div className="cat-grid">
                {CATEGORIES.filter((c) => c.group === g.id).map((c) => (
                  <button key={c.id} className="cat-tile" onClick={() => navigate({ name: "search", categoryIds: [c.id] })}>
                    <span className="cat-icon"><CatIcon id={c.id} /></span>
                    <span>{c.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {out && (
        <section className="stack-sm" aria-label="Results">
          {!q && <h2 className="page-title" style={{ fontSize: 22 }}>{activeCats.map(categoryName).join(", ")}</h2>}
          <div className="ring-path" aria-label="How far the search went">
            <span className="small muted" style={{ marginRight: 4 }}>Searched:</span>
            {ringSteps.map((st) => (
              <span key={st.label} className={`ring-step${st.ring <= out.reachedRing ? " on" : ""}`}>{st.label}</span>
            ))}
          </div>
          <p className="explain">
            <Info size={14} style={{ flex: "none", marginTop: 2 }} />
            {out.results.length
              ? out.results.length >= s.config.targetResults
                ? `${sort === "top" ? "Highest rated first" : "Closest first"}. Found ${s.config.targetResults} good matches by ${out.reachedLabel}, so the search stopped there.`
                : `${sort === "top" ? "Highest rated first" : "Closest first"}. Searched out to ${out.reachedLabel} and found ${out.results.length} good ${out.results.length === 1 ? "match" : "matches"}.`
              : "No one offers this within 10 km yet."}
            {out.hiddenBelowFloor > 0 && ` ${out.hiddenBelowFloor} provider${out.hiddenBelowFloor > 1 ? "s" : ""} rated below ${s.config.qualityFloor} hidden.`}
          </p>
          {licensed && (
            <div className="notice n-warn"><AlertTriangle size={18} /><div className="grow">This kind of job needs a licensed provider. Check their licence before work starts.</div></div>
          )}
          <div className="toolbar">
            <div className="seg" role="group" aria-label="Sort">
              <button aria-pressed={sort === "nearest"} onClick={() => setSort("nearest")}>Nearest</button>
              <button aria-pressed={sort === "top"} onClick={() => setSort("top")}>Top rated</button>
            </div>
            <div className="seg" role="group" aria-label="View">
              <button aria-pressed={view === "map"} onClick={() => setView("map")}><MapIcon size={15} /> Map</button>
              <button aria-pressed={view === "list"} onClick={() => setView("list")}><LayoutList size={15} /> List only</button>
            </div>
          </div>

          {agent?.hints.online && out.online.length > 0 && <OnlineList list={out.online} open={open} />}

          <div className={`results-layout${view === "map" ? " with-map" : ""}`}>
            <div className="stack-sm results-list">
              {out.results.length === 0 && (
                <div className="card-flat">
                  <Empty icon={<Megaphone size={24} />} title="Nobody nearby offers this yet">
                    <span className="small">Post it on the request board and providers in your township will reply.</span>
                    <button className="btn btn-primary btn-sm" onClick={() => navigate({ name: "requests" })}>Post a request</button>
                  </Empty>
                </div>
              )}
              {out.results.map((r, i) => (
                <ProviderCard key={r.provider.id} r={r} onOpen={() => open(r)} selected={selected === r.provider.id} index={i}
                  onHover={(on) => setHot(on ? r.provider.id : null)} />
              ))}
              {out.exception && <ProviderCard r={out.exception} onOpen={() => open(out.exception!)} exception index={out.results.length}
                selected={selected === out.exception.provider.id} onHover={(on) => setHot(on ? out.exception!.provider.id : null)} />}
              {out.results.length > 0 && (
                <button className="link-btn" onClick={() => navigate({ name: "requests" })}><Megaphone size={15} /> None of these fit? Post a request</button>
              )}
            </div>
            {view === "map" && (
              <MapView className="big" center={me.home} zoom={out.reachedRing >= 4 ? 13 : 15} home={me.home} zones={mapZones} pins={pins}
                rings={s.config.ringsKm} selectedId={selected} hotId={hot} onSelect={pickOnMap} googleKey={s.config.mapsKey} mapId={s.config.mapId}>
                {selectedResult && <MapCard r={selectedResult} q={q} onClose={() => setSelected(null)} />}
              </MapView>
            )}
          </div>

          {!agent?.hints.online && out.online.length > 0 && <OnlineList list={out.online} open={open} />}
        </section>
      )}
    </div>
  );
}

/** The card that pops up over the map when a pin is tapped, like a place card in Google Maps. */
function MapCard({ r, q, onClose }: { r: SearchResult; q?: string; onClose: () => void }) {
  const sv = r.service;
  return (
    <div className="map-card" role="dialog" aria-label={`${r.provider.displayName} on the map`}>
      <button className="x-btn map-card-x" onClick={onClose} aria-label="Close"><X size={16} /></button>
      <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
        <Avatar name={r.provider.displayName} hue={r.provider.hue} />
        <div style={{ minWidth: 0, display: "grid", gap: 2 }}>
          <div className="strong ellipsis">{r.provider.displayName}</div>
          <div className="small muted ellipsis">{sv.title}</div>
        </div>
      </div>
      <div className="small" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <RatingLine stats={r.stats} />
        <span><PinIcon size={12} /> {r.ringLabel} · {distanceLabel(r.distanceM)}</span>
        <b className="tnum">{rm(sv.priceMin)}{sv.priceMax > sv.priceMin ? ` to ${rm(sv.priceMax)}` : ""}</b>
      </div>
      <div className="btn-row">
        <button className="btn btn-primary btn-sm" onClick={() => navigate({ name: "book", serviceId: sv.id, q })}>Book a slot</button>
        <button className="btn btn-outline btn-sm" onClick={() => navigate({ name: "provider", id: r.provider.id, q })}>View profile <ArrowRight size={14} /></button>
      </div>
    </div>
  );
}

function OnlineList({ list, open }: { list: SearchResult[]; open: (r: SearchResult) => void }) {
  return (
    <div className="stack-sm">
      <div>
        <h2 className="section-title" style={{ fontSize: 18 }}>Online from verified residents</h2>
        <p className="section-sub">Distance doesn't matter for these, so they're sorted by rating.</p>
      </div>
      <div className="grid-cards">
        {list.map((r) => <ProviderCard key={r.provider.id} r={r} onOpen={() => open(r)} />)}
      </div>
    </div>
  );
}
