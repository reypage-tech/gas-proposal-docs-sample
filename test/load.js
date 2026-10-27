const fs = require('fs'), path = require('path'), vm = require('vm');
module.exports = function load() {
  const ctx = { module: { exports: {} } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/Code.gs'), 'utf8'), ctx);
  return ctx.module.exports;
};
