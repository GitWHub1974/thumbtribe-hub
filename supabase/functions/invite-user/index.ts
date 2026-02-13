import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_ROLES = ["admin", "client"];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify the caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user: caller }, error: authError } = await anonClient.auth.getUser();
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is admin
    const { data: roleData } = await anonClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { email, full_name, role, project_ids } = body;

    // Validate email
    if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email.trim()) || email.trim().length > 255) {
      return new Response(JSON.stringify({ error: "A valid email address is required (max 255 characters)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate full_name
    if (full_name !== undefined && (typeof full_name !== "string" || full_name.length > 255)) {
      return new Response(JSON.stringify({ error: "Full name must be a string with max 255 characters" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate role
    if (role && !VALID_ROLES.includes(role)) {
      return new Response(JSON.stringify({ error: "Role must be 'admin' or 'client'" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate project_ids
    if (project_ids !== undefined) {
      if (!Array.isArray(project_ids) || project_ids.length > 50) {
        return new Response(JSON.stringify({ error: "project_ids must be an array with max 50 items" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      for (const pid of project_ids) {
        if (typeof pid !== "string" || !UUID_REGEX.test(pid)) {
          return new Response(JSON.stringify({ error: "Each project_id must be a valid UUID" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    const sanitizedEmail = email.trim().toLowerCase();
    const sanitizedName = (full_name || "").trim().slice(0, 255);

    // Use service role to create the user (inviteUserByEmail sends a magic link)
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Build redirect URL – the invite email link will land the user on /auth
    const siteUrl = Deno.env.get("SITE_URL") || req.headers.get("origin") || "";
    const redirectTo = siteUrl ? `${siteUrl}/auth` : undefined;

    // Generate a magic link for the invitation
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: sanitizedEmail,
      options: {
        ...(redirectTo ? { redirectTo } : {}),
      },
    });

    if (linkError) {
      return new Response(JSON.stringify({ error: "Failed to generate invitation link" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try to create the user; if they already exist, look up their ID instead
    let newUserId: string;
    const { data: userData, error: userError } = await adminClient.auth.admin.createUser({
      email: sanitizedEmail,
      user_metadata: { full_name: sanitizedName },
      autoconfirm: false,
    });

    if (userError) {
      // If user already exists, find them by email
      const { data: listData, error: listError } = await adminClient.auth.admin.listUsers();
      const existingUser = listData?.users?.find((u) => u.email === sanitizedEmail);
      if (!existingUser) {
        return new Response(JSON.stringify({ error: "Failed to create or find user" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      newUserId = existingUser.id;
    } else {
      newUserId = userData.user.id;
    }

    const magicLink = linkData.properties?.action_link || "";

    // Send invitation email via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Thumbtribe <info@client.thumbtribe.biz>",
        to: sanitizedEmail,
        subject: "You're invited to Thumbtribe",
        template: {
          id: "thumbtribe-dashboard-invite",
          variables: {
            name: sanitizedName || "there",
            invite_link: magicLink,
          },
        },
      }),
    });

    if (!emailResponse.ok) {
      const resendError = await emailResponse.json();
      console.error("Resend error:", resendError);
      return new Response(JSON.stringify({ error: "Failed to send invitation email" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Assign role
    if (role) {
      const { error: roleError } = await adminClient
        .from("user_roles")
        .insert({ user_id: newUserId, role });
      if (roleError) console.error("Role insert error:", roleError.message);
    }

    // Assign to projects (validate existence first)
    if (project_ids && Array.isArray(project_ids) && project_ids.length > 0) {
      const { data: existingProjects } = await adminClient
        .from("projects")
        .select("id")
        .in("id", project_ids);

      const validIds = new Set((existingProjects || []).map((p) => p.id));
      const assignments = project_ids
        .filter((pid: string) => validIds.has(pid))
        .map((pid: string) => ({
          client_id: newUserId,
          project_id: pid,
        }));

      if (assignments.length > 0) {
        const { error: assignError } = await adminClient
          .from("client_projects")
          .insert(assignments);
        if (assignError) console.error("Assignment error:", assignError.message);
      }
    }

    return new Response(JSON.stringify({ success: true, user_id: newUserId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
