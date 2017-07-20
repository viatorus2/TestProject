/* global require */
"use strict";

const {spawn, spawnSync, execSync} = require('child_process');
const fs = require('fs');
const process = require('process');

const COLOR = {
  // Reset
  "ColorOff": '\x1B[0m', //  Text Reset
  // Regular Colors
  "Black": '\x1B[0;30m', //  Black
  "Red": '\x1B[0;31m', //  Red
  "Green": '\x1B[0;32m', //  Green
  "Yellow": '\x1B[0;33m', //  Yellow
  "Blue": '\x1B[0;34m', //  Blue
  "Purple": '\x1B[0;35m', //  Purple
  "Cyan": '\x1B[0;36m', //  Cyan
  "White": '\x1B[0;37m', //  White
  // Bold
  "BBlack": '\x1B[1;30m', //  Black
  "BRed": '\x1B[1;31m', //  Red
  "BGreen": '\x1B[1;32m', //  Green
  "BYellow": '\x1B[1;33m', //  Yellow
  "BBlue": '\x1B[1;34m', //  Blue
  "BPurple": '\x1B[1;35m', //  Purple
  "BCyan": '\x1B[1;36m', //  Cyan
  "BWhite": '\x1B[1;37m', //  White
  // Underline
  "UBlack": '\x1B[4;30m', //  Black
  "URed": '\x1B[4;31m', //  Red
  "UGreen": '\x1B[4;32m', //  Green
  "UYellow": '\x1B[4;33m', //  Yellow
  "UBlue": '\x1B[4;34m', //  Blue
  "UPurple": '\x1B[4;35m', //  Purple
  "UCyan": '\x1B[4;36m', //  Cyan
  "UWhite": '\x1B[4;37m', //  White
  // Background
  "On_Black": '\x1B[40m', //  Black
  "On_Red": '\x1B[41m', //  Red
  "On_Green": '\x1B[42m', //  Green
  "On_Yellow": '\x1B[43m', //  Yellow
  "On_Blue": '\x1B[44m', //  Blue
  "On_Purple": '\x1B[45m', //  Purple
  "On_Cyan": '\x1B[46m', //  Cyan
  "On_White": '\x1B[47m', //  White
  // High Intensity
  "IBlack": '\x1B[0;90m', //  Black
  "IRed": '\x1B[0;91m', //  Red
  "IGreen": '\x1B[0;92m', //  Green
  "IYellow": '\x1B[0;93m', //  Yellow
  "IBlue": '\x1B[0;94m', //  Blue
  "IPurple": '\x1B[0;95m', //  Purple
  "ICyan": '\x1B[0;96m', //  Cyan
  "IWhite": '\x1B[0;97m', //  White
  // Bold High Intensity
  "BIBlack": '\x1B[1;90m', //  Black
  "BIRed": '\x1B[1;91m', //  Red
  "BIGreen": '\x1B[1;92m', //  Green
  "BIYellow": '\x1B[1;93m', //  Yellow
  "BIBlue": '\x1B[1;94m', //  Blue
  "BIPurple": '\x1B[1;95m', //  Purple
  "BICyan": '\x1B[1;96m', //  Cyan
  "BIWhite": '\x1B[1;97m', //  White
  // High Intensity backgrounds
  "On_IBlack": '\x1B[0;100m', //  Black
  "On_IRed": '\x1B[0;101m', //  Red
  "On_IGreen": '\x1B[0;102m', //  Green
  "On_IYellow": '\x1B[0;103m', //  Yellow
  "On_IBlue": '\x1B[0;104m', //  Blue
  "On_IPurple": '\x1B[0;105m', //  Purple
  "On_ICyan": '\x1B[0;106m', //  Cyan
  "On_IWhite": '\x1B[0;107m', //  White
};


const VERSION = require('./package.json').version;

process.argv.forEach((val, index) => {
  console.log(`${index}: ${val}`);
});

const PACKAGES = [
  "main",
  "root"
];

const ROOT_DIR = process.cwd();

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
    run(UGLIFYJS, [`${OUT_DIR}/${FILENAME}`, "--output", `${OUT_DIR}/${FILENAME_MINIFIED}`]);

    print(`======      [${PACKAGE}]: VERSIONING =====`);
    const data = fs.readFileSync(`${NPM_DIR}/package.json`);
    let json = JSON.parse(data);
    json.version = VERSION;
    fs.writeFileSync(`/${NPM_DIR}/package.json`, JSON.stringify(json, null, 2));
  }
}

function merge() {

//  execSync(`git checkout master && `)

}

npm_login()
  .then(() => {
    build();
    publish();
  })
  .catch((e) => {
    print_error(e.message);
  });

function publish() {
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
}

function remove_dir(path) {
  execSync(`rm -rf ${path}`);
}

function make_dir(path) {
  execSync(`mkdir -p ${path}`);
}

function print(...txt) {
  process.stdout.write(COLOR.White);
  process.stdout.write(...txt);
  process.stdout.write(COLOR.ColorOff + "\n");
}

function print_error(...msg) {
  process.stderr.write(COLOR.Red);
  process.stderr.write(...msg);
  process.stderr.write(COLOR.ColorOff + "\n");
}
