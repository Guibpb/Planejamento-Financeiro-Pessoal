# ◒ Clareza

Planejador financeiro pessoal para usar no computador e no navegador do celular. Aplicação independente, com interface em português, TypeScript, React e SQLite. Sem conta do ChatGPT, banco na nuvem, serviços pagos ou cadastro externo.

## O que já funciona

- Contas com saldo inicial por mês.
- Receitas e despesas por categoria, previstas e realizadas.
- Saldo realizado e previsão de fechamento mensal.
- Login local com usuário e senha; planejamentos separados por usuário.
- Dados persistentes em SQLite, inclusive após reiniciar o aplicativo.
- Exportação e importação de backup JSON.
- Importação de faturas PDF do Inter com revisão de categorias, parcelas, cartões e meses.
- Proteção contra sobrescrever alterações feitas por outra sessão.
- Layout adaptado a computador e celular.

## Instalação no Windows

1. Instale o **Node.js 24 LTS**, com npm, em [nodejs.org](https://nodejs.org/). Feche e reabra os terminais após instalar.
2. Extraia este projeto para uma pasta de sua escolha.
3. Dê dois cliques em **Instalar.cmd**. É necessário internet para baixar as bibliotecas na primeira instalação.
4. Abra **Iniciar.cmd** e mantenha a janela aberta.
5. Acesse **http://localhost:3000** no navegador.
6. Clique em **Criar conta local**, escolha um usuário e senha e cadastre suas contas financeiras.

Não há senha padrão. Não é necessário configurar chaves, arquivos de ambiente ou banco de dados. Depois de instalado e compilado, o aplicativo funciona sem internet. Não abra `index.html` diretamente: o servidor local é necessário para login e banco.

## Instalação por terminal (Windows, macOS ou Linux)

Na pasta do projeto, com Node.js 24 LTS e npm disponíveis:

```sh
npm ci
npm run build
npm start
```

Abra **http://localhost:3000**. Para encerrar, pressione **Ctrl+C** no terminal. Os dados são preservados.

## Acesso pelo celular

1. Conecte o computador e o celular à **mesma rede Wi-Fi**.
2. No computador, execute **Iniciar-na-rede.cmd** ou:

```sh
npm run start:lan
```

3. O terminal mostrará endereços como `http://192.168.1.10:3000`. No celular, abra o endereço que corresponde à sua rede Wi-Fi.
4. Entre com o mesmo usuário e senha criados no computador. Os dois dispositivos usam o mesmo banco.

O computador e o aplicativo precisam permanecer ligados. Sem o computador, esta versão não funciona sozinha no celular e não é um APK ou aplicativo nativo. O modo de rede não publica o site na internet.

Se o acesso falhar, verifique se a rede é privada, se ambos estão no mesmo Wi-Fi e se o firewall permite o Node.js **na rede privada**. Redes de visitantes podem impedir a comunicação entre dispositivos. O IP pode mudar após reiniciar o roteador: confira o endereço exibido novamente. VPNs podem mostrar IPs de outras interfaces; use o do Wi-Fi.

Este modo usa HTTP e login simples para uso pessoal em rede de confiança. Não encaminhe a porta do roteador nem exponha este servidor à internet. Para uso público, seria necessário preparar HTTPS, recuperação de acesso e operação de produção.

## Onde ficam os dados e como fazer backup

O banco é criado automaticamente em **`data/clareza.sqlite`**. Ele contém usuários, senhas derivadas com salt, sessões e planejamentos. As senhas não são armazenadas em texto simples; o banco financeiro não é criptografado em disco.

- Use **Exportar dados** para baixar o planejamento do usuário conectado em JSON. A exportação não contém senhas ou sessões.
- Para importar, entre em uma conta sem contas financeiras e sem lançamentos e selecione o arquivo em **Importar backup do Clareza**. A importação não substitui um planejamento existente.
- Para backup completo, encerre o aplicativo e copie a pasta **`data/`** inteira para um local seguro. Para restaurar, com o aplicativo fechado, substitua essa pasta pela cópia.
- Para trocar de computador, copie o projeto e a pasta `data/` por um meio privado; instale as bibliotecas novamente. Não envie o banco para o GitHub.
- Não há recuperação de senha por e-mail. Guarde sua senha; um backup JSON permite recuperar o planejamento em uma nova conta local.

Para usar outra pasta de dados, defina a variável de ambiente `CLAREZA_DATA_DIR` antes de iniciar. Ela recebe um diretório, não o nome do arquivo. A variável `PORT` permite trocar a porta padrão 3000.

## Trazer os dados do protótipo anterior

Os dados da versão hospedada não são copiados automaticamente. No site anterior, entre e clique em **Exportar dados**. No Clareza local, crie uma conta e importe esse JSON antes de cadastrar lançamentos. O armazenamento do navegador do site anterior pertence a outro endereço e não pode ser lido pelo aplicativo local.

## Importar fatura de cartão

Em **Importar fatura do cartão**, selecione um PDF do Inter com texto selecionável (até 15 MB e 50 páginas). A leitura acontece no navegador, sem serviços externos; o PDF não é guardado no banco. PDFs escaneados ou protegidos por senha e outros modelos de banco ainda não são suportados.

Confira os lançamentos, corrija as categorias sugeridas e selecione a conta. Escolha separar por **data original da compra** ou pelo **mês da fatura**, usando o vencimento como data do lançamento. A data original, cartão, parcela e mês da fatura são preservados no backup. Em compras parceladas, a data impressa pode ser de meses anteriores: esta importação registra apenas a parcela cobrada, sem reconstruir o valor integral da compra ou criar parcelas futuras.

O resumo mostra a seleção por mês e categoria. Pagamentos da fatura são ignorados, estornos entram como créditos e juros/IOF separados são classificados como encargos. Os valores de principal e juros detalhados abaixo de uma parcela não são somados novamente. O total a pagar pode diferir das compras por antecipações e ajustes; confira ambos no PDF. As categorias são sugestões por palavras do estabelecimento, e itens desconhecidos ficam em Outros. Categorias corrigidas são reaproveitadas quando a descrição é idêntica.

Clique em **Importar seleção para o planejamento**. Os itens entram como previstos e só são salvos nesse momento. Selecione o mês correspondente no planejamento para consultá-los. Evite registrar também o pagamento da fatura como despesa, pois isso duplicaria o gasto. Reimportações com os mesmos dados são identificadas pela fatura, cartão, data, descrição e valor; lançamentos manuais e PDFs com descrições alteradas precisam de conferência. Duas compras iguais no mesmo arquivo são preservadas.

## Compartilhar no GitHub

Esta pasta é a raiz do projeto. O arquivo `.gitignore` exclui `data/`, bancos SQLite, `node_modules/`, arquivos de ambiente e `dist/`. O código não contém credenciais, IDs do ChatGPT ou dados financeiros reais.

Você pode criar um repositório e adicionar esta pasta pelo GitHub Desktop ou pelo terminal:

```sh
git init
git add .
git status
git commit -m "Versão local do Clareza"
git branch -M main
```

Crie um repositório vazio na sua conta do GitHub, adicione a URL dele como `origin` e envie a branch. Confira os arquivos em `git status` antes de publicar: backups JSON pessoais também não devem ser enviados.

Quem baixar o repositório poderá seguir a instalação acima e terá seu próprio banco local. **GitHub Pages não executa este aplicativo**, pois login e SQLite precisam do servidor Node.js. Publicar o código no GitHub não publica seus dados nem coloca seu servidor no ar.

Licença **MIT**: outras pessoas podem usar, estudar e modificar o projeto, mantendo os avisos da licença.

## Desenvolvimento

```sh
npm run dev
```

Abra **http://localhost:5173**. O Vite atualiza a interface durante as alterações e encaminha a API para o servidor local na porta 3000. O modo de desenvolvimento usa o banco local da pasta `data/`; faça backup antes de alterar regras de dados.

```sh
npm run typecheck
npm run build
npm test
```

Os testes usam bancos temporários separados dos dados pessoais. Execute o build antes dos testes. O comando `npm run format` formata o código.

```text
src/          Interface React e estilos responsivos
shared/       Tipos, validações e cálculos financeiros
server/       API HTTP, login, sessões e SQLite
scripts/      Inicialização e desenvolvimento
tests/        Cálculos, login, isolamento e persistência
public/       Ícone local
data/         Banco local gerado em uso (fora do Git)
dist/         Interface compilada (fora do Git)
```

O servidor usa o [SQLite integrado ao Node.js 24](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html); a interface é compilada com [Vite](https://vite.dev/guide/build). Todas as fontes e recursos usados pela interface são locais. Não há analytics, chamadas a APIs externas ou sincronização com a nuvem.

## Limites atuais

- O saldo inicial é informado por mês, sem transporte automático do saldo anterior.
- Importação JSON disponível apenas para um planejamento vazio.
- Não há conexão bancária, transferências automáticas, geração automática de parcelas futuras, recuperação de senha ou sincronização entre computadores independentes.
- O servidor local é necessário para usar o aplicativo pelo celular.
- O atalho de inicialização compila a interface caso `dist/` ainda não exista. Após mudar o código, execute `npm run build` novamente.
