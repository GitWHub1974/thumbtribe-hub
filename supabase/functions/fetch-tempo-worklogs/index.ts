import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  

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

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    // Parse params
    const url = new URL(req.url);
    const projectId = url.searchParams.get("project_id");
    const from = url.searchParams.get("from"); // YYYY-MM-DD
    const to = url.searchParams.get("to"); // YYYY-MM-DD

    if (!projectId) {
      return new Response(JSON.stringify({ error: "project_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify access
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
      return new Response(JSON.stringify({ error: "Credentials not configured" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get project key for filtering
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

    const { tempo_api_token, jira_base_url, jira_api_email, jira_api_token } = creds;

    // First get Jira project ID from key
    const jiraAuthString = btoa(`${jira_api_email}:${jira_api_token}`);
    const jiraBaseUrl = jira_base_url.replace(/\/+$/, "");

    const projectRes = await fetch(`${jiraBaseUrl}/rest/api/3/project/${projectKey}`, {
      headers: {
        Authorization: `Basic ${jiraAuthString}`,
        Accept: "application/json",
      },
    });

    if (!projectRes.ok) {
      const errText = await projectRes.text();
      return new Response(JSON.stringify({ error: "Failed to fetch Jira project", details: errText }), {
        status: projectRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jiraProject = await projectRes.json();
    const jiraProjectKey = jiraProject.key;

    // Fetch worklogs from Tempo API v4
    const tempoBase = "https://api.tempo.io/4";
    let allWorklogs: any[] = [];
    let offset = 0;
    const limit = 1000;

    while (true) {
      let tempoUrl = `${tempoBase}/worklogs/project/${jiraProjectKey}?limit=${limit}&offset=${offset}`;
      if (from) tempoUrl += `&from=${from}`;
      if (to) tempoUrl += `&to=${to}`;

      const tempoRes = await fetch(tempoUrl, {
        headers: {
          Authorization: `Bearer ${tempo_api_token}`,
          Accept: "application/json",
        },
      });

      if (!tempoRes.ok) {
        const errText = await tempoRes.text();
        return new Response(JSON.stringify({ error: "Tempo API error", details: errText }), {
          status: tempoRes.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await tempoRes.json();
      const results = data.results || [];
      allWorklogs = allWorklogs.concat(results);

      if (!data.metadata?.next) break;
      offset += limit;
    }

    // Transform
    const worklogs = allWorklogs.map((w: any) => ({
      id: w.tempoWorklogId,
      issueKey: w.issue?.key || null,
      issueSummary: w.issue?.summary || null,
      date: w.startDate,
      timeSpentSeconds: w.timeSpentSeconds,
      timeSpentHours: Math.round((w.timeSpentSeconds / 3600) * 100) / 100,
      description: w.description || "",
      author: w.author
        ? {
            displayName: w.author.displayName,
            accountId: w.author.accountId,
          }
        : null,
    }));

    return new Response(JSON.stringify({ worklogs }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
