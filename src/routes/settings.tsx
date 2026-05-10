import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "系统设置 · BOOMER OFF" }, { name: "description", content: "权限角色、数据字典与操作日志" }] }),
  component: SettingsPage,
});

function Placeholder({ title }: { title: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="border-2 border-dashed rounded-md py-16 text-center text-muted-foreground text-sm">
          即将推出
        </div>
      </CardContent>
    </Card>
  );
}

function SettingsPage() {
  return (
    <div>
      <PageHeader title="系统设置" description="角色权限、数据字典与系统日志管理" />
      <Tabs defaultValue="roles">
        <TabsList>
          <TabsTrigger value="roles">角色权限</TabsTrigger>
          <TabsTrigger value="dict">数据字典</TabsTrigger>
          <TabsTrigger value="logs">操作日志</TabsTrigger>
        </TabsList>
        <TabsContent value="roles" className="mt-4">
          <Placeholder title="角色与权限管理" />
        </TabsContent>
        <TabsContent value="dict" className="mt-4">
          <Placeholder title="数据字典维护" />
        </TabsContent>
        <TabsContent value="logs" className="mt-4">
          <Placeholder title="系统操作日志" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
