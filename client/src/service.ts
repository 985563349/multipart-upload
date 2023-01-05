import { request } from './utils';

export const verifyUpload = (params: { filename: string; filehash: string }) => {
  return new Promise<any>((resolve, reject) => {
    request({
      url: `http://localhost:3000/upload-verify?${new URLSearchParams(params).toString()}`,
      method: 'GET',
      onSuccess: resolve,
      onError: reject,
    });
  });
};

export const mergeUpload = (body: { filename: string; filehash: string; size: number }) => {
  return new Promise((resolve, reject) => {
    request({
      url: 'http://localhost:3000/upload-merge',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      onSuccess: resolve,
      onError: reject,
    });
  });
};
