-- Add snack_defaults column to user_stats for per-dish default snack counts
-- dish_1 through dish_4 individually configurable per user (JSONB)

ALTER TABLE public.user_stats 
ADD COLUMN IF NOT EXISTS snack_defaults JSONB DEFAULT '{"dish_1":0,"dish_2":0,"dish_3":0,"dish_4":0}';
