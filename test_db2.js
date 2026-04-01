import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ezanilxygnpucwkwpsoc.supabase.co';
const supabaseKey = 'sb_publishable_5uIVxDWuaI916HXVN9Mb8A_jhrYLPYz';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLeagues() {
  const { data, error } = await supabase.from('leagues').select('*');
  console.log("Leagues Error:", error);
  console.log("Leagues Data count:", data?.length);
  if (data?.length > 0) {
    console.log("First league:", data[0]);
  }
}

checkLeagues();
