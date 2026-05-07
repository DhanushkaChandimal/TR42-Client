import { useEffect, useState, useCallback, useRef } from "react";
import { messagingService } from "../services/messagingService";
import { countUnread, UNREAD_UPDATED } from "../utils/unreadMessages";

export function useUnreadMessageCount() {
  const [count, setCount] = useState(0);
  const contactsRef = useRef([]);

  const recompute = useCallback(() => {
    setCount(countUnread(contactsRef.current));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const contacts = await messagingService.listContacts();
      contactsRef.current = contacts;
      setCount(countUnread(contacts));
    } catch {
      // silent — badge just stays stale
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 20_000);
    window.addEventListener(UNREAD_UPDATED, recompute);
    return () => {
      clearInterval(id);
      window.removeEventListener(UNREAD_UPDATED, recompute);
    };
  }, [refresh, recompute]);

  return count;
}
