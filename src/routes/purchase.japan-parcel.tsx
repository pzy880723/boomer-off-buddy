import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/purchase/japan-parcel")({
  component: () => <Outlet />,
});
