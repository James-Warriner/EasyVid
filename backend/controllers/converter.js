

const ffmpeg = require('fluent-ffmpeg');
const stream = require('stream');
const archiver = require('archiver');
const tmp = require('tmp');
const path = require('path');



exports.single = (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).send('No file provided.');

  const originalName = file.originalname;
  const outputName = originalName.replace(/\.mts$/i, '.mp4');


  const tmpFile = tmp.fileSync({ postfix: '.mp4' });
  const tmpPath = tmpFile.name;

  ffmpeg()
    .input(new stream.PassThrough().end(file.buffer))
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
      tmpFile.removeCallback();
      if (!res.headersSent) res.status(500).send('Conversion failed');
    })
    .on('end', () => {
      res.download(tmpPath, outputName, err => {
        tmpFile.removeCallback();
        if (err) console.error('Download error:', err);
      });
    })
    .run();
};


exports.bulk = (req, res) => {
  const files = req.files;
  if (!files || !files.length) return res.status(400).send('No files provided.');


  const tmpDir = tmp.dirSync({ unsafeCleanup: true });


  const tasks = files.map(file => {
    return new Promise((resolve, reject) => {
      const outputName = file.originalname.replace(/\.mts$/i, '.mp4');
      const tmpPath = path.join(tmpDir.name, outputName);

      ffmpeg()
        .input(new stream.PassThrough().end(file.buffer))
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

        .on('start', cmd => console.log(`FFmpeg bulk start for ${file.originalname}:`, cmd))
        .on('error', (err, stdout, stderr) => {
          console.error(`FFmpeg bulk error for ${file.originalname}:`, err.message);
          console.error(stderr);
          reject(err);
        })
        .on('end', resolve)
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
        res.status(500).send('Archive creation failed');
        tmpDir.removeCallback();
      });

      archive.pipe(res);
      files.forEach(file => {
        const name = file.originalname.replace(/\.mts$/i, '.mp4');
        archive.file(path.join(tmpDir.name, name), { name });
      });
      archive.finalize();

      res.on('finish', () => tmpDir.removeCallback());
    })
    .catch(err => {
      console.error('Bulk conversion error:', err);
      tmpDir.removeCallback();
      if (!res.headersSent) res.status(500).send('Conversion failed');
    });
};
