import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'https://nesnxcmdfksakgspvkcg.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lc254Y21kZmtzYWtnc3B2a2NnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzMzkxMjgsImV4cCI6MjEwMTkxNTEyOH0.M6IVTgWjow4gDCHH5DmJYRwRzSSQm8y29Ah4pyJqV7c'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
