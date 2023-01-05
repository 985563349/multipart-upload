import SparkMD5 from 'spark-md5';

const calculateHashSample = (file: File) => {
  return new Promise<string>((resolve) => {
    const spark = new SparkMD5.ArrayBuffer();
    const reader = new FileReader();
    const size = file.size;
    const offset = 2 * 1024 * 1024;

    const chunks = [file.slice(0, offset)];
    let cur = offset;

    while (cur < size) {
      if (cur + offset >= size) {
        chunks.push(file.slice(cur, cur + offset));
      } else {
        const mid = cur + offset / 2;
        const end = cur + offset;
        chunks.push(file.slice(cur, cur + 2));
        chunks.push(file.slice(mid, mid + 2));
        chunks.push(file.slice(end - 2, end));
      }
      cur += offset;
    }
    reader.readAsArrayBuffer(new Blob(chunks));
    reader.onload = (e) => {
      spark.append(e.target?.result as ArrayBuffer);
      resolve(spark.end());
    };
  });
};

export default calculateHashSample;
