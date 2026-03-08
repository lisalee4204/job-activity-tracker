import { getCorsHeaders } from '../_shared/cors.ts';

interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  payload?: {
    headers: Array<{ name: string; value: string }>;
    parts?: Array<{
      mimeType: string;
      body: { data?: string };
    }>;
    body?: { data?: string };
  };
}

async function refreshAccessToken(
  supabaseUrl: string,
  supabaseServiceKey: string,
  userId: string,
  refreshToken: string
): Promise<string> {
  const clientId = Deno.env.get('GMAIL_CLIENT_ID');
  const clientSecret = Deno.env.get('GMAIL_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error('Gmail credentials not configured — cannot refresh token');
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error('Token refresh failed:', errorText);
    throw new Error('Gmail token expired — please reconnect your Gmail account');
  }

  const tokens = await tokenResponse.json();
  const newAccessToken: string = tokens.access_token;
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  // Persist new access token to DB
  await fetch(`${supabaseUrl}/rest/v1/gmail_tokens?user_id=eq.${userId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'apikey': supabaseServiceKey,
    },
    body: JSON.stringify({ access_token: newAccessToken, expires_at: expiresAt }),
  });

  return newAccessToken;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { accessToken: initialAccessToken, daysAgo = 7 } = await req.json();

    if (!initialAccessToken) {
      return new Response(
        JSON.stringify({ error: 'Access token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');

    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': supabaseServiceKey,
      },
    });

    if (!userResponse.ok) {
      throw new Error('Failed to verify user');
    }

    const user = await userResponse.json();

    console.log('Fetching emails from Gmail...');

    const keywords = [
      'thank you for applying',
      'thanks for applying',
      'application received',
      'received your application',
      'we received your application',
      'confirm your application',
      'application confirmation'
    ];

    const keywordQuery = keywords.map(k => `"${k}"`).join(' OR ');
    const query = encodeURIComponent(`newer_than:${daysAgo}d (${keywordQuery})`);

    // Attempt Gmail search, refresh token on 401
    let accessToken = initialAccessToken;
    let messagesResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=50`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (messagesResponse.status === 401) {
      console.log('Access token expired, attempting refresh...');

      // Fetch refresh token from DB
      const tokenRow = await fetch(
        `${supabaseUrl}/rest/v1/gmail_tokens?user_id=eq.${user.id}&select=refresh_token`,
        {
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'apikey': supabaseServiceKey,
          },
        }
      );

      if (!tokenRow.ok) {
        throw new Error('Gmail token expired — please reconnect your Gmail account');
      }

      const tokenData = await tokenRow.json();
      const refreshToken = tokenData?.[0]?.refresh_token;
      if (!refreshToken) {
        throw new Error('No refresh token available — please reconnect your Gmail account');
      }

      accessToken = await refreshAccessToken(supabaseUrl, supabaseServiceKey, user.id, refreshToken);

      // Retry with new token
      messagesResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=50`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    if (!messagesResponse.ok) {
      const errorText = await messagesResponse.text();
      console.error('Failed to fetch messages:', errorText);
      throw new Error(`Failed to fetch messages: ${messagesResponse.status}`);
    }

    const messagesData = await messagesResponse.json();
    const messageIds = messagesData.messages || [];

    console.log(`Found ${messageIds.length} messages`);

    const parsedActivities = [];

    for (const msg of messageIds.slice(0, 10)) {
      try {
        const messageResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!messageResponse.ok) continue;

        const message: GmailMessage = await messageResponse.json();

        let emailBody = message.snippet || '';

        if (message.payload?.parts) {
          const textPart = message.payload.parts.find(part =>
            part.mimeType === 'text/plain' || part.mimeType === 'text/html'
          );
          if (textPart?.body?.data) {
            emailBody = atob(textPart.body.data.replace(/-/g, '+').replace(/_/g, '/'));
          }
        } else if (message.payload?.body?.data) {
          emailBody = atob(message.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        }

        const parseResponse = await fetch(
          `${supabaseUrl}/functions/v1/parse-email`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authHeader,
            },
            body: JSON.stringify({ emailContent: emailBody }),
          }
        );

        if (!parseResponse.ok) {
          console.error(`Failed to parse email ${msg.id}`);
          continue;
        }

        const parseResult = await parseResponse.json();

        if (parseResult.success && parseResult.data) {
          const insertResponse = await fetch(
            `${supabaseUrl}/rest/v1/job_search_activities`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'apikey': supabaseServiceKey,
                'Prefer': 'return=minimal',
              },
              body: JSON.stringify({
                user_id: user.id,
                date: parseResult.data.date,
                company_name: parseResult.data.companyName,
                job_title: parseResult.data.jobTitle,
                activity_type: 'application',
                job_description_url: parseResult.data.jobDescriptionUrl,
              }),
            }
          );

          if (insertResponse.ok) {
            parsedActivities.push(parseResult.data);
          }
        }
      } catch (error) {
        console.error(`Error processing message ${msg.id}:`, error);
      }
    }

    console.log(`Successfully parsed ${parsedActivities.length} activities`);

    return new Response(
      JSON.stringify({
        success: true,
        count: parsedActivities.length,
        activities: parsedActivities,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching Gmail emails:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch emails';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
