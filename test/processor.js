const delay = (ms) => new Promise((res) => setTimeout(res, ms));

const sthAsync = async (data) => {
  console.log(`is called data`);

  console.time(`sthAsync`);
  await delay(data * 1000);
  console.log(data);
  console.timeEnd(`sthAsync end`);
};

const handler = (data) => {
  return async () => {
    await sthAsync(data);
  };
};

const concatPromise = (prevRS, job)=> {
    const result = Array.isArray(prevRS) ? prevRS : [];
    return job().then((rs) => {
      result.push(rs);
      return Promise.resolve(result);
    });
  }

  const waterfallPromise = (jobs, ms)=> {
    return jobs.reduce((prev, curr) => {
      return prev.then(async (rs) => {
        await delay(ms);
        return concatPromise(rs, curr);
      });
    }, Promise.resolve());
  }

const test = async () => {
  let arr = [1, 2, 3, 4, 5, 6].map((data) => handler(data));
  waterfallPromise(arr, 100)
};

test();
