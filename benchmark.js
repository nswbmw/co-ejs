var co = require('co');
var ejs = require('./lib/ejs'),
    str = '<% if (foo) { %><p><%= foo %></p><% } %>',
    times = 50000;

console.log('rendering ' + times + ' times');

co(function* () {
  console.time('time');
  while (times--) {
    yield *ejs.render(str, { cache: true, filename: 'test', locals: { foo: 'bar' }});
  }
  console.timeEnd('time');
}).catch(function (err) {
  console.log(err);
});