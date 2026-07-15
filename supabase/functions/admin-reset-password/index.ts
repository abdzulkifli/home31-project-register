import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const respond = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });

Deno.serve(async request => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return respond({ error: "Method not allowed." }, 405);
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization) return respond({ error: "Missing authorization token." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return respond({ error: "Function environment is incomplete." }, 500);
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: { user: caller } } = await callerClient.auth.getUser();
  if (!caller) return respond({ error: "Invalid session." }, 401);

  const { data: profile } = await adminClient
    .from("profiles")
    .select("role, account_status")
    .eq("id", caller.id)
    .maybeSingle();

  if (profile?.role !== "super_admin" || profile?.account_status !== "active") {
    return respond({ error: "Super-admin access required." }, 403);
  }

  const payload = await request.json();
  const targetUserId = String(payload.user_id ?? "");
  const temporaryPassword = String(payload.password ?? "");

  if (!targetUserId || temporaryPassword.length < 10) {
    return respond({ error: "User ID and a temporary password of at least 10 characters are required." }, 400);
  }

  const { error: updateError } = await adminClient.auth.admin.updateUserById(
    targetUserId,
    { password: temporaryPassword }
  );

  if (updateError) return respond({ error: updateError.message }, 400);

  await adminClient.from("profiles").update({
    must_change_password: true,
    password_changed_at: null,
    updated_at: new Date().toISOString()
  }).eq("id", targetUserId);

  return respond({
    ok: true,
    message: "Temporary password assigned. The user must change it at next login."
  });
});
