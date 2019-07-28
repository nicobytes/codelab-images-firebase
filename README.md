![Imgur](https://i.imgur.com/zLTQ566.png)

# 1. Init project
```
firebase init 
cd functions
npm i @google-cloud/storage
```

# 2. Init project
```
firebase init 
cd functions
npm i @google-cloud/storage fs-extra --save
```

#3. Init trigger
```js
const functions = require('firebase-functions');
const { Storage } = require('@google-cloud/storage');
const fs = require('fs-extra');

const storage = new Storage();

exports.optimizeImages = functions.storage
.object()
.onFinalize(async object => {
  console.log('upload file');
});
```

#4. deploy
```
firebase deploy
```

#5.
```js
.onFinalize(async object => {
  const fileBucket = object.bucket;
  const filePath = object.name;
  const contentType = object.contentType;

  if (fileBucket && filePath && contentType) {


  } else {
    console.log('incomplete data');
    return false;
  }
});

```

#6.
```js
// Exit if this is triggered on a file that is not an image.
if (!contentType.startsWith('image/')) {
  console.log('This is not an image.');
  return true;
}
```

#7.
```js
const { join, dirname, basename, extname } = require('path');

// Get the file name.
const extendName = extname(filePath);
const fileName = basename(filePath, extendName);
const fileFullName = `${fileName}${extendName}`;
if (fileName.includes('_thumb_')) {
  console.log('Already a Thumbnail.');
  return true;
}
```

#8.
```js
// Download file from bucket.
const bucket = storage.bucket(fileBucket);
const file = bucket.file(filePath);

const [data] = await file.getMetadata();
if (data.metadata && data.metadata.optimized) {
  console.log('Image has been already optimized');
  return true;
}
```

#9.
```js
const { tmpdir } = require('os');

const workingDir = join(tmpdir(), 'thumbs');
const destination = join(workingDir, fileFullName);

await fs.ensureDir(workingDir);
await file.download({ destination });
const bucketDir = dirname(filePath);
```

#10.
```js
const sharp = require('sharp');

const sizes = [480, 640, 1200];
const resizesPromises = sizes.map((size) => {
  const thumbName = `${fileName}_thumb_${size}${extendName}`;
  const thumbPath = join(workingDir, thumbName);
  return sharp(destination)
    .resize(size)
    .toFile(thumbPath);
});
await Promise.all(resizesPromises);
console.log('generate 3 images per devices, done!');
```


#11.
```js
const files = await fs.readdir(workingDir);
console.log(files);

const uploadPromises = files.map(file => {
  const path = join(workingDir, file);
  return bucket.upload(path, {
    destination: join(bucketDir, basename(file)),
    metadata: {
      metadata: {
        optimized: true
      }
    }
  });
});
await Promise.all(uploadPromises);
console.log('upload images, done!');

return fs.remove(workingDir);
```

#12. deploy
```
firebase deploy
```

#13.
```js
const imagemin = require('imagemin');
const imageminPngquant = require('imagemin-pngquant');
const imageminMozjpeg = require('imagemin-mozjpeg');

await imagemin([`${workingDir}/*.{jpg,png}`], {
  destination: workingDir,
  plugins: [
    imageminPngquant({quality: [0.6, 0.6]}),
    imageminMozjpeg({quality: 60}),
  ]
});
console.log('optimize jpg and png, done!');
```

#14. deploy
```
firebase deploy
```