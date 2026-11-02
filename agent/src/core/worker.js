// One long-running Python worker, spoken to in JSON lines: a request is one line on its stdin, its answer one line on
// its stdout. Every worker the gateway keeps (the embedder, Prompt Guard, the goal check, speech in and speech out)
// goes through this, so each gets the same care:
//   - answers are matched to requests by an id (byId: the worker echoes it), or in order (a FIFO queue); a request
//     that timed out keeps its place in the queue, so a late answer is dropped instead of going to the next request
//   - a worker that can't start (no Python, ENOENT), closes its pipe (EPIPE) or exits fails the requests it holds and
//     is started again on the next call; none of that is ever an error of the gateway
//   - readyLine: a worker that loads a model first says {"ready": true} (or {"ready": false, "error"}), and calls wait
//     for it (up to readyMs)
// spec() returns {python, args, env} each time the worker starts, and may throw (say, when the Python isn't there).
import {spawn} from 'node:child_process';

export function pyWorker({
  name = 'the worker',
  spec,
  stderr = 'ignore',
  byId = false,
  readyLine = false,
  readyMs = 300000,
}) {
  // each process keeps its own requests: one that exits fails only its own, never those of the one started after it
  let proc = null,
    ready = null,
    seq = 0;
  const answer = (pend, j) => {
    if (byId) {
      const f = pend.waiting.get(j.id);
      if (f) {
        pend.waiting.delete(j.id);
        f(j);
      }
    } else pend.queue.shift()?.(j);
  };
  function start() {
    if (ready) return ready;
    ready = new Promise((ok, fail) => {
      let p;
      try {
        const s = spec();
        p = spawn(s.python, s.args || [], {
          stdio: ['pipe', 'pipe', stderr],
          env: {...process.env, ...(s.env || {})},
        });
      } catch (e) {
        return fail(
          new Error(
            `${name} did not start (${String(e.code || e.message).slice(0, 80)})`,
          ),
        );
      }
      proc = p;
      const pend = (p.pend = {waiting: new Map(), queue: []});
      const timer = readyLine
        ? setTimeout(() => {
            fail(new Error(`${name} took too long to load`));
            if (proc === p) {
              proc = null;
              ready = null;
            }
            p.kill();
          }, readyMs)
        : null;
      if (!readyLine) ok();
      let buf = '';
      p.stdout.setEncoding('utf8');
      p.stdout.on('data', d => {
        buf += d;
        for (let i; (i = buf.indexOf('\n')) >= 0; ) {
          const line = buf.slice(0, i);
          buf = buf.slice(i + 1);
          let j;
          try {
            j = JSON.parse(line);
          } catch {
            if (!byId)
              pend.queue.shift()?.({
                error: `${name} wrote a line that is not JSON`,
              });
            continue;
          }
          if (readyLine && j && 'ready' in j && j.id == null) {
            clearTimeout(timer);
            j.ready
              ? ok(j)
              : fail(new Error(j.error || `${name} could not load`));
            continue;
          }
          answer(pend, j);
        }
      });
      // once per process: one that errors and then exits ends only once
      let ended = false;
      const stopped = e => {
        if (ended) return;
        ended = true;
        clearTimeout(timer);
        if (proc === p) {
          proc = null;
          ready = null;
        }
        const why = e?.code
          ? `${name} did not start (${e.code})`
          : `${name} stopped`;
        fail(new Error(why));
        for (const f of pend.waiting.values()) f({error: why});
        pend.waiting.clear();
        pend.queue.splice(0).forEach(f => f({error: why}));
      };
      p.on('error', stopped);
      p.stdin.on('error', () => {}); // a write after the worker died: its exit answers the request
      p.on('exit', () => stopped());
    });
    ready.catch(() => {});
    return ready;
  }
  // one request: its answer (an object; { error } when the worker stopped), or a rejection when it doesn't answer
  // within timeoutMs
  async function call(msg, {timeoutMs = 60000} = {}) {
    await start();
    const p = proc;
    if (!p) throw new Error(`${name} stopped`);
    return new Promise((ok, fail) => {
      const id = ++seq;
      let done = false;
      const t = setTimeout(() => {
        done = true;
        if (byId) p.pend.waiting.delete(id);
        fail(new Error(`${name} did not answer in time`));
      }, timeoutMs);
      const f = j => {
        if (done) return;
        done = true;
        clearTimeout(t);
        ok(j);
      };
      if (byId) p.pend.waiting.set(id, f);
      else p.pend.queue.push(f);
      p.stdin.write(JSON.stringify(byId ? {...msg, id} : msg) + '\n');
    });
  }
  return {
    start,
    call,
    running: () => !!proc,
    stop() {
      const p = proc;
      proc = null;
      ready = null;
      p?.kill();
    },
  };
}
