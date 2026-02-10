import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Save } from "lucide-react";

const JiraSettings = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedProject, setSelectedProject] = useState("");

  const { data: projects } = useQuery({
    queryKey: ["admin-projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: creds, isLoading } = useQuery({
    queryKey: ["jira-creds", selectedProject],
    enabled: !!selectedProject,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jira_credentials")
        .select("*")
        .eq("project_id", selectedProject)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState({
    jira_base_url: "",
    jira_api_email: "",
    jira_api_token: "",
    tempo_api_token: "",
    start_date_field_id: "customfield_10015",
  });

  // Sync form when creds load
  const currentCredsId = creds?.id;
  useState(() => {});
  // Use effect-like pattern via key
  const formKey = `${selectedProject}-${currentCredsId}`;

  const resetForm = () => {
    if (creds) {
      setForm({
        jira_base_url: creds.jira_base_url,
        jira_api_email: creds.jira_api_email,
        jira_api_token: creds.jira_api_token,
        tempo_api_token: creds.tempo_api_token,
        start_date_field_id: creds.start_date_field_id,
      });
    } else {
      setForm({
        jira_base_url: "",
        jira_api_email: "",
        jira_api_token: "",
        tempo_api_token: "",
        start_date_field_id: "customfield_10015",
      });
    }
  };

  // Reset form when creds change
  const [prevKey, setPrevKey] = useState("");
  if (formKey !== prevKey && !isLoading) {
    setPrevKey(formKey);
    if (creds) {
      setForm({
        jira_base_url: creds.jira_base_url,
        jira_api_email: creds.jira_api_email,
        jira_api_token: creds.jira_api_token,
        tempo_api_token: creds.tempo_api_token,
        start_date_field_id: creds.start_date_field_id,
      });
    } else {
      setForm({
        jira_base_url: "",
        jira_api_email: "",
        jira_api_token: "",
        tempo_api_token: "",
        start_date_field_id: "customfield_10015",
      });
    }
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (creds) {
        const { error } = await supabase.from("jira_credentials").update(form).eq("id", creds.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("jira_credentials").insert({ ...form, project_id: selectedProject });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jira-creds", selectedProject] });
      toast({ title: "Credentials saved" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-heading font-bold text-foreground mb-6">Jira & Tempo Settings</h1>

      <div className="mb-6 max-w-xs">
        <Label>Select Project</Label>
        <Select value={selectedProject} onValueChange={setSelectedProject}>
          <SelectTrigger><SelectValue placeholder="Choose a project" /></SelectTrigger>
          <SelectContent>
            {projects?.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedProject && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="text-lg">API Credentials</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveMutation.mutate();
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>Jira Base URL</Label>
                <Input
                  value={form.jira_base_url}
                  onChange={(e) => setForm({ ...form, jira_base_url: e.target.value })}
                  placeholder="https://your-domain.atlassian.net"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>API Email</Label>
                  <Input
                    value={form.jira_api_email}
                    onChange={(e) => setForm({ ...form, jira_api_email: e.target.value })}
                    placeholder="you@company.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>API Token</Label>
                  <Input
                    type="password"
                    value={form.jira_api_token}
                    onChange={(e) => setForm({ ...form, jira_api_token: e.target.value })}
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tempo API Token</Label>
                <Input
                  type="password"
                  value={form.tempo_api_token}
                  onChange={(e) => setForm({ ...form, tempo_api_token: e.target.value })}
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-2">
                <Label>Start Date Custom Field ID</Label>
                <Input
                  value={form.start_date_field_id}
                  onChange={(e) => setForm({ ...form, start_date_field_id: e.target.value })}
                  placeholder="customfield_10015"
                />
                <p className="text-xs text-muted-foreground">The Jira custom field ID for the start date of issues.</p>
              </div>
              <Button type="submit" disabled={saveMutation.isPending}>
                <Save className="w-4 h-4 mr-2" />
                {saveMutation.isPending ? "Saving..." : "Save Credentials"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default JiraSettings;
