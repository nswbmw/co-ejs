var co = require('co');
var ejs = require('./');
var wait = require('co-wait');

var locals = {
  version: '1.0.0',
  now: function () {
    return new Date();
  },
  ip: function *() {  // generatorFunction
    yield wait(1000);
    return this.ip || '<p>127.0.0.1</p>'; // use this like in koa middleware
  },
  callback: function() {
    return function (cb) {
      cb(null, '<p>callback</p>');
    }
  },
  callbackGen: function() {
    return function* () {
      yield wait(3000);
      return '<p>callbackGen</p>';
    };
  },
  doNothing: function() {
    console.log('this will not print');
  }
};

var str =
'<h1><%= version %></h1>\n' +
'<h2><%= now() %></h2>\n' +
'<h3><%= ip() %></h3>\n' +
'<h4><%- callback() %></h4>\n' +
'<h5><%= callbackGen() %></h5>';

co(function* () {
  console.time('time');
  var result = yield *ejs.render(str, {locals: locals});
  console.log(result);
  console.timeEnd('time');
}).catch(function (err) {
  console.log(err);
});