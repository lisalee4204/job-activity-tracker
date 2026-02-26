import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Database, Trash2 } from 'lucide-react';

const demoActivities = [
  { date: '2026-02-25', company_name: 'Google', job_title: 'Senior Frontend Engineer', activity_type: 'application', status: 'hr_screen', notes: 'Applied through careers page' },
  { date: '2026-02-24', company_name: 'Microsoft', job_title: 'Software Engineer II', activity_type: 'interview', status: 'hiring_manager', contact_person: 'Sarah Chen', contact_method: 'Video Call' },
  { date: '2026-02-23', company_name: 'Amazon', job_title: 'Full Stack Developer', activity_type: 'application', status: 'application', job_description_url: 'https://amazon.jobs/example' },
  { date: '2026-02-22', company_name: 'Meta', job_title: 'React Developer', activity_type: 'phone_call', status: 'hr_screen', contact_person: 'James Liu', contact_method: 'Phone' },
  { date: '2026-02-21', company_name: 'Apple', job_title: 'UI Engineer', activity_type: 'application', status: 'assessment', notes: 'Completed online assessment' },
  { date: '2026-02-20', company_name: 'Netflix', job_title: 'Senior UI Developer', activity_type: 'networking', contact_person: 'Mike Torres', contact_method: 'LinkedIn' },
  { date: '2026-02-19', company_name: 'Stripe', job_title: 'Frontend Engineer', activity_type: 'application', status: 'application' },
  { date: '2026-02-18', company_name: 'Airbnb', job_title: 'Web Developer', activity_type: 'email_inquiry', contact_person: 'Lisa Wang', contact_method: 'Email' },
  { date: '2026-02-17', company_name: 'Shopify', job_title: 'Software Developer', activity_type: 'recruiter_contact', status: 'hr_screen', contact_person: 'David Kim', contact_method: 'LinkedIn' },
  { date: '2026-02-16', company_name: 'Salesforce', job_title: 'Full Stack Engineer', activity_type: 'interview', status: 'final_round', contact_person: 'Rachel Green', contact_method: 'On-site' },
  { date: '2026-02-15', company_name: 'Spotify', job_title: 'Frontend Developer', activity_type: 'application', status: 'rejected', notes: 'Position filled internally' },
  { date: '2026-02-14', company_name: 'Twitter', job_title: 'React Engineer', activity_type: 'resume_submission', status: 'application' },
  { date: '2026-02-13', company_name: 'Uber', job_title: 'Software Engineer', activity_type: 'job_fair', notes: 'Met at local tech job fair' },
  { date: '2026-02-12', company_name: 'Slack', job_title: 'Frontend Engineer', activity_type: 'application', status: 'offer', notes: 'Received offer!' },
  { date: '2026-02-11', company_name: 'Figma', job_title: 'Design Engineer', activity_type: 'networking', contact_person: 'Emma Davis', contact_method: 'Meetup' },
  { date: '2026-02-10', company_name: 'Notion', job_title: 'Web Engineer', activity_type: 'application', status: 'assessment' },
  { date: '2026-02-09', company_name: 'Vercel', job_title: 'Frontend Developer', activity_type: 'interview', status: 'hiring_manager', contact_person: 'Tom Wilson' },
  { date: '2026-02-08', company_name: 'GitHub', job_title: 'Software Engineer', activity_type: 'application', status: 'hr_screen' },
  { date: '2026-02-07', company_name: 'Datadog', job_title: 'Full Stack Developer', activity_type: 'phone_call', contact_person: 'Alex Brown', contact_method: 'Phone' },
  { date: '2026-02-06', company_name: 'Twilio', job_title: 'Web Developer', activity_type: 'email_inquiry', status: 'application', contact_method: 'Email' },
  { date: '2026-02-05', company_name: 'Square', job_title: 'React Developer', activity_type: 'recruiter_contact', contact_person: 'Nina Patel', contact_method: 'LinkedIn' },
  { date: '2026-02-04', company_name: 'Dropbox', job_title: 'Frontend Engineer', activity_type: 'application', status: 'rejected' },
  { date: '2026-02-03', company_name: 'Zoom', job_title: 'UI Developer', activity_type: 'interview', status: 'hr_screen', contact_person: 'Chris Lee' },
  { date: '2026-02-02', company_name: 'HubSpot', job_title: 'Software Developer', activity_type: 'application', status: 'application', notes: 'Referral from a friend' },
  { date: '2026-02-01', company_name: 'Atlassian', job_title: 'Senior Frontend Dev', activity_type: 'networking', contact_person: 'Priya Sharma', contact_method: 'Conference' },
];

interface DemoDataButtonProps {
  onComplete: () => void;
  hasActivities: boolean;
}

export const DemoDataButton = ({ onComplete, hasActivities }: DemoDataButtonProps) => {
  const [loading, setLoading] = useState(false);
  const [demoLoaded, setDemoLoaded] = useState(false);

  const loadDemoData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('You must be logged in'); return; }

      const rows = demoActivities.map(a => ({ ...a, user_id: user.id }));
      const { error } = await supabase.from('job_search_activities').insert(rows);
      if (error) throw error;

      setDemoLoaded(true);
      toast.success('25 demo activities loaded!');
      onComplete();
    } catch (e) {
      console.error(e);
      toast.error('Failed to load demo data');
    } finally {
      setLoading(false);
    }
  };

  const clearDemoData = async () => {
    setLoading(true);
    try {
      const companies = demoActivities.map(a => a.company_name);
      const { error } = await supabase
        .from('job_search_activities')
        .delete()
        .in('company_name', companies);
      if (error) throw error;

      setDemoLoaded(false);
      toast.success('Demo data cleared!');
      onComplete();
    } catch (e) {
      console.error(e);
      toast.error('Failed to clear demo data');
    } finally {
      setLoading(false);
    }
  };

  return demoLoaded ? (
    <Button variant="outline" size="sm" onClick={clearDemoData} disabled={loading} className="gap-2 w-full lg:w-auto">
      <Trash2 className="h-4 w-4" />
      <span>{loading ? 'Clearing...' : 'Clear Demo Data'}</span>
    </Button>
  ) : (
    <Button variant="outline" size="sm" onClick={loadDemoData} disabled={loading} className="gap-2 w-full lg:w-auto">
      <Database className="h-4 w-4" />
      <span>{loading ? 'Loading...' : 'Load Demo Data'}</span>
    </Button>
  );
};
