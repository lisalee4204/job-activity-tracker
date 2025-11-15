export type ActivityType = 
  | 'application'
  | 'interview'
  | 'networking'
  | 'job_fair'
  | 'resume_submission'
  | 'phone_call'
  | 'email_inquiry'
  | 'recruiter_contact'
  | 'other';

export interface JobSearchActivity {
  id: string;
  date: string;
  companyName: string;
  jobTitle: string;
  activityType: ActivityType;
  jobDescriptionUrl?: string;
  contactPerson?: string;
  contactMethod?: string;
  notes?: string;
  status?: 'pending' | 'followed_up' | 'rejected' | 'interview_scheduled' | 'offer';
  createdAt: string;
}

export interface WeeklySummary {
  weekStart: string;
  weekEnd: string;
  totalActivities: number;
  meetsRequirement: boolean;
  activitiesByType: Record<ActivityType, number>;
}
