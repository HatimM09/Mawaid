-- Run this in your Supabase SQL Editor to enable instant updates for surveys
ALTER PUBLICATION supabase_realtime ADD TABLE public.survey_submissions_flat;
