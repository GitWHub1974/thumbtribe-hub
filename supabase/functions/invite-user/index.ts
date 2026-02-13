import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    const { email, full_name, role, project_ids } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      email,
      options: {
        ...(redirectTo ? { redirectTo } : {}),
      },
    });

    if (linkError) {
      return new Response(JSON.stringify({ error: linkError.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create the user manually since we're generating our own link
    const { data: userData, error: userError } = await adminClient.auth.admin.createUser({
      email,
      user_metadata: { full_name: full_name || "" },
      autoconfirm: false,
    });

    if (userError) {
      return new Response(JSON.stringify({ error: userError.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newUserId = userData.user.id;
    const magicLink = linkData.properties?.action_link || "";

    // Send invitation email via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "Resend API key not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #5b21b6 0%, #7c3aed 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { color: white; margin: 0; font-size: 24px; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
            .footer { text-align: center; padding-top: 20px; font-size: 12px; color: #666; }
            .greeting { font-size: 16px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Thumbtribe</h1>
            </div>
            <div class="content">
              <div class="greeting">Hello${full_name ? " " + full_name : ""},</div>
              <p>You've been invited to join Thumbtribe. Click the button below to set up your account:</p>
              <a href="${magicLink}" class="button">Accept Invitation</a>
              <p style="color: #666; font-size: 14px; margin-top: 20px;">Or copy this link if the button doesn't work:<br><code style="background: #e5e7eb; padding: 4px 8px; border-radius: 4px; word-break: break-all;">${magicLink}</code></p>
              <p style="color: #999; font-size: 12px; margin-top: 30px;">This invitation link will expire in 24 hours.</p>
            </div>
            <div class="footer">
              <p>&copy; Thumbtribe. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Thumbtribe <info@client.thumbtribe.biz>",
        to: email,
        subject: "You're invited to Thumbtribe",
        html: emailHtml,
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

    // Assign to projects
    if (project_ids && Array.isArray(project_ids) && project_ids.length > 0) {
      const assignments = project_ids.map((pid: string) => ({
        client_id: newUserId,
        project_id: pid,
      }));
      const { error: assignError } = await adminClient
        .from("client_projects")
        .insert(assignments);
      if (assignError) console.error("Assignment error:", assignError.message);
    }

    return new Response(JSON.stringify({ success: true, user_id: newUserId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
