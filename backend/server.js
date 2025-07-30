
const express = require('express');
const cors    = require('cors');
const convert = require('./routes/convert');
const bulk    = require('./routes/convertBulk');
const dotenv = require('dotenv')


const PORT = parseInt(process.env.PORT)

const app = express();
const FRONTEND = process.env.CORS_ORIGIN || 'http://localhost:5500';


app.use(cors({
  origin: FRONTEND,
  methods: ['POST'],
}));


app.use('/api', (req, res, next) => {
  const origin  = req.get('origin');
  const referer = req.get('referer');
  if (origin === ALLOWED_ORIGIN || (referer && referer.startsWith(ALLOWED_ORIGIN))) {
    return next();
  }
  res.status(403).send('Forbidden');
});


app.use('/api/convert', convert);
app.use('/api/convert/bulk', bulk);

app.listen(PORT, () => {
  console.log(`🚀 Listening on http://localhost:${PORT}`);
});