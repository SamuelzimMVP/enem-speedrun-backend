const app = require('./app');
const PORT = process.env.PORT || 3001;

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📚 ENEM Speedrun Backend iniciado`);
});
