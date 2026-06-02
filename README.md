# Consulta de Processo SIPAC UFBA

Extensão Chrome MV3 que adiciona um campo de consulta rápida de número de protocolo ao SIPAC/UFBA.

No portal público, o painel aparece na área de **Editais Recentes**. No Portal Administrativo autenticado, o painel aparece no topo do conteúdo e usa a sessão do usuário logado.

No portal público, abaixo do painel, a extensão exibe um botão para acessar diretamente o Portal Administrativo quando o usuário já está autenticado. Caso contrário, exibe um botão para entrar no sistema.

O painel tem duas buscas independentes:

- **Processo**, para números de protocolo associados a processos.
- **Documento**, para números de protocolo associados a documentos.

Ao colar um protocolo de processo no portal público, a extensão:

1. interpreta o número no formato `23066.000000/2026-00`;
2. verifica se o identificador público do processo já está no cache local;
3. quando necessário, preenche e envia a busca oficial de processos do próprio SIPAC;
4. extrai o identificador do resultado e salva esse valor no cache;
5. abre `https://sipac.ufba.br/public/jsp/processos/processo_detalhado.jsf?id=...`.

Nas consultas públicas seguintes ao mesmo processo, a extensão usa o identificador salvo e abre diretamente a página detalhada, sem repetir a busca.

Na página pública detalhada do processo, a extensão também exibe um botão para abrir o mesmo protocolo no Portal Administrativo autenticado.

Ao colar um protocolo de documento no portal público, a extensão verifica primeiro se o `idDoc` já está salvo no cache. Quando está, abre diretamente a página do documento. Caso contrário, preenche e envia o formulário oficial `documentosForm`, salva o identificador encontrado e abre a página correspondente.

Ao colar um protocolo no Portal Administrativo, a extensão:

1. interpreta o número no mesmo formato;
2. abre a consulta autenticada de processo ou documento;
3. preenche os campos internos do formulário autenticado;
4. submete a busca usando a sessão já autenticada do navegador.

No portal público e no Portal Administrativo, a extensão também exibe os últimos 10 documentos e processos consultados. O histórico fica armazenado localmente no navegador e apresenta links diretos para cada protocolo.

## Instalação local

1. Abra `chrome://extensions`.
2. Ative **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação**.
4. Selecione esta pasta:

```text
/Users/rodrigorgs/Documents/Codex/2026-05-29/crie-uma-extens-o-do-chrome
```

## Uso

Acesse `https://sipac.ufba.br/`, `https://sipac.ufba.br/public/jsp/portal.jsf` ou, após login, `https://sipac.ufba.br/sipac/portal_administrativo/index.jsf` e cole o número do protocolo no campo **Consulta rápida de protocolo**.

Também é possível pressionar `Enter` ou clicar em **Consultar**.

## URL direta para documento

Após login no SIPAC, também é possível abrir uma URL neste formato:

```text
https://sipac.ufba.br/sipac/portal_administrativo/index.jsf?doc=23066.029772/2026-10
```

A extensão detecta o parâmetro `doc`, busca o documento pelo protocolo, extrai o `idDoc` da ação da lupa e navega para a página de detalhes do documento.

## URL direta para processo

Após login no SIPAC, também é possível abrir uma URL neste formato:

```text
https://sipac.ufba.br/sipac/portal_administrativo/index.jsf?proc=23066.011718/2026-18
```

A extensão detecta o parâmetro `proc`, abre a consulta autenticada de processos e realiza a busca pelo protocolo.

## Observações

- A extensão não armazena login ou senha. No Portal Administrativo, ela apenas reaproveita a sessão já aberta no Chrome.
- No portal público, a extensão usa o formulário público já presente no portal; ela não usa APIs privadas.
- Se o SIPAC retornar mais de um resultado, a extensão evita escolher sozinha e deixa a página de resultados aberta.
- Caso o protocolo seja colado apenas com números, a extensão tenta inferir o formato padrão da UFBA iniciado por `23066`.

Para limpar apenas o cache de processos públicos durante testes, abra o console em uma página do SIPAC e execute:

```js
localStorage.removeItem("sipacProtocoloRapido:publicProcessIdCache");
```
