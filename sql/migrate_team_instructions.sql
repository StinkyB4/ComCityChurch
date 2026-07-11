-- Team instructions / checklist document + "include in reminder email" toggle.
--
-- Each team can hold one instructions/checklist document. When the toggle is on,
-- the serving reminder email includes a button linking to a viewer page that
-- loads the instructions live — so edits made after an email is sent still show.
ALTER TABLE teams ADD COLUMN IF NOT EXISTS instructions text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS include_instructions_in_reminder boolean NOT NULL DEFAULT false;

-- Existing RLS already covers these columns:
--   • approved members (and the anonymous swap/instructions viewer path) can SELECT teams
--   • team leaders can UPDATE their own team; admins can UPDATE any team
-- so no new policies are required.
