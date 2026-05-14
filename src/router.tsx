import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    // Allow Router's preload cache to serve hover-prefetched data instantly;
    // Query still controls real freshness via its own staleTime.
    defaultPreloadStaleTime: 10_000,
    // Don't flash pending UI for fast navigations, and if it shows, drop the
    // 500ms minimum-display so the page swaps in as soon as data is ready.
    defaultPendingMs: 800,
    defaultPendingMinMs: 0,
  });

  return router;
};

