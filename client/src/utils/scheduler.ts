function scheduler(tasks: (() => Promise<any>)[], max = 4) {
  return new Promise((resolve, reject) => {
    let i = 0;

    function start() {
      while (i < tasks.length && max > 0) {
        max--;
        tasks[i]()
          .then(() => {
            max++;
            if (i === tasks.length) {
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
