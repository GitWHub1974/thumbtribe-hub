import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS: allow Supabase-hosted frontend and localhost for development
const ALLOWED_ORIGINS = [
  Deno.env.get("SITE_URL") || "",
  "http://localhost:5173",
  "http://localhost:3000",
].filter(Boolean);

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    // Parse params
    const url = new URL(req.url);
    const projectId = url.searchParams.get("project_id");
    if (!projectId) {
      return new Response(JSON.stringify({ error: "project_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify access: admin or assigned client
    const { data: hasAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    const { data: hasClient } = await supabase.rpc("is_client_for_project", { _user_id: userId, _project_id: projectId });

    if (!hasAdmin && !hasClient) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get credentials using service role
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: creds, error: credsErr } = await serviceClient
      .from("jira_credentials")
      .select("*")
      .eq("project_id", projectId)
      .maybeSingle();

    if (credsErr || !creds) {
      return new Response(JSON.stringify({ error: "Jira credentials not configured for this project" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get project key
    const { data: project } = await serviceClient
      .from("projects")
      .select("jira_project_key")
      .eq("id", projectId)
      .single();

    const projectKey = project?.jira_project_key;
    if (!projectKey) {
      return new Response(JSON.stringify({ error: "No Jira project key configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { jira_base_url, jira_api_email, jira_api_token, start_date_field_id } = creds;
    const authString = btoa(`${jira_api_email}:${jira_api_token}`);
    const baseUrl = jira_base_url.replace(/\/+$/, "");

    // Fetch epics, stories, and tasks
    const jql = `project = "${projectKey}" AND issuetype in (Epic, Story, Task, Sub-task) ORDER BY issuetype ASC, key ASC`;
    const fields = `summary,status,issuetype,parent,duedate,${start_date_field_id},assignee`;

    let allIssues: any[] = [];
    let startAt = 0;
    const maxResults = 100;

    while (true) {
      const searchUrl = `${baseUrl}/rest/api/3/search?jql=${encodeURIComponent(jql)}&fields=${encodeURIComponent(fields)}&startAt=${startAt}&maxResults=${maxResults}`;

      const jiraRes = await fetch(searchUrl, {
        headers: {
          Authorization: `Basic ${authString}`,
          Accept: "application/json",
        },
      });

      if (!jiraRes.ok) {
        const errBody = await jiraRes.text();
        return new Response(JSON.stringify({ error: "Jira API error", details: errBody }), {
          status: jiraRes.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await jiraRes.json();
      allIssues = allIssues.concat(data.issues || []);

      if (startAt + maxResults >= data.total) break;
      startAt += maxResults;
    }

    // Transform to structured response
    const issues = allIssues.map((issue: any) => ({
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status?.name || "Unknown",
      statusCategory: issue.fields.status?.statusCategory?.key || "undefined",
      issueType: issue.fields.issuetype?.name || "Unknown",
      parentKey: issue.fields.parent?.key || null,
      startDate: issue.fields[start_date_field_id] || null,
      dueDate: issue.fields.duedate || null,
      assignee: issue.fields.assignee
        ? {
            displayName: issue.fields.assignee.displayName,
            emailAddress: issue.fields.assignee.emailAddress,
          }
        : null,
    }));

    return new Response(JSON.stringify({ issues }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
