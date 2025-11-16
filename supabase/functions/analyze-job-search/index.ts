import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { activities } = await req.json();
    
    if (!activities || activities.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No activities provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare activity summary for AI analysis
    const activitySummary = {
      totalActivities: activities.length,
      byType: activities.reduce((acc: any, act: any) => {
        acc[act.activityType] = (acc[act.activityType] || 0) + 1;
        return acc;
      }, {}),
      byStatus: activities.reduce((acc: any, act: any) => {
        if (act.status) acc[act.status] = (acc[act.status] || 0) + 1;
        return acc;
      }, {}),
      companies: [...new Set(activities.map((a: any) => a.companyName))],
      recentActivities: activities.slice(0, 10).map((a: any) => ({
        date: a.date,
        company: a.companyName,
        jobTitle: a.jobTitle,
        type: a.activityType,
        status: a.status
      }))
    };

    const prompt = `You are a career advisor AI analyzing job search activities. 

Based on this job search data:
${JSON.stringify(activitySummary, null, 2)}

Provide 4-6 actionable insights and recommendations to improve their job search strategy. Focus on:
1. Application patterns and frequency
2. Success indicators (interview/offer rates if applicable)
3. Diversification of companies and roles
4. Activity types effectiveness
5. Suggestions for improvement

Format as a JSON array of insight objects with "title" and "description" fields. Keep descriptions concise (2-3 sentences max).

Example format:
[
  {
    "title": "Strong Application Volume",
    "description": "You've submitted 15 applications this week. Maintain this momentum while ensuring quality over quantity."
  }
]

Return ONLY the JSON array, no other text.`;

    console.log('Calling Lovable AI for insights...');
    
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a helpful career advisor. Always respond with valid JSON only.' },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'AI service rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI service credits exhausted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`AI API returned ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content in AI response');
    }

    // Parse the JSON response
    let insights;
    try {
      // Remove markdown code blocks if present
      const cleanedContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      insights = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      throw new Error('Failed to parse AI insights');
    }

    console.log('Successfully generated insights:', insights.length);

    return new Response(
      JSON.stringify({ insights }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-job-search function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to generate insights' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
