
const fs       = require('fs');
const ffmpeg   = require('fluent-ffmpeg');
const archiver = require('archiver');
const tmp      = require('tmp');
const path     = require('path');


exports.single = (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).send('No file provided.');

  const inputPath  = file.path;
  const outputName = file.originalname.replace(/\.mts$/i, '.mp4');


  const tmpFile = tmp.fileSync({ postfix: '.mp4' });
  const tmpPath = tmpFile.name;

  ffmpeg(inputPath)
    .inputFormat('mpegts')
    .videoCodec('libx264')
    .outputOptions([
      '-preset fast',
      '-crf 23',
      '-profile:v main',
      '-level 3.1',
      '-movflags faststart'
    ])
    .audioCodec('aac')
    .audioBitrate('128k')
    .format('mp4')
    .output(tmpPath)
    .on('start', cmd => console.log('FFmpeg single start:', cmd))
    .on('error', (err, stdout, stderr) => {
      console.error('FFmpeg single error:', err.message);
      console.error(stderr);
      cleanup();
      if (!res.headersSent) res.status(500).send('Conversion failed');
    })
    .on('end', () => {
   
      res.download(tmpPath, outputName, err => {
        if (err) console.error('Download error:', err);
      });
    })
    .run();


  res.on('finish', cleanup);

  function cleanup() {

    fs.unlink(inputPath, err => {
      if (err) console.warn('Could not delete upload:', err);
    });

    tmpFile.removeCallback();
  }
};



exports.bulk = (req, res) => {
  const files = req.files || [];
  if (!files.length) return res.status(400).send('No files provided.');


  const tmpDir = tmp.dirSync({ unsafeCleanup: true });

 
  const tasks = files.map(file => {
    return new Promise((resolve, reject) => {
      const inputPath  = file.path;
      const outputName = file.originalname.replace(/\.mts$/i, '.mp4');
      const tmpPath    = path.join(tmpDir.name, outputName);

      ffmpeg(inputPath)
        .inputFormat('mpegts')
        .videoCodec('libx264')
        .outputOptions([
          '-preset fast',
          '-crf 23',
          '-profile:v main',
          '-level 3.1',
          '-movflags faststart'
        ])
        .audioCodec('aac')
        .audioBitrate('128k')
        .format('mp4')
        .output(tmpPath)
        .on('start', cmd => console.log(`FFmpeg bulk start ${file.originalname}:`, cmd))
        .on('error', (err, stdout, stderr) => {
          console.error(`FFmpeg bulk error ${file.originalname}:`, err.message);
          console.error(stderr);
      
          fs.unlink(inputPath, ()=>{});
          reject(err);
        })
        .on('end', () => {

          fs.unlink(inputPath, ()=>{});
          resolve();
        })
        .run();
    });
  });

  Promise.all(tasks)
    .then(() => {
 
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="converted_videos.zip"');

      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.on('error', err => {
        console.error('Archive error:', err.message);
        if (!res.headersSent) res.status(500).send('Archive failed');
        cleanupAll();
      });

      archive.pipe(res);
      files.forEach(file => {
        const name = file.originalname.replace(/\.mts$/i, '.mp4');
        archive.file(path.join(tmpDir.name, name), { name });
      });
      archive.finalize();

 
      res.on('finish', cleanupAll);
    })
    .catch(err => {
      console.error('Bulk conversion error:', err);
      if (!res.headersSent) res.status(500).send('Conversion failed');
      cleanupAll();
    });

  function cleanupAll() {

    tmpDir.removeCallback();

    files.forEach(file => {
      fs.unlink(file.path, ()=>{});
    });
  }
};
