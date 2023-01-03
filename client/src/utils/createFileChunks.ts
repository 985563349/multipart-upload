const createFileChunks = (file: File, size: number) => {
  const chunks = [];
  let count = 0;
  while (count < file.size) {
    chunks.push({ chunk: file.slice(count, count + size) });
    count += size;
  }
  return chunks;
};

export default createFileChunks;
