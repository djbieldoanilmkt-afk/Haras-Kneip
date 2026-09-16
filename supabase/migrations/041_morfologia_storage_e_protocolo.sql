-- 041 — Armazenamento privado e o protocolo da raça.
--
-- ARMAZENAMENTO
--
-- Balde PRIVADO, ao contrário de `fotos-animais` e `logos`. A avaliação é o
-- material mais sensível do módulo: fotos de um cavalo que o Kneip pretende
-- comprar, notas e laudo. URL pública aqui seria entregar o parecer a quem
-- adivinhasse o caminho.
--
-- PROTOCOLO
--
-- A especificação foi explícita: "utilizar apenas informações verificadas do
-- padrão oficial ABCCMM" e "NUNCA inventar regra racial".
--
-- Eu não tenho o documento oficial. Escrever aqui uma lista de regras e
-- carimbá-la como padrão ABCCMM seria exatamente o que a especificação
-- proíbe — e o erro seria invisível, porque o texto SOA correto.
--
-- Então o protocolo nasce em RASCUNHO, com procedência em branco e um aviso
-- que o relatório carrega. Os critérios abaixo são regiões morfológicas que
-- qualquer julgamento de equino avalia (cabeça, pescoço, tronco, garupa,
-- aprumos) — estrutura, não regra racial. Os LIMIARES e as características
-- desejáveis/indesejáveis de cada região ficam vazios até virem do documento
-- oficial, que o Seu Hélio pode exportar da ABCCMM.
--
-- Promover para 'vigente' é uma linha, depois da conferência.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('morfologia', 'morfologia', false, 104857600,
        array['image/jpeg','image/png','image/webp','image/heic','image/heif',
              'video/mp4','video/quicktime','video/webm','video/3gpp',
              'application/pdf'])
on conflict (id) do update set
  public = false,
  file_size_limit = 104857600,
  allowed_mime_types = excluded.allowed_mime_types;

/*
  Ninguém lê nem escreve direto: só o service_role, pelas funções do módulo.

  O acesso da tela é por URL assinada, gerada depois de conferir haras e
  recurso. Sem política para `authenticated`, o RLS do storage nega por
  omissão — que é o padrão certo para material privado.
*/
drop policy if exists morfologia_storage_sem_acesso_direto on storage.objects;

-- --------------------------------------------------------------- protocolo

insert into public.morfologia_protocolos
  (raca, versao, situacao, fonte_nome, fonte_referencia, criterios, pesos, regras_jovens)
values (
  'Mangalarga Marchador',
  'V1',
  'rascunho',
  null,
  null,
  $json$[
    {"chave":"aparencia_geral","titulo":"Aparência geral","descricao":"Harmonia do conjunto, equilíbrio entre as regiões, impressão de tipo."},
    {"chave":"caracterizacao_racial","titulo":"Caracterização racial","descricao":"Expressão de tipo da raça no conjunto."},
    {"chave":"cabeca_expressao","titulo":"Cabeça e expressão","descricao":"Proporção da cabeça, olhos, orelhas, perfil e expressão."},
    {"chave":"pescoco","titulo":"Pescoço e ligações","descricao":"Comprimento, inserção na cabeça e no tronco, linha superior."},
    {"chave":"conjunto_frente","titulo":"Conjunto de frente","descricao":"Espádua, braço, peito e inserção dos membros anteriores."},
    {"chave":"tronco","titulo":"Tronco","descricao":"Profundidade, arqueamento de costelas, cilindro torácico."},
    {"chave":"dorso_lombo","titulo":"Dorso e lombo","descricao":"Linha dorso-lombar, comprimento e ligação com a garupa."},
    {"chave":"garupa_ancas","titulo":"Garupa e ancas","descricao":"Comprimento, largura, inclinação e musculatura."},
    {"chave":"membros_anteriores","titulo":"Membros anteriores","descricao":"Ossatura, articulações, quartelas e cascos."},
    {"chave":"membros_posteriores","titulo":"Membros posteriores","descricao":"Ossatura, jarretes, quartelas e cascos."},
    {"chave":"aprumos","titulo":"Aprumos","descricao":"Alinhamento dos membros visto de frente, de trás e de lado."},
    {"chave":"equilibrio_geral","titulo":"Equilíbrio e proporções","descricao":"Relação entre alturas, comprimentos e massa."}
  ]$json$::jsonb,
  /*
    PESOS IGUAIS, de propósito.

    Peso é regra racial: dizer que garupa vale mais que cabeça no Mangalarga
    é uma afirmação sobre o padrão, e eu não tenho como conferir. Peso igual
    não finge conhecimento que não tenho — e a nota geral continua sendo
    calculada pelo BANCO, nunca inventada pelo modelo a cada avaliação.

    Ao promover para V2 com o documento oficial, os pesos reais entram aqui.
  */
  $json${
    "aparencia_geral": 1, "caracterizacao_racial": 1, "cabeca_expressao": 1,
    "pescoco": 1, "conjunto_frente": 1, "tronco": 1, "dorso_lombo": 1,
    "garupa_ancas": 1, "membros_anteriores": 1, "membros_posteriores": 1,
    "aprumos": 1, "equilibrio_geral": 1
  }$json$::jsonb,
  $json${
    "idade_adulta_meses": 48,
    "aviso": "Animal em crescimento não é adulto em miniatura. Desproporções transitórias (por exemplo garupa acima da cernelha em certas fases) não devem ser tratadas como defeito definitivo.",
    "criterios_com_projecao": ["dorso_lombo","garupa_ancas","equilibrio_geral","tronco"],
    "criterios_estaveis_cedo": ["cabeca_expressao","caracterizacao_racial"]
  }$json$::jsonb
)
on conflict (raca, versao) do nothing;

commit;
