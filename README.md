# Painel DRE — sistema multiempresa

Sistema de administração financeira: login → lista de todas as suas empresas → DRE
isolado por empresa. Os dados de cada empresa são separados no nível do banco
de dados (Row Level Security do Postgres), então não existe risco de mistura
entre empresas nem entre contas de usuários diferentes.

Stack: Next.js 16 (App Router) + Supabase (Auth + Postgres + RLS) + Tailwind v4,
hospedado na Vercel. A extração por IA usa a API da Anthropic chamada **somente
no servidor** — sua chave nunca é enviada ao navegador.

---

## 1. Criar o projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) → **New Project** (plano free serve).
2. Espere o projeto provisionar (1–2 min).
3. Vá em **SQL Editor** → cole todo o conteúdo do arquivo `supabase/schema.sql`
   deste projeto → **Run**. Isso cria as tabelas `companies` e `transactions`
   já com as políticas de RLS que garantem o isolamento.
4. Vá em **Project Settings → API** e copie:
   - `Project URL` → será o `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → será o `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. (Opcional, recomendado pra uso solo sem fricção) Em **Authentication →
   Providers → Email**, desative **"Confirm email"** — assim você consegue
   logar imediatamente após criar a conta, sem precisar confirmar e-mail.
   Se preferir manter ativado, o fluxo de confirmação já está implementado
   em `app/auth/callback/route.ts`.

## 2. Subir o código para o GitHub

```bash
cd painel-dre-saas
git init
git add .
git commit -m "Painel DRE - versão inicial"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/painel-dre-saas.git
git push -u origin main
```

## 3. Conectar na Vercel

1. Acesse [vercel.com/new](https://vercel.com/new) → importe o repositório
   que você acabou de criar.
2. Antes de clicar em **Deploy**, abra **Environment Variables** e adicione:

   | Nome | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | a URL copiada no passo 1 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | a anon key copiada no passo 1 |
   | `ANTHROPIC_API_KEY` | sua chave da API da Anthropic ([console.anthropic.com](https://console.anthropic.com)) |

3. Clique em **Deploy**. Em ~1 minuto seu painel estará no ar.

## 4. Primeiro uso

1. Abra a URL gerada pela Vercel → clique em **Criar conta** → cadastre seu
   e-mail e senha.
2. Você cai direto na tela "Suas empresas" — clique em **Nova empresa** e
   dê o nome (ex: BossFlow, Falei Né., Saffira Oliveira).
3. Dentro da empresa, clique em **Importar extrato** → cole o texto do
   extrato ou envie um PDF/imagem → a IA categoriza automaticamente.
4. Ajuste qualquer categoria errada na aba **Transações**.

---

## Como o isolamento funciona

- Toda empresa pertence a um `user_id` (seu usuário no Supabase Auth).
- Toda transação pertence a uma `company_id`.
- As políticas de RLS em `supabase/schema.sql` garantem, **dentro do banco**,
  que uma consulta só retorna dados de empresas cujo `user_id` é o do usuário
  autenticado. Mesmo um bug na aplicação não conseguiria misturar dados de
  empresas diferentes, porque a permissão é checada pelo Postgres, não pelo
  código da aplicação.

## Variáveis de ambiente

Veja `.env.local.example`. Para desenvolvimento local, copie para `.env.local`
e rode `npm install && npm run dev`.

## Limitações conhecidas / próximas melhorias possíveis

- Hoje só há login por e-mail/senha. Login com Google é simples de adicionar
  via Supabase Auth se quiser.
- Hoje cada empresa só é acessível pelo seu usuário (uso solo). Se um dia
  quiser convidar um sócio ou funcionário para acessar uma empresa específica,
  dá pra estender com uma tabela `company_members` com papéis (owner/membro).
- Upload de arquivo está limitado a ~4MB (limite de Server Actions/Vercel).
  Para extratos muito grandes, prefira colar o texto.
- Não há exportação para Excel/PDF ainda — pode ser adicionado depois.
