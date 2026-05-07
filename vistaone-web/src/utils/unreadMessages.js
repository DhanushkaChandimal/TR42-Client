const KEY = "msg_last_read";
export const UNREAD_UPDATED = "msg-read-updated";

function getAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

export function getReadMap() {
  return getAll();
}

export function markRead(chatId, lastMessageAt) {
  if (!chatId || !lastMessageAt) return;
  const all = getAll();
  all[chatId] = lastMessageAt;
  localStorage.setItem(KEY, JSON.stringify(all));
  window.dispatchEvent(new Event(UNREAD_UPDATED));
}

export function countUnread(contacts) {
  const all = getAll();
  return contacts.filter((c) => {
    if (!c.last_message?.created_at) return false;
    const lastRead = all[c.chat_id];
    return !lastRead || new Date(c.last_message.created_at) > new Date(lastRead);
  }).length;
}
