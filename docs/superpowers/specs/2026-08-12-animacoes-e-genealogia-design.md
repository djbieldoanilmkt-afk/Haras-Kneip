# Movimento de sistema e árvore genealógica — Haras Kneip

**Data:** 2026-08-12
**Status:** aguardando aprovação
**Depende de:** `2026-08-11-frontend-redesign-design.md` (concluído, PR #1)

## Objetivo

Dar ao sistema um acabamento que sustente uma **demonstração ao vivo de poucos minutos**, conduzida pelo dono do projeto para o seu chefe.

O contexto define as escolhas. Numa demo curta, quem apresenta controla o caminho e a impressão se forma nos primeiros segundos de cada tela. Por isso o esforço vai para transições entre telas e para uma peça de destaque, e não para recursos que só aparecem no uso prolongado.

## O que este trabalho não é

Animar tudo. Movimento em excesso é a assinatura mais confiável de software amador, e foi exatamente o diagnóstico que originou o redesign anterior: "parece amador". Software que transmite competência usa movimento com moderação e sempre a serviço da compreensão — de onde esta tela veio, o que acabou de mudar.

## Princípios

Valem para toda animação deste documento, sem exceção.

1. **`prefers-reduced-motion: reduce` desliga o movimento.** Quem configurou o sistema operacional para reduzir animação — por enjoo, vertigem, epilepsia fotossensível ou preferência — recebe a versão estática, com o conteúdo já no estado final. Isto não é um extra: é o que separa uma interface animada de uma interface excludente.
2. **Durações entre 150ms e 400ms**, com duas exceções nomeadas: o traçado da árvore genealógica (600ms) e o contador das métricas (800ms). As duas são deliberadas — um traçado rápido demais não é percebido como traçado, e um contador rápido demais não é percebido como contagem.
3. **Uma curva de easing só:** `cubic-bezier(0.16, 1, 0.3, 1)`. Desacelera rápido e lembra física real. Já era a curva do sistema legado.
4. **Movimento com propósito.** Entrada significa "isto é novo". Nada gira, quica ou pulsa.
5. **Nunca animar `width`, `height`, `top` ou `left`.** Só `opacity` e `transform`, que o navegador compõe sem recalcular layout. Animar layout causa engasgo em telas com muitos cards.
6. **Números em contagem usam `font-variant-numeric: tabular-nums`.** Sem isso, cada dígito tem largura própria e o número treme enquanto sobe — o defeito faz a animação parecer quebrada em vez de polida.

## A · Movimento de sistema

| Peça | Comportamento | Duração |
|---|---|---|
| Troca de rota | Conteúdo entra com opacidade e 8px de deslocamento vertical | 250ms |
| Cards do plantel | Entrada escalonada, 30ms entre cards | 250ms cada |
| Métricas do painel | Contador de 0 até o valor final | 800ms |
| Gráficos | Recharts desenhando as séries | padrão da biblioteca |
| Skeleton → conteúdo | Transição cruzada em vez de troca seca | 200ms |

### Teto do escalonamento

O atraso acumula em no máximo **12 itens**. Com 30ms por card e 50 animais, o último apareceria 1,5 segundo depois do primeiro — a lista pareceria lenta, não elegante. A partir do décimo terceiro item, todos entram com o atraso do décimo segundo.

### Risco identificado: re-animação indevida

Na página do plantel, marcar um animal como "incluído no link" altera o estado e re-renderiza a grade. Se a animação for disparada a cada render, a grade inteira re-anima a cada clique — irritante e, ironicamente, amador.

A animação é ancorada na **montagem** do componente, não no render. Um item só anima quando entra na árvore. Trocar de filtro re-anima (correto: a lista mudou); alternar destaque não re-anima (correto: a lista é a mesma).

### Sem biblioteca de animação

Framer Motion resolveria com menos código, mas custa cerca de 50 KB comprimidos. Todo o comportamento acima é alcançável com CSS e um hook de contador. A vitrine pública já carrega no celular de estranhos e não precisa desse peso.

A consequência aceita: **não há animação de saída.** Sem `AnimatePresence`, elementos que somem somem imediatamente. Numa demo, ninguém repara na saída — repara na entrada.

## B · Árvore genealógica como peça de destaque

A tela mais específica do domínio, e hoje a mais pobre: três colunas de caixas soltas, sem nada indicando o parentesco. Um pedigree de verdade é o que nenhum sistema genérico tem.

### Mudanças

- **Linhas conectoras** ligando animal → pais → avós, no formato de chave usado em pedigree impresso
- **Miniatura da foto** de cada ancestral, com as iniciais como reserva
- Ao abrir a aba, os conectores se desenham da esquerda para a direita e as caixas entram nível a nível
- Ancestral desconhecido permanece com borda tracejada e texto apagado
- O clique continua navegando para o perfil do ancestral

### Decisão técnica: conectores por borda CSS

Os conectores são bordas de elementos posicionados por grid, **não** SVG com geometria calculada em JavaScript.

A árvore tem forma fixa — um animal, dois pais, quatro avós — então a posição de cada conector é conhecida em tempo de escrita. Medir o DOM introduziria bugs em redimensionamento de janela, em fonte que carrega depois da primeira pintura e em zoom do navegador. Borda não mede nada.

O traçado anima por `transform: scaleX()` a partir da origem, o que respeita o princípio 5.

## Scroll-trigger

Perguntado pelo dono do projeto. A resposta honesta é que ele tem **um** lugar legítimo no app atual.

**Onde entra:** a vitrine pública (`#/plantel`). É uma grade longa, lida de cima a baixo, vista principalmente no celular. Revelar cada card conforme ele entra na tela é o uso correto do recurso.

**Onde não entra:** painel, plantel, perfil, calendário, relatórios e configurações. São ferramentas de trabalho — o conteúdo cabe quase todo na primeira tela e quem usa quer o dado imediatamente. Animar ao rolar faz uma ferramenta parecer lenta, não sofisticada.

Implementado com `IntersectionObserver` nativo, sem biblioteca. Cada card revela uma única vez; sair da tela não desfaz.

## Fora de escopo

- **Página inicial com login.** Pedida pelo dono do projeto e adiada por decisão dele para a rodada seguinte. Não é só uma tela: implica autenticação, mudança da rota raiz (`#/` deixa de ser o painel) e decisões sobre recuperação de senha e o que permanece público. Merece brainstorming próprio.
- Animação de saída de elementos.
- Qualquer movimento nas telas administrativas além do descrito em A.

## Relação com a pendência de segurança

A página inicial com login, quando for feita, **é** o trabalho de autenticação registrado como pendência no redesign anterior. Hoje o banco aceita escrita anônima e não há login, então quem recebe o link público consegue alterar os dados. Os dois itens são o mesmo trabalho e devem ser tratados juntos.

## Critérios de sucesso

1. Com `prefers-reduced-motion: reduce`, nenhuma animação roda e todo conteúdo aparece no estado final.
2. Alternar o destaque de um animal no plantel não re-anima a grade.
3. A árvore genealógica mostra conectores e miniaturas, e continua legível em tela de 375px.
4. Nenhuma animação de `width`, `height`, `top` ou `left`.
5. Os 98 testes existentes continuam passando, mais cobertura nova para o contador e para o desligamento por `prefers-reduced-motion`.
