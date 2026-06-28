import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://byelcaamxxvfltnegxby.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5ZWxjYWFteHh2Zmx0bmVneGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0MDE1MzgsImV4cCI6MjA2Njk3NzUzOH0.nYHGf_uFjw4oSAA04-ZeN1zA3SjlOkfzWgTg5sKYeGg"

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
