## co-ejs

Embedded JavaScript templates for ES6.

### Install

    npm i co-ejs --save

### Example

```
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
'<% var cb = callback() %>' +
'<h5><%= callbackGen() %></h5>\n' +
'<h4><%- cb %></h4>';

co(function* () {
  console.time('time');
  var result = yield *ejs.render(str, {locals: locals});
  console.log(result);
  console.timeEnd('time');
}).catch(function (err) {
  console.log(err);
});
```

result:

```
<h1>1.0.0</h1>
<h2>Sat Jan 24 2015 00:47:58 GMT+0800 (CST)</h2>
<h3>&lt;p&gt;127.0.0.1&lt;/p&gt;</h3>
<h4><p>callback</p></h4>
<h5>&lt;p&gt;callbackGen&lt;/p&gt;</h5>
time: 3015ms
```

### Others

see [ejs](https://github.com/tj/ejs)

### Test

    npm test

### License

MIT