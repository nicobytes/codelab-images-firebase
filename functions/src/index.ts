import * as functions from 'firebase-functions';

import { Storage } from '@google-cloud/storage';
const storage = new Storage();

import { tmpdir } from 'os';
import { join, dirname, basename, extname } from 'path';

import * as sharp from 'sharp';
import * as fs from 'fs-extra';

export const generateThumbs = functions.storage
  .object()
  .onFinalize(async object => {
    const fileBucket = object.bucket;
    const filePath = object.name;
    const contentType = object.contentType;


    if (fileBucket && filePath && contentType) {

      // Exit if this is triggered on a file that is not an image.
      if (!contentType.startsWith('image/')) {
        console.log('This is not an image.');
        return false;
      }

      // Get the file name.
      const fileName = basename(filePath);
      const extendName = extname(filePath);
      if (fileName.includes('_thumb_')) {
        console.log('Already a Thumbnail.');
        return false;
      }

      // Download file from bucket.
      const bucket = storage.bucket(fileBucket);

      const workingDir = join(tmpdir(), 'thumbs');
      const destination = join(workingDir, 'source.png');

      await fs.ensureDir(workingDir);

      await bucket.file(filePath).download({destination});
      
      const bucketDir = dirname(filePath);
      const sizes = [64, 128, 256];

      const uploadPromises = sizes.map(async (size) => {

        const thumbName = `${fileName}_thumb_${size}.${extendName}`;
        const thumbPath = join(workingDir, thumbName);

        await sharp(destination)
          .resize(size)
          .toFile(thumbPath);
        
        return bucket.upload(thumbPath, {
          destination: join(bucketDir, thumbName)
        });
      });

      return Promise.all(uploadPromises);

    } else {
      console.log('incomplete info');
      return false;
    }
  });