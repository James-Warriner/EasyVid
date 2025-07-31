const express  = require('express');
const multer   = require('multer');
const controller = require('../controllers/converter');
const fs       = require('fs');
const os       = require('os');
const path     = require('path');

const router = express.Router();


const uploadDir = path.join(os.tmpdir(), 'easyvid-uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({ dest: uploadDir });


router.post('/', upload.array('videos'), controller.bulk);

module.exports = router;
