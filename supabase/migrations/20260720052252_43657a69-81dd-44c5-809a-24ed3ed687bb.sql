
-- Constrain weekly_goal
ALTER TABLE public.user_preferences
  ADD CONSTRAINT weekly_goal_range CHECK (weekly_goal >= 1 AND weekly_goal <= 100);

-- Revoke public EXECUTE on SECURITY DEFINER trigger functions.
-- These are only invoked by triggers (owner runs them), not by API callers.
REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
