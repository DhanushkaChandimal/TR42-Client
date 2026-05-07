import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import { messagingService } from "../services/messagingService";
import { getUserIdFromToken } from "../services/currentUser";
import { useRealtimeMessages } from "../hooks/useRealtimeMessages";
import "../styles/messagesPage.css";
import { markRead, getReadMap, UNREAD_UPDATED } from "../utils/unreadMessages";

// Pane layout: bounds + persisted-state keys
const LEFT_MIN = 200, LEFT_MAX = 480, LEFT_DEFAULT = 280;
const RIGHT_MIN = 220, RIGHT_MAX = 540, RIGHT_DEFAULT = 320;
const LS_LAYOUT_KEY = "messagesPageLayout:v1";

function loadLayout() {
  try {
    const raw = localStorage.getItem(LS_LAYOUT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

const formatTime = (s) =>
  s
    ? new Date(s).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

const formatDay = (s) =>
  s
    ? new Date(s).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

export default function Messages() {
  const [searchParams, setSearchParams] = useSearchParams();
  const deepUser = searchParams.get("user");

  const [contacts, setContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [activeContact, setActiveContact] = useState(null);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [contactContext, setContactContext] = useState(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [loadingContext, setLoadingContext] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [readMap, setReadMap] = useState(() => getReadMap());
  const lastSeenRef = useRef(null);
  const threadRef = useRef(null);
  const activeChatIdRef = useRef(null);
  const currentUserId = getUserIdFromToken();
  const navigate = useNavigate();

  // Resizable + collapsible pane state, persisted to localStorage
  const [paneLayout, setPaneLayout] = useState(() => {
    const saved = loadLayout();
    return {
      leftWidth: clamp(saved?.leftWidth ?? LEFT_DEFAULT, LEFT_MIN, LEFT_MAX),
      rightWidth: clamp(saved?.rightWidth ?? RIGHT_DEFAULT, RIGHT_MIN, RIGHT_MAX),
      leftCollapsed: !!saved?.leftCollapsed,
      rightCollapsed: !!saved?.rightCollapsed,
    };
  });
  const dragState = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(LS_LAYOUT_KEY, JSON.stringify(paneLayout));
    } catch {
      /* localStorage may be unavailable; non-fatal */
    }
  }, [paneLayout]);

  const beginDrag = (which) => (e) => {
    e.preventDefault();
    dragState.current = {
      which,
      startX: e.clientX,
      startWidth:
        which === "left" ? paneLayout.leftWidth : paneLayout.rightWidth,
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    const onMove = (e) => {
      const d = dragState.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      if (d.which === "left") {
        const next = clamp(d.startWidth + dx, LEFT_MIN, LEFT_MAX);
        setPaneLayout((prev) =>
          prev.leftWidth === next ? prev : { ...prev, leftWidth: next },
        );
      } else {
        // Right pane shrinks when the mouse moves right (toward it).
        const next = clamp(d.startWidth - dx, RIGHT_MIN, RIGHT_MAX);
        setPaneLayout((prev) =>
          prev.rightWidth === next ? prev : { ...prev, rightWidth: next },
        );
      }
    };
    const onUp = () => {
      if (!dragState.current) return;
      dragState.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const setLeftCollapsed = (v) =>
    setPaneLayout((prev) => ({ ...prev, leftCollapsed: v }));
  const setRightCollapsed = (v) =>
    setPaneLayout((prev) => ({ ...prev, rightCollapsed: v }));

  useEffect(() => {
    const handler = () => setReadMap(getReadMap());
    window.addEventListener(UNREAD_UPDATED, handler);
    return () => window.removeEventListener(UNREAD_UPDATED, handler);
  }, []);

  const loadContacts = useCallback(async () => {
    try {
      const data = await messagingService.listContacts();
      setContacts(data);
    } catch (err) {
      setError(err.message || "Failed to load contacts");
    } finally {
      setLoadingContacts(false);
    }
  }, []);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") loadContacts();
    }, 20_000);
    return () => clearInterval(id);
  }, [loadContacts]);

  const selectContact = useCallback(
    async (contact) => {
      setActiveContact(contact);
      setActiveChatId(contact.chat_id);
      activeChatIdRef.current = contact.chat_id;
      setMessages([]);
      setContactContext(null);
      lastSeenRef.current = null;
      setLoadingThread(true);
      setLoadingContext(true);
      setError("");
      try {
        const [msgs, ctx] = await Promise.all([
          messagingService.listMessages(contact.chat_id),
          messagingService.getUserContext(contact.id).catch(() => null),
        ]);
        setMessages(msgs);
        setContactContext(ctx);
        if (msgs.length) {
          lastSeenRef.current = msgs[msgs.length - 1].created_at;
          markRead(contact.chat_id, msgs[msgs.length - 1].created_at);
        } else {
          markRead(contact.chat_id, contact.last_message?.created_at);
        }
      } catch (err) {
        setError(err.message || "Failed to open conversation");
      } finally {
        setLoadingThread(false);
        setLoadingContext(false);
      }
    },
    []
  );

  // Deep link via ?user=<id>
  useEffect(() => {
    if (!deepUser || loadingContacts) return;
    const found = contacts.find((c) => c.id === deepUser);
    if (found) {
      selectContact(found);
    }
    setSearchParams({}, { replace: true });
  }, [deepUser, contacts, loadingContacts, selectContact, setSearchParams]);

  const handleIncomingMessage = useCallback((row) => {
    if (row.chat_id === activeChatIdRef.current) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === row.id)) return prev;
        return [...prev, row];
      });
      lastSeenRef.current = row.created_at;
      markRead(row.chat_id, row.created_at);
    }
    loadContacts();
  }, [loadContacts]);

  useRealtimeMessages({
    userId: currentUserId,
    onMessage: handleIncomingMessage,
  });

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages.length]);

  const send = async (e) => {
    e.preventDefault();
    if (!activeChatId) return;
    if (!draft.trim() && !file) return;
    setSending(true);
    setError("");
    try {
      const msg = await messagingService.postMessage(activeChatId, draft, file);
      setMessages((prev) => [...prev, msg]);
      lastSeenRef.current = msg.created_at;
      markRead(activeChatId, msg.created_at);
      setDraft("");
      setFile(null);
      await loadContacts();
    } catch (err) {
      setError(err.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  return (
    <AppShell
      title="Messages"
      subtitle="Pick a contact to view their thread, work orders, tickets, and invoices."
    >
      <div className="messages-page">
        <div className="messages-page-grid">
          {paneLayout.leftCollapsed ? (
            <div
              className="messages-rail"
              role="button"
              tabIndex={0}
              title="Expand contacts"
              onClick={() => setLeftCollapsed(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setLeftCollapsed(false);
              }}
            >
              <button
                type="button"
                className="messages-rail-toggle"
                onClick={(e) => {
                  e.stopPropagation();
                  setLeftCollapsed(false);
                }}
                aria-label="Expand contacts"
              >
                ›
              </button>
              <div className="messages-rail-label">Contacts</div>
            </div>
          ) : (
            <>
              <div
                className="messages-pane messages-pane-left"
                style={{ width: paneLayout.leftWidth }}
              >
                <ContactsList
                  contacts={contacts}
                  loading={loadingContacts}
                  activeId={activeContact?.id}
                  onSelect={selectContact}
                  readMap={readMap}
                  onCollapse={() => setLeftCollapsed(true)}
                />
              </div>
              <div
                className={`messages-splitter${dragState.current?.which === "left" ? " dragging" : ""}`}
                onMouseDown={beginDrag("left")}
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize contacts pane"
              />
            </>
          )}

          <div className="messages-pane messages-pane-center">
            <ThreadPane
              activeContact={activeContact}
              messages={messages}
              loadingThread={loadingThread}
              currentUserId={currentUserId}
              threadRef={threadRef}
              draft={draft}
              setDraft={setDraft}
              file={file}
              setFile={setFile}
              sending={sending}
              error={error}
              onSend={send}
            />
          </div>

          {paneLayout.rightCollapsed ? (
            <div
              className="messages-rail messages-rail-right"
              role="button"
              tabIndex={0}
              title="Expand details"
              onClick={() => setRightCollapsed(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setRightCollapsed(false);
              }}
            >
              <button
                type="button"
                className="messages-rail-toggle"
                onClick={(e) => {
                  e.stopPropagation();
                  setRightCollapsed(false);
                }}
                aria-label="Expand details"
              >
                ‹
              </button>
              <div className="messages-rail-label">Details</div>
            </div>
          ) : (
            <>
              <div
                className={`messages-splitter${dragState.current?.which === "right" ? " dragging" : ""}`}
                onMouseDown={beginDrag("right")}
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize details pane"
              />
              <div
                className="messages-pane messages-pane-right"
                style={{ width: paneLayout.rightWidth }}
              >
                <ContactContextPanel
                  context={contactContext}
                  loading={loadingContext}
                  visible={!!activeContact}
                  onOpenWorkOrder={(woId) => navigate(`/workorders?id=${woId}`)}
                  onCollapse={() => setRightCollapsed(true)}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function ContactsList({ contacts, loading, activeId, onSelect, readMap, onCollapse }) {
  return (
    <aside className="messages-contacts">
      <header className="messages-contacts-header">
        <span>Contacts</span>
        {onCollapse && (
          <button
            type="button"
            className="messages-pane-collapse-btn"
            onClick={onCollapse}
            aria-label="Collapse contacts"
            title="Collapse"
          >
            ‹
          </button>
        )}
      </header>
      {loading ? (
        <div className="messages-state">Loading…</div>
      ) : contacts.length === 0 ? (
        <div className="messages-state">
          No contacts yet. Open a work order and pick someone to start a conversation.
        </div>
      ) : (
        contacts.map((c) => {
          const lastRead = readMap[c.chat_id];
          const unread =
            !!c.last_message?.created_at &&
            (!lastRead || new Date(c.last_message.created_at) > new Date(lastRead));
          return (
            <button
              key={c.id}
              className={`messages-contact ${
                activeId === c.id ? "messages-contact-active" : ""
              }`}
              onClick={() => onSelect(c)}
            >
              <div className="messages-contact-row">
                <span className={`messages-contact-name${unread ? " messages-contact-name-unread" : ""}`}>
                  {c.name}
                </span>
                {unread && <span className="messages-unread-dot" />}
              </div>
              <div className="messages-contact-role">{c.role}</div>
              {c.last_message && (
                <div className="messages-contact-preview">
                  {c.last_message.body
                    ? c.last_message.body.slice(0, 60)
                    : "(attachment)"}
                </div>
              )}
              {c.last_message?.created_at && (
                <div className="messages-contact-time">
                  {formatDay(c.last_message.created_at)}
                </div>
              )}
            </button>
          );
        })
      )}
    </aside>
  );
}

function ThreadPane({
  activeContact,
  messages,
  loadingThread,
  currentUserId,
  threadRef,
  draft,
  setDraft,
  file,
  setFile,
  sending,
  error,
  onSend,
}) {
  if (!activeContact) {
    return (
      <section className="messages-thread-pane">
        <div className="messages-state">Pick a contact to start reading.</div>
      </section>
    );
  }
  return (
    <section className="messages-thread-pane">
      <div className="messages-thread-header">
        <strong>{activeContact.name}</strong>
        <span className="messages-thread-role">{activeContact.role}</span>
      </div>
      {loadingThread ? (
        <div className="messages-state">Loading…</div>
      ) : (
        <>
          <div className="messages-thread" ref={threadRef}>
            {messages.length === 0 ? (
              <div className="messages-state">No messages yet. Say hi.</div>
            ) : (
              messages.map((m) => {
                const mine = m.sender_id === currentUserId;
                return (
                  <div
                    key={m.id}
                    className={`messages-bubble ${
                      mine ? "messages-bubble-mine" : "messages-bubble-theirs"
                    }`}
                  >
                    {m.body && <div className="messages-body">{m.body}</div>}
                    {m.attachments?.length > 0 && (
                      <ul className="messages-attachments">
                        {m.attachments.map((a) => (
                          <li key={a.id}>
                            <a
                              href={messagingService.attachmentUrl(m.id, a.id)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {a.filename}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="messages-meta">
                      {formatTime(m.created_at)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <form className="messages-composer" onSubmit={onSend}>
            <textarea
              className="messages-input"
              placeholder="Type a message…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={sending}
              rows={2}
            />
            <div className="messages-composer-row">
              <input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                disabled={sending}
              />
              <button
                type="submit"
                className="messages-send-btn"
                disabled={sending || (!draft.trim() && !file)}
              >
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
            {error && <div className="messages-error">{error}</div>}
          </form>
        </>
      )}
    </section>
  );
}

function ContactContextPanel({ context, loading, visible, onOpenWorkOrder, onCollapse }) {
  if (!visible) return null;
  if (loading || !context) {
    return (
      <aside className="messages-context">
        <header className="messages-context-header">
          <span>Details</span>
          {onCollapse && (
            <button
              type="button"
              className="messages-pane-collapse-btn"
              onClick={onCollapse}
              aria-label="Collapse details"
              title="Collapse"
            >
              ›
            </button>
          )}
        </header>
        <div className="messages-state">Loading details…</div>
      </aside>
    );
  }
  const { contact, work_orders = [], tickets = [], invoices = [] } = context;
  return (
    <aside className="messages-context">
      <header className="messages-context-header">
        <span>Details</span>
        {onCollapse && (
          <button
            type="button"
            className="messages-pane-collapse-btn"
            onClick={onCollapse}
            aria-label="Collapse details"
            title="Collapse"
          >
            ›
          </button>
        )}
      </header>
      <section className="messages-context-section">
        <h3>Contact</h3>
        <dl>
          <dt>Name</dt><dd>{contact.name}</dd>
          <dt>Type</dt><dd>{contact.user_type || "—"}</dd>
          <dt>Email</dt>
          <dd>
            {contact.email ? (
              <a href={`mailto:${contact.email}`}>{contact.email}</a>
            ) : (
              "—"
            )}
          </dd>
          <dt>Phone</dt>
          <dd>
            {contact.phone ? (
              <a href={`tel:${contact.phone}`}>{contact.phone}</a>
            ) : (
              "—"
            )}
          </dd>
        </dl>
      </section>

      <section className="messages-context-section">
        <h3>Work Orders ({work_orders.length})</h3>
        {work_orders.length === 0 ? (
          <div className="messages-context-empty">None on file.</div>
        ) : (
          <ul className="messages-context-list">
            {work_orders.map((w) => (
              <li
                key={w.id}
                className="messages-context-clickable"
                onClick={() => onOpenWorkOrder(w.id)}
              >
                <span className="messages-context-msa-name">{w.label}</span>
                <span className="messages-context-msa-meta">
                  {w.status || ""}{w.priority ? ` · ${w.priority}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="messages-context-section">
        <h3>Tickets ({tickets.length})</h3>
        {tickets.length === 0 ? (
          <div className="messages-context-empty">None.</div>
        ) : (
          <ul className="messages-context-list">
            {tickets.map((t) => (
              <li key={t.id}>
                <span className="messages-context-msa-name">
                  {t.description || `Ticket ${t.id.slice(0, 8)}`}
                </span>
                <span className="messages-context-msa-meta">
                  {t.status || ""}
                  {t.priority ? ` · ${t.priority}` : ""}
                  {t.due_date ? ` · due ${formatDay(t.due_date)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="messages-context-section">
        <h3>Invoices ({invoices.length})</h3>
        {invoices.length === 0 ? (
          <div className="messages-context-empty">None.</div>
        ) : (
          <ul className="messages-context-list">
            {invoices.map((inv) => (
              <li key={inv.id}>
                <span className="messages-context-msa-name">
                  {inv.total_amount != null
                    ? `$${inv.total_amount.toFixed(2)}`
                    : `Invoice ${inv.id.slice(0, 8)}`}
                </span>
                <span className="messages-context-msa-meta">
                  {inv.status || ""}
                  {inv.due_date ? ` · due ${formatDay(inv.due_date)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}
