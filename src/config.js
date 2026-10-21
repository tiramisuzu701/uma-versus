// ============================================================================
//  Online services. The anon key is public by design: every table is guarded
//  by row-level security in supabase/001_accounts.sql. Leave url empty to ship
//  a build without accounts (everything else still works).
// ============================================================================
'use strict';
const ACCT_CFG = {
  url: 'https://nyjpzwbbwgycxmnlswze.supabase.co',
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55anB6d2Jid2d5Y3htbmxzd3plIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2MDgxMjAsImV4cCI6MjEwODE4NDEyMH0.qC4aXgQyOmwPOXzMmuI_YKJxPMcxM0DQY1uHC24yaq8',   // public anon key
};
