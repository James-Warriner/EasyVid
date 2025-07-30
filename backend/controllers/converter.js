
const { spawn }     = require('child_process');
const ffmpegPath    = require('@ffmpeg-installer/ffmpeg').path;
const archiver      = require('archiver');

exports.single = (req, res) => {
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const outName = req.file.originalname.replace(/\.mts$/i, '.mp4');
  res.writeHead(200, {
    'Content-Type':        'video/mp4',
    'Content-Disposition': `attachment; filename="${outName}"`
  });

  const args = [
    '-hide_banner',
    '-loglevel', 'error',


    '-f', 'mpegts',
    '-i', 'pipe:0',


    '-c:v', 'copy',


    '-c:a', 'aac',
    '-b:a', '320k',


    '-bsf:a', 'aac_adtstoasc',


    '-f', 'mp4',
    'pipe:1'
  ];

  const ff = spawn(ffmpegPath, args);
  ff.stdin.write(req.file.buffer);
  ff.stdin.end();
  ff.stdout.pipe(res);

  ff.stderr.on('data', d => console.error('FFmpeg stderr:', d.toString()));
  ff.on('error', err => {
    console.error('FFmpeg spawn error:', err);
    if (!res.headersSent) res.status(500).end();
  });
};

exports.bulk = (req, res) => {
  if (!req.files || !req.files.length) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  res.writeHead(200, {
    'Content-Type':        'application/zip',
    'Content-Disposition': 'attachment; filename="converted.zip"'
  });

  const archive = archiver('zip', { zlib: { level: 0 } });
  archive.pipe(res);

  req.files.forEach(file => {
    const base    = file.originalname.replace(/\.mts$/i, '');
    const outName = `${base}.mp4`;

    const args = [
      '-hide_banner',
      '-loglevel', 'error',
      '-f', 'mpegts',
      '-i', 'pipe:0',
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '320k',
      '-bsf:a', 'aac_adtstoasc',
      '-f', 'mp4',
      'pipe:1'
    ];

    const ff = spawn(ffmpegPath, args);
    ff.stdin.write(file.buffer);
    ff.stdin.end();

    archive.append(ff.stdout, { name: outName });

    ff.stderr.on('data', d =>
      console.error(`FFmpeg stderr [${file.originalname}]:`, d.toString())
    );
    ff.on('error', err =>
      console.error(`FFmpeg spawn error [${file.originalname}]:`, err)
    );
  });

  archive.finalize();
};
