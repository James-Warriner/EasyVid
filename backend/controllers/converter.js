

const ffmpeg = require('fluent-ffmpeg');
const archiver = require('archiver');
const tmp = require('tmp');
const fs = require('fs');
const path = require('path');


function safeUnlink(filePath) {
  fs.unlink(filePath, err => {
    if (err) console.warn(`Cleanup failed for ${filePath}:`, err.message);
  });
}


exports.single = (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).send('No file provided.');

  const inputPath = file.path;
  const outputName = file.originalname.replace(/\.mts$/i, '.mp4');
  const tmpFile = tmp.fileSync({ postfix: '.mp4' });
  const tmpPath = tmpFile.name;

  const command = ffmpeg(inputPath)
    .inputFormat('mpegts')

    .videoCodec('libx264')
    .outputOptions([
      '-preset ultrafast',     
      '-crf 23',                
      '-profile:v main',
      '-level 3.1',
      '-movflags faststart'
    ])

    .audioCodec('aac')
    .audioBitrate('128k')

    .format('mp4')
    .output(tmpPath)
    .overwriteOutput()

    .on('start', cmd => console.log('FFmpeg single start:', cmd))
    .on('stderr', line => console.log('FFmpeg stderr:', line))
    .on('progress', progress => console.log(`Progress: ${progress.percent?.toFixed(2)}%`))
    .on('error', (err, stdout, stderr) => {
      console.error('FFmpeg single error:', err.message);
      console.error(stderr);
      
      safeUnlink(inputPath);
      tmpFile.removeCallback();
      if (!res.headersSent) res.status(500).send('Conversion failed');
    })
    .on('end', () => {
      res.download(tmpPath, outputName, err => {
        safeUnlink(inputPath);
        tmpFile.removeCallback();
        if (err) console.error('Download error:', err.message);
      });
    });


  res.on('close', () => {
    console.log('Response closed, killing FFmpeg');
    try { command.kill('SIGKILL'); } catch {};
    safeUnlink(inputPath);
    tmpFile.removeCallback();
  });

  command.run();
};

exports.bulk = (req, res) => {
  const files = req.files || [];
  if (!files.length) return res.status(400).send('No files provided.');

  const tmpDir = tmp.dirSync({ unsafeCleanup: true });

  const tasks = files.map(file => {
    return new Promise((resolve, reject) => {
      const inputPath = file.path;
      const outputName = file.originalname.replace(/\.mts$/i, '.mp4');
      const tmpPath = path.join(tmpDir.name, outputName);

      const cmd = ffmpeg(inputPath)
        .inputFormat('mpegts')
        .videoCodec('libx264')
        .outputOptions([
          '-preset ultrafast',
          '-crf 23',
          '-profile:v main',
          '-level 3.1',
          '-movflags faststart'
        ])
        .audioCodec('aac')
        .audioBitrate('128k')
        .format('mp4')
        .output(tmpPath)
        .overwriteOutput()
        .on('start', cmdline => console.log(`FFmpeg bulk start ${file.originalname}:`, cmdline))
        .on('stderr', line => console.log('FFmpeg stderr:', line))
        .on('error', (err, stdout, stderr) => {
          console.error(`FFmpeg bulk error ${file.originalname}:`, err.message);
          console.error(stderr);
          safeUnlink(inputPath);
          reject(err);
        })
        .on('end', () => {
          safeUnlink(inputPath);
          resolve();
        });

      cmd.run();
    });
  });

  Promise.all(tasks)
    .then(() => {
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="converted_videos.zip"');

      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.on('error', err => {
        console.error('Archive error:', err.message);
        if (!res.headersSent) res.status(500).send('Archive creation failed');
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
      if (!res.headersSent) res.status(500).send('Conversion failed');
      tmpDir.removeCallback();
    });
};
