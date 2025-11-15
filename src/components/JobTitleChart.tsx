import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface JobTitleChartProps {
  data: Record<string, number>;
}

export const JobTitleChart = ({ data }: JobTitleChartProps) => {
  const sortedData = Object.entries(data)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  if (sortedData.length === 0) {
    return null;
  }

  const maxCount = Math.max(...sortedData.map(([, count]) => count));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Job Titles</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sortedData.map(([title, count]) => (
            <div key={title} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium truncate flex-1">{title}</span>
                <span className="text-muted-foreground ml-2">{count}</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className="bg-accent h-2 rounded-full transition-all"
                  style={{ width: `${(count / maxCount) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
