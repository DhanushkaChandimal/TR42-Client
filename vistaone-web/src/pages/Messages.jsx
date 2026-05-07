import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import { messagingService } from "../services/messagingService";
import { getUserIdFromToken } from "../services/currentUser";
import { useRealtimeMessages } from "../hooks/useRealtimeMessages";
import "../styles/messagesPage.css";

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
  const lastSeenRef = useRef(null);
  const threadRef = useRef(null);
  const activeChatIdRef = useRef(null);
  const currentUserId = getUserIdFromToken();
  const navigate = useNavigate();

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
        if (msgs.length) lastSeenRef.current = msgs[msgs.length - 1].created_at;
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
          <ContactsList
            contacts={contacts}
            loading={loadingContacts}
            activeId={activeContact?.id}
            onSelect={selectContact}
          />
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
          <ContactContextPanel
            context={contactContext}
            loading={loadingContext}
            visible={!!activeContact}
            onOpenWorkOrder={(woId) => navigate(`/workorders?id=${woId}`)}
          />
        </div>
      </div>
    </AppShell>
  );
}

function ContactsList({ contacts, loading, activeId, onSelect }) {
  return (
    <aside className="messages-contacts">
      <header className="messages-contacts-header">Contacts</header>
      {loading ? (
        <div className="messages-state">Loading…</div>
      ) : contacts.length === 0 ? (
        <div className="messages-state">
          No contacts yet. Open a work order and pick someone to start a conversation.
        </div>
      ) : (
        contacts.map((c) => (
          <button
            key={c.id}
            className={`messages-contact ${
              activeId === c.id ? "messages-contact-active" : ""
            }`}
            onClick={() => onSelect(c)}
          >
            <div className="messages-contact-row">
              <span className="messages-contact-name">{c.name}</span>
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
        ))
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

function ContactContextPanel({ context, loading, visible, onOpenWorkOrder }) {
  if (!visible) return null;
  if (loading || !context) {
    return (
      <aside className="messages-context">
        <div className="messages-state">Loading details…</div>
      </aside>
    );
  }
  const { contact, work_orders = [], tickets = [], invoices = [] } = context;
  return (
    <aside className="messages-context">
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
