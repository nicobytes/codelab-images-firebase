const functions = require('firebase-functions');
const { Storage } = require('@google-cloud/storage');

const storage = new Storage();

const { tmpdir } = require('os');
const { join, dirname, basename, extname } = require('path');

const sharp = require('sharp');
const fs = require('fs-extra');

const imagemin = require('imagemin');
const imageminPngquant = require('imagemin-pngquant');
const imageminMozjpeg = require('imagemin-mozjpeg');
const imageminWebp = require('imagemin-webp');

exports.optimizeImages = functions.storage
  .object()
  .onFinalize(async object => {
    const fileBucket = object.bucket;
    const filePath = object.name;
    const contentType = object.contentType;

    if (fileBucket && filePath && contentType) {

      // Exit if this is triggered on a file that is not an image.
      if (!contentType.startsWith('image/')) {
        console.log('This is not an image.');
        return true;
      }

      // Get the file name.
      const extendName = extname(filePath);
      const fileName = basename(filePath, extendName);
      const fileFullName = `${fileName}${extendName}`;
      if (fileName.includes('_thumb_')) {
        console.log('Already a Thumbnail.');
        return true;
      }

      // Download file from bucket.
      const bucket = storage.bucket(fileBucket);
      const file = bucket.file(filePath);

      const [data] = await file.getMetadata();
      if (data.metadata && data.metadata.optimized) {
        console.log('Image has been already optimized');
        return true;
      }

      const workingDir = join(tmpdir(), 'thumbs');
      const destination = join(workingDir, fileFullName);

      await fs.ensureDir(workingDir);
      await file.download({ destination });

      const bucketDir = dirname(filePath);
      const sizes = [480, 640, 1200];

      const resizesPromises = sizes.map((size) => {
        const thumbName = `${fileName}_thumb_${size}${extendName}`;
        const thumbPath = join(workingDir, thumbName);
        return sharp(destination)
          .resize(size)
          .toFile(thumbPath);
      });

      await Promise.all(resizesPromises);

      const imageminFiles = await imagemin([`${workingDir}/*.{jpg,png}`], {
        destination: workingDir,
        plugins: [
          imageminPngquant({quality: [0.5, 0.5]}),
          imageminMozjpeg({quality: 50}),
          imageminWebp({quality: 50}),
        ]
      });

      const uploadPromises = imageminFiles.map(imageminFile => {
        return bucket.upload(imageminFile.sourcePath, {
          destination: join(bucketDir, basename(imageminFile.sourcePath)),
          metadata: {
            metadata: {
              optimized: true
            }
          }
        });
      });

      await Promise.all(uploadPromises);

      return fs.remove(workingDir);
    } else {
      console.log('incomplete info');
      return false;
    }
  });