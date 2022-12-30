const Koa = require('koa');
const Router = require('@koa/router');
const cors = require('@koa/cors');
const { koaBody } = require('koa-body');
const path = require('path');
const fs = require('fs-extra');

const app = new Koa();
const router = new Router();

const UPLOAD_DIR = path.resolve(__dirname, 'target');

router.post('/upload', async (ctx) => {
  const { chunk } = ctx.request.files;
  const { filename, hash } = ctx.request.body;
  const chunkDir = path.resolve(UPLOAD_DIR, 'chunkDir' + filename);

  await fs.ensureDir(chunkDir);
  await fs.move(chunk.filepath, `${chunkDir}/${hash}`);
  ctx.body = 'received file chunk.';
});

router.post('/upload-merge', async (ctx) => {
  const { filename, size } = ctx.request.body;
  const chunkDir = path.resolve(UPLOAD_DIR, 'chunkDir' + filename);
  const filepath = path.resolve(UPLOAD_DIR, filename);
  const chunkPaths = await fs.readdir(chunkDir);

  // sort chunks
  chunkPaths.sort((a, b) => a.split('-')[1] - b.split('-')[1]);

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
