import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ActivityDialog } from '@/components/ActivityDialog';
import { EmailImportDialog } from '@/components/EmailImportDialog';
import { GmailImportDialog } from '@/components/GmailImportDialog';
import { WeeklySummaryCard } from '@/components/WeeklySummaryCard';
import { ActivityTable } from '@/components/ActivityTable';
import { SettingsDialog } from '@/components/SettingsDialog';
import { CategoryChart } from '@/components/CategoryChart';
import { JobTitleChart } from '@/components/JobTitleChart';
import { AnalyticsDashboard } from '@/components/AnalyticsDashboard';
import { InsightsCard } from '@/components/InsightsCard';
import { ExportMenu } from '@/components/ExportMenu';
import { JobSearchActivity } from '@/types/jobSearch';
import { GmailConnectButton } from '@/components/GmailConnectButton';
import {
  getWeeklySummaries,
  getActivitiesByCategory,
  getJobTitleCounts,
} from '@/lib/weekUtils';
import { toast } from 'sonner';
import { Briefcase, FileText, TrendingUp, LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const Index = () => {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<JobSearchActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [weeklyGoal, setWeeklyGoal] = useState(3);

  useEffect(() => {
    loadActivitiesFromDb();
    loadUserPreferences();
  }, []);

  const loadUserPreferences = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_preferences')
        .select('weekly_goal')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading preferences:', error);
        return;
      }

      if (data) {
        setWeeklyGoal(data.weekly_goal);
      } else {
        // Create default preferences
        await supabase
          .from('user_preferences')
          .insert({ user_id: user.id, weekly_goal: 3 });
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
  };

  const loadActivitiesFromDb = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('job_search_activities')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;

      const formattedActivities: JobSearchActivity[] = (data || []).map(activity => ({
        id: activity.id,
        date: activity.date,
        companyName: activity.company_name,
        jobTitle: activity.job_title,
        activityType: activity.activity_type as JobSearchActivity['activityType'],
        jobDescriptionUrl: activity.job_description_url || undefined,
        contactPerson: activity.contact_person || undefined,
        contactMethod: activity.contact_method || undefined,
        notes: activity.notes || undefined,
        status: activity.status as JobSearchActivity['status'],
        createdAt: activity.created_at,
      }));

      setActivities(formattedActivities);
    } catch (error) {
      console.error('Error loading activities:', error);
      toast.error('Failed to load activities');
    } finally {
      setLoading(false);
    }
  };

  const handleAddActivity = async (activityData: Omit<JobSearchActivity, 'id' | 'createdAt'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in');
        return;
      }

      const { data, error } = await supabase
        .from('job_search_activities')
        .insert({
          user_id: user.id,
          date: activityData.date,
          company_name: activityData.companyName,
          job_title: activityData.jobTitle,
          activity_type: activityData.activityType,
          job_description_url: activityData.jobDescriptionUrl,
          contact_person: activityData.contactPerson,
          contact_method: activityData.contactMethod,
          notes: activityData.notes,
          status: activityData.status,
        })
        .select()
        .single();

      if (error) throw error;

      await loadActivitiesFromDb();
      toast.success('Activity added successfully');
    } catch (error) {
      console.error('Error adding activity:', error);
      toast.error('Failed to add activity');
    }
  };

  const handleDeleteActivity = async (id: string) => {
    try {
      const { error } = await supabase
        .from('job_search_activities')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await loadActivitiesFromDb();
      toast.success('Activity deleted');
    } catch (error) {
      console.error('Error deleting activity:', error);
      toast.error('Failed to delete activity');
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('Failed to log out');
    } else {
      navigate('/auth');
    }
  };

  const weeklySummaries = getWeeklySummaries(activities, weeklyGoal);
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
                  Track your job search activities and stay organized
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              {/* Primary Action */}
              <ActivityDialog onSave={handleAddActivity} />
              
              {/* Import Options */}
              <div className="flex gap-2 items-center">
                <GmailConnectButton />
                <GmailImportDialog onImportComplete={loadActivitiesFromDb} />
                <EmailImportDialog onImport={handleAddActivity} />
              </div>
              
              {/* Secondary Actions */}
              <div className="flex gap-2 items-center">
                <ExportMenu activities={activities} weeklyGoal={weeklyGoal} />
                <SettingsDialog weeklyGoal={weeklyGoal} onGoalChange={setWeeklyGoal} />
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={handleLogout}
                  className="gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
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
                  ? 'Meets weekly goal' 
                  : `Need ${weeklyGoal}+ activities`}
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
              <WeeklySummaryCard key={summary.weekStart} summary={summary} weeklyGoal={weeklyGoal} />
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

        {/* Analytics Dashboard */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Analytics & Insights</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AnalyticsDashboard activities={activities} />
            <InsightsCard activities={activities} />
          </div>
        </section>

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
          </>
        )}
      </main>
    </div>
  );
};

export default Index;
