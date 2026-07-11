const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { emailContent, emailDate } = await req.json();

    if (!emailContent) {
      return new Response(
        JSON.stringify({ error: 'Email content is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Security: Limit email content size to 50KB to prevent DoS and credit exhaustion
    const MAX_EMAIL_SIZE = 50 * 1024; // 50KB
    if (emailContent.length > MAX_EMAIL_SIZE) {
      return new Response(
        JSON.stringify({ error: `Email content too large. Maximum size is ${MAX_EMAIL_SIZE / 1024}KB` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('Parsing email with AI...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a helpful assistant that extracts job application information from emails. Extract company name, job title, and job description URL if present. The email was received on ${emailDate || 'an unknown date'} — use that as the application date.`
          },
          {
            role: 'user',
            content: `Parse this job application confirmation email and extract the relevant information:\n\n${emailContent}`
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_job_application',
              description: 'Extract job application details from email',
              parameters: {
                type: 'object',
                properties: {
                  companyName: {
                    type: 'string',
                    description: 'The name of the company'
                  },
                  jobTitle: {
                    type: 'string',
                    description: 'The job title or position applied for'
                  },
                  date: {
                    type: 'string',
                    description: 'The application date in YYYY-MM-DD format'
                  },
                  jobDescriptionUrl: {
                    type: 'string',
                    description: 'URL to the job posting if mentioned in the email'
                  }
                },
                required: ['companyName', 'jobTitle', 'date'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extract_job_application' } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`AI API returned ${response.status}`);
    }

    const data = await response.json();
    console.log('AI Response:', JSON.stringify(data, null, 2));

    // Extract the function call arguments
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(
        JSON.stringify({ error: 'Could not extract job details from email. Please check the email format.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const parsedData = JSON.parse(toolCall.function.arguments);
    console.log('Extracted job details:', parsedData);

    return new Response(
      JSON.stringify({
        success: true,
        data: parsedData
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error parsing email:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to parse email';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
