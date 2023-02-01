function scheduler(tasks: (() => Promise<any>)[], max = 4) {
  if (tasks.length <= 0) return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    let i = 0;
    let count = 0;

    function start() {
      while (i < tasks.length && max > 0) {
        max--;
        tasks[i]()
          .then(() => {
            max++;
            count++;
            if (count === tasks.length) {
              resolve(null);
            } else {
              start();
            }
          })
          .catch(() => reject(new Error('Task exception execution interrupt!')));
        i++;
      }
    }

    start();
  });
}

export default scheduler;
