# Consulta de Processo SIPAC UFBA

Extensão Chrome MV3 que adiciona, no portal público do SIPAC/UFBA, um campo de consulta rápida de número de protocolo na área de **Editais Recentes**.

Ao colar um protocolo, a extensão:

1. interpreta o número no formato `23066.000000/2026-00`;
2. preenche a busca oficial de processos do próprio SIPAC;
3. envia o formulário oficial;
4. tenta abrir automaticamente o link do processo quando a tela de resultado apresenta um único item correspondente.

## Instalação local

1. Abra `chrome://extensions`.
2. Ative **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação**.
4. Selecione esta pasta:

```text
/Users/rodrigorgs/Documents/Codex/2026-05-29/crie-uma-extens-o-do-chrome
```

## Uso

Acesse `https://sipac.ufba.br/` ou `https://sipac.ufba.br/public/jsp/portal.jsf` e cole o número do protocolo no campo **Consulta rápida de protocolo**.

Também é possível pressionar `Enter` ou clicar em **Consultar**.

## Observações

- A extensão usa o formulário público já presente no portal; ela não usa login, senha nem APIs privadas.
- Se o SIPAC retornar mais de um resultado, a extensão evita escolher sozinha e deixa a página de resultados aberta.
- Caso o protocolo seja colado apenas com números, a extensão tenta inferir o formato padrão da UFBA iniciado por `23066`.
