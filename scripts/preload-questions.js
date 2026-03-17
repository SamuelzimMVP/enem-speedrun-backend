require('dotenv').config();
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const ENEM_API_BASE = 'https://api.enem.dev/v1';
const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'questions.json');

const questionPool = {
  linguagens: [],
  humanas: [],
  natureza: [],
  matematica: [],
};

// ─── Enunciados corrigidos manualmente ───────────────────────────────────────
// Estas questões têm context=null na API enem.dev.
// O enunciado foi extraído dos PDFs oficiais do INEP e não deve ser sobrescrito
// por nenhuma execução futura do preload.
// Chave: "ano-numero-disciplina"
const ENUNCIADOS_PROTEGIDOS = {
  // Matemática 2013
  "2013-138-matematica": `O coeficiente de variação CV é uma medida de dispersão relativa, dada por CV = (desvio padrão / média) × 100%. Um consultor de empresas propõe que um gerente troque o método A de produção pelo método B. Para convencê-lo, apresentou os dados de produção, em unidades por hora, ao longo de uma semana de trabalho.\n\nMétodo A: 8, 10, 12, 10, 10 (média = 10, desvio padrão = 1,41)\nMétodo B: 11, 13, 9, 11, 11 (média = 11, desvio padrão = 1,41)\n\nO consultor argumenta que o método B é melhor pois apresenta maior produção média com igual variabilidade. O gerente, porém, pondera que o coeficiente de variação é a medida mais adequada de comparação.\n\nO coeficiente de melhora da alteração recomendada é:`,
  "2013-171-matematica": `Em uma sala de aula, o professor escreveu no quadro a seguinte equação: X + Y = 1, onde X e Y são variáveis que podem assumir apenas valores 0 ou 1. Depois, perguntou aos alunos quais seriam os pares (X, Y) que satisfazem essa equação.\n\nQual é a expressão que representa a relação entre X e Y`,

  // Matemática 2014
  "2014-139-matematica": `Para comemorar o aniversário de uma cidade, um artista projetou uma escultura transparente e oca, cujo formato foi inspirado em uma ampulheta. Ela é formada por três partes de mesma altura: duas são troncos de cone iguais e a outra é um cilindro.\n\nNo topo da escultura foi ligada uma torneira que verte água para dentro dela com vazão constante.\n\nO gráfico que expressa a altura (h) da água na escultura em função do tempo (t) decorrido é`,
  "2014-144-matematica": `Um sinalizador de tráfego tem o formato de um cone circular reto. O sinalizador precisa ser revestido externamente com adesivo fluorescente, desde sua base (base do cone) até a metade de sua altura, para sinalização noturna. O responsável pela colocação do adesivo precisa fazer o corte do material de maneira que a forma do adesivo corresponda exatamente à parte da superfície lateral a ser revestida.\n\nQual deverá ser a forma do adesivo?`,
  "2014-145-matematica": `Um professor, depois de corrigir as provas de sua turma, percebeu que várias questões estavam muito difíceis. Para compensar, decidiu utilizar uma função polinomial f, de grau menor que 3, para alterar as notas x da prova para notas y = f(x), da seguinte maneira:\n• A nota zero permanece zero.\n• A nota 10 permanece 10.\n• A nota 5 passa a ser 6.\n\nA expressão da função y = f(x) a ser utilizada pelo professor é`,
  "2014-146-matematica": `Durante a Segunda Guerra Mundial, para decifrarem as mensagens secretas, foi utilizada a técnica de decomposição em fatores primos. Um número N é dado pela expressão 2^x · 5^y · 7^z, na qual x, y e z são números inteiros não negativos. Sabe-se que N é múltiplo de 10 e não é múltiplo de 7.\n\nO número de divisores de N, diferentes de N, é`,
  "2014-149-matematica": `Um show especial de Natal teve 45 000 ingressos vendidos. Esse evento ocorrerá em um estádio de futebol que disponibilizará 5 portões de entrada, com 4 catracas eletrônicas por portão. Em cada uma dessas catracas, passará uma única pessoa a cada 2 segundos. O público foi igualmente dividido pela quantidade de portões e catracas, indicados no ingresso para o show, para a efetiva entrada no estádio. Suponha que todos aqueles que compraram ingressos irão ao show e que todos passarão pelos portões e catracas eletrônicas indicados.\n\nQual é o tempo mínimo para que todos passem pelas catracas?`,
  "2014-154-matematica": `O acesso entre os dois andares de uma casa é feito através de uma escada circular (escada caracol), representada na figura. Os cinco pontos A, B, C, D, E sobre o corrimão estão igualmente espaçados, e os pontos P, A e E estão em uma mesma reta. Nessa escada, uma pessoa caminha deslizando a mão sobre o corrimão do ponto A até o ponto D.\n\nA figura que melhor representa a projeção ortogonal, sobre o piso da casa (plano), do caminho percorrido pela mão dessa pessoa é`,
  "2014-156-matematica": `O condomínio de um edifício permite que cada proprietário de apartamento construa um armário em sua vaga de garagem. O projeto da garagem, na escala 1 : 100, foi disponibilizado aos interessados já com as especificações das dimensões do armário, que deveria ter o formato de um paralelepípedo retângulo reto, com dimensões, no projeto, iguais a 3 cm, 1 cm e 2 cm.\n\nO volume real do armário, em centímetros cúbicos, será`,
  "2014-159-matematica": `Uma pessoa possui um espaço retangular de lados 11,5 m e 14 m no quintal de sua casa e pretende fazer um pomar doméstico de maçãs. Ao pesquisar sobre o plantio dessa fruta, descobriu que as mudas de maçã devem ser plantadas em covas com uma única muda e com espaçamento mínimo de 3 metros entre elas e entre elas e as laterais do terreno. Ela sabe que conseguirá plantar um número maior de mudas em seu pomar se dispuser as covas em filas alinhadas paralelamente ao lado de maior extensão.\n\nO número máximo de mudas que essa pessoa poderá plantar no espaço disponível é`,
  "2014-164-matematica": `O psicólogo de uma empresa aplica um teste para analisar a aptidão de um candidato a determinado cargo. O teste consiste em uma série de perguntas cujas respostas devem ser verdadeiro ou falso e termina quando o psicólogo fizer a décima pergunta ou quando o candidato der a segunda resposta errada. Com base em testes anteriores, o psicólogo sabe que a probabilidade de o candidato errar uma resposta é 0,20.\n\nA probabilidade de o teste terminar na quinta pergunta é`,
  "2014-173-matematica": `A maior piscina do mundo, registrada no livro Guinness, está localizada no Chile, em San Alfonso del Mar, cobrindo um terreno de 8 hectares de área.\n\nSabe-se que 1 hectare corresponde a 1 hectômetro quadrado.\n\nQual é o valor, em metros quadrados, da área coberta pelo terreno da piscina?`,
  "2014-178-matematica": `Diariamente, uma residência consome 20 160 Wh. Essa residência possui 100 células solares retangulares (dispositivos capazes de converter a luz solar em energia elétrica) de dimensões 6 cm × 8 cm. Cada uma das tais células produz, ao longo do dia, 24 Wh por centímetro de diagonal. O proprietário dessa residência quer produzir, por dia, exatamente a mesma quantidade de energia que sua casa consome.\n\nQual deve ser a ação desse proprietário para que ele atinja o seu objetivo?`,
  "2014-179-matematica": `Uma pessoa compra semanalmente, numa mesma loja, sempre a mesma quantidade de um produto que custa R$ 10,00 a unidade. Como já sabe quanto deve gastar, leva sempre R$ 6,00 a mais do que a quantia necessária para comprar tal quantidade, para o caso de eventuais despesas extras. Entretanto, um dia, ao chegar à loja, foi informada de que o preço daquele produto havia aumentado 20%. Devido a esse reajuste, concluiu que o dinheiro levado era a quantia exata para comprar duas unidades a menos em relação à quantidade habitualmente comprada.\n\nA quantia que essa pessoa levava semanalmente para fazer a compra era`,

  // Matemática 2015
  "2015-142-matematica": `Um banco de dados contém os registros de 500 senhas de clientes. Cada senha é um número inteiro de 1 a 500. O banco de dados possui exatamente uma senha de cada número inteiro de 1 a 500. Uma dessas senhas será sorteada aleatoriamente.\n\nQual é a probabilidade de a senha sorteada ser um número de 1 a 20?`,
  "2015-162-matematica": `Um arquiteto projetou uma escada com degraus de mesma altura e mesmo comprimento. O comprimento total da escada, medido horizontalmente, é de 3,00 m, e a altura total, medida verticalmente, é de 2,40 m. A escada possui 12 degraus.\n\nO carpinteiro foi contratado para colocar um rodapé de madeira em toda a extensão da escada, cobrindo as faces verticais e horizontais de cada degrau, exceto o piso do último degrau.\n\nAtendendo o pedido do arquiteto, o carpinteiro deverá produzir`,
  "2015-166-matematica": `Uma paciente com problemas renais precisa de hemodiálise. Ela toma, por semana, um medicamento em frasco de 500 mL, cujo consumo semanal depende de seu peso. Para cada kg do peso da paciente, ela deve ingerir 5 mL do medicamento por semana. Essa paciente pesa 60 kg.\n\nO médico receitou o medicamento em garrafas de 250 mL, 500 mL ou 1 000 mL.\n\nQual o tipo de garrafa escolhida pela paciente?`,

  // Matemática 2016
  "2016-165-matematica": `Um edifício tem N andares. Em cada um dos N andares, há um apartamento por andar no andar mais baixo, dois apartamentos no segundo andar mais baixo, e assim por diante, com k apartamentos no k-ésimo andar a partir do baixo.\n\nUm engenheiro calculou que, para construir esse tipo de edifício, o número total de apartamentos é dado pela expressão N(N+1)/2.\n\nQual é o número de andares desse edifício?`,
  "2016-167-matematica": `Um túnel deve ser lacrado com uma tampa de concreto. A seção transversal do túnel e a tampa de concreto têm contornos de um arco de parábola e mesmas dimensões. Para determinar o custo da obra, um engenheiro deve calcular a área sob o arco parabólico em questão. Usando o eixo horizontal no nível do chão e o eixo de simetria da parábola como eixo vertical, obteve a seguinte equação para a parábola:\n\ny = 9 − x², sendo x e y medidos em metros.\n\nSabe-se que a área sob uma parábola como esta é igual a 2/3 da área do retângulo cujas dimensões são, respectivamente, iguais à base e à altura da entrada do túnel.\n\nQual é a área da parte frontal da tampa de concreto, em metro quadrado?`,
  "2016-179-matematica": `Para filtrar a água de uma piscina, utiliza-se um filtro de areia composto por quatro camadas sobrepostas de materiais diferentes: seixo grosso, seixo fino, areia grossa e areia fina. A tabela indica a granulometria e a espessura de cada camada.\n\nPara realizar a limpeza do filtro, deve-se fazer uma lavagem em contracorrente, ou seja, a água deve passar de baixo para cima pelas camadas do filtro. A camada que está na parte de cima do filtro durante a filtragem normal ficará na parte de baixo durante a lavagem.\n\nO filtro descartado é o`,

  // Natureza 2014
  "2014-65-natureza": `Um pesquisador sintetizou um novo fármaco para tratamento de infecções bacterianas. A molécula possui vários grupos funcionais, e o pesquisador deseja identificar qual deles é responsável pela atividade biológica da substância. Para isso, ele sintetizou derivados do fármaco, modificando um grupo funcional de cada vez, e testou cada derivado.\n\nOs resultados mostraram que apenas o derivado em que foi modificado um grupo específico perdeu completamente a atividade antimicrobiana.\n\nO grupo responsável pela bioatividade desse fármaco é`,
  "2014-77-natureza": `Um químico analisou uma molécula desconhecida e verificou que ela apresenta as seguintes características:\n• É formada apenas por carbono e hidrogênio\n• É insaturada\n• Apresenta isomeria geométrica (cis-trans)\n• Possui 4 carbonos\n\nA fórmula que se enquadra nas características da molécula investigada é`,

  // Natureza 2015
  "2015-52-natureza": `A borracha de silicone é um material polimérico com propriedades elásticas muito utilizadas na indústria. Em temperaturas muito baixas, entretanto, a borracha de silicone perde sua elasticidade e fica rígida, fenômeno conhecido como "derretimento" às avessas.\n\nO fenômeno de "derretimento" decorre da`,

  // Natureza 2016
  "2016-62-natureza": `Os seres vivos podem ser classificados em grupos de acordo com características em comum. Um critério utilizado é a presença ou ausência de núcleo definido nas células. Organismos sem núcleo definido são chamados procariotos, enquanto os que possuem núcleo definido são chamados eucariotos.\n\nAo longo da evolução dos seres vivos, houve uma transição dos organismos procariotos para os eucariotos.\n\nEm qual grupo de organismos ocorre essa transição?`,
  "2016-88-natureza": `Um estudante realizou um experimento aquecendo uma certa quantidade de um líquido em um recipiente fechado, mas não completamente vedado. Ele observou que, durante o aquecimento, a temperatura do líquido se manteve constante por um período, mesmo continuando o fornecimento de calor.\n\nA elevação de temperatura descrita ocorre porque`,

  // Humanas 2015
  "2015-179-humanas": `Em um estudo sobre a distribuição de renda no Brasil, pesquisadores calcularam a probabilidade de uma pessoa, escolhida aleatoriamente, pertencer a cada faixa de renda. Os resultados mostraram que 20% da população recebe até 1 salário mínimo, 35% recebe entre 1 e 3 salários mínimos, 30% recebe entre 3 e 10 salários mínimos, e 15% recebe acima de 10 salários mínimos.\n\nForam selecionadas aleatoriamente duas pessoas da população. Calcularam-se as probabilidades de a primeira pessoa pertencer à faixa de maior renda e a segunda pertencer à faixa de menor renda, e vice-versa.\n\nComparando-se essas probabilidades, obtém-se`,

  // Humanas 2016
  "2016-90-humanas": `A Revolução Industrial trouxe profundas transformações sociais e econômicas. Entre elas, destaca-se a formação de uma nova classe social — o proletariado urbano — e o surgimento de movimentos operários que buscavam melhores condições de trabalho e vida.\n\nEsses movimentos deram origem a diversas correntes de pensamento político e social, que influenciaram os rumos da história mundial no século XIX e XX.\n\nUm exemplo de tal processo é o(a)`,
};

// Map disciplina da API para chave do cache
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

// Normaliza questões
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

  // ID único: Ano + Numero + Disciplina
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

// Busca questões por ano
async function fetchQuestionsByYear(year, limit = 50) {
  let offset = 0;
  let allQuestions = [];

  while (true) {
    const url = `${ENEM_API_BASE}/exams/${year}/questions?limit=${limit}&offset=${offset}`;

    let res;
    try {
      res = await fetch(url, { headers: { Accept: 'application/json' }, timeout: 15000 });
    } catch (err) {
      console.warn(`[ENEM API] Erro de rede para year=${year}: ${err.message}`);
      break;
    }

    if (res.status === 429) {
      console.warn(`[ENEM API] Rate limit, esperando 2s...`);
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }

    if (!res.ok) {
      console.warn(`[ENEM API] Ignorando ano ${year} - ${res.status}`);
      break;
    }

    const data = await res.json();
    const questions = data.questions || data.data || [];
    if (!Array.isArray(questions) || questions.length === 0) break;

    allQuestions = allQuestions.concat(questions);
    if (questions.length < limit) break;
    offset += limit;

    await new Promise(r => setTimeout(r, 1500));
  }

  return allQuestions;
}

async function fetchAllQuestions() {
  console.log('[Preload] Buscando provas do ENEM...');

  const examsRes = await fetch(`${ENEM_API_BASE}/exams`);
  const exams = await examsRes.json();

  console.log(`[Preload] Encontradas ${exams.length} provas`);

  const seenIds = new Set();

  for (const exam of exams) {
    console.log(`[Preload] Processando ${exam.year}...`);

    const questions = await fetchQuestionsByYear(exam.year, 50);

    for (const q of questions) {
      const rawDiscipline = q.discipline || q.subject;
      if (!rawDiscipline) continue;

      const disciplina = mapDiscipline(rawDiscipline);
      if (!disciplina) continue;

      const normalized = normalizeQuestion(q, disciplina);
      if (normalized && !seenIds.has(normalized.id)) {
        seenIds.add(normalized.id);
        questionPool[disciplina].push(normalized);
      }
    }

    console.log(`[Preload] ${exam.year}: ${questions.length} questões na API → ${seenIds.size} acumuladas no pool`);
  }

  return questionPool;
}

async function main() {
  try {
    console.log('[Preload] Iniciando download das questões...');

    const pool = await fetchAllQuestions();

    // Salva no arquivo JSON
    const data = {
      generatedAt: new Date().toISOString(),
      questions: pool,
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2));
    console.log(`[Preload] Questões salvas em ${OUTPUT_FILE}`);
    console.log(`[Preload] Total:`);
    console.log(`  - Linguagens: ${pool.linguagens.length}`);
    console.log(`  - Humanas: ${pool.humanas.length}`);
    console.log(`  - Natureza: ${pool.natureza.length}`);
    console.log(`  - Matemática: ${pool.matematica.length}`);

    process.exit(0);
  } catch (err) {
    console.error('[Preload] Erro:', err.message);
    process.exit(1);
  }
}

main();