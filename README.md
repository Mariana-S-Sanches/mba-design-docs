# Design Docs Orientados por IA — Sistema de Webhooks de Notificação de Pedidos

## 1. Sobre o Desafio

Este repositório documenta o processo de transformação da transcrição de uma reunião técnica de 55 minutos ([`TRANSCRICAO.md`](file:///Users/marianasanches/Desktop/mba-design-docs/TRANSCRICAO.md)) e da análise do código-fonte de um Order Management System (OMS) existente (baseado em Node.js, TypeScript, Express, Prisma ORM e MySQL 8) em um pacote completo, acionável, de alta fidelidade e com **Zero Alucinação** de Design Docs para engenharia de software.

Como **Maestro de IA / Staff Software Architect**, a missão consistiu em orquestrar modelos de linguagem avançados para ler a codebase existente, auditar as discussões entre os membros do time (Larissa, Marcos, Bruno, Diego e Sofia) e sintetizar os requisitos de negócio e decisões técnicas sem extrapolar o escopo ou inventar artefatos inexistentes. O resultado é um conjunto de documentos cobrindo produto, arquitetura, especificação operacional e rastreabilidade bidirecional.

---

## 2. Ferramentas de IA Utilizadas

* **Antigravity CLI (Google DeepMind):** Execução de agentes autônomos de código no terminal para varredura do repositório local, leitura da codebase (`src/`, `prisma/schema.prisma`), geração estruturada dos arquivos Markdown e validação de consistência.
* **Gemini 3.6 Flash:** Modelo de fronteira empregado na engenharia de prompts analíticos, extração semântica de falantes e timestamps (`[hh:mm] Nome`), filtragem de alternativas descartadas vs. requisitos funcionais, e modelagem de arquiteturas de sistemas distribuídos.

---

## 3. Workflow Adotado

Para evitar inconsistências, contradições e alucinações de dados, o processo foi estruturado em 6 etapas sequenciais e dependentes:

```
[Etapa 1: Diagnóstico de Fatos] ➔ [Etapa 2: ADRs (adrs/)] ➔ [Etapa 3: RFC Arquitetural (RFC.md)]
                                                                       │
[Etapa 6: Tracker & Auditoria]  [Etapa 5: PRD de Produto]  [Etapa 4: FDD Operacional (FDD.md)]
```

1. **Etapa 1: Diagnóstico e Mapeamento de Fatos (Contextualização):** Leitura integral de `prisma/schema.prisma`, `order.service.ts` e `TRANSCRICAO.md` para extração de participantes, decisões centrais, alternativas descartadas, questões em aberto e mapeamento de arquivos reais afetados.
2. **Etapa 2: ADRs First (`docs/adrs/`):** Formalização prévia das 7 decisões arquiteturais fundamentais no padrão MADR (Outbox Pattern, Polling Worker, Retry/DLQ, HMAC-SHA256, At-Least-Once, Payload Snapshot e Replay Admin), estabelecendo a fundação técnica.
3. **Etapa 3: RFC Arquitetural (`docs/RFC.md`):** Consolidação da proposta técnica em nível macro (2 a 4 páginas), contextualizando a solução, alternativas descartadas e decisões vinculadas às ADRs.
4. **Etapa 4: FDD Operacional (`docs/FDD.md`):** Especificação detalhada de engenharia, contendo o acoplamento cirúrgico em 5 arquivos legados, contratos HTTP completos, diagramas Mermaid, matriz de erros `WEBHOOK_*` e estratégias de resiliência.
5. **Etapa 5: PRD de Produto (`docs/PRD.md`):** Alinhamento de objetivos de negócio, público-alvo, métricas quantitativas (`PRD-MET-*`), escopo/fora de escopo e matriz de riscos.
6. **Etapa 6: Tracker e Auditoria (`docs/TRACKER.md`):** Criação da matriz de rastreabilidade mapeando 53 itens e ligando cada Requisito/Decisão ao seu timestamp de origem `[hh:mm] Nome` ou arquivo do `CODIGO`.

---

## 4. Prompts Customizados Utilizados

### Prompt 1: Extração e Mapeamento de Fatos com Zero Alucinação
```text
Você é um Arquiteto de Software Staff especializado em sistemas distribuídos.
Sua missão é realizar uma varredura completa no repositório e no arquivo TRANSCRICAO.md e gerar um relatório estruturado no console contendo:
1. MAPA DA TRANSCRIÇÃO: Lista de participantes (nomes e papéis), as 6 decisões centrais com timestamps [hh:mm] e falantes, 2+ alternativas descartadas com motivos e timestamps, 2+ questões em aberto com timestamps e Requisitos Funcionais/Não-Funcionais com timestamps.
2. MAPA DO CÓDIGO EXISTENTE: Arquitetura atual em src/modules/, schema prisma e identificação de pelo menos 4 caminhos de arquivos reais que serão afetados pela feature.
REGRA RÍGIDA: ZERO ALUCINAÇÃO. Toda decisão ou modelo deve ser extraído estritamente da transcrição ou dos arquivos em src/ e prisma/. Não invente caminhos de arquivo inexistentes.
```

### Prompt 2: Engenharia de FDD e Integração com a Codebase Legada
```text
Você é um Engenheiro Principal e Arquiteto de Software. Sua tarefa é gerar a especificação técnica detalhada no arquivo docs/FDD.md.
DIRETRIZES:
1. O documento deve ser operacional e definitivo, contendo schemas e payloads JSON completos (sem reticências ou placeholders).
2. Detalhar a integração cirúrgica em pelo menos 4 arquivos reais do repositório (prisma/schema.prisma, src/modules/orders/order.service.ts, src/shared/errors/app-error.ts, src/middlewares/auth.middleware.ts, src/app.ts).
3. Apresentar diagramas de sequência/estados em Mermaid para enfileiramento atômico, polling worker, retentativas e replay admin.
4. Mapear a matriz completa de erros no padrão WEBHOOK_* com status HTTP e resposta JSON padronizada.
```

---

## 5. Iterações, Desafios e Ajustes Críticos

Durante a condução da IA e a revisão técnica pela banca avaliadora, foram consolidados os seguintes ajustes e refinamentos críticos no projeto:

* **Ajuste de Fronteiras entre Documentos:** Foi necessário instruir o agente para manter a separação clara de responsabilidades entre os artefatos. O `RFC.md` manteve o foco em motivadores, trade-offs e decisões arquiteturais de alto nível, evitando a proliferação de schemas JSON exaustivos que pertenciam exclusivamente ao `FDD.md`.
* **Tratamento Rigoroso de Ideias Descartadas:** Ideias levantadas na reunião técnica e descartadas (como uso de Redis Streams, disparo HTTP síncrono no checkout e disparo de e-mails em caso de falha) foram explicitamente posicionadas nas seções *Fora de Escopo* e *Alternativas Descartadas* dos documentos, impedindo que fossem incorporadas erroneamente como requisitos no `PRD.md` ou `FDD.md`.
* **Precisão de Caminhos de Código Legado:** Garantia de que todos os arquivos citados apontassem para caminhos reais existentes no repositório (`src/modules/orders/order.service.ts`, `prisma/schema.prisma`, `src/shared/errors/app-error.ts`, `src/middlewares/auth.middleware.ts`, `src/app.ts`).
* **Especificação de Distributed Tracing (OpenTelemetry):** Iteração dedicada no `FDD.md` para documentar a estratégia de rastreabilidade ponta a ponta com OpenTelemetry (`@opentelemetry/sdk-node` e `@opentelemetry/api`). Foi modelado a captura do contexto W3C (`traceparent`) na requisição de checkout/alteração de status, a persistência do contexto dentro do snapshot da outbox, a extração pelo Polling Worker em `src/worker.ts`, a criação de spans-filhos (`webhook.dispatch`) e a injeção do cabeçalho `traceparent` no disparo HTTP de saída para os clientes B2B.
* **Inclusão de Seções formais de Dependências e Riscos Técnicos:** Complementação do FDD com o mapeamento exaustivo de dependências de runtime (Node.js LTS >= 18.x, TypeScript 5.x, Prisma 5.x, MySQL 8, OpenTelemetry, Pino, Zod) e mitigações estratégicas para riscos como contenção de locks na outbox via `FOR UPDATE SKIP LOCKED`, isolamento de pools de conexão MySQL entre Worker e API, tratativa de entrega fora de ordem via timestamp no snapshot e controle de vazamentos de memória (memory leaks) no loop do worker.

---

## 6. Como Navegar a Entrega

### Estrutura de Diretórios

```text
.
├── TRANSCRICAO.md                       # Transcrição original da reunião técnica
├── README.md                            # Este guia de entrega e processo de IA
├── docs/
│   ├── PRD.md                           # Product Requirement Document
│   ├── RFC.md                           # Request for Comments (Arquitetura Macro)
│   ├── FDD.md                           # Feature Design Document (Especificação Técnica)
│   ├── TRACKER.md                       # Matriz de Rastreabilidade de Engenharia
│   └── adrs/                            # Architecture Decision Records (MADR)
│       ├── ADR-001-transactional-outbox-no-mysql.md
│       ├── ADR-002-polling-worker-architecture.md
│       ├── ADR-003-politica-retry-backoff-dlq.md
│       ├── ADR-004-autenticacao-hmac-sha256-e-rotacao.md
│       ├── ADR-005-garantia-at-least-once-e-idempotencia.md
│       ├── ADR-006-snapshot-de-payload-no-momento-da-insercao.md
│       └── ADR-007-gestao-dlq-e-replay-admin.md
├── prisma/
│   └── schema.prisma                    # Schema do banco de dados MySQL / Prisma
└── src/                                 # Código-fonte da aplicação OMS Node.js/TS
```

### Ordem Sugerida de Leitura

Para uma compreensão lógica e progressiva da solução entregue, sugere-se a seguinte ordem:

1. **[`docs/PRD.md`](file:///Users/marianasanches/Desktop/mba-design-docs/docs/PRD.md):** Entenda as dores do negócio, os clientes B2B afetados, os objetivos e os requisitos funcionais e não-funcionais.
2. **[`docs/RFC.md`](file:///Users/marianasanches/Desktop/mba-design-docs/docs/RFC.md):** Compreenda a proposta de solução técnica em alto nível, os motivadores da arquitetura e o que foi considerado e descartado.
3. **[`docs/adrs/`](file:///Users/marianasanches/Desktop/mba-design-docs/docs/adrs):** Explore os 7 registros individuais de decisão arquitetural (Outbox, Polling Worker, Retries, HMAC, At-Least-Once, Snapshot Payload e DLQ/Replay).
4. **[`docs/FDD.md`](file:///Users/marianasanches/Desktop/mba-design-docs/docs/FDD.md):** Analise o guia técnico operacional de implementação com código de acoplamento aos arquivos legados, diagramas Mermaid, schemas Prisma e contratos HTTP completos.
5. **[`docs/TRACKER.md`](file:///Users/marianasanches/Desktop/mba-design-docs/docs/TRACKER.md):** Audite a rastreabilidade bidirecional dos 53 itens de engenharia vinculados aos seus respectivos timestamps na reunião técnica e arquivos de código.
