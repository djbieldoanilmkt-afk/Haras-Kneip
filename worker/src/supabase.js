/*
  A ligação com o Supabase.

  Duas regras que valem para o módulo inteiro e não podem escorregar aqui:

  1. O trabalhador NÃO monta SQL. Ele chama funções nomeadas, definidas em
     `045_morfologia_fila_de_video.sql`. O que ele pode fazer no banco está
     escrito lá, em SQL revisável — não aqui, em JavaScript.

  2. A chave de serviço só existe em variável de ambiente do Railway. Ela nunca
     entra em log, nem em mensagem de erro: por isso `pedir` monta a mensagem
     de falha com o corpo da resposta, nunca com o cabeçalho enviado.
*/

const URL_BASE = process.env.SUPABASE_URL;
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const BALDE = 'morfologia';

export function conferirAmbiente() {
  const faltando = [];
  if (!URL_BASE) faltando.push('SUPABASE_URL');
  if (!CHAVE) faltando.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!process.env.WORKER_SEGREDO) faltando.push('WORKER_SEGREDO');
  return faltando;
}

function cabecalhos(extra = {}) {
  return { apikey: CHAVE, Authorization: `Bearer ${CHAVE}`, ...extra };
}

async function pedir(caminho, opcoes) {
  const r = await fetch(`${URL_BASE}${caminho}`, opcoes);
  if (!r.ok) {
    const corpo = await r.text().catch(() => '');
    throw new Error(`${opcoes.method ?? 'GET'} ${caminho} -> ${r.status} ${corpo.slice(0, 500)}`);
  }
  return r;
}

/** Chama uma das funções do módulo. */
export async function rpc(funcao, argumentos = {}) {
  const r = await pedir(`/rest/v1/rpc/${funcao}`, {
    method: 'POST',
    headers: cabecalhos({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(argumentos),
  });
  const texto = await r.text();
  return texto ? JSON.parse(texto) : null;
}

/** Baixa um arquivo do balde privado. */
export async function baixar(caminho) {
  const r = await pedir(`/storage/v1/object/${BALDE}/${caminho}`, {
    method: 'GET',
    headers: cabecalhos(),
  });
  return Buffer.from(await r.arrayBuffer());
}

/*
  Sobe um arquivo, sobrescrevendo.

  `x-upsert` é o que torna a segunda tentativa inofensiva: o caminho do quadro
  é determinístico (mídia + segundo), então reprocessar troca o arquivo em vez
  de acumular lixo no balde.
*/
export async function subir(caminho, bytes, mime = 'image/jpeg') {
  await pedir(`/storage/v1/object/${BALDE}/${caminho}`, {
    method: 'POST',
    headers: cabecalhos({ 'Content-Type': mime, 'x-upsert': 'true' }),
    body: bytes,
  });
  return caminho;
}
