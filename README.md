# Consulta de Processo SIPAC UFBA

Extensão Chrome MV3 que adiciona um campo de consulta rápida de número de protocolo ao SIPAC/UFBA.

No portal público, o painel aparece na área de **Editais Recentes**. No Portal Administrativo autenticado, o painel aparece no topo do conteúdo e usa a sessão do usuário logado.

O painel tem duas buscas independentes:

- **Processo**, para números de protocolo associados a processos.
- **Documento**, para números de protocolo associados a documentos.

Ao colar um protocolo de processo no portal público, a extensão:

1. interpreta o número no formato `23066.000000/2026-00`;
2. preenche a busca oficial de processos do próprio SIPAC;
3. envia o formulário oficial;
4. tenta abrir automaticamente o link do processo quando a tela de resultado apresenta um único item correspondente.

Ao colar um protocolo de documento no portal público, a extensão preenche e envia o formulário oficial `documentosForm`.

Ao colar um protocolo no Portal Administrativo, a extensão:

1. interpreta o número no mesmo formato;
2. abre a consulta autenticada de processo ou documento;
3. preenche os campos internos do formulário autenticado;
4. submete a busca usando a sessão já autenticada do navegador.

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

## Observações

- A extensão não armazena login ou senha. No Portal Administrativo, ela apenas reaproveita a sessão já aberta no Chrome.
- No portal público, a extensão usa o formulário público já presente no portal; ela não usa APIs privadas.
- Se o SIPAC retornar mais de um resultado, a extensão evita escolher sozinha e deixa a página de resultados aberta.
- Caso o protocolo seja colado apenas com números, a extensão tenta inferir o formato padrão da UFBA iniciado por `23066`.
