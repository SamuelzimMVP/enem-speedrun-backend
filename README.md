# 📚 ENEM Speedrun - Backend 🚀

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white) ![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white) ![Supabase](https://img.shields.io/badge/Supabase-181818?style=for-the-badge&logo=supabase&logoColor=white) ![JWT](https://img.shields.io/badge/JWT-black?style=for-the-badge&logo=JSON%20web%20tokens)

Este é o motor (API) do **ENEM Speedrun**, uma plataforma de gamificação para estudantes do ENEM. O objetivo do backend é gerenciar a lógica de prova, persistência de dados e a integridade competitiva do sistema.

## 🎯 O que o site resolve?
O ENEM Speedrun transforma o estudo cansativo em uma competição saudável. Ele resolve a falta de engajamento permitindo que alunos testem seus conhecimentos contra o relógio, conquistando níveis (Bronze a Diamante) e subindo no ranking nacional.

## 🛠️ Funcionalidades Core (API)

- **🔐 Autenticação com Refresh Token**: Sistema robusto de login via Supabase Auth com renovação automática de sessão, garantindo que o aluno não perca o progresso.
- **📝 Motor de Questões**: Consome a API `enem.dev` e organiza provas por categorias (Humanas, Exatas ou Completa) e contagem (10, 20 ou 30 questões).
- **🏆 Sistema de Conquistas (Achievements)**: Lógica no servidor que valida recordes de tempo e precisão, conferindo badges permanentes no banco de dados.
- **📊 Ranking em Tempo Real**: View SQL otimizada para listar os melhores desempenhos por categoria, usando critérios de acertos e desempate por milissegundos.

## 📦 Tecnologias

- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Banco de Dados**: Supabase (PostgreSQL)
- **Segurança**: Auth Middleware customizado e Rate Limiting.

## ⚙️ Instalação Local

1. Clone o repositório:
   ```bash
   git clone https://github.com/SamuelzimMVP/enem-speedrun-backend.git
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Configure o `.env` (use `.env.example` como base):
   ```env
   PORT=3001
   SUPABASE_URL=seu_link
   SUPABASE_SERVICE_KEY=sua_chave_secreta
   FRONTEND_URL=http://localhost:5500
   ```
4. Rode em dev:
   ```bash
   npm run dev
   ```

## 🤝 Autor
Desenvolvido com foco em alta performance por [Samuel Zim](https://github.com/SamuelzimMVP).
