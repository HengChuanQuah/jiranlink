import { useEffect, useRef, useState } from "react";
import { ArrowLeft, MessageCircle, Send } from "lucide-react";
import { Avatar, Empty } from "../../components/ui";
import { nameOf, threadPeer, threadsFor, useMe } from "../../lib/hooks";
import { back, navigate } from "../../lib/router";
import { attempt } from "../../lib/store";
import { sendMessage } from "../../lib/domain";
import { fmtTime, timeAgo } from "../../lib/time";

export function ChatThread({ threadId }: { threadId: string }) {
  const { s, me } = useMe();
  const [text, setText] = useState("");
  const msgs = s.messages.filter((m) => m.threadId === threadId);
  const end = useRef<HTMLDivElement>(null);
  // Braces matter: newer Chrome returns a value from scrollIntoView, and React would try to run it as clean-up.
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [msgs.length]);
  const send = () => {
    if (attempt((st) => sendMessage(st, threadId, me.id, text))) setText("");
  };
  return (
    <div className="stack-sm">
      <div className="chat" aria-live="polite">
        {msgs.length === 0 && <p className="small muted">No messages yet.</p>}
        {msgs.map((m) => (
          <div key={m.id} className={`bubble ${m.fromId === "system" ? "sys" : m.fromId === me.id ? "me" : "them"}`}>
            {m.text}
            {m.fromId !== "system" && <span className="when tnum">{m.fromId === me.id ? "You" : nameOf(s, m.fromId).split(" ")[0]} · {fmtTime(m.at)}</span>}
          </div>
        ))}
        <div ref={end} />
      </div>
      <form className="composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <label htmlFor={`c-${threadId}`} className="sr-only">Message</label>
        <textarea id={`c-${threadId}`} className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message" rows={1}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <button className="round-btn" type="submit" aria-label="Send"><Send size={18} /></button>
      </form>
    </div>
  );
}

export function Messages() {
  const { s, me } = useMe();
  const threads = threadsFor(s, me.id);
  return (
    <div className="stack">
      <h1 className="page-title">Messages</h1>
      <div className="stack-sm">
        {threads.length === 0 && <div className="card-flat"><Empty icon={<MessageCircle size={24} />} title="No conversations yet">Messages start when you book or reply to a request.</Empty></div>}
        {threads.map((t) => {
          const peer = threadPeer(s, t.id, me.id);
          const prov = s.providers.find((p) => p.id === peer.peerId);
          return (
            <button key={t.id} className="list-row" onClick={() => navigate(peer.bookingId ? { name: "booking", id: peer.bookingId } : { name: "thread", id: t.id })}>
              <Avatar name={nameOf(s, peer.peerId)} hue={prov?.hue ?? 205} />
              <div className="grow">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span className="strong ellipsis">{nameOf(s, peer.peerId)}</span>
                  <span className="tiny muted" style={{ flex: "none" }}>{timeAgo(t.last.at)}</span>
                </div>
                <div className="small muted ellipsis">{peer.title}</div>
                <div className="small ellipsis">{t.last.fromId === me.id ? "You: " : ""}{t.last.text}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Thread({ id }: { id: string }) {
  const { s, me } = useMe();
  const peer = threadPeer(s, id, me.id);
  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <button className="link-btn" onClick={() => back({ name: "messages" })} style={{ justifySelf: "start" }}><ArrowLeft size={16} /> Back</button>
      <div className="card stack-sm">
        <div className="strong" style={{ fontFamily: "var(--font-display)", fontSize: 18 }}>{nameOf(s, peer.peerId)}</div>
        <div className="small muted">{peer.title}</div>
        {s.providers.some((p) => p.id === peer.peerId) && s.mode === "resident" && (
          <button className="btn btn-outline btn-sm" style={{ justifySelf: "start" }} onClick={() => navigate({ name: "provider", id: peer.peerId })}>View profile and book</button>
        )}
        <ChatThread threadId={id} />
      </div>
    </div>
  );
}
