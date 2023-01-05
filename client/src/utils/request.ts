export interface RequestProgressEvent extends ProgressEvent {
  percent?: number;
}

export interface RequestOptions<T = any> {
  url: string | URL;
  method: string;
  headers?: Record<string, string>;
  body?: Document | XMLHttpRequestBodyInit | null;
  withCredentials?: boolean;
  onSuccess?: (body: T) => void;
  onError?: (event: RequestProgressEvent) => void;
  onProgress?: (event: RequestProgressEvent) => void;
}

const getBody = (xhr: XMLHttpRequest) => {
  const text = xhr.responseText || xhr.response;
  if (!text) return text;

  try {
    return JSON.parse(text);
  } catch (e) {
    return text;
  }
};

const request = <T = any>({
  url,
  method,
  headers = {},
  body,
  withCredentials,
  onSuccess,
  onError,
  onProgress,
}: RequestOptions<T>) => {
  const xhr = new XMLHttpRequest();

  xhr.onload = (e) => {
    if (xhr.status < 200 || xhr.status >= 300) {
      onError?.(e);
      return;
    }
    onSuccess?.(getBody(xhr));
  };

  xhr.onerror = (e) => {
    onError?.(e);
  };

  if (onProgress && xhr.upload) {
    xhr.upload.onprogress = (e: RequestProgressEvent) => {
      if (e.total > 0) {
        e.percent = (e.loaded / e.total) * 100;
      }
      onProgress(e);
    };
  }

  xhr.open(method, url, true);

  if (withCredentials && 'withCredentials' in xhr) {
    xhr.withCredentials = true;
  }

  if (headers['X-Requested-With'] !== null) {
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
  }

  Object.keys(headers).forEach((h) => {
    if (headers[h] !== null) {
      xhr.setRequestHeader(h, headers[h]);
    }
  });

  xhr.send(body);

  return xhr;
};

export default request;
