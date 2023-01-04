import React, { useState } from 'react';
import { createFileChunks, calculateHashSample, createFormData, scheduler } from './utils';

const SIZE = 10 * 1024 * 1024;

function App() {
  const [files, setFiles] = useState<File[]>([]);

  const uploadFile = async (file: File) => {
    const hash = await calculateHashSample(file);

    // verify upload
    const { shouldUpload, uploaded } = await fetch(
      `http://localhost:3000/upload-verify?filename=${file.name}&filehash=${hash}`
    ).then((response) => response.json());

    if (!shouldUpload) {
      console.log('skip upload: file upload success!');
      return;
    }

    // create file chunks
    const fileChunks = createFileChunks(file, SIZE);

    const tasks = fileChunks
      .map((chunk, index) => ({
        ...chunk,
        filename: file.name,
        filehash: hash,
        hash: `${hash}-${index}`,
      }))
      .filter((chunk) => !uploaded.includes(chunk.hash))
      .map(
        (data) => () =>
          fetch('http://localhost:3000/upload', { method: 'POST', body: createFormData(data) })
      );

    // concurrency request
    await scheduler(tasks, 4);

    // request merge
    await fetch('http://localhost:3000/upload-merge', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filename: file.name, filehash: hash, size: SIZE }),
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFiles((s) => [...s, file]);
      uploadFile(file);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-blue-300">
      <div className="p-6 w-96 rounded-lg bg-white">
        <h1 className="mb-6 text-2xl text-center font-bold text-blue-300">
          File Uploader JavaScript
        </h1>

        <form className="mb-4">
          <label className="flex justify-center items-center border-2 border-dashed border-blue-300 rounded-md h-40 cursor-pointer">
            <input type="file" hidden onChange={handleChange} />
            <p className="text-xl text-blue-300">Browse File to Upload</p>
          </label>
        </form>

        <ul className="flex flex-col gap-4">
          {files.map((file) => (
            <li className="p-4 rounded-md bg-blue-100" key={file.name}>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-sm">
                  <span>{file.name}</span>
                  <span>59%</span>
                </div>
                <div className="h-1.5 rounded-md bg-white">
                  <div className="w-1/2 h-full rounded-md bg-blue-300"></div>
                </div>
              </div>
            </li>
          ))}

          {/* <li className="p-4 rounded-md bg-blue-100">
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center text-sm">
                <span>filename</span>
              </div>
              <div className="text-xs">
                <span>75kb</span>
              </div>
            </div>
          </li> */}
        </ul>
      </div>
    </div>
  );
}

export default App;
