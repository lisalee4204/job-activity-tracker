import { getCorsHeaders } from '../_shared/cors.ts';

function sanitizeGoogleClientId(clientId: string | undefined): string | undefined {
  return clientId?.trim().replace(/\/+$/, '');
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code, redirectUri } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'Authorization': authHeader,
        'apikey': supabaseServiceKey,
      },
    });

    if (!userResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to verify user' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const user = await userResponse.json();

    if (!code || !redirectUri) {
      return new Response(
        JSON.stringify({ error: 'Code and redirectUri are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const clientId = sanitizeGoogleClientId(Deno.env.get('GMAIL_CLIENT_ID'));
    const clientSecret = Deno.env.get('GMAIL_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new Error('Gmail credentials not configured');
    }

    console.log('Exchanging code for tokens...');

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      throw new Error(`Failed to exchange code: ${tokenResponse.status}`);
    }

    const tokens = await tokenResponse.json();
    console.log('Successfully obtained tokens');

    if (!tokens.access_token || !tokens.expires_in) {
      throw new Error('Google did not return a valid access token');
    }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    const tokenRecord: Record<string, string> = {
      user_id: user.id,
      access_token: tokens.access_token,
      expires_at: expiresAt,
    };

    if (tokens.refresh_token) {
      tokenRecord.refresh_token = tokens.refresh_token;
    }

    const storeResponse = await fetch(`${supabaseUrl}/rest/v1/gmail_tokens?on_conflict=user_id`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey,
        'Prefer': 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(tokenRecord),
    });

    const storeText = await storeResponse.text();
    if (!storeResponse.ok) {
      console.error(`Failed to store Gmail tokens [${storeResponse.status}]:`, storeText);
      throw new Error('Failed to store Gmail authorization');
    }

    return new Response(
      JSON.stringify({ 
        success: true,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in gmail-auth:', error);
    const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
