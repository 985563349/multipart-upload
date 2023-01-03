const Koa = require('koa');
const Router = require('@koa/router');
const cors = require('@koa/cors');
const { koaBody } = require('koa-body');
const path = require('path');
const fs = require('fs-extra');

const app = new Koa();
const router = new Router();

const UPLOAD_DIR = path.resolve(__dirname, 'target');

router.get('/upload-verify', async (ctx) => {
  const { filehash, filename } = ctx.request.query;
  const ext = filename.match(/\.\w+$/)[0];
  const filepath = path.resolve(UPLOAD_DIR, filehash + ext);

  if (fs.existsSync(filepath)) {
    ctx.body = { shouldUpload: false };
  } else {
    const chunkDir = path.resolve(UPLOAD_DIR, 'chunkDir_' + filehash);
    const uploaded = fs.existsSync(chunkDir) ? await fs.readdir(chunkDir) : [];
    ctx.body = { shouldUpload: true, uploaded };
  }
});

router.post('/upload', async (ctx) => {
  const { chunk } = ctx.request.files;
  const { filehash, hash } = ctx.request.body;
  const chunkDir = path.resolve(UPLOAD_DIR, 'chunkDir_' + filehash);

  await fs.ensureDir(chunkDir);
  await fs.move(chunk.filepath, `${chunkDir}/${hash}`);
  ctx.body = 'received file chunk.';
});

router.post('/upload-merge', async (ctx) => {
  const { filename, filehash, size } = ctx.request.body;
  const chunkDir = path.resolve(UPLOAD_DIR, 'chunkDir_' + filehash);
  const chunkPaths = await fs.readdir(chunkDir);

  // sort chunks
  chunkPaths.sort((a, b) => a.split('-')[1] - b.split('-')[1]);

  const ext = filename.match(/\.\w+$/)[0];
  const filepath = path.resolve(UPLOAD_DIR, filehash + ext);

  // write file
  await Promise.all(
    chunkPaths.map((chunkPath, index) => {
      return new Promise((resolve) => {
        const writeStream = fs.createWriteStream(filepath, { start: index * size });
        const readStream = fs.createReadStream(path.resolve(chunkDir, chunkPath));
        readStream.on('end', resolve);
        readStream.pipe(writeStream);
      });
    })
  );

  await fs.remove(chunkDir);
  ctx.body = 'file merged success.';
});

app
  .use(cors())
  .use(koaBody({ multipart: true }))
  .use(router.routes());

app.listen(3000, () => {
  console.log('server running at http://localhost:3000');
});
