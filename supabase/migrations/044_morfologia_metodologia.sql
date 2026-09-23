-- 044 — A metodologia do HarasPro entra no protocolo.
--
-- Os princípios que você trouxe são METODOLOGIA: como olhar, o que decompor,
-- o que não afirmar. Nenhum deles diz "a garupa do Mangalarga deve ter tantos
-- graus" — isso seria regra racial, e continua faltando o documento oficial.
--
-- Por isso tudo aqui entra como REGRA_TECNICA_HARASPRO, o degrau mais baixo
-- da hierarquia: quando o padrão oficial chegar, ele entra ACIMA disto e
-- prevalece sozinho, sem eu mexer em nada.

begin;

do $$
declare
  v_protocolo uuid;
  v_fonte uuid;
begin
  select id into v_protocolo from public.morfologia_protocolos
   where raca = 'Mangalarga Marchador' order by versao desc limit 1;

  -- Uma fonte só para a metodologia, verificada porque é autoria do produto —
  -- não é afirmação sobre a raça que precise de conferência externa.
  insert into public.morfologia_fontes
    (protocolo_id, tipo, titulo, organizacao, verificada, verificada_em)
  values (v_protocolo, 'REGRA_TECNICA_HARASPRO',
          'Metodologia de análise visual HarasPro', 'HarasPro', true, now())
  returning id into v_fonte;

  insert into public.morfologia_conhecimento
    (protocolo_id, fonte_id, categoria, subcategoria, afirmacao, tipo_fonte,
     confianca, situacao)
  values
  -- ---------------------------------------------- aparência e função
  (v_protocolo, v_fonte, 'APARENCIA_GERAL', 'beleza x função',
   'Separar harmonia estética de funcionalidade zootécnica. Um animal pode agradar ' ||
   'aos olhos e ter conformação pouco funcional para sela, e o contrário também ocorre. ' ||
   'As duas leituras entram no parecer; a nota não mede apenas agrado visual.',
   'REGRA_TECNICA_HARASPRO', 0.9, 'ativo'),

  (v_protocolo, v_fonte, 'CONFORMACAO_FUNCIONAL', 'leitura funcional',
   'Interpretar a morfologia em relação a equilíbrio, sustentação, angulações, ' ||
   'proporções e movimento — não como soma de partes bonitas. A pergunta é se o ' ||
   'conjunto serve a um cavalo de sela.',
   'REGRA_TECNICA_HARASPRO', 0.9, 'ativo'),

  -- ---------------------------------------------- expressão racial
  (v_protocolo, v_fonte, 'EXPRESSAO_RACIAL', 'decomposição',
   'Não reduzir expressão racial a uma impressão subjetiva única. Decompor ' ||
   'internamente: cabeça (formato, proporção, secura, simetria), fronte (largura, ' ||
   'planicidade), perfil (fronte e chanfro), olhos (tamanho, expressão, projeção, ' ||
   'simetria), orelhas (tamanho, implantação, direção, paralelismo, pontas), ' ||
   'narinas (tamanho e abertura), boca (comissura, lábios) e ganachas (abertura, definição).',
   'REGRA_TECNICA_HARASPRO', 0.9, 'ativo'),

  (v_protocolo, v_fonte, 'EXPRESSAO_RACIAL', 'além da cabeça',
   'A cabeça pesa muito na caracterização, mas não é toda ela. Considerar também ' ||
   'pescoço, corpo, proporções e harmonia do conjunto. Classificar expressão racial ' ||
   'somente pela cabeça é leitura incompleta.',
   'REGRA_TECNICA_HARASPRO', 0.9, 'ativo'),

  -- ---------------------------------------------- regiões
  (v_protocolo, v_fonte, 'CONJUNTO_FRENTE', 'composição',
   'O conjunto de frente é cabeça, pescoço, ligação cabeça-pescoço, inserção do ' ||
   'pescoço, cernelha e espádua lidos juntos: direção, sustentação, leveza e proporção. ' ||
   'Avaliar como conjunto, não como peças isoladas.',
   'REGRA_TECNICA_HARASPRO', 0.9, 'ativo'),

  (v_protocolo, v_fonte, 'PESCOCO', 'o que observar',
   'Observar comprimento, proporção, forma, direção, volume, ligação e leveza. ' ||
   'Descrever em termos relativos ao conjunto; não converter observação em medida.',
   'REGRA_TECNICA_HARASPRO', 0.85, 'ativo'),

  (v_protocolo, v_fonte, 'LINHA_SUPERIOR', 'continuidade',
   'Avaliar a linha superior como um todo: cernelha, dorso, lombo, transição ' ||
   'dorso-lombo, transição lombo-garupa e garupa. Procurar quebras de continuidade ' ||
   'e perda de harmonia, não apenas a altura de um ponto.',
   'REGRA_TECNICA_HARASPRO', 0.9, 'ativo'),

  (v_protocolo, v_fonte, 'TRONCO', 'o que observar',
   'Profundidade, capacidade torácica, arqueamento de costelas, comprimento e ' ||
   'sustentação, sempre em relação à linha superior e à função de sela.',
   'REGRA_TECNICA_HARASPRO', 0.85, 'ativo'),

  (v_protocolo, v_fonte, 'GARUPA', 'o que observar',
   'Comprimento, largura, forma, inclinação, musculatura, simetria, ligação com o ' ||
   'lombo e relação com os posteriores. Usar as laterais E a traseira: inclinação se ' ||
   'lê de lado, largura e simetria se leem por trás.',
   'REGRA_TECNICA_HARASPRO', 0.9, 'ativo'),

  (v_protocolo, v_fonte, 'MEMBROS_ANTERIORES', 'decomposição',
   'Decompor internamente: espádua, braço, antebraço, joelho, canela, boleto, ' ||
   'quartela e casco. Observar direção, comprimento, proporção, angulações e ' ||
   'alinhamento entre os segmentos.',
   'REGRA_TECNICA_HARASPRO', 0.9, 'ativo'),

  (v_protocolo, v_fonte, 'MEMBROS_POSTERIORES', 'decomposição',
   'Decompor internamente: coxa, perna, jarrete, canela, boleto, quartela e casco. ' ||
   'Observar comprimento, proporção, angulações, musculatura e alinhamento. ' ||
   'Não afirmar desempenho real a partir da morfologia.',
   'REGRA_TECNICA_HARASPRO', 0.9, 'ativo'),

  (v_protocolo, v_fonte, 'CONFORMACAO_FUNCIONAL', 'membros',
   'Membros sustentam o animal e participam diretamente da locomoção, influenciando ' ||
   'amplitude e equilíbrio. Não merecem avaliação superficial: o que for visualmente ' ||
   'relevante precisa ser explicado, e não apenas pontuado.',
   'REGRA_TECNICA_HARASPRO', 0.85, 'ativo'),

  -- ---------------------------------------------- aprumos e ângulos
  (v_protocolo, v_fonte, 'APRUMOS', 'estático x dinâmico',
   'Separar aprumo ESTÁTICO (fotos de frente, de trás e laterais) de aprumo ' ||
   'DINÂMICO (vídeo indo e voltando e seus frames). Observar tendências de ' ||
   'fechamento, abertura, rotação, desvio, regularidade e simetria. ' ||
   'Descrever tendência; não diagnosticar patologia.',
   'REGRA_TECNICA_HARASPRO', 0.95, 'ativo'),

  (v_protocolo, v_fonte, 'ANGULACOES', 'sem graus inventados',
   'Nunca declarar graus exatos a partir de imagem: não há sistema de mensuração ' ||
   'validado aqui. Usar linguagem qualitativa — adequada, discretamente aberta, ' ||
   'discretamente fechada, merece atenção — ou registrar evidência insuficiente.',
   'REGRA_TECNICA_HARASPRO', 0.95, 'ativo'),

  (v_protocolo, v_fonte, 'PROPORCOES', 'medida real manda',
   'Medida informada pelo proprietário tem prioridade sobre estimativa visual. ' ||
   'NUNCA produzir centímetros a partir de foto. Sem medida informada, falar de ' ||
   'proporção relativa entre segmentos, não de valores absolutos.',
   'REGRA_TECNICA_HARASPRO', 0.95, 'ativo'),

  -- ---------------------------------------------- movimento
  (v_protocolo, v_fonte, 'MOVIMENTO', 'favorece, não garante',
   'Boa morfologia PODE favorecer boa qualidade de movimento, mas não garante ' ||
   'marcha excepcional, dissociação, comodidade nem desempenho. Escrever ' ||
   '"a conformação apresenta características estruturalmente favoráveis ao movimento", ' ||
   'nunca "por ter essa morfologia terá excelente marcha".',
   'REGRA_TECNICA_HARASPRO', 0.95, 'ativo'),

  (v_protocolo, v_fonte, 'MARCHA', 'dissociação exige avaliação funcional',
   'Não inferir dissociação de marcha apenas pela morfologia. Sem avaliação ' ||
   'funcional específica, declarar que o quesito depende dela.',
   'REGRA_TECNICA_HARASPRO', 0.95, 'ativo'),

  -- ---------------------------------------------- animal jovem
  (v_protocolo, v_fonte, 'ANIMAL_JOVEM', 'crescimento',
   'Animal em crescimento não é adulto em miniatura. Desproporções transitórias ' ||
   'ligadas à fase de crescimento não devem ser tratadas como defeito definitivo: ' ||
   'usar ACOMPANHAR_DESENVOLVIMENTO. Separar o que já aparenta ser qualidade, o que ' ||
   'ainda está em formação e o que não é determinável nesta idade.',
   'REGRA_TECNICA_HARASPRO', 0.95, 'ativo'),

  -- ---------------------------------------------- método de exame
  (v_protocolo, v_fonte, 'APARENCIA_GERAL', 'ordem do exame',
   'Examinar em etapas, como uma inspeção: A) aparência geral e primeira impressão; ' ||
   'B) perfil; C) frente; D) traseira; E) dinâmica; F) revisão do conjunto cruzando ' ||
   'todas as evidências. Não avaliar cada foto isoladamente — a conclusão sai do cruzamento.',
   'REGRA_TECNICA_HARASPRO', 0.9, 'ativo');

  raise notice 'metodologia carregada';
end $$;

-- ====================================================== critérios ligados
--
-- Cada critério passa a declarar a CATEGORIA de onde puxa conhecimento e QUAIS
-- mídias sustentam a leitura. Sem isso o modelo receberia a base inteira a
-- cada critério — caro, e pior: ruidoso.

update public.morfologia_protocolos
   set criterios = $json$[
  {"chave":"aparencia_geral","titulo":"Aparência geral","categoria":"APARENCIA_GERAL",
   "descricao":"Harmonia do conjunto, tipo, equilíbrio e primeira impressão.",
   "evidencias":["LATERAL_ESQ","LATERAL_DIR","FRENTE","TRASEIRA"]},

  {"chave":"caracterizacao_racial","titulo":"Expressão racial","categoria":"EXPRESSAO_RACIAL",
   "descricao":"Tipo da raça no conjunto — cabeça, pescoço, corpo e proporções.",
   "evidencias":["CABECA_FRENTE","CABECA_PERFIL","LATERAL_ESQ","LATERAL_DIR"],
   "subcomponentes":["cabeca","fronte","perfil","olhos","orelhas","narinas","boca","ganachas"]},

  {"chave":"cabeca_expressao","titulo":"Cabeça","categoria":"CABECA",
   "descricao":"Formato, proporção, secura, simetria e expressão.",
   "evidencias":["CABECA_FRENTE","CABECA_PERFIL"],
   "subcomponentes":["formato","proporcao","secura","simetria","olhos","orelhas","narinas","boca"]},

  {"chave":"pescoco","titulo":"Pescoço e ligações","categoria":"PESCOCO",
   "descricao":"Comprimento, forma, direção, volume e ligações.",
   "evidencias":["LATERAL_ESQ","LATERAL_DIR","CABECA_PERFIL"]},

  {"chave":"conjunto_frente","titulo":"Conjunto de frente","categoria":"CONJUNTO_FRENTE",
   "descricao":"Cabeça, pescoço, cernelha e espádua lidos como conjunto.",
   "evidencias":["LATERAL_ESQ","LATERAL_DIR","FRENTE"],
   "subcomponentes":["ligacao_cabeca_pescoco","insercao_pescoco","cernelha","espadua","sustentacao","leveza"]},

  {"chave":"tronco","titulo":"Tronco","categoria":"TRONCO",
   "descricao":"Profundidade, capacidade torácica, costelas e comprimento.",
   "evidencias":["LATERAL_ESQ","LATERAL_DIR"]},

  {"chave":"dorso_lombo","titulo":"Linha superior","categoria":"LINHA_SUPERIOR",
   "descricao":"Cernelha, dorso, lombo, transições e continuidade.",
   "evidencias":["LATERAL_ESQ","LATERAL_DIR"],
   "subcomponentes":["cernelha","dorso","lombo","transicao_dorso_lombo","transicao_lombo_garupa","continuidade"]},

  {"chave":"garupa_ancas","titulo":"Garupa e ancas","categoria":"GARUPA",
   "descricao":"Comprimento, largura, inclinação, musculatura e simetria.",
   "evidencias":["LATERAL_ESQ","LATERAL_DIR","TRASEIRA"]},

  {"chave":"membros_anteriores","titulo":"Membros anteriores","categoria":"MEMBROS_ANTERIORES",
   "descricao":"Da espádua ao casco: direção, proporção e angulações.",
   "evidencias":["FRENTE","LATERAL_ESQ","LATERAL_DIR"],
   "subcomponentes":["espadua","braco","antebraco","joelho","canela","boleto","quartela","casco"]},

  {"chave":"membros_posteriores","titulo":"Membros posteriores","categoria":"MEMBROS_POSTERIORES",
   "descricao":"Da coxa ao casco: proporção, angulações e musculatura.",
   "evidencias":["TRASEIRA","LATERAL_ESQ","LATERAL_DIR"],
   "subcomponentes":["coxa","perna","jarrete","canela","boleto","quartela","casco"]},

  {"chave":"aprumos","titulo":"Aprumos","categoria":"APRUMOS",
   "descricao":"Alinhamento estático e, quando houver vídeo, dinâmico.",
   "evidencias":["FRENTE","TRASEIRA","LATERAL_ESQ","LATERAL_DIR","VIDEO_FRENTE_TRAS"],
   "subcomponentes":["estatico","dinamico"]},

  {"chave":"equilibrio_geral","titulo":"Equilíbrio e proporções","categoria":"PROPORCOES",
   "descricao":"Relação entre segmentos, membros e tronco; equilíbrio longitudinal.",
   "evidencias":["LATERAL_ESQ","LATERAL_DIR"]}
]$json$::jsonb
 where raca = 'Mangalarga Marchador';

commit;
