import React, { useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCloudUploadAlt,
  faCheck,
  faFileLines,
  faXmark,
  faPause,
  faPlay,
} from '@fortawesome/free-solid-svg-icons';

import { createFileChunks, calculateHashSample, createFormData, request, scheduler } from './utils';
import { verifyUpload, mergeUpload } from './service';

type FileStatus = 'uploading' | 'done' | 'error' | 'pause';

interface FileObj {
  uid: number;
  name: string;
  size: number;
  percent: number;
  status: FileStatus;
  originFileObj: File;
}

const file2Obj = (file: File): FileObj => ({
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
  const executionQueue = useRef<Record<string, XMLHttpRequest[]>>({});

  const updateFile = (uid: number, state: Partial<FileObj>) => {
    setFiles((s) => {
      const preState = s.find((f) => f.uid === uid)!;
      Object.assign(preState, state);
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

    // create task execution queue
    if (!executionQueue.current[file.uid]) executionQueue.current[file.uid] = [];
    const currentExecutionQueue = executionQueue.current[file.uid];

    const createUploadChunkTask = (chunk: any) => () =>
      new Promise((resolve, reject) => {
        let xhr: XMLHttpRequest;
        let count = RETRY_COUNT;

        (function start() {
          xhr = request({
            url: 'http://localhost:3000/upload',
            method: 'POST',
            body: createFormData(chunk),
            onSuccess: (e) => {
              currentExecutionQueue.splice(
                currentExecutionQueue.findIndex((item) => item === xhr) >>> 0,
                1
              );
              resolve(e);
            },
            onError: (e) => {
              currentExecutionQueue.splice(
                currentExecutionQueue.findIndex((item) => item === xhr) >>> 0,
                1
              );
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
                // FIX: continue to upload progress is reset
                const percent = ~~(getFileChunksLoaded() / file.size);
                if (percent > file.percent) {
                  updateFile(file.uid, { percent });
                }
              }
            },
          });
        })();

        currentExecutionQueue.push(xhr);
      });

    // create upload tasks
    const tasks = fileChunks
      .filter((chunk) => !uploaded.includes(chunk.hash))
      .map(createUploadChunkTask);

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
        delete executionQueue.current[fileObj.uid];
      } catch {
        updateFile(fileObj.uid, { status: 'error' });
      }
    }
  };

  const pause = (uid: number) => {
    executionQueue.current[uid]?.forEach((xhr) => xhr.abort());
    executionQueue.current[uid] = [];
    updateFile(uid, { status: 'pause' });
  };

  const resume = (uid: number) => {
    updateFile(uid, { status: 'uploading' });
    uploadFile(files.find((f) => f.uid === uid)!);
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
                  {['uploading', 'pause'].includes(file.status) && (
                    <span className="text-sm">{file.percent}%</span>
                  )}
                </div>

                {['uploading', 'pause'].includes(file.status) ? (
                  <div className="flex gap-3 items-center">
                    <div className="flex-1 h-1.5 rounded-md bg-white">
                      <div
                        style={{ width: `${file.percent}%` }}
                        className="h-full rounded-md bg-blue-300"
                      ></div>
                    </div>

                    <span
                      className="relative before:block before:absolute before:-inset-2 cursor-pointer leading-none transition hover:text-blue-300"
                      onClick={() => {
                        if (file.status === 'uploading') {
                          pause(file.uid);
                        } else {
                          resume(file.uid);
                        }
                      }}
                    >
                      {file.status === 'uploading' ? (
                        <FontAwesomeIcon icon={faPause} className="px-[1px]" />
                      ) : (
                        <FontAwesomeIcon icon={faPlay} />
                      )}
                    </span>
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
