require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const authRoutes    = require('./src/routes/auth');
const quizRoutes    = require('./src/routes/quiz');
const rankingRoutes = require('./src/routes/ranking');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Permite apenas seu frontend e localhost
const allowedOrigins = [
  process.env.FRONTEND_URL || 'https://enem-speedrun-frontend.vercel.app',
  'http://localhost:5500',
  'http://localhost:3000',
  'http://127.0.0.1:5500',
];

app.use(cors({
  origin: function(origin, callback) {
    // Se for requisição do frontend ou postman (sem origin), permite
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    console.warn('[CORS] Origem bloqueada:', origin);
    callback(new Error('Origem não permitida pelo CORS'));
  },
  credentials: true,
}));

// Habilita OPTIONS preflight para todas as rotas
app.options('*', cors({
  origin: allowedOrigins,
  credentials: true,
}));

// ─── Middlewares ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));

// Rate limit geral
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200,
  message: { error: 'Muitas requisições. Tente novamente em 15 minutos.' },
}));

// Rate limit específico para auth (mais restritivo)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Muitas tentativas de login. Aguarde 15 minutos.' },
});

// ─── Rotas ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/ranking', rankingRoutes);

// ─── Health check (keep-alive do cron-job.org) ────────────────────────────────
app.get('/ping', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Server Error]', err.message);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Erro interno no servidor.' });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📚 ENEM Speedrun Backend iniciado`);
});