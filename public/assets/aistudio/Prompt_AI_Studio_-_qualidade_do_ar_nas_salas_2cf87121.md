# Qualidade do ar dentro das salas: CO2 estimado, ar lá fora e vistoria

## Por que esta mudança

O app hoje olha só para o calor. Mas 10 das 12 escolas cadastradas declaram ao Censo 2025 todas as salas climatizadas, e o ar-condicionado split comum não traz ar de fora: ele só esfria o ar que já está na sala. Com porta e janelas fechadas, o gás carbônico (CO2) que os alunos exalam se acumula aula após aula.

- Em três salas de aula com split e janelas fechadas na UFCG (Campina Grande, 2018), o CO2 passou de 1.000 ppm em cerca de 95% do tempo, com pico de 4.736 ppm.
- Uma revisão de Wargocki e colegas (Building and Environment, 2020) estima que baixar o CO2 de 2.100 para 900 ppm deixa as tarefas escolares cerca de 12% mais rápidas.
- A referência técnica brasileira atual para ar interior em ambiente climatizado é a ABNT NBR 17037: CO2 até 700 ppm acima do ar externo. Ela tomou o lugar da RE 9/2003 da Anvisa, que fixava 1.000 ppm.
- A Lei 13.589/2018 obriga prédios de uso público e coletivo com ar-condicionado a ter um Plano de Manutenção, Operação e Controle (PMOC).

Calor e ar puxam para lados opostos: fechar a sala para resfriar acumula CO2; abrir traz calor e, às vezes, poluição da rua. Esta tarefa faz o app mostrar os dois lados.

## Regras desta tarefa (valem para todas as partes)

- O CO2 dentro da sala é **estimativa de modelo**. Nunca use o selo de observação para ele e nunca escreva "medido", "medição" ou "leitura" para um valor estimado.
- Ar lá fora: se a API falhar, mostre "Previsão do ar externo indisponível agora". Não crie valores de reserva, nem sintéticos, nem de exemplo.
- Não altere o cálculo de calor, a previsão do tempo Open-Meteo que já existe, os campos `shifts` e `shiftsInformed`, o índice de exposição térmica nem os dados de ilha de calor.
- Não apague nada do Firestore. Nenhuma operação de delete.
- Todos os testes atuais continuam passando. Acrescente os testes pedidos abaixo.
- Textos de interface em português do Brasil, sem travessão (—).
- Use o componente de selo de proveniência que já existe (`DataProvenanceBadge`). Para estimativa de modelo, use a natureza que o app já usa para a temperatura estimada da sala. Se não existir uma, crie `'estimativa'` com a descrição: "Calculado por modelo a partir de dados públicos. Não é medição."

## Parte 1. Turmas por turno (dado do Censo)

Em `src/types.ts`:

```ts
export interface ClassShiftRecord {
  shift: 'manha' | 'tarde' | 'noite';
  classes: number;            // número de turmas que começam nesse turno
  enrollment: number;         // matrículas somadas dessas turmas
  avgClassSize: number;       // média de alunos por turma
  maxClassSize: number;       // maior turma
  startTime: string;          // horário de início declarado (HH:MM)
  durationMinutesMin: number; // menor duração diária declarada
  durationMinutesMax: number; // maior duração diária declarada
}
```

Em `SchoolRecord`, acrescente `classesByShift?: ClassShiftRecord[]` e `classesByShiftSource?: string`.

Crie `src/data/classesByShift.ts` exportando `CLASSES_BY_SHIFT: Record<string, ClassShiftRecord[]>` com os dados abaixo, exatamente como estão. A chave é o código INEP. Ao carregar as escolas, junte pelo `inepCode` e preencha `classesByShiftSource` com: "Censo Escolar 2024 (Inep), tabela de turmas, via Base dos Dados. Turmas sem etapa de ensino (atividade complementar e AEE) ficaram de fora. 2024 é o ano mais recente dessa tabela."

```json
{
  "33058610": [{"shift": "manha", "classes": 7, "enrollment": 227, "avgClassSize": 32.4, "maxClassSize": 37, "startTime": "07:00", "durationMinutesMin": 315, "durationMinutesMax": 575}, {"shift": "tarde", "classes": 2, "enrollment": 70, "avgClassSize": 35.0, "maxClassSize": 37, "startTime": "12:50", "durationMinutesMin": 315, "durationMinutesMax": 315}, {"shift": "noite", "classes": 6, "enrollment": 140, "avgClassSize": 23.3, "maxClassSize": 30, "startTime": "18:10", "durationMinutesMin": 265, "durationMinutesMax": 265}],
  "33062110": [{"shift": "manha", "classes": 20, "enrollment": 577, "avgClassSize": 28.9, "maxClassSize": 35, "startTime": "07:30", "durationMinutesMin": 240, "durationMinutesMax": 240}, {"shift": "tarde", "classes": 20, "enrollment": 705, "avgClassSize": 35.2, "maxClassSize": 44, "startTime": "12:40", "durationMinutesMin": 320, "durationMinutesMax": 320}, {"shift": "noite", "classes": 5, "enrollment": 133, "avgClassSize": 26.6, "maxClassSize": 42, "startTime": "18:00", "durationMinutesMin": 240, "durationMinutesMax": 240}],
  "33063397": [{"shift": "manha", "classes": 24, "enrollment": 803, "avgClassSize": 33.5, "maxClassSize": 39, "startTime": "07:20", "durationMinutesMin": 315, "durationMinutesMax": 325}, {"shift": "tarde", "classes": 19, "enrollment": 406, "avgClassSize": 21.4, "maxClassSize": 34, "startTime": "13:00", "durationMinutesMin": 315, "durationMinutesMax": 315}, {"shift": "noite", "classes": 11, "enrollment": 265, "avgClassSize": 24.1, "maxClassSize": 36, "startTime": "18:20", "durationMinutesMin": 250, "durationMinutesMax": 270}],
  "33069131": [{"shift": "manha", "classes": 17, "enrollment": 633, "avgClassSize": 37.2, "maxClassSize": 44, "startTime": "07:30", "durationMinutesMin": 250, "durationMinutesMax": 420}],
  "33072965": [{"shift": "manha", "classes": 15, "enrollment": 539, "avgClassSize": 35.9, "maxClassSize": 43, "startTime": "07:30", "durationMinutesMin": 260, "durationMinutesMax": 420}],
  "33074313": [{"shift": "manha", "classes": 10, "enrollment": 239, "avgClassSize": 23.9, "maxClassSize": 31, "startTime": "07:30", "durationMinutesMin": 270, "durationMinutesMax": 420}, {"shift": "tarde", "classes": 4, "enrollment": 85, "avgClassSize": 21.3, "maxClassSize": 25, "startTime": "13:00", "durationMinutesMin": 270, "durationMinutesMax": 270}],
  "33074615": [{"shift": "manha", "classes": 18, "enrollment": 490, "avgClassSize": 27.2, "maxClassSize": 33, "startTime": "07:30", "durationMinutesMin": 270, "durationMinutesMax": 270}, {"shift": "tarde", "classes": 15, "enrollment": 426, "avgClassSize": 28.4, "maxClassSize": 33, "startTime": "13:00", "durationMinutesMin": 270, "durationMinutesMax": 270}],
  "33076464": [{"shift": "manha", "classes": 9, "enrollment": 264, "avgClassSize": 29.3, "maxClassSize": 34, "startTime": "07:30", "durationMinutesMin": 420, "durationMinutesMax": 420}, {"shift": "noite", "classes": 4, "enrollment": 53, "avgClassSize": 13.3, "maxClassSize": 18, "startTime": "18:00", "durationMinutesMin": 240, "durationMinutesMax": 240}],
  "33077746": [{"shift": "manha", "classes": 13, "enrollment": 415, "avgClassSize": 31.9, "maxClassSize": 37, "startTime": "07:30", "durationMinutesMin": 240, "durationMinutesMax": 270}, {"shift": "tarde", "classes": 10, "enrollment": 294, "avgClassSize": 29.4, "maxClassSize": 37, "startTime": "13:00", "durationMinutesMin": 240, "durationMinutesMax": 270}],
  "33086206": [{"shift": "manha", "classes": 11, "enrollment": 329, "avgClassSize": 29.9, "maxClassSize": 40, "startTime": "07:30", "durationMinutesMin": 420, "durationMinutesMax": 420}],
  "33104379": [{"shift": "manha", "classes": 18, "enrollment": 585, "avgClassSize": 32.5, "maxClassSize": 45, "startTime": "07:00", "durationMinutesMin": 315, "durationMinutesMax": 315}, {"shift": "tarde", "classes": 18, "enrollment": 645, "avgClassSize": 35.8, "maxClassSize": 42, "startTime": "12:45", "durationMinutesMin": 315, "durationMinutesMax": 315}, {"shift": "noite", "classes": 8, "enrollment": 236, "avgClassSize": 29.5, "maxClassSize": 40, "startTime": "18:50", "durationMinutesMin": 250, "durationMinutesMax": 250}],
  "33144591": [{"shift": "manha", "classes": 6, "enrollment": 151, "avgClassSize": 25.2, "maxClassSize": 27, "startTime": "07:30", "durationMinutesMin": 480, "durationMinutesMax": 480}]
}
```

A escola fictícia de demonstração fica sem `classesByShift`.

Este dado entra só no módulo de ar nesta tarefa. Não use para mudar `shifts`, `shiftsInformed` nem o cálculo de calor por turno.

## Parte 2. Modelo de CO2 (`src/utils/airQualityMath.ts`)

Modelo de sala bem misturada (balanço de massa), com resolução de 1 minuto. Comente no código que todos os valores marcados como provisórios serão recalibrados com os sensores do piloto.

Constantes:

```ts
export const OUTDOOR_CO2_PPM = 420;                 // ar externo de referência; a NBR 17037 pede medir o ar externo junto
export const CO2_MARGIN_ABOVE_OUTDOOR_PPM = 700;    // ABNT NBR 17037
export const CO2_REFERENCE_PPM = OUTDOOR_CO2_PPM + CO2_MARGIN_ABOVE_OUTDOOR_PPM; // 1.120 ppm

// Geração de CO2 por pessoa sentada em sala, em L/s. Valores medianos para 6, 11 e 16 anos
// (Carrasco, Molina e Jones, "An evaluation of CO2 emission rates by Chilean school children", AIVC).
export const CO2_GENERATION_LS: Record<EducationStage, number> = {
  infantil: 0.0033, fundamental_1: 0.0033, fundamental_2: 0.0041, medio: 0.0049, eja: 0.0049,
};
export const TEACHER_CO2_LS = 0.0049; // professor contado com o valor de 16 anos (subestima um pouco)

export const DEFAULT_ROOM = { areaM2: 50, heightM: 3 }; // 150 m³; provisório até a vistoria medir a sala
export const AIR_CHANGES_PER_HOUR = {                     // provisórios
  fechada_split: 0.5,        // porta e janelas fechadas, só frestas
  fresta_aberta: 1.5,
  janelas_abertas: 3,
  ventilacao_cruzada: 6,     // janelas e porta abertas em lados opostos
};
// Turno de referência: 4 aulas de 50 min; recreio de 20 min depois da 2ª aula, com a sala vazia.
```

Funções:

1. `co2GenerationPerStudent(enrollmentByStage)`: média de `CO2_GENERATION_LS` ponderada pelas matrículas de cada etapa. Se o total for zero, devolva 0.0033 e `isFallback: true`.
2. `steadyStateCo2(totalGenerationLs, roomVolumeM3, airChangesPerHour, outdoorPpm = OUTDOOR_CO2_PPM)`:
   `Css = outdoorPpm + (totalGenerationLs * 3.6 / roomVolumeM3) * 1e6 / airChangesPerHour`.
3. `simulateClassroomCo2(opts)` com `students`, `generationPerStudentLs`, `roomVolumeM3`, `achClass`, `achRecess` (padrão = `achClass`), `ventilateMinutesAtClassEnd` (padrão 0), `achVentilation` (padrão 6) e `outdoorPpm`:
   - Geração total na aula = `students * generationPerStudentLs + TEACHER_CO2_LS`. No recreio, geração zero.
   - Em cada trecho: `C(t) = Css + (C0 - Css) * Math.exp(-ach * t / 60)`, com t em minutos. Começa em `C0 = outdoorPpm`.
   - Se `ventilateMinutesAtClassEnd > 0`, os últimos N minutos de cada aula usam `achVentilation`, com os alunos ainda na sala.
   - Devolve `series` (ppm a cada minuto), `peakPpm`, `classMinutes` (200), `minutesAboveReference` (só minutos de aula), `firstMinuteAboveReference` (minuto do turno, ou null).
4. `requiredAirChangesPerHour(students, generationPerStudentLs, roomVolumeM3)` = `(students * g + TEACHER_CO2_LS) * 3.6 / (roomVolumeM3 * CO2_MARGIN_ABOVE_OUTDOOR_PPM * 1e-6)`.
5. `requiredOutdoorAirPerPersonM3h(g)` = `g * 3.6 / (CO2_MARGIN_ABOVE_OUTDOOR_PPM * 1e-6)`.
6. `schoolAirEstimate(school, inspection?)`: escolhe o turno diurno (manhã ou tarde) com a maior `avgClassSize`, usa `Math.round(avgClassSize)` alunos e devolve o turno escolhido, alunos, maior turma, `firstMinuteAboveReference` com a sala fechada, pico com janelas abertas e renovação necessária. Volume: o da vistoria, se houver (Parte 6); senão, `DEFAULT_ROOM`. Sem `classesByShift`, devolve `{ status: 'pendente' }`, sem NaN.

Testes novos em `tests/airQuality.test.ts`:

- (a) 30 alunos, g = 0,0033, 150 m³, 0,5 troca por hora: o valor no minuto 50 é 2.119 ppm (tolerância de 1 ppm).
- (b) `requiredAirChangesPerHour(30, 0.0033, 150)` = 3,56 (tolerância de 0,01).
- (c) `steadyStateCo2` com 30 alunos, g = 0,0033, professor, 150 m³ e 3 trocas por hora = 1.251 ppm (tolerância de 1).
- (d) E.M. Bahia (37 alunos, só fundamental 2, 150 m³, 0,5 troca por hora): `firstMinuteAboveReference` = 12.
- (e) Escola sem `classesByShift`: status 'pendente' e nenhum NaN.
- (f) `requiredOutdoorAirPerPersonM3h(0.0033)` = 16,97 (tolerância de 0,01).

## Parte 3. Ficha da escola: bloco "Ar dentro da sala"

Em `SchoolDetail.tsx`, logo depois do bloco de ilha de calor, crie o bloco "Ar dentro da sala (estimativa, sem sensor)" com o selo de estimativa.

- Linha de turma: "Turma média no turno da {manhã|tarde}: {N} alunos (maior turma: {M}). Fonte: Censo Escolar 2024, turmas."
- Escola com salas climatizadas declaradas (`declaredClimatizedRooms > 0`):
  - "Com porta e janelas fechadas e ar-condicionado split, o CO2 passa da referência em cerca de {X} minutos de aula."
  - "Para ficar dentro da referência, a sala precisaria receber cerca de {Q} m³/h de ar de fora ({R} trocas de ar por hora numa sala de {V} m³). O split comum não traz ar de fora; só esfria o ar da sala."
  - "Sala climatizada de uso coletivo: a Lei 13.589/2018 exige PMOC. PMOC desta escola: {valor da vistoria ou 'não verificado'}."
- Escola sem salas climatizadas: "Com janelas abertas (3 trocas por hora, valor provisório), o pico estimado é de {P} ppm. Janela aberta também traz o ar da rua: veja a previsão de partículas no monitoramento."
- Sempre: "Referência: ABNT NBR 17037, CO2 até 700 ppm acima do ar externo (1.120 ppm com o ar externo a 420 ppm). A norma vale para ambiente climatizado; em sala sem ar-condicionado, o Termômetro usa o mesmo valor como régua."
- Um "Como esta estimativa é feita", recolhido por padrão, com: sala de 150 m³ (50 m² e 3 m de pé-direito) até a vistoria medir; 0,5 troca de ar por hora com tudo fechado e 3 com janelas abertas, valores provisórios; geração de CO2 por idade (Carrasco, Molina e Jones); professor incluído; ar externo a 420 ppm; 4 aulas de 50 minutos e recreio de 20 minutos com a sala vazia. Termine com: "A ordem de grandeza bate com medições em salas brasileiras com split, mas só o sensor do piloto confirma o número desta escola."
- Ajustes pela vistoria (Parte 6):
  - `acType === 'central_com_renovacao'`: troque a frase da sala fechada por "Sistema com renovação de ar declarado na vistoria. Só um sensor mostra se a vazão basta."
  - `windowsOperable === 'nenhuma'`: não mostre o cenário de janelas abertas e escreva "Janelas não abrem (vistoria)".
- Status 'pendente': "Estimativa pendente: turmas desta escola não carregadas", em cinza e sem número.
- Não mostre o pico da sala fechada na ficha. Ele depende demais das suposições; fica só no simulador.

## Parte 4. Ar lá fora: previsão de partículas

Em `server.ts`, seguindo o padrão da previsão do tempo que já existe (rota, cache e tratamento de erro), crie a busca da qualidade do ar:

```
https://air-quality-api.open-meteo.com/v1/air-quality?latitude={lat}&longitude={lon}&hourly=pm2_5,pm10,ozone&timezone=America%2FSao_Paulo&forecast_days=3&domains=cams_global
```

- Cache de 3 horas. A fonte é atualizada a cada 12 horas.
- Em caso de falha, devolva `status: 'indisponivel'` e nenhum valor. Sem fallback.
- Proveniência: a mesma natureza usada para a previsão do tempo. Fonte: "CAMS (Copernicus), via Open-Meteo Air Quality API, grade de cerca de 45 km". Descrição: "Previsão de partículas no ar da região, não da sala nem da rua da escola. Serve para saber se o dia está limpo ou carregado."
- Junte com a previsão do tempo pelo horário. Hora sem valor fica `null`.

Em `Monitoring72h.tsx`, por dia e por turno:

- "Partículas finas lá fora (PM2,5): máximo de {x} µg/m³". Marque como "ar externo carregado" as horas acima de 25 µg/m³. Explique numa nota: "25 µg/m³ é o limite de PM2,5 da NBR 17037 para ar interior; aqui serve de régua para o ar que entraria pela janela."
- "Melhor horário para abrir porta e janelas: {h1} e {h2}". Crie `bestVentilationHours(hourly, shiftHours)` em `airQualityMath.ts`: entre as horas do turno com PM2,5 até 25 µg/m³, as 2 com menor índice de calor. Com o ar externo indisponível, use só o índice de calor e avise "sem dado de partículas". Se nenhuma hora do turno tiver PM2,5 até 25, mostre "Ar externo carregado o turno todo: evite abrir janelas para a rua".
- Teste de `bestVentilationHours` com 4 horas sintéticas dentro do teste: a hora mais fresca com PM2,5 de 40 fica de fora.

## Parte 5. Simulador: "Ar da sala"

No simulador, crie uma seção ou aba "Ar da sala", com o selo de simulação:

- Escola: preenche alunos e etapas pelo Censo. Também permite valores livres.
- Controles: alunos (10 a 50); etapa (infantil e fundamental 1, fundamental 2, médio e EJA); área (30 a 80 m²) e pé-direito (2,6 a 4 m); ventilação durante a aula (fechada com split, fresta aberta, janelas abertas, ventilação cruzada).
- Duas opções liga/desliga: "Recreio com tudo aberto" e "Abrir tudo 5 minutos no fim de cada aula".
- Gráfico do CO2 minuto a minuto nas 4 aulas, com a linha de referência de 1.120 ppm, na mesma biblioteca de gráficos que o app já usa.
- Números abaixo do gráfico: minutos de aula acima da referência (de 200), pico e renovação necessária.
- Nota fixa: "Trocas de ar por hora são valores provisórios. Abrir a sala nas trocas de aula ajuda, mas não substitui renovação de ar contínua."

## Parte 6. Vistoria: campos sobre o ar

Em `SchoolInspection` (`types.ts`), acrescente campos **opcionais**:

- `acType`: 'split' | 'janela' | 'central_com_renovacao' | 'ventilador' | 'nenhum' | 'desconhecido'
- `windowsOperable`: 'todas_abrem' | 'algumas' | 'nenhuma' | 'desconhecido'
- `windowsClosedWhenAcOn`: 'sempre' | 'as_vezes' | 'nunca' | 'desconhecido'
- `pmocStatus`: 'visto_documento' | 'informado_sem_documento' | 'nao_tem' | 'desconhecido'
- `lastFilterCleaning`: string no formato AAAA-MM
- `moldOrDampSigns`: boolean
- `nearbyPollutionSource`: 'via_movimentada' | 'obra' | 'queima_de_lixo' | 'industria' | 'nenhuma' | 'desconhecido'
- `roomDimensions`: `{ lengthM: number; widthM: number; heightM: number }` da sala vistoriada

Mais o que fazer nesta parte:

- No formulário de vistoria, agrupe tudo numa seção "Ar da sala". O valor padrão dos campos de opção é 'desconhecido'.
- Em `src/firebase.ts`, as funções de leitura e gravação copiam campo a campo. Inclua os campos novos. Vistorias antigas sem esses campos continuam abrindo normalmente.
- Em `firestore.rules`, acrescente os campos novos à lista do `hasOnly` da vistoria, cada um opcional e validado:
  - opções com `!('campo' in data) || data.campo in [...]`;
  - `lastFilterCleaning` com `matches('^[0-9]{4}-[0-9]{2}$')`;
  - `roomDimensions` com comprimento e largura entre 1 e 30 e pé-direito entre 2 e 8.
  - Não afrouxe nenhuma outra regra.
- Casos novos no avaliador de regras:
  - vistoria antiga sem os campos: ALLOW;
  - vistoria com os campos válidos: ALLOW;
  - `acType: 'outro'`: DENY;
  - `lastFilterCleaning: 'ontem'`: DENY.
- Me avise se as regras novas precisam ser publicadas à mão no console do Firebase. Sem isso, vistorias com os campos novos serão recusadas.

## Parte 7. Piloto e sensores

- Em `SentinelReading`, acrescente `co2Ppm?: number`.
- Em `PilotAndValidation.tsx`, o kit de cada sala passa a ter também um sensor de CO2 por infravermelho (NDIR), com leitura a cada 10 minutos, junto com temperatura e umidade.
- Métrica nova, ao lado das horas acima de 25 °C: "minutos de aula com CO2 acima de 700 ppm do ar externo".
- Em cada visita, registre uma leitura do ar externo, como pede a NBR 17037.
- Nota de precedente: "O projeto Sala de Aula Saudável (UVV e UFES) comparou um medidor de baixo custo com ESP32 a um registrador de referência (HOBO MX1102A) numa sala de aula climatizada no Espírito Santo, com erro de cerca de 67 ppm (RMSE)."
- Na Escola Demonstração (fictícia), acrescente `co2Ppm` aos sensores simulados: 1850 no da sala de aula e 430 no do pátio. Os dois ficam com o selo de demonstração. Nenhuma escola real ganha leitura de CO2.

## Parte 8. Boletim e parecer do Gemini

Em `BulletinsAndReports.tsx`:

- Escola com salas climatizadas: acrescente a ação "Abrir porta e janelas por 5 minutos na troca de aula e durante todo o recreio, de preferência às {melhor horário}. Ajuda a baixar o CO2; não substitui renovação de ar."
- Se houver horas com "ar externo carregado" no turno, acrescente: "Ar lá fora carregado de partículas entre {h1} e {h2}: evite abrir janelas para a rua nesse período."
- Na mensagem de WhatsApp, use uma linha só, no mesmo tom das outras.

No `server.ts`, prompt do Gemini:

- Acrescente a estimativa de ar e a previsão de partículas aos dados de entrada.
- Em `GeminiStructuredEvaluation`, acrescente `indoorAirStatus: string` ao tipo e ao schema.
- Inclua esta instrução: "O CO2 dentro da sala é estimativa de modelo, sem sensor. Nunca diga que foi medido. Se faltar dado de ar, diga que está pendente."

## Parte 9. Faixa de transparência e rodapé

- No fim do texto atual da faixa fixa do topo, sem mudar o resto, acrescente: "Ar dentro da sala: estimativa por modelo, sem sensor. Ar lá fora: CAMS (Copernicus), via Open-Meteo."
- Rodapé: acrescente "CAMS/Copernicus via Open-Meteo" e "ABNT NBR 17037 (referência)" às fontes.
- Na seção de referências, se existir, acrescente:
  - Wargocki e colegas, Building and Environment 173 (2020), artigo 106749;
  - Araújo, Farias e Farias, CONTECC 2018 (UFCG);
  - Carrasco, Molina e Jones (AIVC);
  - Lei 13.589/2018;
  - ABNT NBR 17037.

## Como saber que terminou

1. `npm test` passa: os testes antigos mais os novos de `airQuality.test.ts`, de `bestVentilationHours` e das regras. `npm run lint` passa.
2. Nenhum valor de CO2 de escola real aparece com selo de observação. Uma busca por "medido" e "medição" perto dos textos de CO2 não encontra nada.
3. Com a API de qualidade do ar bloqueada, nenhum número de partículas aparece. Só o aviso de indisponível.
4. Os testes de calor dão exatamente o mesmo resultado de antes.
5. No fim, me mostre:
   - a lista de arquivos alterados;
   - a ficha da E.M. Bahia com o bloco novo;
   - qualquer ponto em que você precisou decidir algo que este prompt não cobria.
