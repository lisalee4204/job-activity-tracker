import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lightbulb, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Insight {
  title: string;
  description: string;
}

interface InsightsCardProps {
  activities: any[];
}

export const InsightsCard = ({ activities }: InsightsCardProps) => {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateInsights = async () => {
    if (activities.length === 0) {
      toast.error('Add some activities first to get insights');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: functionError } = await supabase.functions.invoke('analyze-job-search', {
        body: { activities }
      });

      if (functionError) {
        console.error('Function error:', functionError);
        throw functionError;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setInsights(data.insights || []);
      toast.success('AI insights generated!');
    } catch (err: any) {
      console.error('Error generating insights:', err);
      const errorMsg = err.message || 'Failed to generate insights';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              AI Insights
            </CardTitle>
            <CardDescription>
              Get personalized suggestions to improve your job search strategy
            </CardDescription>
          </div>
          <Button 
            onClick={generateInsights} 
            disabled={loading || activities.length === 0}
            className="gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Lightbulb className="h-4 w-4" />
                Generate Insights
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {insights.length > 0 ? (
          <div className="space-y-4">
            {insights.map((insight, index) => (
              <div key={index} className="border-l-4 border-primary pl-4 py-2">
                <h4 className="font-semibold text-foreground mb-1">{insight.title}</h4>
                <p className="text-sm text-muted-foreground">{insight.description}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Lightbulb className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Click "Generate Insights" to get AI-powered recommendations</p>
            <p className="text-sm mt-2">
              {activities.length === 0 
                ? 'Add some job search activities first'
                : `Based on your ${activities.length} activities`}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
