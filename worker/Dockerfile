# Imagem do trabalhador de vídeo.
#
# Existe por uma razão só: FFmpeg. O Supabase roda Deno, e Deno não tem FFmpeg
# nem como instalar — então a extração de quadros mora aqui.
#
# `node:22-slim` em vez de `node:22`: a diferença é ~700 MB de ferramenta de
# compilação que este serviço não usa. O código não tem nenhuma dependência de
# npm, então não há `npm install` — só Node, FFmpeg e quatro arquivos.

FROM node:22-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
COPY src ./src

# Não roda como root: se algum dia um vídeo malformado virar execução de
# código pelo FFmpeg, ele acorda sem permissão para nada.
USER node

ENV NODE_ENV=production
CMD ["node", "src/servidor.js"]
