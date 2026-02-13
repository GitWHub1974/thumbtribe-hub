import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function isValidJiraUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const hostname = parsed.hostname.toLowerCase();
    // Block private/internal IPs
    if (
      hostname === "localhost" ||
      hostname.startsWith("127.") ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.16.") ||
      hostname.startsWith("172.17.") ||
      hostname.startsWith("172.18.") ||
      hostname.startsWith("172.19.") ||
      hostname.startsWith("172.2") ||
      hostname.startsWith("172.30.") ||
      hostname.startsWith("172.31.") ||
      hostname.match(/^169\.254\./) ||
      hostname === "[::1]" ||
      hostname === "0.0.0.0"
    ) return false;
    // Must be an Atlassian domain
    if (!hostname.endsWith(".atlassian.net")) return false;
    return true;
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { jira_base_url, jira_api_email, jira_api_token, tempo_api_token } = await req.json();

    // Validate required fields
    if (!jira_base_url || typeof jira_base_url !== "string" ||
        !jira_api_email || typeof jira_api_email !== "string" ||
        !jira_api_token || typeof jira_api_token !== "string") {
      return new Response(JSON.stringify({ error: "Missing or invalid Jira credentials" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate URL to prevent SSRF
    if (!isValidJiraUrl(jira_base_url)) {
      return new Response(JSON.stringify({ error: "Invalid Jira URL. Must be HTTPS and end with .atlassian.net" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate field lengths
    if (jira_api_email.length > 255 || jira_api_token.length > 500 || jira_base_url.length > 500) {
      return new Response(JSON.stringify({ error: "Input fields exceed maximum length" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = jira_base_url.replace(/\/+$/, "");
    const jiraAuth = btoa(`${jira_api_email}:${jira_api_token}`);

    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let jiraRes: Response;
    try {
      jiraRes = await fetch(`${baseUrl}/rest/api/3/myself`, {
        headers: { Authorization: `Basic ${jiraAuth}`, Accept: "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      const msg = (fetchErr as Error).name === "AbortError" ? "Request timed out" : "Failed to connect to Jira";
      return new Response(JSON.stringify({ error: msg }), {
        status: 408, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!jiraRes.ok) {
      return new Response(JSON.stringify({ error: `Jira connection failed (${jiraRes.status})` }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jiraUser = await jiraRes.json();
    const result: any = { jira_ok: true, jira_user: jiraUser.displayName };

    if (tempo_api_token && typeof tempo_api_token === "string" && tempo_api_token.length <= 500) {
      const tempoController = new AbortController();
      const tempoTimeoutId = setTimeout(() => tempoController.abort(), 10000);
      try {
        const tempoRes = await fetch("https://api.tempo.io/4/accounts", {
          headers: { Authorization: `Bearer ${tempo_api_token}`, Accept: "application/json" },
          signal: tempoController.signal,
        });
        clearTimeout(tempoTimeoutId);
        result.tempo_ok = tempoRes.ok;
        if (!tempoRes.ok) result.tempo_status = tempoRes.status;
      } catch {
        clearTimeout(tempoTimeoutId);
        result.tempo_ok = false;
        result.tempo_error = "Request timed out or failed";
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
