require('dotenv').config();
const { createApp } = require('./app');

const app = createApp({ env: process.env }).app;
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';

app.listen(port, host, () => {
  console.log(`prayer-wall running at http://${host}:${port}`);
});
