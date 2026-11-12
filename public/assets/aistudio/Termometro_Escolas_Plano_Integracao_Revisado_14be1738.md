# Termômetro das Escolas RJ — Plano de Convergência e Integração (revisão 2)

**Natureza:** especificação de implementação e homologação; não comprova que os módulos já estejam operacionais.  
**Escopo:** integrar componentes produzidos em paralelo no Claude à aplicação React/TypeScript do Google AI Studio, mantendo o código existente e a estrutura Firestore.  
**Prioridades:** Simulador Térmico, Ficha Técnica da Escola, preservação do histórico de vistorias, segurança e testes de precisão matemática.

## 1. Decisões preservadas

1. Manter um único produto no ecossistema do AI Studio; integrar código, não duplicar plataformas.
2. Portar algoritmos e fixtures do Claude para TypeScript compartilhado entre cliente e servidor, validando resultados contra referências independentes.
3. Priorizar o Simulador Térmico e a Ficha Técnica de Infraestrutura, mantendo Monitoramento 72h, Mapa e Boletins funcionais.
4. Diferenciar indicadores de exposição meteorológica (`IE_met`) e vulnerabilidade de infraestrutura (`IV_infra`), sem apresentá-los como métricas oficiais da Prefeitura.
5. Preservar as vistorias existentes: executar migrações reversíveis, com backup e auditoria antes de alterar estruturas em produção.

## 2. Posicionamento e limites científicos

O produto cruza dados cadastrais, condições de infraestrutura verificadas e previsão meteorológica para **priorizar acompanhamento preventivo** de escolas expostas ao calor. A aplicação deverá identificar separadamente:

- **Observado:** medições instrumentais efetivamente coletadas, com horário e localização.
- **Previsto:** variáveis meteorológicas fornecidas por modelo externo para as próximas 72 horas.
- **Declarado/verificado:** condições de infraestrutura informadas pelo Censo ou por vistoria, com procedência e data.
- **Simulado:** cenários hipotéticos de mudança de telhado, ventilação, sombreamento ou ocupação.
- **Estimado experimentalmente:** temperatura interna ou risco derivado de modelo ainda sujeito a calibração.

Não usar as expressões *alta precisão*, *alta fidelidade térmica*, *temperatura interna confirmada* ou *laudo de insalubridade* sem validação específica. Mapas de temperatura da superfície (LST) caracterizam o território; não são termômetros da sala de aula. O Índice de Calor de Rothfusz refere-se a temperatura e umidade do ar, em condições de sombra, e não incorpora diretamente radiação e vento.

## 3. Experiência e navegação

### Monitoramento 72h
- Séries horárias reais obtidas da Open-Meteo por coordenadas, com informação de atualização, origem e falhas de consulta.
- Horários de turno definidos por escola ou rede; utilizar 07h–12h, 12h–17h e 07h–17h **somente como valores iniciais editáveis**, não horários oficiais universais.
- Mostrar máximas, horários críticos e duração da exposição por limites experimentais claramente identificados.
- Informação sobre indisponibilidade de estações somente quando confirmada por fonte operacional, nunca por texto estático.

### Mapa e escolas
- Escolas reais, coordenadas verificadas, filtros por rede, bairro e cobertura de vistorias.
- LST, vegetação e indicadores urbanos somente quando houver camadas licenciadas e georreferenciadas, com resolução e data explicitadas.
- Filtros pelo `IV_infra` e pela condição confirmada da climatização, sem atribuir infraestrutura ausente a campos desconhecidos.

### Ficha Técnica da Escola
- Comparação lado a lado entre cadastro INEP e última vistoria **aprovada**, incluindo divergências e datas.
- Status: não vistoriada, rascunho, pendente de aprovação, aprovada, desatualizada.
- Exibir `IE_met` e `IV_infra` em blocos distintos; explicitar variáveis usadas e ausentes.
- Apresentar histórico de revisões técnicas aprovadas; ocultar identidade e contatos do inspetor na área pública.
- Leituras de sensores somente se registradas por dispositivo real, com metadados de qualidade.

### Simulador Térmico
- Controles de tipo de cobertura, orientação solar, sombreamento, ventilação, ocupação e eventos como falha elétrica.
- Resultados sempre rotulados **cenário hipotético / não constitui previsão validada de temperatura interna**.
- Exibir hipóteses, coeficientes, unidades e sensibilidade; desabilitar linguagem de precisão até validação instrumental.
- Permitir comparar cenário-base e intervenção sem gravar simulações como vistorias reais.

### Boletins e relatórios
- Gemini transforma **resultados numéricos já calculados e validados** em texto acessível e recomendações preventivas.
- Aprovação humana obrigatória antes de comunicação externa.
- Relatórios institucionais com identificação das fontes, versão do modelo e limitações; não confundir com perícia NR-15/NHO-06.

**Design:** manter identidade analítica e utilitária, tipografia Plus Jakarta Sans / Public Sans / JetBrains Mono e semântica de cores consistente; fornecer contraste acessível e nunca transmitir gravidade somente por cor.

## 4. Firestore — dados, privacidade e revisões

### 4.1 Estrutura canônica

```text
/inspections/{schoolId}                   # retrato técnico aprovado, público
  /revisions/{revisionId}                  # versão técnica aprovada e saneada, pública
  /private/{revisionId}                    # autor/contatos/auditoria sensível, restrita
/inspectionDrafts/{draftId}                # rascunhos e propostas de vistoria, restritos
/inspectors/{uid}                          # perfil privado e permissões, restrito
```

O documento público contém **somente** informações de infraestrutura aprovadas: `schoolId`, `revisionId`, `version`, `status=published`, campos técnicos autorizados, `source`, `inspectedAt`, `approvedAt` e `updatedAt` fornecidos pelo servidor. Não incluir nome, telefone, e-mail, fotos de crianças ou detalhes sensíveis de segurança predial. Dados como furto de fiação podem requerer divulgação resumida ou restrita após avaliação de risco.

Cada revisão guarda o retrato técnico aprovado daquela versão, `schemaVersion`, data e campos alterados, **sem identificação pessoal**. Em `/private/{revisionId}` manter referência autenticada ao inspetor e ao aprovador, contatos estritamente necessários, registros de validação e metadados restritos. Rascunhos não são públicos. Evidências fotográficas, caso necessárias, devem ficar em armazenamento privado, com regras próprias, retenção definida e revisão para remoção de dados pessoais.

### 4.2 Fluxo de publicação

1. Editor autenticado preenche ou atualiza um rascunho da escola para a qual tem permissão.
2. Backend valida esquema, vínculo com `schoolId` real, tipos, campos permitidos, integridade e identidade do editor.
3. Revisor autorizado aprova, rejeita ou solicita complementação, com justificativa registrada.
4. Ao aprovar, backend realiza **transação atômica**: cria revisão técnica pública, grava metadados privados correspondentes e atualiza o retrato público e o número da versão.
5. Cliente recebe a nova versão pelo `onSnapshot`; somente após confirmação do servidor apresenta estado `sincronizado`.
6. Revisões publicadas são append-only na lógica de autorização; correções geram nova revisão, sem sobrescrever a anterior. Esta medida **não é garantia criptográfica de imutabilidade**: manter backup, registros administrativos e política de retenção.

### 4.3 Permissões e segurança

- Leitura anônima: exclusivamente `inspections` aprovadas e respectivas revisões técnicas saneadas.
- Inspetor: ler/escrever apenas rascunhos de escolas às quais esteja formalmente vinculado.
- Revisor: revisar e aprovar apenas escopos autorizados.
- Administrador: administrar perfis e investigar registros privados, com acesso mínimo necessário.
- Clientes web não podem publicar diretamente nem alterar revisões aprovadas.
- Login Google confirma identidade, **não concede automaticamente papel de inspetor ou aprovador**.
- Aplicar controles explícitos a **cada subcoleção**; evitar regras amplas recursivas que exponham `private`.
- Quando usar SDK administrativo no servidor, verificar token, função e vínculo institucional **no servidor**; bibliotecas de servidor não obedecem automaticamente às Security Rules do cliente.
- Conferir `projectId`, `databaseId`, edição/modo Native do Firestore Enterprise e a publicação das regras no banco **nomeado** correto.
- Capturar `permission-denied`, perda de conexão e dados pendentes. A interface mostra `conectando`, `sincronizado`, `offline` ou `erro`, sem inferir conexão a partir da simples inicialização do SDK.
- Para listas extensas, substituir listener indiscriminado de toda a coleção por consultas filtradas/paginadas e listeners apenas nas telas que necessitam atualização contínua.
- Política de privacidade e retenção: definir responsáveis pelo tratamento, finalidades, base legal adequada, minimização, prazo de retenção, atendimento a titulares e proteção especial de dados relacionados a crianças e adolescentes.

## 5. Cálculos físicos e simulação

### `src/utils/thermalMath.ts`

Portar e revisar, antes de mesclar, funções propostas no Claude:

- `calculateHeatIndex(temperatureC, relativeHumidityPercent)`: implementar algoritmo NWS/NOAA com conversão correta para °F, fórmula simplificada e domínio de aplicação da regressão de Rothfusz, ajustes de umidade e retorno em °C.
- `calculateApparentTemperature(...)`: usar nomenclatura e metodologia próprias; **não** assumir que é sinônimo do Índice de Calor.
- `estimateEnvelopeGain(...)`: tratar como modelo experimental de cenários, com parâmetros e limites explícitos; não como previsão validada de temperatura interna.
- `calculateMeteorologicalExposure(...)` e `calculateInfrastructureVulnerability(...)`: índices separados, versionados, reproduzíveis e documentados; tratar dados ausentes como `unknown`, não como zero ou falha confirmada.

Fixture importada do Claude **não é evidência suficiente de validação independente**. Exigir comparação com referências oficiais/casos conferidos manualmente, teste de unidade, limites, entradas inválidas, NaN, umidade fora de 0–100%, conversão °C/°F e reprodutibilidade entre servidor e navegador. Manter o código físico em módulo compartilhado para evitar fórmulas divergentes.

## 6. Integrações externas e modelo de IA

- **Open-Meteo:** `temperature_2m`, `relative_humidity_2m`, `wind_speed_10m` e `shortwave_radiation`, horizonte explícito de 72 horas, fuso `America/Sao_Paulo`, `fetchedAt`, cache limitado e tratamento de indisponibilidade. Diferenciar **previsão atualizada** de medição em tempo real.
- **INEP / Geoportal:** reconciliar `schoolId`/código INEP, município, rede e coordenadas. Registrar fonte, competência/ano e conflitos; não inventar atributos de telhado, rede elétrica ou climatização funcional.
- **LST/ilhas de calor:** solicitar permissão e confirmar licença, método, data e resolução antes de publicar camada. Se a fonte não oferecer dados reutilizáveis, mostrar indisponibilidade, não fabricar geometrias.
- **Gemini:** escolher um identificador de modelo suportado pelo SDK da implantação (não depender do nome exibido na interface); receber apenas indicadores estruturados e gerar texto, com JSON Schema, checagem de saída, controle de custo e aprovação humana. Nunca delegar ao modelo a execução das equações ou a classificação oficial NC1–NC5.

## 7. Arquitetura de execução

```text
React/Vite (Monitoramento | Mapa | Ficha | Simulador | Boletins)
  |- thermalMath.ts compartilhado e testado
  |- Firebase Auth + Firestore (leituras públicas; rascunhos autorizados)
  |- onSnapshot filtrado e estados reais de sincronização
  `- server.ts / endpoints autenticados
       |- Open-Meteo com cache, fonte e timestamp
       |- publicação/revisões via transação segura
       `- Gemini para interpretação textual (JSON validado)

Firestore:
  inspections/{schoolId}                (público aprovado)
  inspections/{schoolId}/revisions/*    (histórico público saneado)
  inspections/{schoolId}/private/*      (informações privadas por revisão)
  inspectionDrafts/*                    (rascunhos restritos)
  inspectors/*                          (identidade/autorizações privadas)
```

## 8. Sequência de implementação e critérios de aceite

| Fase | Entrega | Critério verificável |
| --- | --- | --- |
| P0 — Auditoria | Comparar código existente, fontes Claude, schema e regras Firestore | Inventário dos arquivos, incompatibilidades e backup; nenhum dado apagado |
| P0 — Segurança | Corrigir databaseId, login, papéis, regras e erros de permissão | Leitura pública aprovada funciona; dados privados e escritas indevidas são negados |
| P1 — Versionamento | Rascunhos, revisão humana, publicação atômica e histórico | Duas sessões recebem versão publicada; revisão anterior permanece consultável |
| P1 — Física | `thermalMath.ts` compartilhado e fixtures independentes | Testes automatizados passam no browser e servidor, com limites documentados |
| P1 — Ficha | Cruzamento INEP e vistoria aprovada | Campos divergentes e desconhecidos aparecem corretamente, com fonte e data |
| P2 — Simulador | Interface reativa e comparação de cenários | Parâmetros alteram resultados; tudo é rotulado como hipotético |
| P2 — Previsão/Mapa | Open-Meteo real e bases geográficas verificadas | 72h com data, fuso e fonte; mapa não usa dados fictícios sem aviso |
| P3 — Boletins | Gemini com aprovação humana | Saída JSON válida, sem alegação de nível oficial ou diagnóstico de saúde |
| P4 — Piloto | Escolas-sentinela e sensores | Medições rastreáveis, análise de erro e decisão fundamentada sobre previsão interna |

### Testes obrigatórios antes da homologação

1. Visitante não autenticado lê somente vistorias aprovadas e revisões públicas.
2. Visitante, inspetor e editor de outra escola **não** leem `private` ou rascunhos fora de seu escopo.
3. Inspetor sem papel de revisor **não** publica, apaga ou reescreve histórico.
4. Vistoria com campos não permitidos e `schoolId` inválido é recusada.
5. Publicação cria versão histórica, metadados privados e retrato atual na mesma transação.
6. Após recarregar, dados persistem; falha de rede e `permission-denied` não exibem sucesso falso.
7. Cache e forecast registram `fetchedAt`; previsões simuladas não são exibidas como reais.
8. Casos físicos de referência, limites e unidades passam na suíte automatizada.
9. Interface é legível em dispositivos móveis e acessível sem depender apenas de cores.
10. A documentação registra o que foi efetivamente testado e o que permanece planejado.

## 9. Fora do escopo do MVP

- Previsão clínica de adoecimento de crianças ou trabalhadores.
- Determinação automática de suspensão de aulas ou interdição de instalações.
- Classificação oficial municipal de Níveis de Calor calculada pelo aplicativo.
- Laudos ocupacionais NR-15/NHO-06 gerados automaticamente.
- Alegações de previsão precisa da temperatura interna sem sensores e validação independente.
- Disparos automáticos de WhatsApp antes de consentimento e fluxo de aprovação.

## 10. Próxima entrega

**Primeiro checkpoint:** auditoria e correção da integração Firestore já iniciada, incluindo o eventual erro `Missing or insufficient permissions`, seguida da implantação de vistorias versionadas e públicas somente após aprovação. **Segundo checkpoint:** integração das fixtures reais de Claude e do simulador com testes de regressão, sem substituir componentes funcionais do AI Studio.

**Observação de verificação:** este documento é um plano; a conclusão de cada fase depende de arquivos de código, testes e logs de execução efetivamente inspecionados.

### Referências técnicas

- Firebase — regras e campos: https://firebase.google.com/docs/firestore/security/rules-fields
- Firebase — bancos nomeados: https://firebase.google.com/docs/firestore/manage-databases
- Firebase — testes de regras: https://firebase.google.com/docs/firestore/security/test-rules-emulator
- Firebase — transações: https://firebase.google.com/docs/firestore/manage-data/transactions
- NWS — equação e condições do Índice de Calor: https://www.weather.gov/ctp/heat
- Open-Meteo — variáveis meteorológicas: https://open-meteo.com/en/docs
