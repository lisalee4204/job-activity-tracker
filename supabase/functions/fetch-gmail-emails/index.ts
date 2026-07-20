import { getCorsHeaders } from '../_shared/cors.ts';

interface MessagePart {
  mimeType: string;
  body: { data?: string };
  parts?: MessagePart[];
}

interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  internalDate?: string;
  payload?: {
    mimeType?: string;
    headers: Array<{ name: string; value: string }>;
    parts?: MessagePart[];
    body?: { data?: string };
  };
}

function decodeBase64Url(data: string): string {
  return atob(data.replace(/-/g, '+').replace(/_/g, '/'));
}

function extractEmailBody(parts: MessagePart[]): string {
  for (const part of parts) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      return decodeBase64Url(part.body.data);
    }
  }

  for (const part of parts) {
    if (part.mimeType?.startsWith('multipart/') && part.parts?.length) {
      const nested = extractEmailBody(part.parts);
      if (nested) return nested;
    }
  }

  for (const part of parts) {
    if (part.mimeType === 'text/html' && part.body?.data) {
      return decodeBase64Url(part.body.data);
    }
  }

  return '';
}

async function refreshGmailToken(
  supabaseUrl: string,
  supabaseServiceKey: string,
  userId: string
): Promise<string | null> {
  const clientId = Deno.env.get('GMAIL_CLIENT_ID');
  const clientSecret = Deno.env.get('GMAIL_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    console.error('Gmail credentials not configured for token refresh');
    return null;
  }

  const tokenRes = await fetch(
    `${supabaseUrl}/rest/v1/gmail_tokens?user_id=eq.${userId}&select=refresh_token`,
    {
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey,
      },
    }
  );

  if (!tokenRes.ok) {
    console.error('Failed to look up refresh token');
    return null;
  }

  const [tokenRow] = await tokenRes.json();
  if (!tokenRow?.refresh_token) {
    console.error('No refresh token available');
    return null;
  }

  const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: tokenRow.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  if (!refreshRes.ok) {
    console.error('Token refresh failed:', await refreshRes.text());
    return null;
  }

  const tokens = await refreshRes.json();
  const newAccessToken = tokens.access_token;
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  await fetch(
    `${supabaseUrl}/rest/v1/gmail_tokens?user_id=eq.${userId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey,
      },
      body: JSON.stringify({ access_token: newAccessToken, expires_at: expiresAt }),
    }
  );

  console.log('Access token refreshed successfully');
  return newAccessToken;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { accessToken, daysAgo = 7 } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || supabaseServiceKey;

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

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'Access token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching emails from Gmail...');

    const keywords = [
      'thank you for applying',
      'thanks for applying',
      'application received',
      'received your application',
      'we received your application',
      'confirm your application',
      'application confirmation',
      'your application has been',
      'successfully applied',
      'application submitted',
    ];

    const keywordQuery = keywords.map(k => `"${k}"`).join(' OR ');
    const query = encodeURIComponent(`newer_than:${daysAgo}d (label:job-apps OR ${keywordQuery})`);

    let effectiveToken = accessToken;
    let messagesResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=50`,
      {
        headers: {
          'Authorization': `Bearer ${effectiveToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (messagesResponse.status === 401) {
      console.log('Access token expired, attempting refresh...');
      const refreshed = await refreshGmailToken(supabaseUrl, supabaseServiceKey, user.id);
      if (refreshed) {
        effectiveToken = refreshed;
        messagesResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=50`,
          {
            headers: {
              'Authorization': `Bearer ${effectiveToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
      }
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
              'Authorization': `Bearer ${effectiveToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!messageResponse.ok) {
          console.error(`Failed to fetch message ${msg.id}: ${messageResponse.status}`);
          continue;
        }

        const message: GmailMessage = await messageResponse.json();

        const dateHeader = message.payload?.headers?.find(
          (h) => h.name.toLowerCase() === 'date'
        )?.value;
        let emailDate: string;
        if (dateHeader) {
          const parsed = new Date(dateHeader);
          emailDate = isNaN(parsed.getTime())
            ? new Date(Number(message.internalDate)).toISOString().split('T')[0]
            : parsed.toISOString().split('T')[0];
        } else if (message.internalDate) {
          emailDate = new Date(Number(message.internalDate)).toISOString().split('T')[0];
        } else {
          emailDate = new Date().toISOString().split('T')[0];
        }

        let emailBody = '';

        if (message.payload?.parts?.length) {
          emailBody = extractEmailBody(message.payload.parts);
        } else if (message.payload?.body?.data) {
          emailBody = decodeBase64Url(message.payload.body.data);
        }

        if (!emailBody) {
          emailBody = message.snippet || '';
          console.warn(`Message ${msg.id}: falling back to snippet (no body extracted)`);
        }

        const parseResponse = await fetch(
          `${supabaseUrl}/functions/v1/parse-email`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authHeader,
              'apikey': supabaseAnonKey,
            },
            body: JSON.stringify({ emailContent: emailBody, emailDate }),
          }
        );

        if (!parseResponse.ok) {
          console.error(`Failed to parse email ${msg.id}: ${parseResponse.status}`);
          continue;
        }

        const parseResult = await parseResponse.json();

        if (parseResult.success && parseResult.data) {
          parseResult.data.date = emailDate;

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
                date: emailDate,
                company_name: parseResult.data.companyName,
                job_title: parseResult.data.jobTitle,
                activity_type: 'application',
                job_description_url: parseResult.data.jobDescriptionUrl,
              }),
            }
          );

          if (insertResponse.ok) {
            parsedActivities.push(parseResult.data);
          } else {
            console.error(`Failed to insert activity for message ${msg.id}: ${insertResponse.status}`);
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
