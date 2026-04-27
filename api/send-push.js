// api/send-push.js — Vercel Serverless Function
// Receives webhook from Supabase when a new notice is inserted,
// fetches FCM tokens from user_stats, and sends push via Firebase Cloud Messaging.
//
// No extra packages needed — uses built-in Node.js crypto + existing @supabase/supabase-js

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// ── Firebase OAuth2 Access Token via JWT ────────────────────────
async function getFirebaseAccessToken() {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

  const now = Math.floor(Date.now() / 1000);

  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: clientEmail,
    sub: clientEmail,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
  })).toString('base64url');

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(`${header}.${payload}`);
  const signature = sign.sign(privateKey, 'base64url');

  const jwt = `${header}.${payload}.${signature}`;

  // Exchange JWT for Google OAuth2 access token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error('Failed to get Firebase access token: ' + JSON.stringify(tokenData));
  }
  return tokenData.access_token;
}

// ── Main Handler ────────────────────────────────────────────────
export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Simple webhook secret check (optional but recommended)
  const webhookSecret = process.env.WEBHOOK_SECRET;
  if (webhookSecret) {
    const authHeader = req.headers['x-webhook-secret'] || req.headers['authorization'];
    if (authHeader !== webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    const body = req.body;

    // Support both Supabase webhook format ({ record: {...} }) and direct call
    const record = body.record || body;
    const { title, body: msgBody, target_user_id } = record;

    if (!title || !msgBody) {
      return res.status(400).json({ error: 'Missing title or body' });
    }

    // Init Supabase with service role key (bypasses RLS)
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Fetch FCM tokens from user_stats
    let query = supabase
      .from('user_stats')
      .select('user_id, fcm_token, name')
      .not('fcm_token', 'is', null);

    if (target_user_id) {
      query = query.eq('user_id', target_user_id);
    }

    const { data: users, error: fetchErr } = await query;
    if (fetchErr) throw fetchErr;

    if (!users || users.length === 0) {
      return res.status(200).json({ message: 'No FCM tokens found', sent: 0 });
    }

    // Get Firebase access token
    const accessToken = await getFirebaseAccessToken();
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    // Send push to each user's device
    const results = await Promise.allSettled(
      users.map(async (u) => {
        const fcmRes = await fetch(fcmUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token: u.fcm_token,
              notification: { title, body: msgBody },
              webpush: {
                notification: {
                  icon: '/al-mawaid.png',
                  badge: '/al-mawaid.png',
                  vibrate: [200, 100, 200],
                },
                fcm_options: { link: '/' },
              },
            },
          }),
        });

        const fcmBody = await fcmRes.json();

        // If token is invalid/expired, clear it from the database
        if (!fcmRes.ok) {
          console.error(`FCM failed for ${u.user_id}:`, fcmBody);
          const errorCode = fcmBody?.error?.details?.[0]?.errorCode;
          if (fcmRes.status === 404 || errorCode === 'UNREGISTERED') {
            await supabase.from('user_stats').update({ fcm_token: null }).eq('user_id', u.user_id);
            console.log(`Cleared stale token for user ${u.user_id}`);
          }
        }

        return { user_id: u.user_id, status: fcmRes.status, ok: fcmRes.ok };
      })
    );

    const succeeded = results.filter(r => r.status === 'fulfilled' && r.value?.ok).length;

    return res.status(200).json({
      sent: results.length,
      succeeded,
      failed: results.length - succeeded,
    });
  } catch (err) {
    console.error('send-push error:', err);
    return res.status(500).json({ error: err.message });
  }
}
