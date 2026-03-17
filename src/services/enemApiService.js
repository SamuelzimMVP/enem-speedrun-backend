const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const ENEM_API_BASE = 'https://api.enem.dev/v1';
const QUESTIONS_FILE = path.join(__dirname, '..', '..', 'data', 'questions.json');

// ─── Enunciados corrigidos manualmente ───────────────────────────────────────
// Estas questões têm context=null na API enem.dev.
// O enunciado foi extraído dos PDFs oficiais do INEP e não deve ser sobrescrito.
// Chave: "ano-numero-disciplina"
const ENUNCIADOS_PROTEGIDOS = {
  "2013-138-matematica": `O coeficiente de variação CV é uma medida de dispersão relativa, dada por CV = (desvio padrão / média) × 100%. Um consultor de empresas propõe que um gerente troque o método A de produção pelo método B. Para convencê-lo, apresentou os dados de produção, em unidades por hora, ao longo de uma semana de trabalho.\n\nMétodo A: 8, 10, 12, 10, 10 (média = 10, desvio padrão = 1,41)\nMétodo B: 11, 13, 9, 11, 11 (média = 11, desvio padrão = 1,41)\n\nO consultor argumenta que o método B é melhor pois apresenta maior produção média com igual variabilidade. O gerente, porém, pondera que o coeficiente de variação é a medida mais adequada de comparação.\n\nO coeficiente de melhora da alteração recomendada é:`,
  "2013-171-matematica": `Em uma sala de aula, o professor escreveu no quadro a seguinte equação: X + Y = 1, onde X e Y são variáveis que podem assumir apenas valores 0 ou 1. Depois, perguntou aos alunos quais seriam os pares (X, Y) que satisfazem essa equação.\n\nQual é a expressão que representa a relação entre X e Y`,
  "2014-139-matematica": `Para comemorar o aniversário de uma cidade, um artista projetou uma escultura transparente e oca, cujo formato foi inspirado em uma ampulheta. Ela é formada por três partes de mesma altura: duas são troncos de cone iguais e a outra é um cilindro.\n\nNo topo da escultura foi ligada uma torneira que verte água para dentro dela com vazão constante.\n\nO gráfico que expressa a altura (h) da água na escultura em função do tempo (t) decorrido é`,
  "2014-144-matematica": `Um sinalizador de tráfego tem o formato de um cone circular reto. O sinalizador precisa ser revestido externamente com adesivo fluorescente, desde sua base (base do cone) até a metade de sua altura, para sinalização noturna. O responsável pela colocação do adesivo precisa fazer o corte do material de maneira que a forma do adesivo corresponda exatamente à parte da superfície lateral a ser revestida.\n\nQual deverá ser a forma do adesivo?`,
  "2014-145-matematica": `Um professor, depois de corrigir as provas de sua turma, percebeu que várias questões estavam muito difíceis. Para compensar, decidiu utilizar uma função polinomial f, de grau menor que 3, para alterar as notas x da prova para notas y = f(x), da seguinte maneira:\n• A nota zero permanece zero.\n• A nota 10 permanece 10.\n• A nota 5 passa a ser 6.\n\nA expressão da função y = f(x) a ser utilizada pelo professor é`,
  "2014-146-matematica": `Durante a Segunda Guerra Mundial, para decifrarem as mensagens secretas, foi utilizada a técnica de decomposição em fatores primos. Um número N é dado pela expressão 2^x · 5^y · 7^z, na qual x, y e z são números inteiros não negativos. Sabe-se que N é múltiplo de 10 e não é múltiplo de 7.\n\nO número de divisores de N, diferentes de N, é`,
  "2014-149-matematica": `Um show especial de Natal teve 45 000 ingressos vendidos. Esse evento ocorrerá em um estádio de futebol que disponibilizará 5 portões de entrada, com 4 catracas eletrônicas por portão. Em cada uma dessas catracas, passará uma única pessoa a cada 2 segundos. O público foi igualmente dividido pela quantidade de portões e catracas, indicados no ingresso para o show, para a efetiva entrada no estádio.\n\nQual é o tempo mínimo para que todos passem pelas catracas?`,
  "2014-154-matematica": `O acesso entre os dois andares de uma casa é feito através de uma escada circular (escada caracol). Os cinco pontos A, B, C, D, E sobre o corrimão estão igualmente espaçados, e os pontos P, A e E estão em uma mesma reta. Nessa escada, uma pessoa caminha deslizando a mão sobre o corrimão do ponto A até o ponto D.\n\nA figura que melhor representa a projeção ortogonal, sobre o piso da casa (plano), do caminho percorrido pela mão dessa pessoa é`,
  "2014-156-matematica": `O condomínio de um edifício permite que cada proprietário de apartamento construa um armário em sua vaga de garagem. O projeto da garagem, na escala 1 : 100, foi disponibilizado aos interessados já com as especificações das dimensões do armário, com dimensões, no projeto, iguais a 3 cm, 1 cm e 2 cm.\n\nO volume real do armário, em centímetros cúbicos, será`,
  "2014-159-matematica": `Uma pessoa possui um espaço retangular de lados 11,5 m e 14 m no quintal de sua casa e pretende fazer um pomar doméstico de maçãs. As mudas de maçã devem ser plantadas com espaçamento mínimo de 3 metros entre elas e entre elas e as laterais do terreno.\n\nO número máximo de mudas que essa pessoa poderá plantar no espaço disponível é`,
  "2014-164-matematica": `O psicólogo de uma empresa aplica um teste que termina quando o psicólogo fizer a décima pergunta ou quando o candidato der a segunda resposta errada. A probabilidade de o candidato errar uma resposta é 0,20.\n\nA probabilidade de o teste terminar na quinta pergunta é`,
  "2014-173-matematica": `A maior piscina do mundo, registrada no livro Guinness, está localizada no Chile, em San Alfonso del Mar, cobrindo um terreno de 8 hectares de área.\n\nSabe-se que 1 hectare corresponde a 1 hectômetro quadrado.\n\nQual é o valor, em metros quadrados, da área coberta pelo terreno da piscina?`,
  "2014-178-matematica": `Diariamente, uma residência consome 20 160 Wh. Essa residência possui 100 células solares retangulares de dimensões 6 cm × 8 cm. Cada célula produz, ao longo do dia, 24 Wh por centímetro de diagonal. O proprietário quer produzir, por dia, exatamente a mesma quantidade de energia que sua casa consome.\n\nQual deve ser a ação desse proprietário para que ele atinja o seu objetivo?`,
  "2014-179-matematica": `Uma pessoa compra semanalmente sempre a mesma quantidade de um produto que custa R$ 10,00 a unidade, levando sempre R$ 6,00 a mais. Um dia o preço aumentou 20% e o dinheiro levado era a quantia exata para comprar duas unidades a menos.\n\nA quantia que essa pessoa levava semanalmente para fazer a compra era`,
  "2015-142-matematica": `Um banco de dados contém os registros de 500 senhas de clientes, sendo exatamente uma senha de cada número inteiro de 1 a 500. Uma dessas senhas será sorteada aleatoriamente.\n\nQual é a probabilidade de a senha sorteada ser um número de 1 a 20?`,
  "2015-162-matematica": `Um arquiteto projetou uma escada com degraus de mesma altura e mesmo comprimento. O comprimento total horizontal é de 3,00 m, a altura total vertical é de 2,40 m e a escada possui 12 degraus. O carpinteiro colocará rodapé cobrindo as faces verticais e horizontais de cada degrau, exceto o piso do último degrau.\n\nAtendendo o pedido do arquiteto, o carpinteiro deverá produzir`,
  "2015-166-matematica": `Uma paciente com problemas renais precisa de hemodiálise. Para cada kg do peso da paciente, ela deve ingerir 5 mL do medicamento por semana. Essa paciente pesa 60 kg. O médico receitou o medicamento em garrafas de 250 mL, 500 mL ou 1 000 mL.\n\nQual o tipo de garrafa escolhida pela paciente?`,
  "2016-165-matematica": `Um edifício tem N andares, com k apartamentos no k-ésimo andar a partir do baixo. O número total de apartamentos é dado pela expressão N(N+1)/2.\n\nQual é o número de andares desse edifício?`,
  "2016-167-matematica": `Um túnel deve ser lacrado com uma tampa de concreto com contorno em arco de parábola. A equação da parábola é y = 9 − x², com x e y em metros. A área sob a parábola é igual a 2/3 da área do retângulo de mesmas dimensões.\n\nQual é a área da parte frontal da tampa de concreto, em metro quadrado?`,
  "2016-179-matematica": `Para filtrar a água de uma piscina, utiliza-se um filtro de areia com quatro camadas: seixo grosso, seixo fino, areia grossa e areia fina. A limpeza é feita por lavagem em contracorrente (água de baixo para cima), invertendo a posição das camadas.\n\nO filtro descartado é o`,
  "2014-65-natureza": `Um pesquisador sintetizou um novo fármaco e deseja identificar qual grupo funcional é responsável pela atividade biológica. Ele sintetizou derivados modificando um grupo por vez. Apenas o derivado com um grupo específico modificado perdeu a atividade antimicrobiana.\n\nO grupo responsável pela bioatividade desse fármaco é`,
  "2014-77-natureza": `Um químico analisou uma molécula formada apenas por carbono e hidrogênio, insaturada, com isomeria geométrica (cis-trans) e 4 carbonos.\n\nA fórmula que se enquadra nas características da molécula investigada é`,
  "2015-52-natureza": `A borracha de silicone é um material polimérico com propriedades elásticas. Em temperaturas muito baixas, ela perde sua elasticidade e fica rígida, fenômeno conhecido como "derretimento" às avessas.\n\nO fenômeno de "derretimento" decorre da`,
  "2016-62-natureza": `Os seres vivos podem ser classificados conforme a presença ou ausência de núcleo definido. Procariotos não possuem núcleo definido; eucariotos possuem. Ao longo da evolução, houve uma transição dos organismos procariotos para os eucariotos.\n\nEm qual grupo de organismos ocorre essa transição?`,
  "2016-88-natureza": `Um estudante aqueceu um líquido em recipiente não completamente vedado e observou que a temperatura se manteve constante por um período mesmo com fornecimento contínuo de calor.\n\nA elevação de temperatura descrita ocorre porque`,
  "2015-179-humanas": `Em um estudo sobre distribuição de renda, 20% da população recebe até 1 salário mínimo, 35% entre 1 e 3, 30% entre 3 e 10, e 15% acima de 10. Foram selecionadas aleatoriamente duas pessoas e calculadas as probabilidades de combinações entre as faixas de maior e menor renda.\n\nComparando-se essas probabilidades, obtém-se`,
  "2016-90-humanas": `A Revolução Industrial trouxe profundas transformações sociais e econômicas, com a formação do proletariado urbano e o surgimento de movimentos operários que buscavam melhores condições de trabalho e vida, originando diversas correntes de pensamento político e social.\n\nUm exemplo de tal processo é o(a)`,
};


const questionPool = {
  linguagens: [],
  humanas: [],
  natureza: [],
  matematica: [],
};
let cacheLoadedAt = null;
const CACHE_TTL = 3 * 24 * 60 * 60 * 1000; // 3 dias (mais persistente)

// ─── Carrega questões do arquivo local ────────────────────────────────────────
function loadFromFile() {
  try {
    if (fs.existsSync(QUESTIONS_FILE)) {
      const data = JSON.parse(fs.readFileSync(QUESTIONS_FILE, 'utf-8'));
      if (data.questions) {
        Object.assign(questionPool, data.questions);
        cacheLoadedAt = new Date(data.generatedAt).getTime();
        console.log(`[Cache] Carregado de ${QUESTIONS_FILE}`);
        console.log(`[Cache] Total: linguagens=${questionPool.linguagens.length}, humanas=${questionPool.humanas.length}, natureza=${questionPool.natureza.length}, matematica=${questionPool.matematica.length}`);
        return true;
      }
    }
  } catch (err) {
    console.warn('[Cache] Erro ao carregar arquivo local:', err.message);
  }
  return false;
}

// ─── Mapeamento categorias → disciplinas do ENEM ─────────────────────────────
const CATEGORY_TO_DISCIPLINES = {
  humanas: ['linguagens', 'humanas'],
  exatas: ['natureza', 'matematica'],
  completa: ['linguagens', 'humanas', 'natureza', 'matematica'],
};

// ─── Map disciplina da API para chave do cache ───────────────────────────────
function mapDiscipline(apiDiscipline) {
  if (!apiDiscipline) return null;
  const d = apiDiscipline.toString().toLowerCase();

  if (['linguagens', 'portugues', 'ingles', 'literatura', 'espanhol', 'artes', 'educacao_fisica'].includes(d)) return 'linguagens';
  if (['ciencias-humanas', 'humanas', 'historia', 'geografia', 'filosofia', 'sociologia'].includes(d)) return 'humanas';
  if (['ciencias-natureza', 'natureza', 'biologia', 'quimica', 'fisica'].includes(d)) return 'natureza';
  if (['matematica'].includes(d)) return 'matematica';

  console.warn(`[Cache] Disciplina desconhecida: '${apiDiscipline}'`);
  return null;
}

// ─── Normaliza questões ──────────────────────────────────────────────────────
function normalizeQuestion(q, disciplinaKey) {
  // Filtro básico de integridade
  if (!q.alternatives || q.alternatives.length < 4) return null;
  
  const alternativas = (q.alternatives || []).map((a, i) => ({
    letra: a.letter || String.fromCharCode(65 + i),
    texto: a.text || '',
    imgUrl: a.file || null,
    isCorrect: !!a.isCorrect,
  }));

  const gabaritoObj = alternativas.find(a => a.isCorrect === true);
  if (!gabaritoObj) return null; // Sem resposta correta = questão inválida

  // A API enem.dev usa dois campos para compor a questão:
  //   q.context              → texto/enunciado principal (problema, texto de apoio, dados)
  //   q.alternativesIntroduction → pergunta final ("Qual o valor de X?", "Assinale...")
  //
  // Questões de exatas costumam ter todo o problema em `context` e só a
  // pergunta final em `alternativesIntroduction`, por isso o enunciado aparecia
  // incompleto quando usávamos apenas `alternativesIntroduction`.
  //
  // Solução: usar `context` como enunciado principal e, se houver
  // `alternativesIntroduction`, concatená-lo ao final como a pergunta.

  const contextoPrincipal = (q.context || q.statement || q.text || '').trim();
  const perguntaFinal = (q.alternativesIntroduction || '').trim();

  // Monta o enunciado completo evitando duplicação
  let enunciado = contextoPrincipal;
  if (perguntaFinal && !contextoPrincipal.includes(perguntaFinal)) {
    enunciado = contextoPrincipal
      ? `${contextoPrincipal}\n\n${perguntaFinal}`
      : perguntaFinal;
  }

  enunciado = enunciado.trim();

  // Extrai imagens
  const allImages = (q.files || []).filter(
    f => typeof f === 'string' && f.startsWith('http') && !f.includes('broken-image')
  );

  // Gera um ID único e estável: Ano + Numero + Disciplina
  const stableId = `${q.year || '0'}-${q.index || '0'}-${disciplinaKey}`;

  // ─── Proteção de enunciados corrigidos manualmente ────────────────────────
  // Se esta questão tem um enunciado protegido, usamos ele sempre,
  // independente do que a API retornar.
  const enunciadoProtegido = ENUNCIADOS_PROTEGIDOS[stableId];
  if (enunciadoProtegido) {
    console.log(`[Protegido] Preservando enunciado manual: ${stableId}`);
    return {
      id: stableId,
      ano: q.year || 0,
      numero: q.index || 0,
      disciplina: disciplinaKey,
      contexto: '',
      enunciado: enunciadoProtegido.trim(),
      alternativas: (q.alternatives || []).map((a, i) => ({
        letra: a.letter || String.fromCharCode(65 + i),
        texto: a.text || '',
        imgUrl: a.file || null,
        isCorrect: !!a.isCorrect,
      })),
      imagens: allImages,
      gabarito: (q.alternatives || []).find(a => a.isCorrect)?.letter || '',
    };
  }
  // ─────────────────────────────────────────────────────────────────────────

  if (enunciado.length < 10) return null; // Enunciado muito curto/vazio

  return {
    id: stableId,
    ano: q.year || 0,
    numero: q.index || 0,
    disciplina: disciplinaKey,
    contexto: '', // contexto agora está incorporado no enunciado
    enunciado: enunciado,
    alternativas,
    imagens: allImages,
    gabarito: gabaritoObj.letra,
  };
}

// ─── Busca questões por ano e paginação ──────────────────────────────────────
async function fetchQuestionsByYear(year, limit = 50, retries = 3) {
  let offset = 0;
  let allQuestions = [];

  while (true) {
    const url = `${ENEM_API_BASE}/exams/${year}/questions?limit=${limit}&offset=${offset}`;
    console.log(`[ENEM API] Buscando: ${url}`);

    let res;
    try {
      res = await fetch(url, { headers: { Accept: 'application/json' }, timeout: 15000 });
    } catch (err) {
      console.warn(`[ENEM API] Erro de rede para year=${year}: ${err.message}`);
      if (retries > 0) {
        console.warn(`[ENEM API] Tentando novamente (${retries} restantes)...`);
        await new Promise(r => setTimeout(r, 2000));
        retries--;
        continue;
      }
      break;
    }

    if (res.status === 429) {
      console.warn(`[ENEM API] Rate limit atingido para year=${year}, esperando 2s...`);
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }

    if (!res.ok) {
      console.warn(`[ENEM API] Ignorando ano ${year} - ${res.status} ${res.statusText}`);
      break;
    }

    const data = await res.json();
    const questions = data.questions || data.data || [];
    if (!Array.isArray(questions) || questions.length === 0) break;

    allQuestions = allQuestions.concat(questions);
    if (questions.length < limit) break; // última página
    offset += limit;

    await new Promise(r => setTimeout(r, 1500)); // evita rate limit
  }

  return allQuestions;
}

// ─── Popula cache ────────────────────────────────────────────────────────────
async function populateCache() {
  console.log('[Cache] Populando cache de questões...');
  try {
    const exams = await fetch(`${ENEM_API_BASE}/exams`).then(r => r.json());
    if (!Array.isArray(exams)) throw new Error('Falha ao obter lista de exames');

    const seenIds = new Set();
    const newPool = { linguagens: [], humanas: [], natureza: [], matematica: [] };

    for (const exam of exams) {
      console.log(`[Cache] Processando ano ${exam.year}...`);
      let questions = [];
      try {
        questions = await fetchQuestionsByYear(exam.year, 50);
      } catch (err) {
        console.warn(`[Cache] Erro ao buscar ano ${exam.year}: ${err.message}`);
        continue;
      }

      for (const q of questions) {
        const rawDiscipline = q.discipline || q.subject;
        if (!rawDiscipline) continue;

        const disciplina = mapDiscipline(rawDiscipline);
        if (!disciplina) continue;

        const normalized = normalizeQuestion(q, disciplina);
        if (normalized && !seenIds.has(normalized.id)) {
          seenIds.add(normalized.id);
          newPool[disciplina].push(normalized);
        }
      }

      await new Promise(r => setTimeout(r, 500));
    }

    // Aplicação atômica do novo pool
    Object.assign(questionPool, newPool);
    cacheLoadedAt = Date.now();

    console.log('[Cache] Cache populado com sucesso!');
    for (const key of Object.keys(questionPool)) {
      console.log(`[Cache] ${key}: ${questionPool[key].length} questões`);
    }
  } catch (err) {
    console.error('[Cache] Erro fatal ao popular cache:', err.message);
  }
}

// ─── Histórico de questões por usuário (anti-repetição) ──────────────────────
// Chave: userId  →  Map<category, Set<questionId>>
// Quando o usuário vê todas as questões de uma categoria, o histórico é resetado.
const userHistory = new Map();

const HISTORY_TTL = 7 * 24 * 60 * 60 * 1000; // 7 dias

// Limpeza periódica do histórico de usuários inativos
setInterval(() => {
  const now = Date.now();
  for (const [userId, entry] of userHistory.entries()) {
    if (now - entry.lastSeen > HISTORY_TTL) {
      userHistory.delete(userId);
    }
  }
}, 60 * 60 * 1000); // roda a cada 1h

function getOrCreateHistory(userId, category) {
  if (!userHistory.has(userId)) {
    userHistory.set(userId, { lastSeen: Date.now(), categories: {} });
  }
  const entry = userHistory.get(userId);
  entry.lastSeen = Date.now();
  if (!entry.categories[category]) {
    entry.categories[category] = new Set();
  }
  return entry.categories[category];
}

function recordSeen(userId, category, questionIds) {
  const seen = getOrCreateHistory(userId, category);
  for (const id of questionIds) seen.add(id);
}

// ─── Retorna questões aleatórias para categoria ─────────────────────────────
async function getQuestions(category, count, userId = null) {
  // Tenta carregar do arquivo local primeiro se o cache estiver zerado
  const totalCache = Object.values(questionPool).reduce((sum, arr) => sum + arr.length, 0);
  if (totalCache === 0) {
    if (!loadFromFile()) {
      console.log('[Cache] Arquivo não encontrado, buscando da API...');
      await populateCache();
    }
  }

  const disciplines = CATEGORY_TO_DISCIPLINES[category];
  if (!disciplines) throw new Error(`Categoria inválida: ${category}`);

  let pool = [];
  for (const disc of disciplines) {
    pool = pool.concat(questionPool[disc] || []);
  }

  // Se ainda não tem questões suficientes, tenta da API
  if (pool.length < count) {
    console.log(`[Cache] Questões insuficientes para ${category}, buscando da API...`);
    await populateCache();
    pool = [];
    for (const disc of disciplines) {
      pool = pool.concat(questionPool[disc] || []);
    }
  }

  if (pool.length < count) {
    throw new Error(`Questões insuficientes no cache para ${category} (${pool.length} disponíveis, ${count} solicitadas)`);
  }

  // ─── Anti-repetição por usuário ──────────────────────────────────────────
  let candidatas = pool;

  if (userId) {
    const seen = getOrCreateHistory(userId, category);

    // Filtra questões que o usuário ainda não viu
    const novas = pool.filter(q => !seen.has(q.id));

    if (novas.length >= count) {
      // Tem questões suficientes não vistas — usa só elas
      candidatas = novas;
      console.log(`[AntiRepeat] ${userId} | ${category}: ${novas.length} novas disponíveis (${seen.size} já vistas)`);
    } else {
      // Usuário esgotou o pool — reseta o histórico e recomeça do zero
      console.log(`[AntiRepeat] ${userId} | ${category}: pool esgotado (${seen.size} vistas). Resetando histórico.`);
      seen.clear();
      candidatas = pool;
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  // Embaralha com Fisher-Yates e retorna
  const shuffled = [...candidatas];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const selected = shuffled.slice(0, count);

  // Registra no histórico do usuário
  if (userId) {
    recordSeen(userId, category, selected.map(q => q.id));
  }

  return selected;
}

// ─── Inicializa cache ao importar ────────────────────────────────────────────
// Tenta carregar do arquivo primeiro
loadFromFile();

module.exports = { getQuestions, populateCache, loadFromFile, questionPool, recordSeen };