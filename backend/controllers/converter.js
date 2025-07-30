
const ffmpeg       = require('fluent-ffmpeg');
const ffmpegPath   = require('@ffmpeg-installer/ffmpeg').path;
const { PassThrough } = require('stream');
const archiver    = require('archiver');

ffmpeg.setFfmpegPath(ffmpegPath);

exports.single = (req, res) => {
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ error: 'No file uploaded' });
  }


  const inStream = new PassThrough();
  inStream.end(req.file.buffer);


  const outName = req.file.originalname.replace(/\.mts$/i, '.mp4');
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Content-Disposition', `attachment; filename="${outName}"`);


  ffmpeg(inStream)
    .inputFormat('mpegts')         
    .videoCodec('copy')           
    .audioCodec('copy')          
    .outputOptions(['-movflags frag_keyframe+empty_moov+faststart'])
    .format('mp4')
    .on('start', cmd => console.log('FFmpeg command:', cmd))
    .on('error', err => {
      console.error('Remux error:', err.message);
      if (!res.headersSent) res.status(500).json({ error: 'Conversion failed' });
    })
    .pipe(res, { end: true });
};

exports.bulk = (req, res) => {
  if (!req.files || !req.files.length) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="converted.zip"');

  const archive = archiver('zip', { zlib: { level: 0 } });
  archive.pipe(res);

  req.files.forEach(file => {
    const inStream = new PassThrough();
    inStream.end(file.buffer);

    const base = file.originalname.replace(/\.mts$/i, '');
    const outName = `${base}.mp4`;

 
    const cmd = ffmpeg(inStream)
      .inputFormat('mpegts')
      .videoCodec('copy')
      .audioCodec('copy')
      .outputOptions(['-movflags frag_keyframe+empty_moov+faststart'])
      .format('mp4')
      .on('error', err => console.error(`Remux error for ${file.originalname}:`, err.message));


    archive.append(cmd.pipe(new PassThrough()), { name: outName });
  });

  archive.finalize();
};
