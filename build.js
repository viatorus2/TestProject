/* global require */
"use strict";

const {spawn, spawnSync, execSync} = require('child_process');
const fs = require('fs');
const process = require('process');

const VERSION = require('./package.json').version;

process.argv.forEach((val, index) => {
  console.log(`${index}: ${val}`);
});

const PACKAGES = [
  "main",
  "root"
];

const ROOT_DIR = process.cwd();

// Check git status.
const IS_PULL_REQUEST = process.env.TRAVIS_PULL_REQUEST !== "false";
const IS_MASTER_TARGET = process.env.TRAVIS_BRANCH === process.env.GIT_BRANCH;
const COMMIT_TAG = process.env.TRAVIS_TAG;

print("PR: ", IS_PULL_REQUEST);
print("PUSH: ", IS_MASTER_TARGET);
print("Tag: ", COMMIT_TAG);

// Check if master.

let promise = Promise.resolve();

promise = promise.then(() => {
  return Promise.resolve(build());
});

if (!IS_PULL_REQUEST) {
  promise = promise
    .then(() => npm_login())
    .then(() => {
      //npm_publish();
    });
}

promise.catch((e) => {
  print_error(e.message);
  process.exit(1);
});

function build() {
  const UGLIFYJS = `${ROOT_DIR}/node_modules/uglify-es/bin/uglifyjs`;

  print(`====== BUILDING: Version ${VERSION}`);

  for (const PACKAGE of PACKAGES) {

    const SRC_DIR = `${ROOT_DIR}/packages/${PACKAGE}`;
    const OUT_DIR = `${ROOT_DIR}/dist/package/${PACKAGE}`;
    const NPM_DIR = `${ROOT_DIR}/dist/packages-dist/${PACKAGE}`;
    const FILENAME = `${PACKAGE}.js`;
    const FILENAME_MINIFIED = `${PACKAGE}.min.js`;

    print(`======      [${PACKAGE}]: PACKING    =====`);
    remove_dir(OUT_DIR);

    run("webpack", ["--config=config/webpack.config.js", `--entry=${SRC_DIR}/src/index.js`, `--output-library=${PACKAGE}`, `--output-path=${OUT_DIR}`, `--output-filename=${FILENAME}`]);

    print(`======      [${PACKAGE}]: BUNDLING   =====`);
    remove_dir(NPM_DIR);
    make_dir(NPM_DIR);

    run("rsync", ["-a", `${OUT_DIR}/`, `${NPM_DIR}`]);
    run("rsync", ["-am", "--include=package.json", "--include=*/", "--exclude=*", `${SRC_DIR}/`, `${NPM_DIR}/`]);

    print(`======      [${PACKAGE}]: MINIFY     =====`);
    run(UGLIFYJS, [`${OUT_DIR}/${FILENAME}`, "--output", `${OUT_DIR}/${FILENAME_MINIFIED}`])

    if (!IS_PULL_REQUEST) {
      print(`======      [${PACKAGE}]: VERSIONING =====`);
      const data = fs.readFileSync(`${NPM_DIR}/package.json`);
      let json = JSON.parse(data);
      json.version = VERSION;
      fs.writeFileSync(`/${NPM_DIR}/package.json`, JSON.stringify(json, null, 2));
    }
  }
}

function merge() {
  const RELEASE = "RELEASE";
  run("git", ["checkout", "-b", RELEASE, "origin/master"]);

  run("git", ["checkout", "master"]);
  run("git", ["merge", RELEASE]);
  run("git", ["branch", "-d", RELEASE]);
}

function npm_login() {
  return new Promise((resolve, reject) => {
    // Login to npm.
    const username = process.env.NPM_USERNAME;
    const password = process.env.NPM_PASSWORD;
    const email = process.env.NPM_EMAIL;

    if (!username || !password || !email || !email.includes('@')) {
      reject(Error("Login data not set probably."));
    }

    // Write to stdin to login.
    const npmLogin = spawn('npm', ['login']);
    npmLogin.stdout.on('data', (data) => {
      const msg = data.toString();
      if (msg.startsWith("Username")) {
        npmLogin.stdin.write(username + '\n');
      } else if (msg.startsWith("Password")) {
        npmLogin.stdin.write(password + '\n');
      } else if (msg.startsWith("Email")) {
        npmLogin.stdin.write(email + '\n');
      }
    });
    npmLogin.stderr.on('data', (data) => {
      print_error(data.toString());
      npmLogin.stdout.destroy();
      npmLogin.stderr.destroy();
      npmLogin.stdin.end();
    });
    npmLogin.on('close', (code) => {
      if (code !== 0) {
        reject(Error("NPM login failed"));
      }
      resolve();
    });
  });
}

function npm_publish() {
  print(`====== PUBLISHING: Version ${VERSION}`);

  for (const PACKAGE of PACKAGES) {
    run("npm", ["publish", `${ROOT_DIR}/dist/packages-dist/${PACKAGE}`, "--access=public"]);
    print(`======      [${PACKAGE}]: PUBLISHED =====`);
  }
}

function run(command, args = [], object = {}) {
  const child = spawnSync(command, args, object);
  if (child.status !== 0) {
    throw Error("Process failed: " + command + " " + args.join(' ') + "\n" + child.output);
  }
  return child.output;
}

function remove_dir(path) {
  run("rm", ["-rf", path]);
}

function make_dir(path) {
  run("mkdir", ["-p", path]);
}

function print(txt) {
  process.stdout.write(txt + "\n");
}

function print_error(txt) {
  process.stderr.write(txt + "\n");
}
