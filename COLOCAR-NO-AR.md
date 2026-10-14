# Colocar a TMZ STORE no ar

São 4 etapas. Leva em torno de 1 hora na primeira vez. Nenhuma delas pede programação: é criar
contas, copiar e colar.

| Etapa | Para quê | Custo |
|---|---|---|
| 1. Supabase | Servidor: produtos, pedidos, clientes e login de verdade, iguais em todos os aparelhos | Grátis (plano Free) |
| 2. Mercado Pago | Pix com QR Code e confirmação automática | Taxa por Pix recebido (veja no Mercado Pago) |
| 3. Publicar | Site no ar em https | Grátis (GitHub Pages) |
| 4. Domínio | Endereço próprio, ex.: tmzstore.com.br | Cerca de R$ 40 por ano no registro.br |

---

## 1. Supabase (servidor e login)

1. Crie uma conta em **supabase.com** e clique em **New project**.
   Nome: `tmz-store`. Região: **South America (São Paulo)**. Anote a senha do banco num lugar seguro.
2. Em **SQL Editor → New query**, cole o arquivo [`supabase/schema.sql`](supabase/schema.sql).
   **Antes de rodar**, troque `admin@tmzstore.com.br` (linha marcada com `<<<`) pelo e-mail do dono.
   Clique em **Run**.
3. Em **Authentication → Sign In / Providers**:
   - deixe **Email** ligado;
   - ligue **Allow anonymous sign-ins** (cada visitante ganha uma sessão anônima para o carrinho e os pedidos);
   - se quiser que o cliente confirme o e-mail antes de entrar, deixe **Confirm email** ligado.
4. Em **Authentication → Users → Add user → Create new user**, crie o usuário do dono
   com o mesmo e-mail do passo 2 e uma senha forte. Marque **Auto Confirm User**.
5. Em **Authentication → URL Configuration**, coloque o endereço do site em **Site URL**
   (ex.: `https://tmzstore.com.br`). É para onde vai o link de "Esqueci a senha".
6. Em **Project Settings → API**, copie:
   - **Project URL** (ex.: `https://abcd1234.supabase.co`);
   - a chave **anon public**.

   **Nunca** use nem compartilhe a chave `service_role`.
7. Abra `js/produtos.js` e preencha no final do bloco `ACESSO`:

   ```js
   const ACESSO = {
     emailAdmin: "email-do-dono@gmail.com",
     supabaseUrl: "https://abcd1234.supabase.co",
     supabaseChave: "eyJhbGciOi...",   // a chave anon public
   };
   ```

8. Abra o site, entre com o e-mail e a senha do dono e abra o **Painel**. Na primeira vez, o site
   grava no servidor o catálogo, as categorias e as configurações. A partir daí, tudo o que você
   muda no painel aparece para todos os clientes.

> **Segurança:** as regras do `schema.sql` ficam no servidor. Mesmo que alguém mexa no código do
> site, o banco só deixa o dono alterar produtos, preços e configurações e ver os pedidos de todos.
> Cada cliente só lê e grava os próprios pedidos, carrinhos e conta.

---

## 2. Mercado Pago (Pix automático)

1. Crie (ou use) uma conta no **Mercado Pago** em nome da loja e cadastre uma chave Pix nela.
2. Acesse **mercadopago.com.br/developers → Suas integrações → Criar aplicação**
   (tipo: Pagamentos online, sem plataforma de e-commerce).
3. Em **Credenciais de produção**, copie o **Access Token** (começa com `APP_USR-`).
   Ele é secreto: vai só no servidor, nunca no site.
4. Instale o **Supabase CLI** no computador (supabase.com/docs/guides/cli) e, na pasta da loja, rode:

   ```bash
   supabase login
   supabase link --project-ref abcd1234          # o código do seu projeto, aparece na URL
   supabase secrets set MERCADOPAGO_ACCESS_TOKEN=APP_USR-xxxxxxxx
   supabase functions deploy pagamento
   supabase functions deploy mercadopago-webhook --no-verify-jwt
   ```

5. No site, abra **Painel → Configurações → Pagamento online** e ligue
   **Cobrar o Pix pelo Mercado Pago**.

Como funciona: ao finalizar, o cliente vê o QR Code e o "Pix copia e cola". O servidor recalcula o
valor com os preços, cupons e frete guardados nele (ninguém consegue pagar menos mexendo no site).
Quando o Pix cai, o Mercado Pago avisa o servidor, que confere o pagamento direto na API do Mercado
Pago, confirma o pedido e dá baixa no estoque. O cliente vê "Pagamento aprovado!" na hora e o pedido
aparece no painel com a etiqueta **Pix verificado**.

> Teste antes com as **Credenciais de teste** do Mercado Pago e um usuário comprador de teste.
> Depois troque pelo Access Token de produção com `supabase secrets set`.

Cartão e boleto continuam combinados pelo WhatsApp. Para cobrar cartão no site, o próximo passo é o
Checkout Pro do Mercado Pago, no mesmo lugar da função `pagamento`.

---

## 3. Publicar (GitHub Pages)

O repositório já tem a publicação automática em `.github/workflows/publicar.yml`. Ela roda os testes
e, se passarem, publica o site.

1. No GitHub, abra o repositório → **Settings → Pages → Build and deployment → Source:
   GitHub Actions**.
2. Junte as mudanças na branch `main` (pull request → Merge). A aba **Actions** mostra o andamento.
3. Em 1 ou 2 minutos o site fica em `https://SEU-USUARIO.github.io/site-de-loja/`.

O site já vem pronto para:
- **instalar como app** no celular ("Adicionar à tela inicial"), com ícone da TMZ;
- **abrir sem internet** as páginas já visitadas;
- **prévia bonita** quando o link é compartilhado no WhatsApp, Instagram e Facebook.

Outras opções que funcionam igual: Netlify ou Vercel (arraste a pasta ou ligue o repositório).

---

## 4. Domínio próprio (tmzstore.com.br)

1. Registre o domínio em **registro.br** (precisa de CPF ou CNPJ).
2. Na zona de DNS do domínio, crie:
   - 4 registros **A** para `@` apontando para `185.199.108.153`, `185.199.109.153`,
     `185.199.110.153` e `185.199.111.153`;
   - 1 registro **CNAME** para `www` apontando para `SEU-USUARIO.github.io`.
3. No GitHub, **Settings → Pages → Custom domain**: digite `tmzstore.com.br`, salve e marque
   **Enforce HTTPS** quando liberar.
4. Crie na raiz do repositório um arquivo `CNAME` com uma linha: `tmzstore.com.br`.
5. Volte ao Supabase (etapa 1, passo 5) e troque a **Site URL** pelo domínio novo.

---

## Antes de abrir

- [ ] Painel → **Contato e links**: WhatsApp real, e-mail, endereço, horário, Instagram, razão social e CNPJ.
- [ ] Painel → **Configurações**: chave Pix, frete (estado e cidade da loja e tabela), regras de reserva.
- [ ] Painel → **Produtos e preços → Editar todos os produtos**: fotos reais, preços e estoque.
- [ ] Painel → **Destaque e textos**: foto do banner e textos.
- [ ] Trocar os comentários de exemplo (`COMENTARIOS` em `js/produtos.js`) pelos reais.
- [ ] Revisar com um advogado as páginas de Privacidade, Trocas e Termos.
- [ ] Fazer o [roteiro de testes](ROTEIRO-DE-TESTES.md) com 3 a 5 pessoas.

O **Resumo** do painel mostra esta lista com o que já está pronto e o que falta.
