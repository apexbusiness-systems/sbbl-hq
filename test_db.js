import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ezanilxygnpucwkwpsoc.supabase.co';
const supabaseKey = 'sb_publishable_5uIVxDWuaI916HXVN9Mb8A_jhrYLPYz';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTeams() {
  const { data, error } = await supabase.from('teams').select('*');
  console.log("Teams Error:", error);
  console.log("Teams Data count:", data?.length);
  if (data?.length > 0) {
    console.log("First team:", data[0]);
  }
}

checkTeams();
