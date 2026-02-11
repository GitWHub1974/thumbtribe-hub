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

    // If start_date_field_id doesn't look like a custom field ID, resolve it
    let startDateFieldId = start_date_field_id;
    if (startDateFieldId && !startDateFieldId.startsWith("customfield_")) {
      // Try to find the custom field by name
      const fieldsRes = await fetch(`${baseUrl}/rest/api/3/field`, {
        headers: { Authorization: `Basic ${authString}`, Accept: "application/json" },
      });
      if (fieldsRes.ok) {
        const fields = await fieldsRes.json();
        const match = fields.find((f: any) =>
          f.name.toLowerCase() === startDateFieldId.toLowerCase() ||
          f.id === startDateFieldId
        );
        if (match) {
          startDateFieldId = match.id;
        }
      }
    }

    // Fetch epics, stories, and tasks using new /search/jql endpoint
    const jql = `project = "${projectKey}" AND issuetype in (Epic, Story, Task, Sub-task) ORDER BY issuetype ASC, key ASC`;
    const requestFields = `summary,status,issuetype,parent,duedate,${startDateFieldId},assignee`;

    let allIssues: any[] = [];
    let startAt = 0;
    const maxResults = 100;

    while (true) {
      const searchUrl = `${baseUrl}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&fields=${encodeURIComponent(requestFields)}&startAt=${startAt}&maxResults=${maxResults}`;

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
      const issues = data.issues || [];
      allIssues = allIssues.concat(issues);

      // New API may not return 'total'; stop when fewer results than requested
      if (issues.length < maxResults) break;
      startAt += maxResults;
    }

    // Map Jira statusCategory keys to our expected values
    const statusCategoryMap: Record<string, string> = {
      "new": "todo",
      "undefined": "todo",
      "indeterminate": "in_progress",
      "done": "done",
    };

    // Transform to structured response
    const issues = allIssues.map((issue: any) => ({
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status?.name || "Unknown",
      statusCategory: statusCategoryMap[issue.fields.status?.statusCategory?.key || "undefined"] || "todo",
      issueType: issue.fields.issuetype?.name || "Unknown",
      parentKey: issue.fields.parent?.key || null,
      startDate: issue.fields[startDateFieldId] || null,
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
