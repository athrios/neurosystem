const FREQUENCY_5 = [
  '0 = Nunca',
  '1 = Raramente',
  '2 = Às vezes',
  '3 = Frequentemente',
  '4 = Quase sempre',
];

const ASRS_FREQUENCY = [
  'NUNCA (0)',
  'RARAMENTE (1)',
  'ALGUMAS VEZES (2)',
  'FREQUENTEMENTE (3)',
  'MUITO FREQUENTEMENTE (4)',
];

const HAMILTON_INTENSITY = [
  '0 = Ausência',
  '1 = Intensidade Ligeira',
  '2 = Intensidade Média',
  '3 = Intensidade Forte',
  '4 = Intensidade Máxima (Incapacitante)',
];

function scaleSection(id, title, items, options = FREQUENCY_5) {
  return {
    id,
    title,
    questions: items.map((label, index) => ({
      id: `${id}-${index + 1}`,
      type: 'single',
      label,
      required: true,
      options,
    })),
  };
}

function openQuestion(id, label) {
  return { id, type: 'textarea', label, required: true, options: [] };
}

const had = {
  key: 'had',
  name: 'Escala HAD',
  shortName: 'HAD',
  description: 'Avaliação do nível de ansiedade e depressão.',
  sourceUrl: 'https://forms.gle/rnoKBMhhj7voYfSW8',
  tags: ['Ansiedade', 'Depressão'],
  sections: [{
    id: 'had-questionario',
    title: 'Questionário HAD',
    questions: [
      ['Eu me sinto tensa(o) ou contraída(o):', ['A maior parte do tempo [3]', 'Boa parte do tempo [2]', 'De vez em quando [1]', 'Nunca [0]']],
      ['Eu ainda sinto que gosto das mesmas coisas de antes:', ['Sim, do mesmo jeito que antes [0]', 'Não tanto quanto antes [1]', 'Só um pouco [2]', 'Já não consigo ter prazer em nada [3]']],
      ['Eu sinto uma espécie de medo, como se alguma coisa ruim fosse acontecer:', ['Sim, de jeito muito forte [3]', 'Sim, mas não tão forte [2]', 'Um pouco, mas isso não me preocupa [1]', 'Não sinto nada disso [0]']],
      ['Dou risada e me divirto quando vejo coisas engraçadas:', ['Do mesmo jeito que antes [0]', 'Atualmente um pouco menos [1]', 'Atualmente bem menos [2]', 'Não consigo mais [3]']],
      ['Estou com a cabeça cheia de preocupações:', ['A maior parte do tempo [3]', 'Boa parte do tempo [2]', 'De vez em quando [1]', 'Raramente [0]']],
      ['Eu me sinto alegre:', ['A maior parte do tempo [0]', 'Muitas vezes [1]', 'Poucas vezes [2]', 'Nunca [3]']],
      ['Consigo ficar sentado à vontade e me sentir relaxado:', ['Sim, quase sempre [0]', 'Muitas vezes [1]', 'Poucas vezes [2]', 'Nunca [3]']],
      ['Eu estou lenta(o) para pensar e fazer coisas:', ['Quase sempre [3]', 'Muitas vezes [2]', 'De vez em quando [1]', 'Nunca [0]']],
      ['Eu tenho uma sensação ruim de medo, como um frio na barriga ou um aperto no estômago:', ['Não sinto nada disso [0]', 'De vez em quando [1]', 'Muitas vezes [2]', 'Quase sempre [3]']],
      ['Eu perdi o interesse em cuidar da minha aparência:', ['Completamente [3]', 'Não estou mais me cuidando como eu deveria [2]', 'Talvez não tanto quanto antes [1]', 'Me cuido do mesmo jeito que antes [0]']],
      ['Eu me sinto inquieta(o), como se eu não pudesse ficar parada(o) em lugar nenhum:', ['Sim, demais [3]', 'Bastante [2]', 'Um pouco [1]', 'Não me sinto assim [0]']],
      ['Fico animada(o) esperando as coisas boas que estão por vir:', ['Do mesmo jeito que antes [0]', 'Um pouco menos que antes [1]', 'Bem menos do que antes [2]', 'Quase nunca [3]']],
      ['De repente, tenho a sensação de entrar em pânico:', ['A quase todo momento [3]', 'Várias vezes [2]', 'De vez em quando [1]', 'Não senti isso [0]']],
      ['Consigo sentir prazer quando assisto a um bom programa, ouço rádio ou leio alguma coisa:', ['Quase sempre [0]', 'Várias vezes [1]', 'Poucas vezes [2]', 'Quase nunca [3]']],
    ].map(([label, options], index) => ({
      id: `had-${index + 1}`,
      type: 'single',
      label: `${index + 1}. ${label}`,
      required: true,
      options,
    })),
  }],
};

const hamilton = {
  key: 'hamilton',
  name: 'Escala de Ansiedade de Hamilton',
  shortName: 'HAM-A',
  description: 'Avaliação clínica da intensidade de sintomas ansiosos.',
  sourceUrl: 'https://forms.gle/wEvadFteuBL3UqdEA',
  tags: ['Ansiedade', 'Entrevista clínica'],
  sections: [
    scaleSection('hamilton-sintomas', 'Avaliação dos sintomas', [
      '1. Humor ansioso (inquietude, temor do pior, apreensão quanto ao futuro ou presente, irritabilidade)',
      '2. Tensão (sensação de tensão, fatigabilidade, tremores, choro fácil, incapacidade de relaxar, agitação, reações de sobressalto)',
      '3. Medo (de escuro, de desconhecidos, de multidão, de ser abandonado, de animais grandes, de trânsito)',
      '4. Insônia (dificuldade de adormecer, sonhos penosos, sono interrompido, sono insatisfatório, fadiga ao acordar, pesadelos, terrores noturnos)',
      '5. Dificuldades intelectuais (dificuldade de concentração, distúrbios de memória)',
      '6. Humor depressivo (perda de interesse, humor variável, indiferença às atividades de rotina, despertar precoce, depressão)',
      '7. Sintomas somáticos gerais — musculares (dores e lassidão muscular, rigidez muscular, mioclonias, ranger de dentes, voz insegura)',
      '8. Sintomas somáticos gerais — sensoriais (visão turva, ondas de calor ou frio, sensação de fraqueza, sensação de picada, zumbidos)',
      '9. Sintomas cardiovasculares (taquicardia, palpitações, dores pré-cordiais, batidas, pulsações arteriais, sensação de desmaio)',
      '10. Sintomas respiratórios (sensação de opressão, dispneia, constrição torácica, suspiro, bolo faríngeo)',
      '11. Sintomas gastrointestinais (dificuldade de engolir, aerofagia, dispepsia, dor pré ou pós-prandial, queimações, empanzinamento, náuseas, vômitos, cólicas, diarreia, constipação, perda de peso)',
      '12. Sintomas gênito-urinários (micções frequentes, urgência, frigidez, amenorreia, ejaculação precoce, ausência de ereção, impotência)',
      '13. Sintomas do sistema nervoso autônomo (secura na boca, ruborização, palidez, tendência à sudação, vertigens, cefaleia de tensão)',
      '14. Comportamento na entrevista (tensão, agitação das mãos/dedos, inquietação, eructações, taquicardia em repouso ou ritmo respiratório > 20 rpm)',
    ], HAMILTON_INTENSITY),
  ],
};

const executive = {
  key: 'funcoes-executivas',
  name: 'Funcionamento Executivo no Cotidiano',
  shortName: 'Funções executivas',
  description: 'Rastreio de organização, iniciação, atenção, memória de trabalho, flexibilidade e controle emocional.',
  sourceUrl: 'https://forms.gle/hW2qmywiwNJRkQHn7',
  tags: ['Funções executivas', 'Cotidiano'],
  sections: [
    scaleSection('fe-organizacao', 'Organização e planejamento', [
      'Tenho dificuldade para organizar minhas atividades do dia a dia.',
      'Costumo deixar tarefas importantes para a última hora.',
      'Tenho dificuldade para planejar etapas de uma tarefa mais complexa.',
      'Frequentemente subestimo o tempo necessário para concluir atividades.',
      'Tenho dificuldade para definir prioridades quando existem muitas demandas.',
    ]),
    scaleSection('fe-iniciacao', 'Iniciação de tarefas', [
      'Demoro para começar tarefas, mesmo sabendo que são importantes.',
      'Preciso sentir pressão ou urgência para conseguir iniciar algumas atividades.',
      'Costumo adiar tarefas que exigem esforço mental prolongado.',
    ]),
    scaleSection('fe-atencao', 'Atenção e concentração', [
      'Perco o foco facilmente durante atividades longas.',
      'Preciso reler textos ou instruções porque minha atenção se dispersa.',
      'Durante conversas, às vezes percebo que deixei de prestar atenção ao que estava sendo dito.',
      'Tenho dificuldade para manter a concentração em atividades pouco interessantes.',
    ]),
    scaleSection('fe-memoria', 'Memória de trabalho', [
      'Esqueço informações que acabei de receber.',
      'Entro em um ambiente e esqueço o que fui fazer.',
      'Tenho dificuldade para manter várias informações em mente ao mesmo tempo.',
      'Costumo perder o raciocínio durante tarefas ou conversas.',
    ]),
    scaleSection('fe-monitoramento', 'Monitoramento e controle', [
      'Cometo erros por distração em atividades que conheço bem.',
      'Só percebo alguns erros depois que a tarefa já foi concluída.',
      'Tenho dificuldade para acompanhar meu próprio progresso em tarefas longas.',
    ]),
    scaleSection('fe-flexibilidade', 'Flexibilidade cognitiva', [
      'Tenho dificuldade para mudar planos quando algo não sai como esperado.',
      'Fico frustrado quando preciso alterar uma rotina previamente estabelecida.',
      'Demoro para me adaptar a mudanças inesperadas.',
    ]),
    scaleSection('fe-emocional', 'Controle emocional', [
      'Pequenos problemas podem gerar mais estresse do que eu gostaria.',
      'Quando fico frustrado, tenho dificuldade para recuperar o equilíbrio emocional rapidamente.',
      'Meu estado emocional interfere no meu desempenho em tarefas importantes.',
    ]),
    {
      id: 'fe-abertas',
      title: 'Perguntas abertas',
      questions: [
        openQuestion('fe-aberta-1', 'Quais são suas maiores dificuldades no dia a dia relacionadas à organização, atenção ou planejamento?'),
        openQuestion('fe-aberta-2', 'Essas dificuldades estão presentes desde a infância, adolescência ou surgiram apenas na vida adulta?'),
        openQuestion('fe-aberta-3', 'Em quais áreas da vida elas causam mais impacto atualmente (trabalho, relacionamentos, estudos, rotina doméstica, finanças)?'),
        openQuestion('fe-aberta-4', 'O que você costuma fazer para compensar ou lidar com essas dificuldades?'),
      ],
    },
  ],
};

const tpoc = {
  key: 'tpoc',
  name: 'Questionário TPOC',
  shortName: 'TPOC',
  description: 'Rastreio clínico de rigidez, perfeccionismo, controle e prejuízos associados.',
  sourceUrl: 'https://forms.gle/x9bzHtUE4PcMyWaK7',
  tags: ['Personalidade', 'Rastreio clínico'],
  sections: [
    scaleSection('tpoc-tracos', 'Avaliação de traços', [
      '1. Tenho dificuldade em concluir tarefas porque gasto muito tempo tentando fazer tudo da melhor forma possível.',
      '2. Costumo me preocupar excessivamente com detalhes, regras, listas, organização ou planejamento.',
      '3. Frequentemente dedico tanto tempo ao trabalho ou às minhas responsabilidades que deixo de lado momentos de lazer, descanso ou convivência social.',
      '4. Tenho dificuldade em flexibilizar regras ou procedimentos que considero corretos.',
      '5. Sinto desconforto quando outras pessoas realizam tarefas de maneira diferente da que considero adequada.',
      '6. Tenho dificuldade em delegar atividades porque acredito que os outros não farão da forma correta.',
      '7. Costumo ser muito exigente comigo mesmo.',
      '8. Tenho dificuldade em aceitar erros, mesmo quando são pequenos ou não trazem consequências importantes.',
      '9. Quando algo sai diferente do planejado, demoro para me adaptar à mudança.',
      '10. As pessoas já me descreveram como perfeccionista, rígido ou excessivamente detalhista.',
      '11. Costumo revisar várias vezes uma tarefa para ter certeza de que está correta.',
      '12. Tenho dificuldade em descartar objetos, documentos ou materiais porque acredito que possam ser úteis no futuro.',
      '13. Sinto necessidade de manter controle sobre situações importantes da minha vida.',
      '14. Tenho dificuldade em relaxar quando ainda existem tarefas pendentes.',
      '15. Frequentemente sinto que poderia ter feito melhor, mesmo quando recebo resultados positivos.',
      '16. Fico frustrado quando os outros não seguem padrões de qualidade semelhantes aos meus.',
      '17. Tenho tendência a assumir muitas responsabilidades porque acredito que os outros podem não executá-las adequadamente.',
      '18. Minha necessidade de organização, controle ou perfeição já causou dificuldades em relacionamentos, trabalho ou outras áreas da vida.',
    ]),
    {
      id: 'tpoc-abertas',
      title: 'Perguntas complementares abertas',
      questions: [
        openQuestion('tpoc-aberta-1', 'Como você se sente quando comete um erro?'),
        openQuestion('tpoc-aberta-2', 'Como reage quando alguém realiza uma tarefa de forma diferente da sua?'),
        openQuestion('tpoc-aberta-3', 'Você costuma adiar tarefas por receio de não executá-las perfeitamente?'),
        openQuestion('tpoc-aberta-4', 'Sua busca por qualidade já trouxe prejuízos no trabalho, relacionamentos ou bem-estar?'),
        openQuestion('tpoc-aberta-5', 'As características descritas acima estão presentes desde quando você se lembra?'),
      ],
    },
  ],
};

const DIVA_SYMPTOMS = [
  {
    code: 'A1',
    title: 'Você com frequência não presta atenção suficiente aos detalhes ou comete erros por distração?',
    adult: ['Comete erros por distração', 'Tem que trabalhar devagar para evitar erros', 'Não lê as instruções com atenção', 'Não é bom em trabalhos detalhados', 'Precisa de muito tempo para os detalhes', 'Perde-se nos detalhes', 'Trabalha muito rápido e comete erros'],
    child: ['Cometia erros por distração nos trabalhos escolares', 'Lia as perguntas de forma errada', 'Deixava perguntas sem responder', 'Trabalho escolar desleixado', 'Não revia as respostas', 'Precisava de muito tempo para detalhes'],
  },
  {
    code: 'A2',
    title: 'Você com frequência tem dificuldade em manter-se concentrado durante as tarefas?',
    adult: ['Não consegue manter a atenção muito tempo', 'Distrai-se com os próprios pensamentos', 'Dificuldade em ver filme ou ler livro até o fim', 'Fica entediado rapidamente', 'Faz perguntas sobre assuntos já discutidos'],
    child: ['Dificuldade em prestar atenção na escola', 'Dificuldade em manter-se atento a jogos', 'Distraía-se facilmente', 'Dificuldade de concentração', 'Precisava de ambiente estruturado'],
  },
  {
    code: 'A3',
    title: 'Você com frequência parece não estar ouvindo quando alguém lhe dirige diretamente a palavra?',
    adult: ['Divaga ou parece ausente', 'Dificuldade de concentrar-se numa conversa', 'Não sabe do que se falou depois', 'Muda frequentemente o assunto', 'Os outros dizem que está com a cabeça em outro lugar'],
    child: ['Não se lembrava do que os pais ou professores diziam', 'Estava frequentemente sonhando ou ausente', 'Ouvia apenas quando olhavam nos olhos', 'Precisava ser chamado várias vezes'],
  },
  {
    code: 'A4',
    title: 'Você com frequência não segue as instruções ou não consegue terminar as tarefas?',
    adult: ['Faz várias coisas ao mesmo tempo sem terminar', 'Dificuldade para finalizar tarefas que não são novidade', 'Necessita de prazos-limite', 'Dificuldade com tarefas administrativas', 'Dificuldade em seguir manuais'],
    child: ['Dificuldade em estar pronto na hora', 'Quarto ou mesa desarrumados', 'Dificuldade de planejar lição de casa', 'Fazia várias coisas ao mesmo tempo', 'Chegava atrasado ou sem noção de tempo'],
  },
  {
    code: 'A5',
    title: 'Você com frequência tem dificuldade para organizar tarefas e atividades?',
    adult: ['Dificuldade no planejamento do dia a dia', 'Casa ou trabalho desorganizados', 'Trabalha de forma desarrumada', 'Marca compromissos no mesmo horário', 'Chega atrasado ou perde prazos'],
    child: ['Dificilmente estava pronto a tempo', 'Quarto desarrumado', 'Dificuldade em brincar sozinho', 'Falhava prazos da escola', 'Má percepção de tempo'],
  },
  {
    code: 'A6',
    title: 'Você com frequência evita tarefas que requeiram esforço mental continuado?',
    adult: ['Faz primeiro o que é fácil ou divertido', 'Adia tarefas entediantes', 'Evita trabalho administrativo', 'Não gosta de ler porque exige esforço', 'Evita preparar relatórios longos'],
    child: ['Evitava ou detestava lição de casa', 'Lia poucos livros', 'Evitava coisas que exigiam muita concentração', 'Detestava matérias difíceis', 'Adiava tarefas'],
  },
  {
    code: 'A7',
    title: 'Você com frequência perde objetos necessários para as tarefas ou atividades?',
    adult: ['Perde carteira, chaves ou agenda', 'Deixa coisas para trás', 'Entra em pânico se mudam as coisas de lugar', 'Perde tempo procurando coisas', 'Perde papéis do trabalho'],
    child: ['Perdia agenda, canetas ou material', 'Perdia muito tempo procurando as coisas', 'Perdia roupas ou brinquedos', 'Entrava em pânico se mudassem suas coisas'],
  },
  {
    code: 'A8',
    title: 'Você com frequência se distrai facilmente com estímulos externos?',
    adult: ['Dificuldade em ignorar estímulos', 'Dificuldade em voltar ao assunto após distração', 'Escuta a conversa dos outros', 'Dificuldade em filtrar informação'],
    child: ['Olhava muitas vezes pela janela na aula', 'Distraía-se com barulhos', 'Após se distrair, custava voltar à tarefa'],
  },
  {
    code: 'A9',
    title: 'Você com frequência se esquece das atividades do dia a dia?',
    adult: ['Esquece compromissos', 'Esquece chaves ou celular', 'Precisa ser lembrado de pagar contas', 'Precisa voltar em casa para buscar coisas esquecidas'],
    child: ['Esquecia instruções ou tarefas', 'Tinha que ser lembrado frequentemente', 'Esquecia de levar coisas para a escola', 'Esquecia materiais na escola'],
  },
  {
    code: 'HI1',
    title: 'Você com frequência mexe as mãos ou os pés de forma irrequieta, ou remexe-se na cadeira?',
    adult: ['Dificuldade em ficar quieto sentado', 'Balança as pernas', 'Brinca com a caneta', 'Rói unhas ou mexe no cabelo'],
    child: ['Pais mandavam sentar quieto', 'Balançava as pernas ou brincava com objetos', 'Não conseguia sentar normalmente na cadeira'],
  },
  {
    code: 'HI2',
    title: 'Você com frequência se levanta do lugar quando deveria permanecer sentado?',
    adult: ['Deixa frequentemente o lugar no trabalho', 'Evita palestras ou igreja', 'Prefere andar a ficar sentado', 'Usa desculpas para andar'],
    child: ['Levantava-se durante as refeições ou aulas', 'Dificuldade extrema de ficar sentado na escola', 'Levava broncas por não sentar'],
  },
  {
    code: 'HI3',
    title: 'Você com frequência sente-se irrequieto (na infância: corria ou subia nas coisas)?',
    adult: ['Sente-se agitado por dentro', 'Sensação de precisar estar ocupado', 'Dificuldade em relaxar', 'Está sempre correndo'],
    child: ['Subia nos móveis ou árvores', 'Sentia-se agitado por dentro', 'Corria em situações inadequadas'],
  },
  {
    code: 'HI4',
    title: 'Você com frequência tem dificuldade em dedicar-se tranquilamente a atividades de lazer?',
    adult: ['Fala quando é inapropriado', 'Tende a chamar atenção em público', 'Dificuldade em fazer atividades em silêncio', 'É barulhento'],
    child: ['Era barulhento em jogos ou aulas', 'Não conseguia ver TV sossegadamente', 'Era repreendido para ficar mais quieto'],
  },
  {
    code: 'HI5',
    title: 'Você com frequência está “a mil por hora” ou age como se estivesse “ligado a um motor”?',
    adult: ['Sempre ocupado fazendo algo', 'Desconfortável em ficar parado por muito tempo', 'Excesso de energia, sempre em movimento', 'Passa dos próprios limites'],
    child: ['Constantemente ocupado', 'Considerado inquieto demais pelos outros', 'Excesso de atividade em casa e na escola'],
  },
  {
    code: 'HI6',
    title: 'Você com frequência fala excessivamente?',
    adult: ['Fala de forma agitada e cansativa', 'Fama de ser muito falador', 'Dificuldade em parar de falar', 'Não deixa os outros falarem'],
    child: ['Fama de tagarela', 'Professores mandavam calar a boca', 'Era castigado por falar demais', 'Distraía colegas conversando'],
  },
  {
    code: 'HI7',
    title: 'Você com frequência dá respostas antes que as perguntas terminem?',
    adult: ['Fala impulsivamente sem pensar', 'Diz o que vem à cabeça', 'Responde antes do outro terminar a frase', 'Completa a frase dos outros'],
    child: ['Dizia coisas sem pensar', 'Queria ser o primeiro a responder na escola', 'Interrompia os outros', 'Dificuldade de esperar a vez na conversa'],
  },
  {
    code: 'HI8',
    title: 'Você com frequência tem dificuldade em esperar a sua vez?',
    adult: ['Dificuldade em esperar em fila', 'Impaciente no trânsito', 'Inicia ou termina relações impulsivamente', 'É muito impaciente'],
    child: ['Dificuldade de aguardar a vez na sala', 'Dificuldade de esperar em jogos de grupo', 'Tornava-se impaciente facilmente', 'Atravessava a rua sem olhar'],
  },
  {
    code: 'HI9',
    title: 'Você com frequência interrompe ou se intromete nas atividades dos outros?',
    adult: ['Intromete-se nos assuntos dos outros', 'Interrompe as pessoas sem licença', 'Tem opinião para tudo e a expressa logo', 'Dificuldade em respeitar limites'],
    child: ['Intrometia-se nos jogos dos outros', 'Interrompia conversas', 'Não era capaz de esperar', 'Reagia a tudo imediatamente'],
  },
];

function divaQuestions(symptoms) {
  return symptoms.flatMap(symptom => {
    const id = symptom.code.toLowerCase();
    return [
      {
        id: `diva-${id}-adult-examples`,
        type: 'multi',
        label: `${symptom.code}. ${symptom.title} — exemplos presentes na idade adulta`,
        required: false,
        options: symptom.adult,
      },
      {
        id: `diva-${id}-adult`,
        type: 'single',
        label: 'Sintoma de TDAH presente na idade adulta (últimos 6 meses)?',
        required: true,
        options: ['Sim', 'Não'],
      },
      {
        id: `diva-${id}-child-examples`,
        type: 'multi',
        label: `${symptom.code}. Exemplos presentes na infância (5 a 12 anos)`,
        required: false,
        options: symptom.child,
      },
      {
        id: `diva-${id}-child`,
        type: 'single',
        label: 'Sintoma de TDAH presente na infância?',
        required: true,
        options: ['Sim', 'Não'],
      },
    ];
  });
}

const diva = {
  key: 'diva-5',
  name: 'DIVA-5',
  shortName: 'DIVA-5',
  description: 'Entrevista para investigação de sintomas de TDAH em adultos e na infância.',
  sourceUrl: 'https://forms.gle/uFwFxCSc5B8HZ3xr8',
  tags: ['TDAH', 'Entrevista diagnóstica'],
  sections: [
    {
      id: 'diva-desatencao',
      title: 'Parte 1 — Sintomas de déficit de atenção (A1 a A9)',
      questions: divaQuestions(DIVA_SYMPTOMS.slice(0, 9)),
    },
    {
      id: 'diva-hiperatividade',
      title: 'Parte 2 — Sintomas de hiperatividade/impulsividade (H/I 1 a 9)',
      questions: divaQuestions(DIVA_SYMPTOMS.slice(9)),
    },
    {
      id: 'diva-prejuizos',
      title: 'Parte 3 — Prejuízos devidos aos sintomas',
      questions: [
        {
          id: 'diva-before-12',
          type: 'single',
          label: 'Vários dos sintomas mencionados estavam presentes antes dos 12 anos?',
          required: true,
          options: ['Sim', 'Não'],
        },
        ...['Trabalho/Educação', 'Relacionamentos/Família', 'Interação social', 'Tempo livre/Hobbies', 'Autoconfiança/Autoimagem']
          .map((area, index) => ({
            id: `diva-impact-${index + 1}`,
            type: 'multi',
            label: `Em quais períodos houve prejuízo em ${area}?`,
            required: true,
            options: ['Idade adulta', 'Infância/Adolescência'],
          })),
      ],
    },
  ],
};

const asrs = {
  key: 'asrs-18',
  name: 'Escala ASRS-18',
  shortName: 'ASRS-18',
  description: 'Rastreio de sintomas de desatenção e hiperatividade/impulsividade em adultos.',
  sourceUrl: 'https://forms.gle/tnbwuiYCoqeGPugd7',
  tags: ['TDAH', 'Rastreio'],
  sections: [
    scaleSection('asrs-a', 'Parte A — Desatenção', [
      '1. Com que frequência você comete erros por falta de atenção quando tem de trabalhar num projeto chato ou difícil?',
      '2. Com que frequência você tem dificuldade para manter a atenção quando está fazendo um trabalho chato ou repetitivo?',
      '3. Com que frequência você tem dificuldade para se concentrar no que as pessoas dizem, mesmo quando elas estão falando diretamente com você?',
      '4. Com que frequência você deixa um projeto pela metade depois de já ter feito as partes mais difíceis?',
      '5. Com que frequência você tem dificuldade para fazer um trabalho que exige organização?',
      '6. Quando você precisa fazer algo que exige muita concentração, com que frequência você evita ou adia o início?',
      '7. Com que frequência você coloca as coisas fora do lugar ou tem dificuldade de encontrá-las em casa ou no trabalho?',
      '8. Com que frequência você se distrai com atividades ou barulho à sua volta?',
      '9. Com que frequência você tem dificuldade para lembrar de compromissos ou obrigações?',
    ], ASRS_FREQUENCY),
    scaleSection('asrs-b', 'Parte B — Hiperatividade/Impulsividade', [
      '1. Com que frequência você fica se mexendo na cadeira ou balançando as mãos ou os pés quando precisa ficar sentado(a) por muito tempo?',
      '2. Com que frequência você se levanta da cadeira em reuniões ou em outras situações em que deveria ficar sentado(a)?',
      '3. Com que frequência você se sente inquieto(a) ou agitado(a)?',
      '4. Com que frequência você tem dificuldade para sossegar e relaxar quando tem tempo livre?',
      '5. Com que frequência você se sente ativo(a) demais e necessitando fazer coisas, como se estivesse “com um motor ligado”?',
      '6. Com que frequência você se pega falando demais em situações sociais?',
      '7. Quando você está conversando, com que frequência se pega terminando as frases das pessoas antes delas?',
      '8. Com que frequência você tem dificuldade para esperar nas situações em que cada um tem a sua vez?',
      '9. Com que frequência você interrompe os outros quando eles estão ocupados?',
    ], ASRS_FREQUENCY),
  ],
};

export const ANAMNESIS_TEMPLATES = [had, hamilton, executive, tpoc, diva, asrs];

export function getAnamnesisTemplate(key) {
  return ANAMNESIS_TEMPLATES.find(template => template.key === key) || null;
}

export function countTemplateQuestions(template) {
  return template.sections.reduce((total, section) => total + section.questions.length, 0);
}

export function cloneTemplate(template) {
  return JSON.parse(JSON.stringify(template));
}
