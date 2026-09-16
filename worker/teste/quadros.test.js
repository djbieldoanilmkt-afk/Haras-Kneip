import test from 'node:test';
import assert from 'node:assert/strict';
import { escolherQuadros, quantosQuadros, PISO_DE_NITIDEZ } from '../src/quadros.js';

/** Vídeo de `seg` segundos a 3 quadros por segundo. */
function candidatos(seg, nitidezDe) {
  const lista = [];
  for (let i = 0; i * (1 / 3) <= seg; i++) {
    const segundo = Number((i / 3).toFixed(2));
    lista.push({ segundo, nitidez: nitidezDe(segundo) });
  }
  return lista;
}

test('pega a quantidade pedida quando há candidato de sobra', () => {
  const r = escolherQuadros(candidatos(30, () => 50), 10);
  assert.equal(r.length, 10);
});

/*
  O teste que justifica o algoritmo inteiro.

  Aqui o cavalo para nos três primeiros segundos (imagem nítida) e depois gira
  em movimento (imagem mais tremida). Escolher "as dez mais nítidas" devolveria
  dez fotos do mesmo ângulo parado. O vídeo de 360 graus ficaria sem os outros
  ângulos — que são a razão de existir do vídeo.
*/
test('cobre o vídeo inteiro mesmo quando as imagens mais nítidas estão todas no começo', () => {
  const lista = candidatos(30, (s) => (s < 4 ? 100 : 40));

  const porNitidez = [...lista].sort((a, b) => b.nitidez - a.nitidez).slice(0, 10);
  assert.ok(
    Math.max(...porNitidez.map((c) => c.segundo)) < 4,
    'premissa do teste: por nitidez pura tudo cairia nos 4 primeiros segundos',
  );

  const r = escolherQuadros(lista, 10);
  const tempos = r.map((c) => c.segundo);
  assert.ok(Math.max(...tempos) > 25, `último quadro em ${Math.max(...tempos)}s, esperava depois de 25s`);
  assert.ok(new Set(tempos).size === tempos.length, 'não pode repetir o mesmo instante');

  /* Nenhuma fatia de 3 segundos do vídeo pode ficar sem representante. */
  for (let i = 0; i < 10; i++) {
    const de = i * 3;
    assert.ok(
      tempos.some((t) => t >= de && t <= de + 3),
      `nada escolhido entre ${de}s e ${de + 3}s`,
    );
  }
});

test('dentro da fatia, escolhe o mais nítido — não o primeiro', () => {
  /* Um pico de nitidez no meio de cada segundo. */
  const lista = candidatos(9, (s) => (Math.abs(s - Math.floor(s) - 0.33) < 0.01 ? 90 : 30));
  const r = escolherQuadros(lista, 9);
  assert.ok(
    r.every((c) => c.nitidez === 90),
    `pegou quadro tremido: ${JSON.stringify(r.map((c) => c.nitidez))}`,
  );
});

test('borrão não entra na análise', () => {
  /* Metade final do vídeo desfocada a ponto de não servir. */
  const lista = candidatos(20, (s) => (s < 10 ? 100 : 100 * PISO_DE_NITIDEZ * 0.5));
  const r = escolherQuadros(lista, 8);
  assert.ok(r.length < 8, 'devia ter descartado as fatias borradas');
  assert.ok(
    r.every((c) => c.segundo < 10),
    `quadro borrado passou: ${JSON.stringify(r.map((c) => c.segundo))}`,
  );
});

test('com menos candidatos que fatias, leva todos os que prestam', () => {
  const lista = [
    { segundo: 0, nitidez: 100 },
    { segundo: 1, nitidez: 80 },
    { segundo: 2, nitidez: 1 },
  ];
  const r = escolherQuadros(lista, 10);
  assert.deepEqual(r.map((c) => c.segundo), [0, 1]);
});

test('vídeo com um instante só não divide por zero', () => {
  const lista = [
    { segundo: 4, nitidez: 10 },
    { segundo: 4, nitidez: 90 },
    { segundo: 4, nitidez: 50 },
  ];
  const r = escolherQuadros(lista, 2);
  assert.equal(r.length, 2);
  assert.deepEqual(r.map((c) => c.nitidez), [90, 50]);
});

test('entrada vazia ou pedido de zero não quebra', () => {
  assert.deepEqual(escolherQuadros([], 5), []);
  assert.deepEqual(escolherQuadros(candidatos(10, () => 50), 0), []);
  assert.deepEqual(escolherQuadros(null, 5), []);
});

test('nitidez ausente é tratada como zero, não como NaN', () => {
  const lista = [
    { segundo: 0 },
    { segundo: 1, nitidez: 100 },
    { segundo: 2 },
  ];
  const r = escolherQuadros(lista, 2);
  assert.ok(r.every((c) => !Number.isNaN(c.nitidez ?? 0)));
  assert.ok(r.some((c) => c.segundo === 1));
});

test('cada tipo de vídeo pede a sua quantidade, e o desconhecido tem padrão', () => {
  assert.equal(quantosQuadros('VIDEO_360'), 10);
  assert.equal(quantosQuadros('VIDEO_LATERAL'), 8);
  assert.equal(quantosQuadros('VIDEO_FRENTE_TRAS'), 6);
  assert.equal(quantosQuadros('EXTRA'), 6);
  assert.equal(quantosQuadros(undefined), 6);
});
