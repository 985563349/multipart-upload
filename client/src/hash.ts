import SparkMD5 from 'spark-md5';

self.addEventListener('message', (e) => {
  const { fileChunks } = e.data;
  const spark = new SparkMD5.ArrayBuffer();
  const fileReader = new FileReader();
  let currentChunk = 0;

  fileReader.onload = function (e) {
    spark.append(e.target?.result as ArrayBuffer);
    currentChunk++;
    if (currentChunk < fileChunks.length) {
      loadNext();
    } else {
      self.postMessage({ hash: spark.end() });
    }
  };

  fileReader.onerror = function () {
    console.warn('oops, something went wrong.');
  };

  function loadNext() {
    fileReader.readAsArrayBuffer(fileChunks[currentChunk].chunk);
  }

  loadNext();
});
