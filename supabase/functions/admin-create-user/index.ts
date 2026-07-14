import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getDefaultKey(dictionaryName: string): string | null {
  const raw = Deno.env.get(dictionaryName);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return parsed.default ?? Object.values(parsed)[0] ?? null;
  } catch {
    return null;
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization) {
    return jsonResponse({ error: "Missing authenticated user token." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const browserKey =
    Deno.env.get("SUPABASE_ANON_KEY") ??
    getDefaultKey("SUPABASE_PUBLISHABLE_KEYS");
  const adminKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    getDefaultKey("SUPABASE_SECRET_KEYS");

  if (!supabaseUrl || !browserKey || !adminKey) {
    return jsonResponse(
      { error: "The Edge Function environment is not configured correctly." },
      500,
    );
  }

  const callerClient = createClient(supabaseUrl, browserKey, {
    global: {
      headers: {
        Authorization: authorization,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const adminClient = createClient(supabaseUrl, adminKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const {
    data: { user: caller },
    error: callerError,
  } = await callerClient.auth.getUser();

  if (callerError || !caller) {
    return jsonResponse({ error: "Your session is invalid or has expired." }, 401);
  }

  const { data: callerProfile, error: profileError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", caller.id)
    .maybeSingle();

  if (profileError) {
    return jsonResponse({ error: "Unable to verify the administrator role." }, 500);
  }

  if (callerProfile?.role !== "super_admin") {
    return jsonResponse({ error: "Super-admin access is required." }, 403);
  }

  let payload: {
    method?: string;
    full_name?: string;
    department?: string;
    email?: string;
    password?: string;
    redirect_to?: string;
  };

  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON request body." }, 400);
  }

  const method = payload.method === "create" ? "create" : "invite";
  const fullName = String(payload.full_name ?? "").trim();
  const department = String(payload.department ?? "").trim();
  const email = String(payload.email ?? "").trim().toLowerCase();
  const password = String(payload.password ?? "");
  const redirectTo = String(payload.redirect_to ?? "").trim();

  if (!fullName || !department || !email) {
    return jsonResponse(
      { error: "Full name, department and email are required." },
      400,
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ error: "Enter a valid email address." }, 400);
  }

  if (method === "create" && password.length < 8) {
    return jsonResponse(
      { error: "The temporary password must contain at least 8 characters." },
      400,
    );
  }

  const userMetadata = {
    full_name: fullName,
    department,
  };

  let createdUserId: string | undefined;
  let resultMessage = "";

  if (method === "create") {
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: userMetadata,
    });

    if (error || !data.user) {
      return jsonResponse(
        { error: error?.message ?? "Unable to create the user account." },
        400,
      );
    }

    createdUserId = data.user.id;
    resultMessage =
      "Active normal-user account created. Share the temporary password securely.";
  } else {
    const inviteOptions: {
      data: Record<string, string>;
      redirectTo?: string;
    } = {
      data: userMetadata,
    };

    if (redirectTo) inviteOptions.redirectTo = redirectTo;

    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(
      email,
      inviteOptions,
    );

    if (error || !data.user) {
      return jsonResponse(
        { error: error?.message ?? "Unable to send the invitation." },
        400,
      );
    }

    createdUserId = data.user.id;
    resultMessage = "Invitation sent. The new account will have Normal User access.";
  }

  const { error: upsertError } = await adminClient.from("profiles").upsert(
    {
      id: createdUserId,
      email,
      full_name: fullName,
      department,
      role: "normal_user",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (upsertError) {
    if (createdUserId) {
      await adminClient.auth.admin.deleteUser(createdUserId);
    }

    return jsonResponse(
      {
        error:
          "The Auth user was created, but its application profile could not be saved. The Auth user was rolled back.",
      },
      500,
    );
  }

  return jsonResponse({
    ok: true,
    user_id: createdUserId,
    method,
    role: "normal_user",
    message: resultMessage,
  });
});
