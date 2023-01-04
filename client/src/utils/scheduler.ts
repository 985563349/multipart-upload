function scheduler(tasks: (() => Promise<any>)[], max = 4) {
  return new Promise((resolve) => {
    let i = 0;

    function start() {
      while (i < tasks.length && max > 0) {
        max--;
        tasks[i]().finally(() => {
          max++;
          if (i === tasks.length) {
            resolve(null);
          } else {
            start();
          }
        });
        i++;
      }
    }

    start();
  });
}

export default scheduler;
