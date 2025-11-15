import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ActivityType } from '@/types/jobSearch';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface CategoryChartProps {
  data: Record<ActivityType, number>;
}

const activityTypeLabels: Record<ActivityType, string> = {
  application: 'Applications',
  interview: 'Interviews',
  networking: 'Networking',
  job_fair: 'Job Fairs',
  resume_submission: 'Resumes',
  phone_call: 'Phone Calls',
  email_inquiry: 'Emails',
  recruiter_contact: 'Recruiters',
  other: 'Other',
};

export const CategoryChart = ({ data }: CategoryChartProps) => {
  const chartData = Object.entries(data)
    .filter(([_, count]) => count > 0)
    .map(([type, count]) => ({
      name: activityTypeLabels[type as ActivityType],
      count,
    }))
    .sort((a, b) => b.count - a.count);

  if (chartData.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activities by Category</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis 
              dataKey="name" 
              className="text-xs"
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px'
              }}
            />
            <Bar dataKey="count" fill="hsl(var(--primary))" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
