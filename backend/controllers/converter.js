

const ffmpeg = require('fluent-ffmpeg');
const stream = require('stream');
const archiver = require('archiver');


exports.single = (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).send('No file provided.');


  const originalName = file.originalname;
  const outputName = originalName.replace(/\.mts$/i, '.mp4');


  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Content-Disposition', `attachment; filename="${outputName}"`);


  const inputStream = new stream.PassThrough();
  inputStream.end(file.buffer);


  const command = ffmpeg(inputStream)
    .inputFormat('mpegts')              
    .videoCodec('copy')                  
    .audioCodec('aac')                    
    .audioBitrate('128k')                
    .format('mp4')                        
    .outputOptions(['-movflags', 'frag_keyframe+empty_moov+faststart']);

  command
    .on('start', cmd => console.log('FFmpeg single start:', cmd))
    .on('error', (err, stdout, stderr) => {
      console.error('FFmpeg single error:', err.message);
      console.error(stderr);
      res.status(500).send('Conversion failed');
    });


  command.pipe(res, { end: true });
};



exports.bulk = (req, res) => {
  const files = req.files;
  if (!files || !files.length) return res.status(400).send('No files provided.');

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="converted_videos.zip"');


  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', err => {
    console.error('Archive error:', err.message);
    res.status(500).send('Archive creation failed');
  });

 
  archive.pipe(res);

  
  files.forEach(file => {
    const originalName = file.originalname;
    const outputName = originalName.replace(/\.mts$/i, '.mp4');

  
    const passThrough = new stream.PassThrough();
    const inputStream = new stream.PassThrough();
    inputStream.end(file.buffer);

    ffmpeg(inputStream)
      .inputFormat('mpegts')
      .videoCodec('copy')
      .audioCodec('aac')
      .audioBitrate('128k')
      .format('mp4')
      .outputOptions(['-movflags', 'frag_keyframe+empty_moov+faststart'])
      .on('start', cmd => console.log(`FFmpeg bulk start for ${originalName}:`, cmd))
      .on('error', (err, stdout, stderr) => console.error(`FFmpeg bulk error for ${originalName}:`, err.message))
      .pipe(passThrough);

   
    archive.append(passThrough, { name: outputName });
  });


  archive.finalize();
};
