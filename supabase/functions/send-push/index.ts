// Supabase Edge Function: send-push
// Receives notification data (from webhook or direct call),
// fetches FCM tokens from user_stats, and sends push notifications via Firebase Cloud Messaging HTTP v1 API.
//
// Deploy: supabase functions deploy send-push --no-verify-jwt
// Secrets needed:
//   FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, FIREBASE_PROJECT_ID, SUPABASE_SERVICE_ROLE_KEY

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Firebase OAuth2 JWT ─────────────────────────────────────────
// Creates a short-lived access token using the service account private key
async function getFirebaseAccessToken(): Promise<string> {
  const clientEmail = Deno.env.get("FIREBASE_CLIENT_EMAIL")!;
  const privateKeyPem = Deno.env.get("FIREBASE_PRIVATE_KEY")!.replace(/\\n/g, "\n");

  const now = Math.floor(Date.now() / 1000);

  // JWT Header
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

  // JWT Payload
  const payload = btoa(JSON.stringify({
    iss: clientEmail,
    sub: clientEmail,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

  // Sign with RSA private key
  const keyData = privateKeyPem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const binaryKey = Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const encoder = new TextEncoder();
  const signatureBuffer = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    encoder.encode(`${header}.${payload}`)
  );

  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

  const jwt = `${header}.${payload}.${signature}`;

  // Exchange JWT for Google OAuth2 access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error(`Failed to get access token: ${JSON.stringify(tokenData)}`);
  }
  return tokenData.access_token;
}

// ── Main Handler ────────────────────────────────────────────────
serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    const body = await req.json();

    // Support both database webhook format ({ record: {...} }) and direct call
    const record = body.record || body;
    const { title, body: msgBody, target_user_id } = record;

    if (!title || !msgBody) {
      return new Response(
        JSON.stringify({ error: "Missing title or body" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Init Supabase with service role key (bypasses RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch FCM tokens from user_stats
    let query = supabase
      .from("user_stats")
      .select("user_id, fcm_token, name")
      .not("fcm_token", "is", null);

    if (target_user_id) {
      query = query.eq("user_id", target_user_id);
    }

    const { data: users, error: fetchErr } = await query;
    if (fetchErr) throw fetchErr;

    if (!users || users.length === 0) {
      return new Response(
        JSON.stringify({ message: "No FCM tokens found", sent: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get Firebase access token
    const accessToken = await getFirebaseAccessToken();
    const projectId = Deno.env.get("FIREBASE_PROJECT_ID")!;
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    // Send push to each user's device
    const results = await Promise.allSettled(
      users.map(async (u) => {
        const res = await fetch(fcmUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token: u.fcm_token,
              notification: {
                title: title,
                body: msgBody,
              },
              webpush: {
                notification: {
                  icon: "/al-mawaid.png",
                  badge: "/al-mawaid.png",
                  vibrate: [200, 100, 200],
                  requireInteraction: false,
                },
                fcm_options: {
                  link: "/",
                },
              },
            },
          }),
        });

        const resBody = await res.json();
        if (!res.ok) {
          console.error(`FCM send failed for ${u.user_id}:`, resBody);
          // If token is invalid/expired, clear it from the database
          if (resBody?.error?.code === 404 || resBody?.error?.details?.[0]?.errorCode === "UNREGISTERED") {
            await supabase.from("user_stats").update({ fcm_token: null }).eq("user_id", u.user_id);
            console.log(`Cleared stale FCM token for user ${u.user_id}`);
          }
        }
        return { user_id: u.user_id, status: res.status, ok: res.ok };
      })
    );

    const succeeded = results.filter((r) => r.status === "fulfilled" && r.value.ok).length;
    const failed = results.length - succeeded;

    return new Response(
      JSON.stringify({ sent: results.length, succeeded, failed, results }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-push error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
