import { useState } from "react";
import {
  Bell, CalendarDays, ClipboardList, Home as HomeIcon, LayoutDashboard, MessageCircle, Flag, Settings, Shield, Store, UserRound, UserPlus,
} from "lucide-react";
import { Avatar, Logo, Sheet, Toasts } from "./components/ui";
import { PERSONAS } from "./data/seed";
import { BUILD_LABEL, TestGuide } from "./components/TestGuide";
import { Assistant } from "./components/Assistant";
import { CrashGuard } from "./components/CrashGuard";
import { run } from "./lib/store";
import { back, navigate, useRoute, type Route } from "./lib/router";
import { firstName, unreadForUser, useMe } from "./lib/hooks";
import { Home } from "./pages/resident/Home";
import { Search } from "./pages/resident/Search";
import { ProviderProfile } from "./pages/resident/ProviderProfile";
import { Book } from "./pages/resident/Book";
import { Bookings } from "./pages/shared/Bookings";
import { BookingDetail } from "./pages/shared/BookingDetail";
import { Messages, Thread } from "./pages/shared/Messages";
import { Requests } from "./pages/resident/Requests";
import { Profile } from "./pages/resident/Profile";
import { Signup } from "./pages/resident/Signup";
import { Dashboard } from "./pages/provider/Dashboard";
import { Services } from "./pages/provider/Services";
import { Availability } from "./pages/provider/Availability";
import { ProviderSettings } from "./pages/provider/ProviderSettings";
import { ProviderReviews } from "./pages/provider/ProviderReviews";
import { Admin } from "./pages/admin/Admin";

type NavItem = { label: string; icon: typeof HomeIcon; route: Route; match: Route["name"][]; badge?: number };

function navItems(mode: string, attention: number): NavItem[] {
  if (mode === "provider")
    return [
      { label: "Dashboard", icon: LayoutDashboard, route: { name: "p-dashboard" }, match: ["p-dashboard"], badge: attention },
      { label: "Jobs", icon: CalendarDays, route: { name: "bookings" }, match: ["bookings", "booking"] },
      { label: "Messages", icon: MessageCircle, route: { name: "messages" }, match: ["messages", "thread"] },
      { label: "Services", icon: Store, route: { name: "p-services" }, match: ["p-services", "p-availability"] },
      { label: "Me", icon: UserRound, route: { name: "p-settings" }, match: ["p-settings", "p-reviews"] },
    ];
  if (mode === "admin")
    return [
      { label: "Verify", icon: Shield, route: { name: "admin", tab: "verify" }, match: ["admin"] },
      { label: "Requests", icon: ClipboardList, route: { name: "requests" }, match: ["requests"] },
      { label: "Reports", icon: Flag, route: { name: "admin", tab: "reports" }, match: [] },
      { label: "Messages", icon: MessageCircle, route: { name: "messages" }, match: ["messages", "thread"] },
      { label: "Settings", icon: Settings, route: { name: "admin", tab: "settings" }, match: [] },
    ];
  return [
    { label: "Home", icon: HomeIcon, route: { name: "home" }, match: ["home", "search", "provider", "book"] },
    { label: "Requests", icon: ClipboardList, route: { name: "requests" }, match: ["requests"] },
    { label: "Bookings", icon: CalendarDays, route: { name: "bookings" }, match: ["bookings", "booking"], badge: attention },
    { label: "Messages", icon: MessageCircle, route: { name: "messages" }, match: ["messages", "thread"] },
    { label: "Me", icon: UserRound, route: { name: "profile" }, match: ["profile", "signup"] },
  ];
}

function PersonaSheet({ onClose }: { onClose: () => void }) {
  const { s, me } = useMe();
  const choose = (id: string, mode: "resident" | "provider" | "admin") => {
    run((st) => {
      st.currentUserId = id;
      st.mode = mode;
    });
    navigate(mode === "provider" ? { name: "p-dashboard" } : mode === "admin" ? { name: "admin" } : { name: "home" }, { reset: true });
    onClose();
  };
  const extra = s.users.filter((u) => u.id.startsWith("u-") && !u.id.startsWith("u-f-") && !PERSONAS.some((p) => p.id === u.id) && !u.id.startsWith("u-pending"));
  return (
    <Sheet title="View the demo as" onClose={onClose}>
      <p className="small muted">Switch between sample residents, providers and the township team. Each one sees results ranked from their own home.</p>
      <div className="persona-list">
        {PERSONAS.map((p) => {
          const u = s.users.find((x) => x.id === p.id)!;
          const prov = s.providers.find((x) => x.id === p.id);
          return (
            <button key={p.id} className="persona" aria-pressed={me.id === p.id} onClick={() => choose(p.id, p.mode)}>
              <Avatar name={prov?.displayName ?? u.name} hue={prov?.hue ?? (p.id === "u-admin" ? 210 : p.id.length * 47)} />
              <div style={{ minWidth: 0 }}>
                <div className="strong">{p.label}</div>
                <div className="small muted">{p.detail}</div>
              </div>
            </button>
          );
        })}
        {extra.map((u) => (
          <button key={u.id} className="persona" aria-pressed={me.id === u.id} onClick={() => choose(u.id, "resident")}>
            <Avatar name={u.name} hue={200} />
            <div><div className="strong">{u.name}</div><div className="small muted">You signed up as this resident ({u.verify})</div></div>
          </button>
        ))}
      </div>
      <button className="btn btn-outline" onClick={() => { onClose(); navigate({ name: "signup" }); }}><UserPlus size={16} /> Sign up as a new resident</button>
    </Sheet>
  );
}

function Header({ overHero }: { overHero: boolean }) {
  const { s, me, myProvider } = useMe();
  const route = useRoute();
  const [personaOpen, setPersonaOpen] = useState(false);
  const items = navItems(s.mode, unreadForUser(s, me.id));
  const modes: { id: "resident" | "provider" | "admin"; label: string }[] = [{ id: "resident", label: "Resident" }];
  if (myProvider) modes.push({ id: "provider", label: "Provider" });
  if (me.isAdmin) modes.push({ id: "admin", label: "Admin" });
  const setMode = (m: "resident" | "provider" | "admin") => {
    run((st) => { st.mode = m; });
    navigate(m === "provider" ? { name: "p-dashboard" } : m === "admin" ? { name: "admin" } : { name: "home" }, { reset: true });
  };
  const attention = unreadForUser(s, me.id);
  return (
    <header className={`header${overHero ? " over-hero" : ""}`}>
      <div className="wrap header-row">
        <button className="brand" onClick={() => navigate(s.mode === "provider" ? { name: "p-dashboard" } : s.mode === "admin" ? { name: "admin" } : { name: "home" }, { reset: true })} aria-label="JiranLink home">
          <Logo />
          <span className="brand-word">Jiran<span>Link</span></span>
        </button>
        <nav className="nav-links" aria-label="Main">
          {items.map((it) => (
            <button key={it.label} aria-current={it.match.includes(route.name) ? "page" : undefined} onClick={() => navigate(it.route, { reset: true })}>{it.label}</button>
          ))}
        </nav>
        <div className="header-actions">
          {modes.length > 1 && (
            <div className="mode-pill" role="group" aria-label="App mode">
              {modes.map((m) => (
                <button key={m.id} aria-pressed={s.mode === m.id} onClick={() => setMode(m.id)}>{m.label}</button>
              ))}
            </div>
          )}
          <button className="ghost-round" aria-label={`Notifications${attention ? `, ${attention} need attention` : ""}`} onClick={() => navigate(s.mode === "provider" ? { name: "p-dashboard" } : { name: "bookings" })}>
            <Bell size={18} />
            {attention > 0 && <span className="dot-badge tnum">{attention}</span>}
          </button>
          <button className="persona-btn" onClick={() => setPersonaOpen(true)} aria-label={`Signed in as ${me.name}. Switch demo user`}>
            <Avatar name={myProvider?.displayName ?? me.name} hue={myProvider?.hue ?? 205} />
            <span className="label">{myProvider && s.mode === "provider" ? myProvider.displayName.replace(/'s .*$/, "") : firstName(me.name)}</span>
          </button>
        </div>
      </div>
      {personaOpen && <PersonaSheet onClose={() => setPersonaOpen(false)} />}
    </header>
  );
}

function BottomNav() {
  const { s, me } = useMe();
  const route = useRoute();
  const items = navItems(s.mode, unreadForUser(s, me.id));
  return (
    <nav className="bottom-nav" aria-label="Main">
      {items.map((it) => {
        const I = it.icon;
        return (
          <button key={it.label} aria-current={it.match.includes(route.name) ? "page" : undefined} onClick={() => navigate(it.route, { reset: true })}>
            <I size={21} />
            {it.label}
            {!!it.badge && <span className="dot-badge tnum">{it.badge}</span>}
          </button>
        );
      })}
    </nav>
  );
}

function Page({ route }: { route: Route }) {
  switch (route.name) {
    case "home": return <Home />;
    case "search": return <Search key={`${route.q ?? ""}|${(route.categoryIds ?? []).join(",")}`} q={route.q} categoryIds={route.categoryIds} />;
    case "provider": return <ProviderProfile id={route.id} q={route.q} />;
    case "book": return <Book serviceId={route.serviceId} q={route.q} />;
    case "bookings": return <Bookings tab={route.tab} />;
    case "booking": return <BookingDetail id={route.id} />;
    case "messages": return <Messages />;
    case "thread": return <Thread id={route.id} />;
    case "requests": return <Requests key={route.draft ?? ""} draft={route.draft} />;
    case "profile": return <Profile />;
    case "signup": return <Signup />;
    case "p-dashboard": return <Dashboard />;
    case "p-services": return <Services />;
    case "p-availability": return <Availability />;
    case "p-settings": return <ProviderSettings />;
    case "p-reviews": return <ProviderReviews />;
    case "admin": return <Admin tab={route.tab} />;
  }
}

export default function App() {
  const route = useRoute();
  const { s } = useMe();
  const overHero = route.name === "home" && s.mode === "resident";
  return (
    <div className="app">
      <Header overHero={overHero} />
      {overHero ? (
        <CrashGuard key="home" area="Home" onBack={() => navigate({ name: "home" }, { reset: true })}><Home /></CrashGuard>
      ) : (
        <main className="page">
          <div className="wrap">
            {/* key: a new screen starts with a fresh guard */}
            <CrashGuard key={JSON.stringify(route)} area={route.name} onBack={() => back({ name: "home" })}><Page route={route} /></CrashGuard>
          </div>
        </main>
      )}
      <footer className="footer">
        <div className="wrap">
          <span>JiranLink prototype for the Sime Darby Property University Hackathon 2026. Not an official Sime Darby Property product.</span>
          <span>All people, businesses, reviews and promotions are sample data. {BUILD_LABEL}.</span>
        </div>
      </footer>
      <BottomNav />
      <TestGuide />
      <CrashGuard area="Ask JiranLink" compact><Assistant /></CrashGuard>
      <Toasts />
    </div>
  );
}
