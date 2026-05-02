import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import AppShell from "../components/AppShell";
import { messagingService } from "../services/messagingService";
import { getUserIdFromToken } from "../services/currentUser";
import "../styles/messagesPage.css";

const POLL_MS = 5000;

const formatTime = (s) =>
  s
    ? new Date(s).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

export default function Messages() {
  const [searchParams, setSearchParams] = useSearchParams();
  const deepWO = searchParams.get("wo");
  const deepUser = searchParams.get("user");

  const [tree, setTree] = useState([]);
  const [loadingTree, setLoadingTree] = useState(true);
  const [openWO, setOpenWO] = useState(new Set());
  const [openGroup, setOpenGroup] = useState(new Set());
  const [activeChatKey, setActiveChatKey] = useState(null);
  const [activeChatId, setActiveChatId] = useState(null);
  const [activePerson, setActivePerson] = useState(null);
  const [activeWO, setActiveWO] = useState(null);
  const [activeWOContext, setActiveWOContext] = useState(null);
  const [loadingWOContext, setLoadingWOContext] = useState(false);
  const [messages, setMessages] = useState([]);
  const [context, setContext] = useState(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const lastSeenRef = useRef(null);
  const threadRef = useRef(null);
  const currentUserId = getUserIdFromToken();

  const loadTree = useCallback(async () => {
    try {
      const data = await messagingService.listTree();
      setTree(data);
    } catch (err) {
      setError(err.message || "Failed to load work orders");
    } finally {
      setLoadingTree(false);
    }
  }, []);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") loadTree();
    }, POLL_MS * 4);
    return () => clearInterval(id);
  }, [loadTree]);

  const selectWO = useCallback(async (wo) => {
    setActiveWO(wo);
    setLoadingWOContext(true);
    setActiveWOContext(null);
    try {
      const ctx = await messagingService.getWorkOrderContext(wo.id);
      setActiveWOContext(ctx);
    } catch (err) {
      setError(err.message || "Failed to load work order details");
    } finally {
      setLoadingWOContext(false);
    }
  }, []);

  const toggleWO = (wo) => {
    const woId = wo.id;
    setOpenWO((prev) => {
      const next = new Set(prev);
      if (next.has(woId)) {
        next.delete(woId);
      } else {
        next.add(woId);
        selectWO(wo);
      }
      return next;
    });
  };

  const toggleGroup = (key) => {
    setOpenGroup((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const openConversation = useCallback(async (wo, person) => {
    const key = `${wo.id}:${person.id}`;
    setActiveChatKey(key);
    setActivePerson(person);
    setMessages([]);
    setContext(null);
    setActiveChatId(null);
    lastSeenRef.current = null;
    setLoadingThread(true);
    setError("");
    selectWO(wo);
    try {
      const chat = person.chat_id
        ? { id: person.chat_id }
        : await messagingService.openChat(wo.id, person.id);
      setActiveChatId(chat.id);
      const [msgs, ctx] = await Promise.all([
        messagingService.listMessages(chat.id),
        messagingService.getContext(chat.id, wo.id).catch(() => null),
      ]);
      setMessages(msgs);
      setContext(ctx);
      if (msgs.length) lastSeenRef.current = msgs[msgs.length - 1].created_at;
      await loadTree();
    } catch (err) {
      setError(err.message || "Failed to open conversation");
    } finally {
      setLoadingThread(false);
    }
  }, [loadTree, selectWO]);

  // Deep link: ?wo=<id>&user=<id>
  useEffect(() => {
    if (!deepWO || loadingTree || !tree.length) return;
    const wo = tree.find((w) => w.id === deepWO);
    if (!wo) return;
    setOpenWO((prev) => {
      const next = new Set(prev);
      next.add(wo.id);
      return next;
    });
    if (deepUser) {
      const inVendor = wo.vendor?.users?.find((u) => u.id === deepUser);
      const inContractors = wo.contractors?.find((u) => u.id === deepUser);
      const person = inVendor || inContractors;
      if (person) {
        if (inVendor) {
          setOpenGroup((prev) => new Set(prev).add(`${wo.id}:vendor`));
        } else {
          setOpenGroup((prev) => new Set(prev).add(`${wo.id}:contractors`));
        }
        openConversation(wo, person);
      } else {
        selectWO(wo);
      }
    } else {
      selectWO(wo);
    }
    setSearchParams({}, { replace: true });
  }, [deepWO, deepUser, tree, loadingTree, openConversation, selectWO, setSearchParams]);

  useEffect(() => {
    if (!activeChatId) return;
    let cancelled = false;
    const tick = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const latest = await messagingService.listMessages(
          activeChatId,
          lastSeenRef.current
        );
        if (cancelled || !latest.length) return;
        setMessages((prev) => [...prev, ...latest]);
        lastSeenRef.current = latest[latest.length - 1].created_at;
      } catch {
        /* polling errors are non-fatal */
      }
    };
    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [activeChatId]);

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
      await loadTree();
    } catch (err) {
      setError(err.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  return (
    <AppShell
      title="Messages"
      subtitle="Conversations grouped by work order. Expand a work order to message its vendor or contractor."
    >
      <div className="messages-page">
        <div className="messages-page-grid">
          <aside className="messages-tree">
            {loadingTree ? (
              <div className="messages-state">Loading…</div>
            ) : tree.length === 0 ? (
              <div className="messages-state">No work orders.</div>
            ) : (
              tree.map((wo) => {
                const woOpen = openWO.has(wo.id);
                const vendorKey = `${wo.id}:vendor`;
                const contractorKey = `${wo.id}:contractors`;
                const vendorOpen = openGroup.has(vendorKey);
                const contractorOpen = openGroup.has(contractorKey);
                return (
                  <div key={wo.id} className="messages-tree-wo">
                    <button
                      className={`messages-tree-row messages-tree-wo-row ${
                        woOpen ? "open" : ""
                      } ${activeWO?.id === wo.id ? "selected" : ""}`}
                      onClick={() => toggleWO(wo)}
                    >
                      <span className="messages-tree-caret">
                        {woOpen ? "▾" : "▸"}
                      </span>
                      <span className="messages-tree-label">{wo.label}</span>
                      {wo.status && (
                        <span className="messages-tree-status">{wo.status}</span>
                      )}
                    </button>
                    {woOpen && (
                      <div className="messages-tree-children">
                        {wo.vendor ? (
                          <>
                            <button
                              className={`messages-tree-row messages-tree-group-row ${
                                vendorOpen ? "open" : ""
                              }`}
                              onClick={() => toggleGroup(vendorKey)}
                            >
                              <span className="messages-tree-caret">
                                {vendorOpen ? "▾" : "▸"}
                              </span>
                              <span className="messages-tree-label">
                                Vendor: {wo.vendor.company_name}
                              </span>
                            </button>
                            {vendorOpen && (
                              <div className="messages-tree-grandchildren">
                                {wo.vendor.users.length === 0 ? (
                                  <div className="messages-tree-empty">
                                    No vendor users linked.
                                  </div>
                                ) : (
                                  wo.vendor.users.map((u) => (
                                    <PersonRow
                                      key={u.id}
                                      person={u}
                                      activeKey={activeChatKey}
                                      woId={wo.id}
                                      onClick={() => openConversation(wo, u)}
                                    />
                                  ))
                                )}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="messages-tree-empty">
                            No vendor on this work order.
                          </div>
                        )}

                        <button
                          className={`messages-tree-row messages-tree-group-row ${
                            contractorOpen ? "open" : ""
                          }`}
                          onClick={() => toggleGroup(contractorKey)}
                        >
                          <span className="messages-tree-caret">
                            {contractorOpen ? "▾" : "▸"}
                          </span>
                          <span className="messages-tree-label">
                            Contractors ({wo.contractors.length})
                          </span>
                        </button>
                        {contractorOpen && (
                          <div className="messages-tree-grandchildren">
                            {wo.contractors.length === 0 ? (
                              <div className="messages-tree-empty">
                                No contractor matched on tickets.
                              </div>
                            ) : (
                              wo.contractors.map((u) => (
                                <PersonRow
                                  key={u.id}
                                  person={u}
                                  activeKey={activeChatKey}
                                  woId={wo.id}
                                  onClick={() => openConversation(wo, u)}
                                />
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </aside>

          <section className="messages-page-thread-wrap">
            {!activeChatKey ? (
              <div className="messages-state">
                Pick a work order, then a recipient.
              </div>
            ) : (
              <>
                <div className="messages-thread-header">
                  <strong>{activePerson?.name}</strong>
                  <span className="messages-thread-wo">
                    {activeWO?.label || ""}
                  </span>
                </div>
                {loadingThread ? (
                  <div className="messages-state">Loading…</div>
                ) : (
                  <>
                    <div className="messages-thread" ref={threadRef}>
                      {messages.length === 0 ? (
                        <div className="messages-state">No messages yet.</div>
                      ) : (
                        messages.map((m) => {
                          const mine = m.sender_id === currentUserId;
                          return (
                            <div
                              key={m.id}
                              className={`messages-bubble ${
                                mine
                                  ? "messages-bubble-mine"
                                  : "messages-bubble-theirs"
                              }`}
                            >
                              {m.body && (
                                <div className="messages-body">{m.body}</div>
                              )}
                              {m.attachments?.length > 0 && (
                                <ul className="messages-attachments">
                                  {m.attachments.map((a) => (
                                    <li key={a.id}>
                                      <a
                                        href={messagingService.attachmentUrl(
                                          m.id,
                                          a.id
                                        )}
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
                    <form className="messages-composer" onSubmit={send}>
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
                          onChange={(e) =>
                            setFile(e.target.files?.[0] || null)
                          }
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
                      {error && (
                        <div className="messages-error">{error}</div>
                      )}
                    </form>
                  </>
                )}
              </>
            )}
          </section>

          {activeWO && (
            <ContextPanel
              chatContext={context}
              woContext={activeWOContext}
              loading={loadingThread || loadingWOContext}
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}

function PersonRow({ person, activeKey, woId, onClick }) {
  const key = `${woId}:${person.id}`;
  const isActive = activeKey === key;
  return (
    <button
      className={`messages-tree-person ${isActive ? "active" : ""}`}
      onClick={onClick}
    >
      <span className="messages-tree-person-name">{person.name}</span>
      {person.role && (
        <span className="messages-tree-person-role">{person.role}</span>
      )}
    </button>
  );
}

function ContextPanel({ chatContext, woContext, loading }) {
  const data = chatContext || woContext;
  if (loading && !data) {
    return (
      <aside className="messages-context">
        <div className="messages-state">Loading details…</div>
      </aside>
    );
  }
  if (!data) {
    return (
      <aside className="messages-context">
        <div className="messages-state">No details available.</div>
      </aside>
    );
  }
  const fmtDate = (s) =>
    s
      ? new Date(s).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "—";
  const other_user = chatContext?.other_user || null;
  const { work_order, vendor, msas, tickets, ticket_counts, invoices } = data;
  return (
    <aside className="messages-context">
      {other_user && (
        <section className="messages-context-section">
          <h3>Contact</h3>
          <dl>
            <dt>Name</dt><dd>{other_user.name}</dd>
            <dt>Role</dt><dd>{other_user.role}</dd>
            <dt>Email</dt>
            <dd>
              {other_user.email ? (
                <a href={`mailto:${other_user.email}`}>{other_user.email}</a>
              ) : (
                "—"
              )}
            </dd>
            <dt>Phone</dt>
            <dd>
              {other_user.phone ? (
                <a href={`tel:${other_user.phone}`}>{other_user.phone}</a>
              ) : (
                "—"
              )}
            </dd>
          </dl>
        </section>
      )}
      {work_order && (
        <section className="messages-context-section">
          <h3>Work Order</h3>
          <dl>
            <dt>Ref</dt><dd>{work_order.label}</dd>
            <dt>Status</dt>
            <dd>
              <span className={`messages-status-pill status-${(work_order.status || "").toLowerCase()}`}>
                {work_order.status || "—"}
              </span>
            </dd>
            <dt>Priority</dt><dd>{work_order.priority || "—"}</dd>
            {work_order.description && (
              <>
                <dt>Description</dt>
                <dd>{work_order.description}</dd>
              </>
            )}
          </dl>
        </section>
      )}

      {work_order && (
        <section className="messages-context-section">
          <h3>Tickets {ticket_counts ? `(${ticket_counts.open}/${ticket_counts.total} open)` : ""}</h3>
          {tickets && tickets.length > 0 ? (
            <ul className="messages-context-list">
              {tickets.map((t) => (
                <li key={t.id}>
                  <span className="messages-context-msa-name">
                    {t.description || `Ticket ${t.id.slice(0, 8)}`}
                  </span>
                  <span className="messages-context-msa-meta">
                    {t.status || ""}
                    {t.priority ? ` · ${t.priority}` : ""}
                    {t.assigned_contractor ? ` · ${t.assigned_contractor}` : ""}
                    {t.due_date ? ` · due ${fmtDate(t.due_date)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="messages-context-empty">No tickets on this WO.</div>
          )}
        </section>
      )}

      {work_order && (
        <section className="messages-context-section">
          <h3>Invoices</h3>
          {invoices && invoices.length > 0 ? (
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
                    {inv.due_date ? ` · due ${fmtDate(inv.due_date)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="messages-context-empty">No invoices yet.</div>
          )}
        </section>
      )}

      {vendor && (
        <section className="messages-context-section">
          <h3>Vendor</h3>
          <dl>
            <dt>Company</dt><dd>{vendor.company_name || "—"}</dd>
            {vendor.vendor_code && (
              <>
                <dt>Code</dt>
                <dd>{vendor.vendor_code}</dd>
              </>
            )}
            <dt>Primary contact</dt>
            <dd>{vendor.primary_contact_name || "—"}</dd>
            <dt>Email</dt>
            <dd>
              {vendor.company_email ? (
                <a href={`mailto:${vendor.company_email}`}>
                  {vendor.company_email}
                </a>
              ) : (
                "—"
              )}
            </dd>
            <dt>Phone</dt>
            <dd>
              {vendor.company_phone ? (
                <a href={`tel:${vendor.company_phone}`}>{vendor.company_phone}</a>
              ) : (
                "—"
              )}
            </dd>
          </dl>
        </section>
      )}

      <section className="messages-context-section">
        <h3>Contracts</h3>
        {msas && msas.length > 0 ? (
          <ul className="messages-context-list">
            {msas.map((m) => (
              <li key={m.id}>
                <span className="messages-context-msa-name">
                  {m.file_name || `MSA ${m.id.slice(0, 8)}`}
                </span>
                <span className="messages-context-msa-meta">
                  {m.version ? `v${m.version}` : ""}{" "}
                  {m.status ? `· ${m.status}` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="messages-context-empty">
            No contracts on file for this vendor.
          </div>
        )}
      </section>
    </aside>
  );
}
