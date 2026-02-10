import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderKanban, Users, Settings } from "lucide-react";

const AdminOverview = () => {
  const { data: projects } = useQuery({
    queryKey: ["admin-projects-count"],
    queryFn: async () => {
      const { count } = await supabase.from("projects").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["admin-clients-count"],
    queryFn: async () => {
      const { count } = await supabase.from("profiles").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: credentials } = useQuery({
    queryKey: ["admin-credentials-count"],
    queryFn: async () => {
      const { count } = await supabase.from("jira_credentials").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const stats = [
    { label: "Projects", value: projects ?? 0, icon: FolderKanban },
    { label: "Users", value: clients ?? 0, icon: Users },
    { label: "Jira Connections", value: credentials ?? 0, icon: Settings },
  ];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-heading font-bold text-foreground mb-6">Admin Overview</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <s.icon className="w-5 h-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-heading font-bold text-foreground">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminOverview;
