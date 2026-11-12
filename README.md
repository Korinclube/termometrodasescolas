# Termômetro das Escolas RJ

Plataforma de inteligência climática escolar para apoiar a prevenção ao calor extremo e a qualidade do ar nas escolas da Região Metropolitana do Rio de Janeiro.

## Integração com o INMET

As chamadas às APIs do INMET são executadas exclusivamente no servidor, com cache de 1 hora, tempo limite por requisição e degradação silenciosa quando o serviço estiver fora do ar.

Sem token configurado, o aplicativo já exibe a situação operacional (`Operante` ou `Pane`), as coordenadas e a distância até a escola selecionada para as 7 estações automáticas do RJ:
- `A621` Vila Militar
- `A603` Xerém
- `A601` Seropédica
- `A627` Niterói
- `A636` Jacarepaguá
- `A652` Forte de Copacabana
- `A602` Marambaia

Nenhuma leitura meteorológica é inventada nas estações reais enquanto o token não estiver ativo.

## Quando o token chegar

Siga estes passos para ativar as leituras horárias reais do INMET assim que receber o seu token pessoal:

1. **Cadastrar o segredo `INMET_TOKEN`:**
   - No **Google AI Studio**, abra o painel **Secrets** (ícone de chave / cadeado na barra lateral do projeto) e adicione uma nova variável com o nome exato `INMET_TOKEN` e o valor do token fornecido pelo INMET.
   - Em ambiente local fora do AI Studio, defina `INMET_TOKEN="seu_token"` no arquivo `.env` na raiz do projeto (nunca use prefixo `VITE_`, para que o token não seja exposto ao navegador).
2. **Reiniciar o servidor:**
   - No AI Studio, clique em **Restart** (ou reinicie o servidor Node/Express em ambiente local) para que `process.env.INMET_TOKEN` seja carregado no processo do servidor.
3. **Conferir na rota de diagnóstico:**
   - Acesse `GET /api/inmet/diagnostics` no navegador ou via `curl`:
     - Confirme que `tokenPresent` retorna `"sim"` (o valor real do token nunca é exibido).
     - Após abrir a aba **Previsão 72h** ou consultar `/api/inmet/stations`, confirme que `lastSuccessAt` foi preenchido com data/hora ISO e que `lastError` está `null`.
   - O cartão **Previsto x Observado** (comparando a previsão Open-Meteo com a estação mais próxima) passa a aparecer automaticamente assim que houver uma leitura horária válida.

> **Segurança e tratamento de erros:** O token nunca é enviado ao navegador nem registrado em logs. Caso o INMET responda com erro `401`, `403`, `404` ou `429`, o servidor aguarda automaticamente 30 minutos antes de tentar nova consulta.
