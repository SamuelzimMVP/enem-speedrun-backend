const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRanking() {
  const output = {};
  try {
    const { data: results } = await supabase
      .from('results')
      .select('*')
      .order('completed_at', { ascending: false })
      .limit(10);
    output.results = results;

    const { data: ranking } = await supabase
      .from('ranking_view')
      .select('*')
      .limit(10);
    output.ranking = ranking;

    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .limit(10);
    output.profiles = profiles;

    fs.writeFileSync('tmp/db_data.json', JSON.stringify(output, null, 2));
    console.log('Dados salvos em tmp/db_data.json');
  } catch (e) {
    console.error('Erro:', e);
  }
}

checkRanking();
