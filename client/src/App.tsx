import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCloudUploadAlt, faCheck, faFileLines, faXmark } from '@fortawesome/free-solid-svg-icons';

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
const RETRY_COUNT = 3;

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
      percent: 0, // The percent attribute will be updated (such as in the upload task onProgress method)
    }));

    const getFileChunksLoaded = () => {
      return fileChunks
        .map((chunk) => chunk.chunk.size * chunk.percent)
        .reduce((acc, cur) => acc + cur);
    };

    if (uploaded.length) {
      fileChunks.forEach((chunk) => {
        if (uploaded.includes(chunk.hash)) chunk.percent = 100;
      });
      updateFile(file.uid, { percent: ~~(getFileChunksLoaded() / file.size) });
    }

    // create upload tasks
    const tasks = fileChunks
      .filter((chunk) => !uploaded.includes(chunk.hash))
      .map(
        (chunk) => () =>
          new Promise((resolve, reject) => {
            let xhr;
            let count = RETRY_COUNT;

            (function start() {
              xhr = request({
                url: 'http://localhost:3000/upload',
                method: 'POST',
                body: createFormData(chunk),
                onSuccess: resolve,
                onError: (e) => {
                  if (count > 0) {
                    // retry
                    start();
                    count--;
                  } else {
                    reject(e);
                  }
                },
                onProgress: (e) => {
                  if (e.percent) {
                    chunk.percent = e.percent;
                    updateFile(file.uid, { percent: ~~(getFileChunksLoaded() / file.size) });
                  }
                },
              });
            })();

            console.log(xhr);
          })
      );

    // concurrency request
    await scheduler(tasks, 4);

    // request merge
    await mergeUpload({ filename: file.name, filehash, size: CHUNK_SIZE });
    updateFile(file.uid, { status: 'done' });
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const fileObj = file2Obj(file);
      setFiles((s) => [...s, fileObj]);

      try {
        await uploadFile(fileObj);
      } catch {
        updateFile(fileObj.uid, { status: 'error' });
      }
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
            <li
              className={`flex items-center gap-4 px-4 py-3 rounded-md ${
                file.status === 'error' ? 'bg-red-100' : 'bg-blue-100'
              }`}
              key={file.name}
            >
              <FontAwesomeIcon
                icon={faFileLines}
                className={`text-4xl ${file.status === 'error' ? 'text-red-300' : 'text-blue-300'}`}
              />

              <div className="flex flex-1 flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span>{file.name}</span>
                  {file.status === 'uploading' && <span className="text-sm">{file.percent}%</span>}
                </div>

                {file.status === 'uploading' ? (
                  <div className="my-[5px] h-1.5 rounded-md bg-white">
                    <div
                      style={{ width: `${file.percent}%` }}
                      className="h-full rounded-md bg-blue-300"
                    ></div>
                  </div>
                ) : (
                  <div className="text-xs">
                    <span>{(file.size / 1024 / 1024).toFixed(2)}mb</span>
                  </div>
                )}
              </div>

              {file.status === 'done' && (
                <FontAwesomeIcon icon={faCheck} className="text-xl text-blue-300" />
              )}

              {file.status === 'error' && (
                <FontAwesomeIcon icon={faXmark} className="mx-1 text-2xl text-red-300" />
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default App;
