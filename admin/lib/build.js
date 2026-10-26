'use strict';
const { exec } = require('child_process');
const U = require('./util');

// 构建与发布:
// - 预览:后台起 hexo server(Windows 下用 taskkill /T 杀整棵进程树)
// - 构建:hexo clean && hexo generate(本地验证用,部署实际由 CI 完成)
// - 发布:git add → commit(无改动跳过)→ push,替代 publish-blog.bat
// 任务串行执行:同一时间只允许一个构建/发布任务,日志存 ring buffer 供前端轮询

const MAX_LOG = 500;

const state = {
  task: null,           // { name, status: running|ok|error, startedAt, endedAt }
  logs: [],             // 构建任务日志
  preview: { proc: null, port: null, startedAt: null, logs: [] },
};

function pushLog(lines) {
  for (const l of String(lines).split(/\r?\n/)) {
    if (l.trim()) {
      state.logs.push(l);
      if (state.logs.length > MAX_LOG) state.logs.splice(0, state.logs.length - MAX_LOG);
    }
  }
}

function sh(cmd, opts = {}) {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd: U.ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, windowsHide: true, ...opts }, (err, stdout, stderr) => {
      resolve({ err, stdout: stdout || '', stderr: stderr || '' });
    });
  });
}

async function runTask(name, steps) {
  if (state.task && state.task.status === 'running') { const e = new Error('已有任务在运行中: ' + state.task.name); e.status = 409; throw e; }
  state.task = { name, status: 'running', startedAt: Date.now(), endedAt: null };
  pushLog(`\n===== [${U.fmtDate()}] ${name} =====`);
  (async () => {
    try {
      for (const step of steps) {
        pushLog(`$ ${step.cmd}`);
        const { err, stdout, stderr } = await sh(step.cmd);
        if (stdout.trim()) pushLog(stdout.trim());
        if (stderr.trim() && !step.allowStderr) pushLog('[stderr] ' + stderr.trim());
        if (err) {
          if (step.ignoreExitCode) { pushLog(`(退出码 ${err.code},已忽略)`); continue; }
          throw new Error(`「${step.cmd}」失败,退出码 ${err.code}`);
        }
      }
      state.task.status = 'ok';
      pushLog(`✔ ${name} 完成`);
    } catch (e) {
      state.task.status = 'error';
      pushLog(`✘ ${name} 失败: ${e.message}`);
    } finally {
      state.task.endedAt = Date.now();
    }
  })();
  return { started: true, task: state.task };
}

function generate() {
  return runTask('本地构建', [
    { cmd: 'npx hexo clean' },
    { cmd: 'npx hexo generate' },
  ]);
}

async function publish(message) {
  const msg = String(message || 'update').replace(/"/g, "'");
  return runTask('发布(git push)', [
    { cmd: 'git add -A' },
    // 无改动时 commit 返回非零退出码属正常
    { cmd: `git commit -m "${msg}"`, ignoreExitCode: true },
    { cmd: 'git push' },
  ]);
}

function previewStatus() {
  const p = state.preview;
  return {
    previewRunning: !!p.proc,
    previewPort: p.port,
    startedAt: p.startedAt,
    previewLogs: p.logs.slice(-100),
    task: state.task,
    logs: state.logs.slice(-200),
  };
}

function previewStart(port) {
  if (state.preview.proc) { const e = new Error('预览已在运行中(端口 ' + state.preview.port + ')'); e.status = 409; throw e; }
  const p = Number(port) || 4000;
  state.preview.logs = [];
  const log = l => { state.preview.logs.push(l); if (state.preview.logs.length > MAX_LOG) state.preview.logs.splice(0, state.preview.logs.length - MAX_LOG); };
  const proc = exec(`npx hexo server -p ${p}`, { cwd: U.ROOT, windowsHide: true, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  proc.stdout.on('data', d => log(d.toString().trim()));
  proc.stderr.on('data', d => log('[stderr] ' + d.toString().trim()));
  proc.on('exit', code => { log(`hexo server 已退出(退出码 ${code})`); state.preview.proc = null; state.preview.port = null; });
  state.preview.proc = proc;
  state.preview.port = p;
  state.preview.startedAt = U.fmtDate();
  return { running: true, port: p };
}

async function previewStop() {
  const p = state.preview;
  if (!p.proc) return { running: false };
  const pid = p.proc.pid;
  p.proc = null; p.port = null;
  if (process.platform === 'win32') {
    await sh(`taskkill /PID ${pid} /T /F`);
  } else {
    try { process.kill(-pid); } catch { try { p.kill(); } catch {} }
  }
  return { running: false };
}

function status() {
  return {
    task: state.task,
    logs: state.logs.slice(-200),
    previewRunning: !!state.preview.proc,
    previewPort: state.preview.port,
  };
}

module.exports = { generate, publish, previewStart, previewStop, previewStatus, status };
