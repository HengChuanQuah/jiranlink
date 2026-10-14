import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Globe, Info, LayoutList, Map as MapIcon, Megaphone, Sparkles } from "lucide-react";
import { HeroSearch } from "./Home";
import { ProviderCard } from "../../components/ProviderCard";
import { MapView, type MapPin } from "../../components/MapView";
import { CatIcon, Empty, categoryName } from "../../components/ui";
import { CATEGORIES, GROUPS, categoryById, type CategoryGroup } from "../../data/categories";
import { ZONES } from "../../data/geo";
import { understand, understandFast, thresholdsFrom, categoriesInGroup, type AgentResult } from "../../ai/agent";
import { blurPoint, zonesFor } from "../../lib/geo";
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
  const [view, setView] = useState<"list" | "map">("list");
  const [selected, setSelected] = useState<string | null>(null);

  // Ask the LLM only when keywords are not confident and a provider is configured.
  useEffect(() => {
    if (!q || categoryIds || !agent || agent.decision.kind === "confident" || s.config.aiProvider === "none" || !s.config.aiKey) return;
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
  const pins: MapPin[] = useMemo(() => {
    if (!out) return [];
    const list = [...out.results, ...(out.exception ? [out.exception] : [])];
    return list.map((r) => ({
      id: r.provider.id, point: r.provider.homeBased ? blurPoint(r.provider.exact) : r.provider.exact, area: r.provider.homeBased,
      label: initialsOf(r.provider.displayName), hue: r.provider.hue, selected: r.provider.id === selected,
    }));
  }, [out, selected]);

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
              <button aria-pressed={view === "list"} onClick={() => setView("list")}><LayoutList size={15} /> List</button>
              <button aria-pressed={view === "map"} onClick={() => setView("map")}><MapIcon size={15} /> Map</button>
            </div>
          </div>

          {agent?.hints.online && out.online.length > 0 && <OnlineList list={out.online} open={open} />}

          <div className={`results-layout${view === "map" ? " with-map" : ""}`}>
            <div className="stack-sm">
              {out.results.length === 0 && (
                <div className="card-flat">
                  <Empty icon={<Megaphone size={24} />} title="Nobody nearby offers this yet">
                    <span className="small">Post it on the request board and providers in your township will reply.</span>
                    <button className="btn btn-primary btn-sm" onClick={() => navigate({ name: "requests" })}>Post a request</button>
                  </Empty>
                </div>
              )}
              {out.results.map((r) => (
                <ProviderCard key={r.provider.id} r={r} onOpen={() => open(r)} selected={selected === r.provider.id} />
              ))}
              {out.exception && <ProviderCard r={out.exception} onOpen={() => open(out.exception!)} exception />}
              {out.results.length > 0 && (
                <button className="link-btn" onClick={() => navigate({ name: "requests" })}><Megaphone size={15} /> None of these fit? Post a request</button>
              )}
            </div>
            {view === "map" && (
              <MapView center={me.home} zoom={out.reachedRing >= 4 ? 13 : 15} home={me.home} zones={mapZones} pins={pins} googleKey={s.config.mapsKey}
                onSelect={(id) => { setSelected(id); document.querySelector(`[aria-label^="${s.providers.find((p) => p.id === id)?.displayName}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }); }} />
            )}
          </div>

          {!agent?.hints.online && out.online.length > 0 && <OnlineList list={out.online} open={open} />}
        </section>
      )}
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
