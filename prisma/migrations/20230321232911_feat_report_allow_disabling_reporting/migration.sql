-- Manually written, we can migrate from the previous table just using this
-- The prisma migration doesn't go "DEFAULT FALSE" since the schema doesn't do that
ALTER TABLE "ReportConfig"
  ADD COLUMN "enabled" BOOLEAN NOT NULL DEFAULT FALSE;
