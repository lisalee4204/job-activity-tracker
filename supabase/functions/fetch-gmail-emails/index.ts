import { getCorsHeaders } from '../_shared/cors.ts';
import { encryptToken, decryptToken } from '../_shared/tokenCrypto.ts';

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

interface StoredGmailToken {
  access_token: string;
  refresh_token: string | null;
  expires_at: string;
}

type TokenRefreshResult =
  | { ok: true; accessToken: string }
  | { ok: false; status: number; error: string; code: string; reauthRequired?: boolean };

function jsonResponse(
  payload: Record<string, unknown>,
  status: number,
  corsHeaders: Record<string, string>
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function sanitizeGoogleClientId(clientId: string | undefined): string | undefined {
  return clientId?.trim().replace(/\/+$/, '');
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
  userId: string,
  refreshToken: string | null
): Promise<TokenRefreshResult> {
  const clientId = sanitizeGoogleClientId(Deno.env.get('GMAIL_CLIENT_ID'));
  const clientSecret = Deno.env.get('GMAIL_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    console.error('Gmail credentials not configured for token refresh');
    return {
      ok: false,
      status: 500,
      error: 'Gmail connection is not configured correctly.',
      code: 'GMAIL_CONFIG_MISSING',
    };
  }

  if (!refreshToken) {
    console.error('No refresh token available');
    return {
      ok: false,
      status: 401,
      error: 'Gmail session expired. Please disconnect and reconnect your Gmail account.',
      code: 'GMAIL_REAUTH_REQUIRED',
      reauthRequired: true,
    };
  }

  const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  const refreshText = await refreshRes.text();

  if (!refreshRes.ok) {
    console.error(`Token refresh failed [${refreshRes.status}]:`, refreshText);
    const invalidGrant = refreshText.includes('invalid_grant');
    if (invalidGrant) {
      await deleteStoredGmailToken(supabaseUrl, supabaseServiceKey, userId);
    }

    return {
      ok: false,
      status: invalidGrant ? 401 : 502,
      error: invalidGrant
        ? 'Gmail authorization expired or was revoked. Please reconnect Gmail.'
        : 'Could not refresh Gmail authorization. Please try again.',
      code: invalidGrant ? 'GMAIL_REAUTH_REQUIRED' : 'GMAIL_REFRESH_FAILED',
      reauthRequired: invalidGrant,
    };
  }

  const tokens = JSON.parse(refreshText);
  const newAccessToken = tokens.access_token;
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  if (!newAccessToken || !tokens.expires_in) {
    console.error('Token refresh response did not include an access token');
    return {
      ok: false,
      status: 502,
      error: 'Gmail returned an invalid refresh response. Please reconnect Gmail.',
      code: 'GMAIL_REFRESH_INVALID',
    };
  }

  const updateBody: Record<string, string> = {
    access_token: await encryptToken(newAccessToken),
    expires_at: expiresAt,
  };

  if (tokens.refresh_token) {
    updateBody.refresh_token = await encryptToken(tokens.refresh_token);
  }

  const updateRes = await fetch(
    `${supabaseUrl}/rest/v1/gmail_tokens?user_id=eq.${userId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey,
      },
      body: JSON.stringify(updateBody),
    }
  );

  const updateText = await updateRes.text();
  if (!updateRes.ok) {
    console.error(`Failed to store refreshed Gmail token [${updateRes.status}]:`, updateText);
    return {
      ok: false,
      status: 500,
      error: 'Could not save refreshed Gmail authorization. Please try again.',
      code: 'GMAIL_REFRESH_SAVE_FAILED',
    };
  }

  console.log('Access token refreshed successfully');
  return { ok: true, accessToken: newAccessToken };
}

async function deleteStoredGmailToken(
  supabaseUrl: string,
  supabaseServiceKey: string,
  userId: string
): Promise<void> {
  const deleteRes = await fetch(`${supabaseUrl}/rest/v1/gmail_tokens?user_id=eq.${userId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'apikey': supabaseServiceKey,
    },
  });

  const deleteText = await deleteRes.text();
  if (!deleteRes.ok) {
    console.error(`Failed to clear invalid Gmail token [${deleteRes.status}]:`, deleteText);
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const daysAgoInput = Number(body.daysAgo ?? 7);

    if (!Number.isFinite(daysAgoInput) || daysAgoInput < 1 || daysAgoInput > 365) {
      return jsonResponse(
        { error: 'daysAgo must be a number from 1 to 365', code: 'INVALID_DAYS_AGO' },
        400,
        corsHeaders
      );
    }

    const daysAgo = Math.ceil(daysAgoInput);

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

    const tokenUrl = new URL(`${supabaseUrl}/rest/v1/gmail_tokens`);
    tokenUrl.searchParams.set('user_id', `eq.${user.id}`);
    tokenUrl.searchParams.set('select', 'access_token,refresh_token,expires_at');

    const storedTokenResponse = await fetch(tokenUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey,
      },
    });

    const storedTokenText = await storedTokenResponse.text();
    if (!storedTokenResponse.ok) {
      console.error(`Failed to load Gmail token [${storedTokenResponse.status}]:`, storedTokenText);
      return jsonResponse(
        { error: 'Could not load Gmail connection. Please try again.', code: 'GMAIL_TOKEN_LOOKUP_FAILED' },
        500,
        corsHeaders
      );
    }

    const [storedToken] = JSON.parse(storedTokenText) as StoredGmailToken[];
    if (!storedToken?.access_token) {
      return jsonResponse(
        { error: 'Please connect your Gmail account first.', code: 'GMAIL_NOT_CONNECTED' },
        409,
        corsHeaders
      );
    }

    let decryptedAccessToken: string | null;
    let decryptedRefreshToken: string | null;
    try {
      decryptedAccessToken = await decryptToken(storedToken.access_token);
      decryptedRefreshToken = await decryptToken(storedToken.refresh_token);
    } catch (err) {
      console.error('Failed to decrypt stored Gmail tokens:', err);
      return jsonResponse(
        {
          error: 'Gmail connection is corrupted. Please reconnect Gmail.',
          code: 'GMAIL_REAUTH_REQUIRED',
          reauthRequired: true,
        },
        401,
        corsHeaders
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
    const query = encodeURIComponent(`newer_than:${daysAgo}d (${keywordQuery})`);

    let effectiveToken = decryptedAccessToken!;

    if (new Date(storedToken.expires_at).getTime() <= Date.now() + 60_000) {
      console.log('Stored access token expired, attempting refresh before Gmail request...');
      const refreshResult = await refreshGmailToken(
        supabaseUrl,
        supabaseServiceKey,
        user.id,
        decryptedRefreshToken
      );

      if (!refreshResult.ok) {
        return jsonResponse(refreshResult, refreshResult.status, corsHeaders);
      }

      effectiveToken = refreshResult.accessToken;
    }

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
      const authErrorText = await messagesResponse.text();
      console.warn('Gmail rejected access token; attempting one refresh:', authErrorText);
      console.log('Access token expired, attempting refresh...');
      const refreshResult = await refreshGmailToken(
        supabaseUrl,
        supabaseServiceKey,
        user.id,
        storedToken.refresh_token
      );

      if (!refreshResult.ok) {
        return jsonResponse(refreshResult, refreshResult.status, corsHeaders);
      }

      effectiveToken = refreshResult.accessToken;
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

    if (!messagesResponse.ok) {
      const errorText = await messagesResponse.text();
      console.error('Failed to fetch messages:', errorText);
      return jsonResponse(
        {
          error: messagesResponse.status === 401
            ? 'Gmail authorization expired. Please reconnect Gmail.'
            : 'Failed to fetch messages from Gmail.',
          code: messagesResponse.status === 401 ? 'GMAIL_REAUTH_REQUIRED' : 'GMAIL_FETCH_FAILED',
          status: messagesResponse.status,
        },
        messagesResponse.status === 401 ? 401 : 502,
        corsHeaders
      );
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
