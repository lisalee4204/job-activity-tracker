import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ActivityDialog } from '@/components/ActivityDialog';
import { EmailImportDialog } from '@/components/EmailImportDialog';
import { WeeklySummaryCard } from '@/components/WeeklySummaryCard';
import { ActivityTable } from '@/components/ActivityTable';
import { CategoryChart } from '@/components/CategoryChart';
import { JobTitleChart } from '@/components/JobTitleChart';
import { JobSearchActivity } from '@/types/jobSearch';
import { loadActivities, addActivity, deleteActivity } from '@/lib/jobSearchStorage';
import {
  getWeeklySummaries,
  getActivitiesByCategory,
  getJobTitleCounts,
} from '@/lib/weekUtils';
import { toast } from 'sonner';
import { Briefcase, FileText, TrendingUp } from 'lucide-react';

const Index = () => {
  const [activities, setActivities] = useState<JobSearchActivity[]>([]);

  useEffect(() => {
    setActivities(loadActivities());
  }, []);

  const handleAddActivity = (activityData: Omit<JobSearchActivity, 'id' | 'createdAt'>) => {
    const newActivity: JobSearchActivity = {
      ...activityData,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    
    const updatedActivities = addActivity(newActivity);
    setActivities(updatedActivities);
    toast.success('Activity added successfully');
  };

  const handleDeleteActivity = (id: string) => {
    const updatedActivities = deleteActivity(id);
    setActivities(updatedActivities);
    toast.success('Activity deleted');
  };

  const weeklySummaries = getWeeklySummaries(activities);
  const categoryCounts = getActivitiesByCategory(activities);
  const jobTitleCounts = getJobTitleCounts(activities);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground shadow-md">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <Briefcase className="h-8 w-8" />
              <div>
                <h1 className="text-2xl font-bold">Job Search Tracker</h1>
                <p className="text-sm opacity-90">
                  Texas Unemployment Claims Documentation
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <EmailImportDialog onImport={handleAddActivity} />
              <ActivityDialog onSave={handleAddActivity} />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{activities.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                All time job search activities
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">This Week</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {weeklySummaries[0]?.totalActivities || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {weeklySummaries[0]?.meetsRequirement 
                  ? 'Meets Texas requirements' 
                  : 'Need 3+ activities'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Compliant Weeks</CardTitle>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {weeklySummaries.filter(w => w.meetsRequirement).length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Out of {weeklySummaries.length} total weeks
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Weekly Summaries */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Weekly Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {weeklySummaries.slice(0, 6).map((summary) => (
              <WeeklySummaryCard key={summary.weekStart} summary={summary} />
            ))}
          </div>
          {weeklySummaries.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No activities recorded yet. Start by adding your job search activities.
              </CardContent>
            </Card>
          )}
        </section>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <CategoryChart data={categoryCounts} />
          <JobTitleChart data={jobTitleCounts} />
        </div>

        {/* Activities Table */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Recent Activities</h2>
          <Card>
            <CardContent className="p-0">
              <ActivityTable 
                activities={activities.slice(0, 20)} 
                onDelete={handleDeleteActivity} 
              />
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
};

export default Index;
