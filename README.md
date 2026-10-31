# ◒ Clareza

**Seu dinheiro, com direção.**

Planejador financeiro local para organizar receitas, despesas e faturas de cartão em uma interface simples, em português e adaptada a computadores e celulares.

Desenvolvido com **React**, **TypeScript**, **Node.js** e **SQLite**. Os dados ficam no computador que executa a aplicação, com acesso pelo navegador e sem necessidade de serviços externos.

[Funcionalidades](#funcionalidades) · [Instalação](#instalação) · [Faturas PDF](#importação-de-faturas) · [Desenvolvimento](#desenvolvimento) · [Licença](#licença)

## Funcionalidades

- **Planejamento mensal:** contas com saldo inicial, receitas e despesas previstas ou realizadas.
- **Visão financeira:** saldo realizado, previsão de fechamento e distribuição dos gastos por categoria.
- **Importação de faturas:** leitura de PDFs do Inter com revisão dos lançamentos antes de salvar.
- **Organização dos gastos:** sugestões de categorias e separação por data da compra ou mês da fatura.
- **Detalhes do cartão:** identificação de cartões, parcelas, estornos, juros e IOF.
- **Controle de duplicidade:** identificação de lançamentos já importados da mesma fatura.
- **Contas de usuário:** autenticação local e planejamentos separados por usuário.
- **Persistência:** armazenamento em SQLite e proteção contra sobrescrita por outra sessão.
- **Backup:** exportação e importação do planejamento em JSON.
- **Interface responsiva:** acesso pelo computador ou pelo celular na mesma rede local.

## Tecnologias

| Camada          | Tecnologias                                |
| --------------- | ------------------------------------------ |
| Interface       | React 19, TypeScript e CSS                 |
| Servidor        | Node.js 24 e API HTTP                      |
| Banco de dados  | SQLite integrado ao Node.js                |
| Validação       | Zod                                        |
| Leitura de PDF  | PDF.js, executado no navegador             |
| Desenvolvimento | Vite, Prettier e testes nativos do Node.js |

## Instalação

### Requisitos

- **Node.js 24**, versão **24.13.0 ou superior dentro da série 24**, com npm.
- Navegador atualizado.
- Internet para instalar as dependências. Após a instalação e a compilação, a aplicação funciona localmente sem internet.

### Pelo terminal

Baixe ou clone o repositório e, na pasta do projeto, execute:

```sh
npm ci
npm run build
npm start
```

Acesse [localhost:3000](http://localhost:3000), clique em **Criar conta local** e cadastre suas contas financeiras. O banco é criado automaticamente; não é necessário configurar credenciais ou arquivos de ambiente.

Mantenha o servidor em execução enquanto utiliza a aplicação. Para encerrar, pressione `Ctrl+C`. Os dados são preservados entre execuções.

### Atalhos para Windows

1. Execute **Instalar.cmd** para instalar as dependências e compilar a aplicação.
2. Execute **Iniciar.cmd** para abrir o servidor local.
3. Acesse [localhost:3000](http://localhost:3000) no navegador.

> Após atualizar o código, execute `npm run build` ou **Instalar.cmd** novamente para atualizar a interface compilada.

## Acesso pelo celular

Com o computador e o celular conectados à mesma rede Wi-Fi, execute:

```sh
npm run start:lan
```

No Windows, também é possível usar **Iniciar-na-rede.cmd**.

Abra no celular o endereço de rede exibido no terminal e entre com a mesma conta local. Ambos os dispositivos acessam o banco do computador, que precisa permanecer ligado com o servidor em execução.

Se a conexão falhar, confira o endereço exibido, a rede Wi-Fi e a permissão do Node.js no firewall para redes privadas.

> O acesso em rede usa HTTP e foi pensado para redes locais de confiança. A aplicação não está preparada para exposição direta à internet. O servidor Node.js é necessário; hospedagem estática, como GitHub Pages, não executa o projeto completo.

## Importação de faturas

O leitor aceita **faturas PDF do Inter com texto selecionável**, com até **15 MB** e **50 páginas**. A extração acontece no navegador, sem envio do arquivo a serviços externos. O PDF original não é armazenado no banco.

1. Em **Importar fatura do cartão**, selecione o PDF.
2. Confira os lançamentos e ajuste as categorias sugeridas.
3. Escolha a conta em que os gastos serão registrados.
4. Selecione o critério de organização: **data original da compra** ou **mês da fatura**, usando o vencimento como data do lançamento.
5. Revise o resumo por mês e categoria e clique em **Importar seleção para o planejamento**.

Os lançamentos são salvos como **previstos**. A data original da compra, o cartão, a parcela e o mês da fatura são preservados nos dados exportados.

### Regras de leitura

- Pagamentos da fatura são ignorados para evitar contar o gasto novamente.
- Estornos entram como créditos; juros e IOF apresentados em linhas separadas são classificados como encargos.
- Detalhes de principal e juros abaixo de uma parcela não são somados novamente.
- Apenas as parcelas cobradas na fatura atual são importadas. A previsão da próxima fatura não gera lançamentos.
- Categorias são sugeridas pelo nome do estabelecimento. Itens desconhecidos ficam em **Outros**; correções anteriores são reaproveitadas quando a descrição é idêntica.
- Reimportações são identificadas pelo mês da fatura, cartão, data, descrição e valor. Compras iguais repetidas no mesmo arquivo são preservadas.

O total a pagar pode diferir da soma das compras por antecipações e ajustes. Confira os valores no PDF e evite registrar também o pagamento da fatura como uma nova despesa. Lançamentos manuais ou arquivos com descrições alteradas exigem revisão de duplicidade.

**Limitações:** PDFs escaneados, documentos protegidos por senha e modelos de outros bancos ainda não são suportados. Em compras parceladas, a data impressa pode corresponder à compra original, inclusive de meses anteriores.

## Armazenamento e backup

O banco é criado em `data/clareza.sqlite` e armazena usuários, sessões e planejamentos. As senhas são armazenadas com derivação e salt; o banco não possui criptografia em disco.

| Operação                  | Como fazer                                                                             |
| ------------------------- | -------------------------------------------------------------------------------------- |
| Exportar planejamento     | Use **Exportar dados** para baixar um JSON sem senhas ou sessões.                      |
| Importar planejamento     | Use **Importar backup do Clareza** em uma conta sem contas financeiras ou lançamentos. |
| Fazer backup completo     | Encerre a aplicação e copie a pasta `data/` para um local seguro.                      |
| Restaurar backup completo | Com a aplicação encerrada, restaure a pasta `data/` a partir da cópia.                 |

A pasta `data/`, bancos SQLite, arquivos de ambiente e arquivos gerados estão excluídos pelo `.gitignore`. Faturas e backups financeiros devem permanecer fora do repositório.

### Configuração opcional

| Variável           | Padrão  | Descrição                                                                              |
| ------------------ | ------- | -------------------------------------------------------------------------------------- |
| `PORT`             | `3000`  | Porta do servidor HTTP.                                                                |
| `CLAREZA_DATA_DIR` | `data/` | Diretório em que o banco SQLite será criado. Informe uma pasta, não o nome do arquivo. |

## Desenvolvimento

```sh
npm ci
npm run dev
```

A interface fica disponível em [localhost:5173](http://localhost:5173), com atualização automática. O Vite encaminha as chamadas da API ao servidor local na porta `3000`.

O ambiente de desenvolvimento utiliza a mesma pasta de dados local por padrão. Para trabalhar com um banco separado, configure `CLAREZA_DATA_DIR` antes de iniciar.

### Comandos

| Comando             | Descrição                                           |
| ------------------- | --------------------------------------------------- |
| `npm run dev`       | Inicia a interface e o servidor em desenvolvimento. |
| `npm run typecheck` | Verifica os tipos TypeScript.                       |
| `npm run build`     | Verifica os tipos e compila a interface.            |
| `npm start`         | Inicia o servidor para uso local.                   |
| `npm run start:lan` | Disponibiliza a aplicação na rede local.            |
| `npm test`          | Executa os testes automatizados.                    |
| `npm run format`    | Formata o código com Prettier.                      |

Para validar uma alteração:

```sh
npm run build
npm test
```

Os testes utilizam bancos temporários separados do banco da aplicação. A integração contínua executa a compilação e os testes em pushes e pull requests.

### Estrutura do projeto

```text
.github/workflows/  Integração contínua
src/               Interface, estilos e leitura de PDF
shared/            Tipos, validações, cálculos e interpretação de faturas
server/            API HTTP, autenticação, sessões e SQLite
scripts/           Inicialização e ambiente de desenvolvimento
tests/             Testes financeiros, de API e de importação
public/            Recursos estáticos
data/              Banco local gerado em uso (fora do Git)
dist/              Interface compilada (fora do Git)
```

## Limitações atuais

- Saldo inicial definido por mês, sem transporte automático do saldo anterior.
- Importação de backup JSON restrita a planejamentos vazios.
- Sem conexão bancária, transferências automáticas ou geração automática de parcelas futuras.
- Sem recuperação de senha ou sincronização entre instalações independentes.
- Acesso pelo celular depende do servidor em execução no computador.

## Contribuições

Sugestões, relatos de problemas e pull requests são bem-vindos. Ao abrir uma issue, descreva o comportamento esperado e os passos para reproduzir o problema. Utilize dados fictícios em exemplos e remova informações financeiras de capturas de tela e arquivos anexados.

## Licença

Distribuído sob a [licença MIT](LICENSE).
