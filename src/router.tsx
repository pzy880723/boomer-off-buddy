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
    defaultPreloadStaleTime: 0,
    // Show route transitions quickly instead of making clicks feel stuck.
    defaultPendingMs: 100,
    defaultPendingMinMs: 0,
  });

  return router;
};

