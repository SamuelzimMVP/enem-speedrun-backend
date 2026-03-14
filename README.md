# 📚 ENEM Speedrun - Backend

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white) ![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white) ![Supabase](https://img.shields.io/badge/Supabase-181818?style=for-the-badge&logo=supabase&logoColor=white)

Este é o repositório do backend para o projeto **ENEM Speedrun**, uma plataforma interativa de quiz voltada para estudantes que estão se preparando para o Exame Nacional do Ensino Médio (ENEM).

A API foi desenvolvida em **Node.js** com **Express** e utiliza **Supabase** como banco de dados e provedor de serviços (BaaS). O principal objetivo é fornecer respostas rápidas e gerenciar o fluxo de autenticação, testes e ranking dos alunos.

## 🚀 Funcionalidades

- **Autenticação (`/api/auth`)**: Rotas para gerenciar login e cadastro dos usuários de forma segura.
- **Quiz (`/api/quiz`)**: Gerenciamento de perguntas, respostas e validações do simulado.
- **Ranking (`/api/ranking`)**: Consulta do ranking dos usuários baseado nas pontuações obtidas.
- **Rate Limiting e CORS**: Proteção contra abusos usando `express-rate-limit` e configuração rígida de CORS autorizando apenas as origens permitidas.

## 🛠️ Tecnologias Utilizadas

- [Node.js](https://nodejs.org/) (Runtime)
- [Express](https://expressjs.com/) (Framework Web)
- [Supabase](https://supabase.com/) (Banco de Dados e Auth)
- `cors` (Segurança de API)
- `express-rate-limit` (Proteção contra força bruta e DDoS)
- `dotenv` (Gerenciamento de variáveis de ambiente)

## 📦 Como rodar o projeto localmente

### 1. Pré-requisitos
- Node.js (versão 18.0.0 ou superior)
- NPM ou Yarn
- Conta e um projeto no **Supabase**

### 2. Instalação

Clone o repositório e instale as dependências:
```bash
git clone https://github.com/SamuelzimMVP/enem-speedrun-backend.git
cd enem-speedrun-backend
npm install
```

### 3. Configuração do `.env`

Crie um arquivo `.env` na raiz do projeto, baseado no arquivo `.env.example`, fornecendo suas chaves do Supabase:

```env
PORT=3001
SUPABASE_URL=sua_url_do_supabase
SUPABASE_KEY=sua_chave_anon_do_supabase
FRONTEND_URL=http://localhost:5500
```

### 4. Iniciando o Servidor

Para rodar em ambiente de desenvolvimento (com auto-reload):
```bash
npm run dev
```

Para rodar em ambiente de produção:
```bash
npm start
```

O servidor estará rodando geralmente na porta `3001` (ou na definida no seu `.env`).

## 🤝 Contribuição

Contribuições são muito bem-vindas! Sinta-se à vontade para abrir uma _issue_ ou enviar um _pull request_.

## 📝 Licença

Desenvolvido por [Samuelcaroba08](mailto:samuelcaroba08@gmail.com). Este projeto está sob licenciamento aberto para fins educacionais.
