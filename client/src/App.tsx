import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCloudUploadAlt } from '@fortawesome/free-solid-svg-icons';

import { createFileChunks, calculateHashSample, createFormData, request, scheduler } from './utils';
import { verifyUpload, mergeUpload } from './service';

export interface FileObj {
  uid: number;
  name: string;
  size: number;
  percent: number;
  status: string;
  originFileObj: File;
}

export const file2Obj = (file: File): FileObj => ({
  uid: Date.now(),
  name: file.name,
  size: file.size,
  percent: 0,
  status: 'uploading',
  originFileObj: file,
});

const CHUNK_SIZE = 10 * 1024 * 1024;

function App() {
  const [files, setFiles] = useState<FileObj[]>([]);

  const updateFile = (uid: number, file: Partial<FileObj>) => {
    setFiles((s) => {
      const cur = s.find((f) => f.uid === uid)!;
      Object.assign(cur, file);
      return [...s];
    });
  };

  const uploadFile = async (file: FileObj) => {
    const filehash = await calculateHashSample(file.originFileObj);

    // verify upload
    const { shouldUpload, uploaded } = await verifyUpload({ filename: file.name, filehash });

    if (!shouldUpload) {
      updateFile(file.uid, { percent: 100, status: 'done' });
      console.log('skip upload: file upload success!');
      return;
    }

    // create file chunks
    const fileChunks = createFileChunks(file.originFileObj, CHUNK_SIZE).map((chunk, index) => ({
      ...chunk,
      filename: file.name,
      filehash,
      hash: `${filehash}-${index}`,
      percent: 0,
    }));

    const getFileChunksLoaded = () => {
      return fileChunks
        .map((chunk) => chunk.chunk.size * chunk.percent)
        .reduce((acc, cur) => acc + cur);
    };

    if (uploaded.length) {
      fileChunks.forEach((chunk) => {
        if (uploaded.includes(chunk.hash)) chunk.percent = 100;
        updateFile(file.uid, { percent: ~~(getFileChunksLoaded() / file.size) });
      });
    }

    const tasks = fileChunks
      .filter((chunk) => !uploaded.includes(chunk.hash))
      .map(
        (chunk) => () =>
          new Promise((resolve, reject) => {
            const xhr = request({
              url: 'http://localhost:3000/upload',
              method: 'POST',
              body: createFormData(chunk),
              onSuccess: resolve,
              onError: reject,
              onProgress: (e) => {
                if (e.percent) {
                  chunk.percent = e.percent;
                  updateFile(file.uid, { percent: ~~(getFileChunksLoaded() / file.size) });
                }
              },
            });
            console.log(xhr);
          })
      );

    // concurrency request
    await scheduler(tasks, 4);

    // request merge
    await mergeUpload({ filename: file.name, filehash, size: CHUNK_SIZE });
    updateFile(file.uid, { status: 'done' });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const fileObj = file2Obj(file);
      setFiles((s) => [...s, fileObj]);
      uploadFile(fileObj);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-blue-300">
      <div className="p-6 w-96 rounded-lg bg-white">
        <h1 className="mb-6 text-2xl text-center font-bold text-blue-300">
          File Uploader JavaScript
        </h1>

        <form className="mb-4">
          <label className="flex flex-col justify-center items-center gap-4 border-2 border-dashed border-blue-300 rounded-md h-40 cursor-pointer">
            <input type="file" hidden onChange={handleChange} />
            <FontAwesomeIcon icon={faCloudUploadAlt} className="text-4xl text-blue-300" />
            <p className="text-xl text-blue-300">Browse File to Upload</p>
          </label>
        </form>

        <ul className="flex flex-col gap-4">
          {files.map((file) => (
            <li className="p-4 rounded-md bg-blue-100" key={file.name}>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-sm">
                  <span>{file.name}</span>
                  {file.status === 'uploading' && <span>{file.percent}%</span>}
                </div>

                {file.status === 'uploading' && (
                  <div className="h-1.5 rounded-md bg-white">
                    <div
                      style={{ width: `${file.percent}%` }}
                      className="h-full rounded-md bg-blue-300"
                    ></div>
                  </div>
                )}

                {file.status === 'done' && (
                  <div className="text-xs">
                    <span>{(file.size / 1024 / 1024).toFixed(2)}mb</span>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default App;
