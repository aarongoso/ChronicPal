const express = require('express');
const dotenv = require('dotenv');
const { connectDB } = require('./config/db');

dotenv.config();

const app = express();

app.use(express.json());

// Basic route
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'ChronicPal backend is running!',
    time: new Date().toISOString(),
  });
});

const PORT = parseInt(process.env.PORT || '4000', 10);

app.listen(PORT, async () => {
  console.log(` Server running on http://localhost:${PORT}`);
  await connectDB();
});
