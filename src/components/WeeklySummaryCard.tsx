import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { WeeklySummary } from '@/types/jobSearch';
import { formatWeekRange } from '@/lib/weekUtils';
import { parseISO } from 'date-fns';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface WeeklySummaryCardProps {
  summary: WeeklySummary;
}

export const WeeklySummaryCard = ({ summary }: WeeklySummaryCardProps) => {
  const weekStart = parseISO(summary.weekStart);
  const weekRange = formatWeekRange(weekStart);
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{weekRange}</CardTitle>
          {summary.meetsRequirement ? (
            <Badge className="gap-1 bg-success text-white">
              <CheckCircle2 className="h-3 w-3" />
              Compliant
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1">
              <AlertCircle className="h-3 w-3" />
              Needs More
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Activities</span>
            <span className="text-2xl font-bold">{summary.totalActivities}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            Texas requires 3+ work search activities per week
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
