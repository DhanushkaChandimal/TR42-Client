import { QueryClient } from "@tanstack/react-query";

// Defaults tuned for an authenticated SPA where most data changes
// infrequently per session. Pages can override staleTime per-query when they
// need fresher data (e.g. messages thread sets staleTime=0).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
