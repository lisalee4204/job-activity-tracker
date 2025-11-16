const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { accessToken } = await req.json();

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'Access token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching emails from Gmail...');

    // Fetch recent emails (last 7 days)
    const query = encodeURIComponent('newer_than:7d');
    const messagesResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=50`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!messagesResponse.ok) {
      const errorText = await messagesResponse.text();
      console.error('Failed to fetch messages:', errorText);
      throw new Error(`Failed to fetch messages: ${messagesResponse.status}`);
    }

    const messagesData = await messagesResponse.json();
    const messageIds = messagesData.messages || [];

    console.log(`Found ${messageIds.length} messages`);

    const parsedActivities = [];
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Get user from authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verify user with Supabase auth
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

    // Fetch and parse each email
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
        
        // Extract email body
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

        // Parse email with AI
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
          // Save to database using REST API
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
