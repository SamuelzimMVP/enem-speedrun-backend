const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixProfiles() {
  console.log('--- Iniciando reparo de perfis para o ranking ---');

  // 1. Pega todos os user_ids únicos da tabela de resultados
  const { data: results, error: resError } = await supabase
    .from('results')
    .select('user_id');

  if (resError) {
    console.error('Erro ao buscar resultados:', resError.message);
    return;
  }

  const uniqueUserIds = [...new Set(results.map(r => r.user_id))];
  console.log(`Encontrados ${uniqueUserIds.length} usuários únicos com resultados.`);

  for (const userId of uniqueUserIds) {
    // 2. Verifica se o perfil já existe
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (!profile) {
      console.log(`Usuário ${userId} está sem perfil. Tentando recuperar dados...`);

      // 3. Tenta pegar metadados do Auth Admin
      const { data: { user }, error: authError } = await supabase.auth.admin.getUserById(userId);

      let nome = 'Usuário Antigo';
      let email = 'email@desconhecido.com';

      if (!authError && user) {
        nome = user.user_metadata?.nome || user.email.split('@')[0] || 'Usuário';
        email = user.email;
      }

      // 4. Cria o perfil
      const { error: insertError } = await supabase
        .from('profiles')
        .upsert({ id: userId, nome, email });

      if (insertError) {
        console.error(`Erro ao criar perfil para ${userId}:`, insertError.message);
      } else {
        console.log(`✅ Perfil criado: ${nome} (${email})`);
      }
    } else {
      console.log(`✨ Perfil já existe para o usuário ${userId}`);
    }
  }

  console.log('--- Reparo concluído! O ranking deve atualizar agora. ---');
}

fixProfiles();
