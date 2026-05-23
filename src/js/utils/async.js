export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function waitWithTimeout(promise, ms) {
  return new Promise(resolve => {
    let done = false;
    const finish = value => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => finish(false), ms);
    Promise.resolve(promise).then(() => finish(true)).catch(() => finish(false));
  });
}

export function scriptOnce(src) {
  return new Promise((resolve, reject) => {
    const old = document.querySelector('script[src="' + src + '"]');
    if (old) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.body.appendChild(s);
  });
}
