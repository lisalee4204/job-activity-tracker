import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { JobSearchActivity } from '@/types/jobSearch';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Award, Clock, Target } from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';

interface AnalyticsDashboardProps {
  activities: JobSearchActivity[];
}

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export const AnalyticsDashboard = ({ activities }: AnalyticsDashboardProps) => {
  // Status distribution
  const statusData = activities.reduce((acc, activity) => {
    const status = activity.status || 'application';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const statusChartData = Object.entries(statusData).map(([name, value]) => ({
    name: name.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
    value,
  }));

  // Success rate calculation (offers / total applications)
  const totalApplications = activities.filter(a => a.activityType === 'application').length;
  const offers = activities.filter(a => a.status === 'offer').length;
  const interviews = activities.filter(a => a.activityType === 'interview' || a.status === 'hr_screen' || a.status === 'hiring_manager').length;
  const successRate = totalApplications > 0 ? ((offers / totalApplications) * 100).toFixed(1) : '0';
  const interviewRate = totalApplications > 0 ? ((interviews / totalApplications) * 100).toFixed(1) : '0';

  // Average time to interview (days from application to first interview activity)
  const applicationsByCompany = activities
    .filter(a => a.activityType === 'application')
    .reduce((acc, app) => {
      acc[app.companyName] = app;
      return acc;
    }, {} as Record<string, JobSearchActivity>);

  const interviewTimes = activities
    .filter(a => a.activityType === 'interview' || a.status === 'hr_screen' || a.status === 'hiring_manager')
    .map(interview => {
      const application = applicationsByCompany[interview.companyName];
      if (application) {
        return differenceInDays(parseISO(interview.date), parseISO(application.date));
      }
      return null;
    })
    .filter((days): days is number => days !== null && days >= 0);

  const avgTimeToInterview = interviewTimes.length > 0
    ? (interviewTimes.reduce((sum, days) => sum + days, 0) / interviewTimes.length).toFixed(1)
    : 'N/A';

  // Activity type distribution
  const activityTypeData = activities.reduce((acc, activity) => {
    acc[activity.activityType] = (acc[activity.activityType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const activityTypeChartData = Object.entries(activityTypeData).map(([name, value]) => ({
    name: name.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
    value,
  }));

  // Top companies by application count
  const companyCounts = activities.reduce((acc, activity) => {
    acc[activity.companyName] = (acc[activity.companyName] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topCompanies = Object.entries(companyCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{successRate}%</div>
            <p className="text-xs text-muted-foreground">
              {offers} offers from {totalApplications} applications
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Interview Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{interviewRate}%</div>
            <p className="text-xs text-muted-foreground">
              {interviews} interviews from applications
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Time to Interview</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgTimeToInterview}</div>
            <p className="text-xs text-muted-foreground">
              days from application
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activities.length}</div>
            <p className="text-xs text-muted-foreground">
              across all job searches
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Application Pipeline Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activity Type Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={activityTypeChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top Companies by Activity Count</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topCompanies} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={150} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--chart-2))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};
