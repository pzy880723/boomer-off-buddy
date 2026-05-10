import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Package,
  Boxes,
  Store,
  BookOpen,
  Settings,
  Plane,
  Mail,
  ShoppingBag,
  Truck,
  Tags,
  Layers,
  ArrowLeftRight,
  Building2,
  Users,
  Link2,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";

const groups = [
  {
    label: "总览",
    items: [{ title: "仪表盘", url: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "采购物流",
    items: [
      { title: "日本大宗", url: "/purchase/japan-bulk", icon: Plane },
      { title: "日本小包裹", url: "/purchase/japan-parcel", icon: Mail },
      { title: "国内渠道", url: "/purchase/domestic", icon: ShoppingBag },
      { title: "物流追踪", url: "/purchase/logistics", icon: Truck },
    ],
    icon: Package,
  },
  {
    label: "商品库存",
    items: [
      { title: "商品档案", url: "/inventory/products", icon: Tags },
      { title: "采购批次", url: "/inventory/batches", icon: Layers },
      { title: "库存调拨", url: "/inventory/transfers", icon: ArrowLeftRight },
    ],
    icon: Boxes,
  },
  {
    label: "门店加盟",
    items: [
      { title: "门店列表", url: "/stores/list", icon: Building2 },
      { title: "加盟商管理", url: "/stores/franchisees", icon: Users },
      { title: "有赞对接", url: "/stores/youzan", icon: Link2 },
    ],
    icon: Store,
  },
  {
    label: "运营",
    items: [
      { title: "知识库", url: "/knowledge", icon: BookOpen },
      { title: "系统设置", url: "/settings", icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (path: string) => currentPath === path || currentPath.startsWith(path + "/");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-sm">
            BO
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold">BOOMER OFF</span>
            <span className="text-xs text-muted-foreground">品牌管理后台</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
