import { JobSearchActivity } from '@/types/jobSearch';

const STORAGE_KEY = 'job_search_activities';

export const saveActivities = (activities: JobSearchActivity[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(activities));
};

export const loadActivities = (): JobSearchActivity[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
};

export const addActivity = (activity: JobSearchActivity) => {
  const activities = loadActivities();
  activities.push(activity);
  saveActivities(activities);
  return activities;
};

export const deleteActivity = (id: string) => {
  const activities = loadActivities().filter(a => a.id !== id);
  saveActivities(activities);
  return activities;
};

export const updateActivity = (id: string, updates: Partial<JobSearchActivity>) => {
  const activities = loadActivities().map(a => 
    a.id === id ? { ...a, ...updates } : a
  );
  saveActivities(activities);
  return activities;
};
