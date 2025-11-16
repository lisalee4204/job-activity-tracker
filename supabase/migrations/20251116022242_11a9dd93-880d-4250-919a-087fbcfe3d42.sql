-- Create job_search_activities table
CREATE TABLE public.job_search_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  company_name TEXT NOT NULL,
  job_title TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  job_description_url TEXT,
  contact_person TEXT,
  contact_method TEXT,
  notes TEXT,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.job_search_activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own activities"
  ON public.job_search_activities
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own activities"
  ON public.job_search_activities
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own activities"
  ON public.job_search_activities
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own activities"
  ON public.job_search_activities
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_job_search_activities_updated_at
  BEFORE UPDATE ON public.job_search_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Add index for better query performance
CREATE INDEX idx_job_search_activities_user_id ON public.job_search_activities(user_id);
CREATE INDEX idx_job_search_activities_date ON public.job_search_activities(date DESC);