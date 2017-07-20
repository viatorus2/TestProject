/* global process, require */
const {spawn} = require('child_process');

const username = process.env.NPM_USERNAME;
const password = process.env.NPM_PASSWORD;
const email = process.env.NPM_EMAIL;

const npmLogin = spawn('npm', ['login']);

npmLogin.stdout.on('data', (data) => {
  const msg = data.toString();
  if (msg === "Username: ") {
    npmLogin.stdin.write(username + '\n');
  } else if (msg === "Password: ") {
    npmLogin.stdin.write(password + '\n');
  } else {
    npmLogin.stdin.write(email + '\n');
  }
});
