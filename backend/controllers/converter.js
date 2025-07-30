
const ffmpeg       = require('fluent-ffmpeg');
const ffmpegPath   = require('@ffmpeg-installer/ffmpeg').path;
const { PassThrough } = require('stream');

ffmpeg.setFfmpegPath(ffmpegPath);

exports.single = (req, res) => {
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ error: 'No file uploaded' });
  }


  const inputStream = new PassThrough();
  inputStream.end(req.file.buffer);

 
  res.setHeader('Content-Type', 'video/mp4');

  ffmpeg(inputStream)
    .inputFormat('mpegts')
    .videoCodec('libx264')         
    .outputOptions([
      '-preset', 'fast',           
      '-crf', '18',                
      '-pix_fmt', 'yuv420p',       
      '-movflags', 'frag_keyframe+empty_moov+faststart'
    ])
    .audioCodec('aac')             
    .audioBitrate('320k')          
    .format('mp4')
    .on('start', cmd => console.log('FFmpeg command:', cmd))
    .on('stderr', line => console.error('FFmpeg stderr:', line))
    .on('error', err => {
      console.error('Conversion error:', err);
      if (!res.headersSent) res.status(500).json({ error: 'Conversion failed' });
    })
    .pipe(res, { end: true });
};

exports.bulk = (req, res) => {
  if (!req.files || !req.files.length) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  const archiver = require('archiver');
  res.setHeader('Content-Type', 'application/zip');
  const archive = archiver('zip', { zlib: { level: 0 } });
  archive.pipe(res);

  req.files.forEach(file => {
    const inStream = new PassThrough();
    inStream.end(file.buffer);
    const basename = file.originalname.replace(/\.mts$/i, '');
    const outName  = `${basename}.mp4`;

    const cmd = ffmpeg(inStream)
      .inputFormat('mpegts')
      .videoCodec('libx264')
      .outputOptions([
        '-preset', 'fast',
        '-crf', '18',
        '-pix_fmt', 'yuv420p',
        '-movflags', 'frag_keyframe+empty_moov+faststart'
      ])
      .audioCodec('aac')
      .audioBitrate('320k')
      .format('mp4')
      .on('error', err => console.error(`Error converting ${file.originalname}:`, err));


    archive.append(cmd.pipe(new PassThrough()), { name: outName });
  });

  archive.finalize();
};
