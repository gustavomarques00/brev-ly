# brev.ly

Encurtador de URLs full stack desenvolvido como solução autoral para o **desafio prático da Fase 1 (Brev.ly)** do programa **Tech Developer 360 da Rocketseat** (Full Stack + DevOps).

O repositório contém uma API em Fastify + Drizzle + PostgreSQL (`server/`) e uma SPA em React + Vite (`web/`) que segue o design da comunidade Rocketseat no Figma.

![Página inicial no desktop](docs/screenshots/home-desktop.png)

## Funcionalidades

- Criar link informando a URL original e a URL encurtada (slug), com validação no frontend e no backend.
- Impedir slugs mal formatados e duplicados (`409 Conflict`), inclusive sob concorrência.
- Listar os links com URL encurtada, URL original e quantidade de acessos.
- Copiar a URL encurtada e excluir links (com confirmação).
- Página `/:url-encurtada` que resolve o slug, registra um acesso e redireciona para a URL original.
- Página de link não encontrado para slugs inexistentes, slugs inválidos e rotas desconhecidas.
- Exportar todos os links em CSV, gerado por streaming, enviado ao Cloudflare R2 e baixado pela URL pública.
- Estados de carregamento, vazio, erro e sucesso; ações bloqueadas enquanto há operações pendentes; layout responsivo (mobile first).

## Tecnologias

| Camada | Stack |
|---|---|
| Backend | Node.js 22, TypeScript, Fastify 5, Drizzle ORM, PostgreSQL 17, Zod 4, `fastify-type-provider-zod`, AWS SDK v3 (S3 compatível com R2), `csv-stringify` |
| Frontend | React 19, Vite 8 (SPA), TypeScript, Tailwind CSS 4, React Router 7, TanStack Query 5, React Hook Form, Zod 4, Phosphor Icons, Sonner |
| Qualidade | Vitest, Testing Library, Biome, GitHub Actions |
| Infra | Docker (multi-stage), Docker Compose (PostgreSQL local) |

O React Router está na versão 7 porque a 8 exige Node ≥ 22.22, e o TypeScript foi fixado em 5.9 por compatibilidade com o ecossistema de ferramentas.

## Arquitetura

```text
brev-ly/
├── .github/workflows/ci.yml     # lint, typecheck, testes, build e docker build
├── compose.yml                  # PostgreSQL para desenvolvimento local
├── docs/screenshots/            # capturas reais da aplicação
├── server/
│   ├── drizzle/                 # migrations versionadas (drizzle-kit)
│   ├── src/
│   │   ├── app.ts               # factory do Fastify (CORS, validação, rotas)
│   │   ├── server.ts            # entrypoint: env, conexões, graceful shutdown
│   │   ├── env.ts               # validação das variáveis de ambiente com Zod
│   │   ├── domain/              # regras de slug/URL e erros de domínio
│   │   ├── http/                # rotas e error handler
│   │   ├── use-cases/           # links e exportação CSV
│   │   └── infra/
│   │       ├── database/        # schema, cliente e migrator programático
│   │       └── storage/         # interface de storage + implementação R2
│   ├── test/                    # testes de integração com banco real
│   └── Dockerfile
└── web/
    ├── src/
    │   ├── components/          # UI do Style Guide (Button, IconButton, Input) e seções
    │   ├── pages/               # home, redirect e not-found
    │   ├── hooks/               # queries e mutations (TanStack Query)
    │   ├── http/                # cliente HTTP e chamadas da API
    │   ├── schemas/             # regras de formulário compartilhadas conceitualmente com o backend
    │   └── utils/
    └── vercel.json              # fallback de SPA caso o deploy seja na Vercel
```

Os use cases recebem as dependências (banco e storage) por parâmetro, o que permite testar a API com `app.inject()` contra um PostgreSQL real e um storage falso.

## Decisões arquiteturais

- **Regra de slug:** `^[A-Za-z0-9_-]{3,50}$`. O slug é salvo como digitado, mas a unicidade e a resolução são *case-insensitive* (`Meu-Link` e `meu-link` são o mesmo link), via índice único em `lower(slug)`.
- **Unicidade sob concorrência:** a criação usa `INSERT ... ON CONFLICT DO NOTHING RETURNING`. A constraint do PostgreSQL é a proteção definitiva; não há verificação prévia sujeita a corrida.
- **Contagem de acessos:** `GET /links/:slug` é uma leitura pura (seguro para crawlers, prefetch e previews). O incremento é uma operação separada, `POST /links/:id/accesses`, que executa `UPDATE links SET access_count = access_count + 1 WHERE id = $1` de forma atômica. A página de redirecionamento dispara esse POST uma única vez por visita (protegido contra a repetição de efeitos do StrictMode) e redireciona mesmo que a contagem falhe.
- **Identificadores:** exclusão e incremento usam o `id` (UUID); a resolução usa o slug. Não há rota ambígua entre slug e id.
- **Listagem:** ordenação estável por `created_at DESC, id DESC`, coberta por índice composto. A listagem retorna todos os links (não há paginação), como pede a experiência do Figma.
- **CSV:** as linhas são lidas com cursor do PostgreSQL em lotes de 500, transformadas por `csv-stringify` e enviadas por streaming ao R2 (`@aws-sdk/lib-storage`), sem carregar a tabela inteira em memória. Cada arquivo recebe nome único (`reports/links-AAAA-MM-DD-<uuid>.csv`) e `Content-Disposition: attachment`.
- **CSV Injection:** valores iniciados por `=`, `+`, `-`, `@`, tab ou CR recebem o prefixo `'`.
- **Segurança de redirecionamento:** apenas URLs `http`/`https` são aceitas na API e a SPA se recusa a redirecionar para qualquer outro esquema.
- **CORS:** somente a origem de `WEB_URL` é permitida, com os métodos `GET`, `POST` e `DELETE`.
- **Storage não configurado:** a API sobe sem as variáveis do R2 e a exportação responde `503 STORAGE_NOT_CONFIGURED`. Falhas de upload respondem `502 REPORT_UPLOAD_FAILED`, sem expor detalhes internos.
- **URL original no formulário:** seguindo o placeholder do Figma (`www.exemplo.com.br`), a SPA aceita URLs sem esquema e assume `https://`. O backend sempre exige `http(s)`.

## Como executar

Pré-requisitos: Node.js ≥ 22.12, pnpm 10 e Docker.

```bash
# 1. Banco de dados local (use POSTGRES_PORT=5434 se a 5432 estiver ocupada)
docker compose up -d

# 2. API
cd server
cp .env.example .env        # ajuste DATABASE_URL se mudou a porta
pnpm install
pnpm db:migrate
pnpm dev                    # http://localhost:3333

# 3. Web (em outro terminal)
cd web
cp .env.example .env
pnpm install
pnpm dev                    # http://localhost:5173
```

## Variáveis de ambiente

### `server/.env`

| Variável | Obrigatória | Descrição |
|---|---|---|
| `PORT` | não (padrão `3333`) | Porta HTTP da API |
| `DATABASE_URL` | sim | Connection string do PostgreSQL |
| `WEB_URL` | não (padrão `http://localhost:5173`) | Origem permitida no CORS e base das URLs encurtadas no CSV |
| `CLOUDFLARE_ACCOUNT_ID` | para exportar CSV | ID da conta Cloudflare |
| `CLOUDFLARE_ACCESS_KEY_ID` | para exportar CSV | Access key de um token R2 |
| `CLOUDFLARE_SECRET_ACCESS_KEY` | para exportar CSV | Secret do token R2 |
| `CLOUDFLARE_BUCKET` | para exportar CSV | Nome do bucket |
| `CLOUDFLARE_PUBLIC_URL` | para exportar CSV | URL pública do bucket (domínio `r2.dev` ou customizado) |
| `CLOUDFLARE_ENDPOINT` | não | Sobrescreve o endpoint S3 (útil para testar com um storage S3 compatível local) |

Recomenda-se um token R2 com permissão apenas de escrita de objetos no bucket de relatórios.

#### Configurando o Cloudflare R2

1. No painel da Cloudflare, em **R2 Object Storage**, crie um bucket dedicado (por exemplo, `brev-ly-reports`).
2. Habilite o acesso público do bucket pela **Public Development URL** (`r2.dev`) ou por um domínio customizado, e use essa URL em `CLOUDFLARE_PUBLIC_URL`.
3. Em **Manage API tokens**, crie um token com a permissão **Object Read & Write** aplicada somente a esse bucket. O painel exibe o `Access Key ID` e o `Secret Access Key` uma única vez.
4. Preencha as variáveis `CLOUDFLARE_*` no `server/.env` (nunca versionado) e reinicie a API. `CLOUDFLARE_ENDPOINT` não é necessário para o R2.

A URL `r2.dev` tem limite de taxa e é indicada pela Cloudflare para desenvolvimento; em produção, prefira um domínio customizado.

### `web/.env`

| Variável | Descrição |
|---|---|
| `VITE_FRONTEND_URL` | URL pública da SPA (usada para montar e exibir as URLs encurtadas) |
| `VITE_BACKEND_URL` | URL base da API |

## Migrations

O schema fica em `server/src/infra/database/schema.ts` e as migrations versionadas em `server/drizzle/`.

```bash
pnpm db:generate       # gera uma nova migration a partir do schema
pnpm db:migrate        # aplica as migrations (drizzle-kit, usa DATABASE_URL)
pnpm db:migrate:prod   # aplica as migrations com o build (sem dependências de desenvolvimento)
```

A migration inicial cria a tabela `links` (`id`, `original_url`, `slug`, `access_count`, `created_at`), o índice único `lower(slug)`, o índice `(created_at DESC, id DESC)` e a constraint `access_count >= 0`.

## Docker

```bash
cd server
docker build -t brev-ly-server .

# migrations dentro do container
docker run --rm -e DATABASE_URL=... brev-ly-server node dist/infra/database/migrate.js

# API
docker run -p 3333:3333 --env-file .env brev-ly-server
```

A imagem é multi-stage (`node:22-alpine`), instala apenas dependências de produção com lockfile congelado, roda como usuário `node` (não root), expõe a porta definida em `PORT`, tem `HEALTHCHECK` em `GET /health` e não embute segredos.

## Testes

```bash
# Backend: exige um PostgreSQL local. O guard recusa hosts não locais e bancos cujo nome não termine em _test.
cd server
TEST_DATABASE_URL=postgresql://brevly:brevly@localhost:5432/brevly_test pnpm test

# Frontend
cd web
pnpm test
```

- **Backend (48 testes):** integração com PostgreSQL real e storage falso. Cobrem criação, slugs e URLs inválidos (incluindo `javascript:` e `data:`), duplicidade (inclusive com maiúsculas e minúsculas), 10 criações simultâneas do mesmo slug, exclusão, resolução, 404, incremento, 50 incrementos simultâneos, listagem e ordenação, CORS, exportação CSV (cabeçalho, linhas, mais de um lote do cursor), nomes únicos, CSV Injection, falha de storage (502), storage ausente (503) e validação de variáveis de ambiente.
- **Frontend (38 testes):** formulário válido e normalização de URL, validação de slug e URL, conflito 409, estados de carregamento, vazio e erro com nova tentativa, listagem, exclusão (confirmação, bloqueio durante a requisição, falha), cópia, exportação CSV (sucesso e falha), redirecionamento com um único registro de acesso, falha na contagem, slug inexistente, slug inválido, URL insegura, erro de servidor com nova tentativa e rotas desconhecidas.
- Cada contexto de teste do backend cria slugs com um prefixo aleatório e remove apenas os próprios registros.

## API

Base: `http://localhost:3333`. Erros seguem o formato `{ "code": string, "message": string }`.

| Método | Rota | Descrição | Respostas |
|---|---|---|---|
| `POST` | `/links` | Cria um link. Body: `{ "originalUrl": string, "slug": string }` | `201 { link }`, `400 VALIDATION_ERROR`, `409 SLUG_ALREADY_EXISTS` |
| `GET` | `/links` | Lista os links (mais recentes primeiro) | `200 { links: Link[] }` |
| `GET` | `/links/:slug` | Resolve o slug (sem efeito colateral) | `200 { link }`, `400`, `404 LINK_NOT_FOUND` |
| `DELETE` | `/links/:id` | Remove o link | `204`, `400`, `404 LINK_NOT_FOUND` |
| `POST` | `/links/:id/accesses` | Incrementa atomicamente o contador | `200 { id, accessCount }`, `400`, `404` |
| `POST` | `/links/exports` | Gera o CSV e envia ao storage | `201 { reportUrl, fileName }`, `502 REPORT_UPLOAD_FAILED`, `503 STORAGE_NOT_CONFIGURED` |
| `GET` | `/health` | Healthcheck | `200 { status: "ok" }` |

```ts
type Link = {
  id: string          // UUID
  originalUrl: string
  slug: string
  accessCount: number
  createdAt: string   // ISO 8601
}
```

CSV gerado:

```csv
URL original,URL encurtada,Contagem de acessos,Data de criação
https://github.com/devname/project-name-v2,https://brev.ly/Github-Project,34,2026-10-26T20:49:14.306Z
```

## Capturas de tela

Capturadas da aplicação rodando localmente (Chromium; desktop com 1366 px e mobile com 375–390 px de largura).

| | Desktop | Mobile |
|---|---|---|
| Links | ![](docs/screenshots/home-desktop.png) | ![](docs/screenshots/home-mobile.png) |
| Vazio | ![](docs/screenshots/empty-desktop.png) | ![](docs/screenshots/empty-mobile.png) |
| Redirecionando | ![](docs/screenshots/redirect-desktop.png) | ![](docs/screenshots/redirect-mobile.png) |
| Não encontrado | ![](docs/screenshots/not-found-desktop.png) | ![](docs/screenshots/not-found-mobile.png) |

## Critérios de aceite

- [x] Criar link, com bloqueio de slug mal formatado e de slug já existente.
- [x] Excluir link.
- [x] Obter a URL original a partir do slug.
- [x] Listar todos os links.
- [x] Incrementar a quantidade de acessos.
- [x] Exportar CSV com URL original, URL encurtada, contagem de acessos e data de criação, acessível por URL pública do storage e com nome aleatório e único.
- [x] Listagem e exportação performáticas (índices, cursor, streaming).
- [x] SPA React + Vite com as páginas `/`, `/:url-encurtada` e de não encontrado.
- [x] Empty state, ícones de carregamento e bloqueio de ações conforme o estado.
- [x] Layout responsivo seguindo o Figma.
- [x] `Dockerfile` do backend, `.env.example` e script `db:migrate`.

## Limitações

- O upload e o download do CSV foram validados ponta a ponta com um storage S3 compatível local (S3Mock) usando o mesmo cliente AWS SDK; a integração com uma conta Cloudflare R2 real depende de credenciais que não fazem parte do repositório.
- Não há autenticação: todos os links são globais, como no escopo do desafio.
- Não há rate limiting nem paginação na listagem.
- Não há testes E2E automatizados (Playwright/Cypress); os fluxos críticos foram verificados manualmente no navegador.

### Recomendações para produção (fora do escopo da avaliação)

- Rate limiting na criação de links e na exportação (por exemplo, `@fastify/rate-limit`).
- Lista de bloqueio de domínios maliciosos e verificação de URLs (phishing).
- Expiração ou lifecycle rule no bucket de relatórios, já que as URLs públicas não expiram.
- Paginação por cursor na listagem quando o volume crescer.

## Créditos

- Desafio e design: [Rocketseat](https://www.rocketseat.com.br/) — "Encurtador de Links (Community)" no Figma.
- Implementação: código autoral de [Gustavo Marques](https://github.com/gustavomarques00), produzido especificamente para esta avaliação. Apenas o design, os ícones (Phosphor Icons, indicados no Style Guide) e o enunciado são referências externas.
