// Centralized query keys so pages and mutations agree on what to invalidate.
// Each entry returns an array; the first element is the resource name, then
// any params that change the result. Keep the shape consistent so partial
// invalidation (e.g. queryClient.invalidateQueries({ queryKey: ["vendors"] }))
// flushes everything under that resource in one call.

export const qk = {
  vendors: {
    all: ["vendors"],
    list: (params) => ["vendors", "list", params],
    detail: (id) => ["vendors", "detail", id],
    services: () => ["vendors", "services"],
    favorites: (clientId) => ["vendors", "favorites", clientId],
  },
  tickets: {
    all: ["tickets"],
    list: (params) => ["tickets", "list", params],
    summary: (params) => ["tickets", "summary", params],
    detail: (id) => ["tickets", "detail", id],
  },
  workorders: {
    all: ["workorders"],
    list: (params) => ["workorders", "list", params],
    summary: (params) => ["workorders", "summary", params],
    detail: (id) => ["workorders", "detail", id],
  },
  invoices: {
    all: ["invoices"],
    list: (params) => ["invoices", "list", params],
    summary: (params) => ["invoices", "summary", params],
    detail: (id) => ["invoices", "detail", id],
  },
  wells: {
    all: ["wells"],
    list: (params) => ["wells", "list", params],
  },
  analytics: {
    overview: () => ["analytics", "overview"],
  },
  fraud: {
    list: (params) => ["fraud", "list", params],
  },
  users: {
    me: ["users", "me"],
  },
};
