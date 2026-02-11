import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { jira_base_url, jira_api_email, jira_api_token, tempo_api_token } = await req.json();

    if (!jira_base_url || !jira_api_email || !jira_api_token) {
      return new Response(JSON.stringify({ error: "Missing Jira credentials" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = jira_base_url.replace(/\/+$/, "");
    const jiraAuth = btoa(`${jira_api_email}:${jira_api_token}`);

    const jiraRes = await fetch(`${baseUrl}/rest/api/3/myself`, {
      headers: { Authorization: `Basic ${jiraAuth}`, Accept: "application/json" },
    });

    if (!jiraRes.ok) {
      const text = await jiraRes.text();
      return new Response(JSON.stringify({ error: `Jira failed (${jiraRes.status}): ${text}` }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jiraUser = await jiraRes.json();
    const result: any = { jira_ok: true, jira_user: jiraUser.displayName };

    if (tempo_api_token) {
      const tempoRes = await fetch("https://api.tempo.io/4/accounts", {
        headers: { Authorization: `Bearer ${tempo_api_token}`, Accept: "application/json" },
      });
      result.tempo_ok = tempoRes.ok;
      if (!tempoRes.ok) result.tempo_status = tempoRes.status;
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
