
const express = require('express');
const cors    = require('cors');
const convert = require('./routes/convert');
const bulk    = require('./routes/convertBulk');
require('dotenv').config();


const PORT = parseInt(process.env.PORT)

const app = express();
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5500';



app.use(cors({
  origin: ALLOWED_ORIGIN,
  methods: ['POST','GET','OPTIONS'],
  allowedHeaders: ['Content-Type']
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
  console.log(`🚀 Listening for ${ALLOWED_ORIGIN}: running on ${PORT}`);
});