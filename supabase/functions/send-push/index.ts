// supabase/functions/send-push/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.6";

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
    const record = body.record || body; // Support webhook format
    const { title, body: msgBody, target_user_id } = record;

    if (!title || !msgBody) {
      return new Response(JSON.stringify({ error: "Missing title or body" }), { status: 400 });
    }

    // Init Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Setup Web Push
    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const privateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
    webpush.setVapidDetails("mailto:admin@almawaid.com", publicKey, privateKey);

    // Fetch Subscriptions
    let query = supabase.from("push_subscriptions").select("user_id, subscription");
    if (target_user_id) {
      query = query.eq("user_id", target_user_id);
    }

    const { data: subs, error: fetchErr } = await query;
    if (fetchErr) throw fetchErr;

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ message: "No subscriptions found", sent: 0 }), { status: 200 });
    }

    // Send notifications
    const results = await Promise.allSettled(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            s.subscription,
            JSON.stringify({ title, body: msgBody, url: "/" })
          );
          return { ok: true, user_id: s.user_id };
        } catch (err) {
          console.error(`Failed for ${s.user_id}:`, err);
          // Clean up expired subscriptions
          if (err.statusCode === 404 || err.statusCode === 410) {
            await supabase.from("push_subscriptions").delete().eq("subscription", s.subscription);
          }
          return { ok: false, user_id: s.user_id };
        }
      })
    );

    const succeeded = results.filter((r) => r.status === "fulfilled" && r.value.ok).length;

    return new Response(
      JSON.stringify({ total: subs.length, succeeded, failed: subs.length - succeeded }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
