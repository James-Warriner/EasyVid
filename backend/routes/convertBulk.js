const ffmpeg = require('fluent-ffmpeg');
const stream = require('stream');
const archiver = require('archiver');
const tmp = require('tmp');
const fs = require('fs');
const path = require('path');

/**
 * Handle single MTS -> MP4 conversion by writing to a temp file
 * so that the MP4 muxer can seek and place moov atom correctly.
 */
exports.single = (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).send('No file provided.');

  const originalName = file.originalname;
  const outputName = originalName.replace(/\.mts$/i, '.mp4');

  // Create a temp file for output
  const tmpFile = tmp.fileSync({ postfix: '.mp4' });
  const tmpPath = tmpFile.name;

  // Perform conversion into temp file
  ffmpeg()
    .input(new stream.PassThrough().end(file.buffer))
    .inputFormat('mpegts')
    .videoCodec('copy')      // bit-for-bit H.264
    .audioCodec('aac')       // AAC for iOS
    .audioBitrate('128k')    // 128k audio bitrate
    .format('mp4')
    .outputOptions(['-movflags', 'faststart'])
    .output(tmpPath)
    .on('start', cmd => console.log('FFmpeg single start:', cmd))
    .on('error', (err, stdout, stderr) => {
      console.error('FFmpeg single error:', err.message);
      console.error(stderr);
      // Clean up temp
      tmpFile.removeCallback();
      if (!res.headersSent) res.status(500).send('Conversion failed');
    })
    .on('end', () => {
      // Send file to client
      res.download(tmpPath, outputName, err => {
        // Always cleanup
        tmpFile.removeCallback();
        if (err) console.error('Send error:', err);
      });
    })
    .run();
};

/**
 * Handle bulk conversion: convert each to a temp MP4, then ZIP them
 */
exports.bulk = (req, res) => {
  const files = req.files;
  if (!files || !files.length) return res.status(400).send('No files provided.');

  // Create temp directory
  const tmpDir = tmp.dirSync({ unsafeCleanup: true });
  const convertTasks = files.map(file => {
    const inputBuffer = file.buffer;
    const outputName = file.originalname.replace(/\.mts$/i, '.mp4');
    const tmpPath = path.join(tmpDir.name, outputName);

    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(new stream.PassThrough().end(inputBuffer))
        .inputFormat('mpegts')
        .videoCodec('copy')
        .audioCodec('aac')
        .audioBitrate('128k')
        .format('mp4')
        .outputOptions(['-movflags', 'faststart'])
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

  Promise.all(convertTasks)
    .then(() => {
      // ZIP all converted files
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="converted_videos.zip"');

      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.on('error', err => {
        console.error('Archive error:', err.message);
        res.status(500).send('Archive creation failed');
      });

      archive.pipe(res);
      files.forEach(file => {
        const name = file.originalname.replace(/\.mts$/i, '.mp4');
        const filePath = path.join(tmpDir.name, name);
        archive.file(filePath, { name });
      });
      archive.finalize();

      // Cleanup temp dir when done streaming
      res.on('finish', () => tmpDir.removeCallback());
    })
    .catch(err => {
      // On error, ensure cleanup
      tmpDir.removeCallback();
    });
};
