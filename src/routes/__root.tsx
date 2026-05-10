import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Search, Bell } from "lucide-react";

import appCss from "../styles.css?url";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Toaster } from "@/components/ui/sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">页面未找到</h2>
        <p className="mt-2 text-sm text-muted-foreground">您访问的页面不存在或已被移动。</p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          返回首页
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">页面加载失败</h1>
        <p className="mt-2 text-sm text-muted-foreground">出现了错误，请重试或返回首页。</p>
        <div className="mt-6 flex justify-center gap-2">
          <Button
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            重试
          </Button>
          <Button variant="outline" asChild>
            <a href="/">返回首页</a>
          </Button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "BOOMER OFF · 品牌管理后台" },
      { name: "description", content: "中古杂货品牌的全链路 ERP 管理系统" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

const breadcrumbMap: Record<string, string> = {
  dashboard: "仪表盘",
  purchase: "采购物流",
  "japan-bulk": "日本大宗",
  "japan-parcel": "日本小包裹",
  domestic: "国内渠道",
  logistics: "物流追踪",
  inventory: "商品库存",
  products: "商品档案",
  batches: "采购批次",
  transfers: "库存调拨",
  stores: "门店加盟",
  list: "门店列表",
  franchisees: "加盟商管理",
  youzan: "有赞对接",
  knowledge: "知识库",
  settings: "系统设置",
};

function Breadcrumbs() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0) return <span className="text-sm text-muted-foreground">首页</span>;
  return (
    <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Link to="/dashboard" className="hover:text-foreground">
        首页
      </Link>
      {segments.map((seg, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <span>/</span>
          <span className={i === segments.length - 1 ? "text-foreground font-medium" : ""}>
            {breadcrumbMap[seg] ?? seg}
          </span>
        </span>
      ))}
    </nav>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <header className="h-14 flex items-center gap-3 border-b bg-card px-4 sticky top-0 z-10">
              <SidebarTrigger />
              <Breadcrumbs />
              <div className="ml-auto flex items-center gap-2">
                <div className="relative hidden md:block">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="全局搜索..."
                    className="pl-8 w-64 h-9 bg-background"
                  />
                </div>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Bell className="h-4 w-4" />
                </Button>
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">管</AvatarFallback>
                </Avatar>
              </div>
            </header>
            <main className="flex-1 p-6 overflow-auto">
              <Outlet />
            </main>
          </div>
        </div>
        <Toaster />
      </SidebarProvider>
    </QueryClientProvider>
  );
}
