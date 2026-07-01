import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = 'https://nbfheimyypcyznxkkykv.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5iZmhlaW15eXBjeXpueGtreWt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3NDE0MzMsImV4cCI6MjA5ODMxNzQzM30.RZqtCUXqpKfJ81rOnOxvwKUKsZaauyGj10RNVsqOHtU'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)
