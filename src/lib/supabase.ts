import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const getOrCreateGuestUser = async () => {
  const { data: sessionData } = await supabase.auth.getSession();
  
  if (sessionData.session) {
    return sessionData.session.user;
  }
  
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.user;
};