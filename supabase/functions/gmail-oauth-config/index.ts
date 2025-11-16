const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const clientId = Deno.env.get('GMAIL_CLIENT_ID');

    if (!clientId) {
      throw new Error('Gmail client ID not configured');
    }

    return new Response(
      JSON.stringify({ 
        clientId,
        scope: 'https://www.googleapis.com/auth/gmail.readonly',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in gmail-oauth-config:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get OAuth config';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
