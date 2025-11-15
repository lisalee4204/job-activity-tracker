import { JobSearchActivity, WeeklySummary, ActivityType } from '@/types/jobSearch';
import { startOfWeek, endOfWeek, format, parseISO, isWithinInterval } from 'date-fns';

export const getWeekStart = (date: Date): Date => {
  return startOfWeek(date, { weekStartsOn: 0 }); // Sunday
};

export const getWeekEnd = (date: Date): Date => {
  return endOfWeek(date, { weekStartsOn: 0 }); // Saturday
};

export const formatWeekRange = (weekStart: Date): string => {
  const weekEnd = getWeekEnd(weekStart);
  return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
};

export const getWeeklySummaries = (activities: JobSearchActivity[]): WeeklySummary[] => {
  const weekMap = new Map<string, WeeklySummary>();
  
  activities.forEach(activity => {
    const activityDate = parseISO(activity.date);
    const weekStart = getWeekStart(activityDate);
    const weekEnd = getWeekEnd(activityDate);
    const weekKey = format(weekStart, 'yyyy-MM-dd');
    
    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, {
        weekStart: format(weekStart, 'yyyy-MM-dd'),
        weekEnd: format(weekEnd, 'yyyy-MM-dd'),
        totalActivities: 0,
        meetsRequirement: false,
        activitiesByType: {
          application: 0,
          interview: 0,
          networking: 0,
          job_fair: 0,
          resume_submission: 0,
          phone_call: 0,
          email_inquiry: 0,
          recruiter_contact: 0,
          other: 0,
        },
      });
    }
    
    const summary = weekMap.get(weekKey)!;
    summary.totalActivities++;
    summary.activitiesByType[activity.activityType]++;
    summary.meetsRequirement = summary.totalActivities >= 3;
  });
  
  return Array.from(weekMap.values()).sort((a, b) => 
    new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime()
  );
};

export const getActivitiesForWeek = (activities: JobSearchActivity[], weekStart: string): JobSearchActivity[] => {
  const start = parseISO(weekStart);
  const end = getWeekEnd(start);
  
  return activities.filter(activity => {
    const activityDate = parseISO(activity.date);
    return isWithinInterval(activityDate, { start, end });
  });
};

export const getActivitiesByCategory = (activities: JobSearchActivity[]): Record<ActivityType, number> => {
  const counts: Record<ActivityType, number> = {
    application: 0,
    interview: 0,
    networking: 0,
    job_fair: 0,
    resume_submission: 0,
    phone_call: 0,
    email_inquiry: 0,
    recruiter_contact: 0,
    other: 0,
  };
  
  activities.forEach(activity => {
    counts[activity.activityType]++;
  });
  
  return counts;
};

export const getJobTitleCounts = (activities: JobSearchActivity[]): Record<string, number> => {
  const counts: Record<string, number> = {};
  
  activities.forEach(activity => {
    const title = activity.jobTitle || 'Unspecified';
    counts[title] = (counts[title] || 0) + 1;
  });
  
  return counts;
};
