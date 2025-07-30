const express    = require('express');
const multer     = require('multer');
const controller = require('../controllers/converter');

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

router.post('/', upload.single('video'), controller.single);

module.exports = router;
