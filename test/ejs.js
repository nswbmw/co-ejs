/**
 * Module dependencies.
 */

var ejs = require('..')
  , fs = require('fs')
  , read = fs.readFileSync
  , assert = require('should')
  , co = require('co');

/**
 * Load fixture `name`.
 */

function fixture(name) {
  return read('test/fixtures/' + name, 'utf8').replace(/\r/g, '');
}

function onerror(err) {
  console.log(err.stack);
}

/**
 * User fixtures.
 */

var users = [];
users.push({ name: 'tobi' });
users.push({ name: 'loki' });
users.push({ name: 'jane' });

describe('ejs.compile(str, options)', function(){
  it('should compile to a function', function(){
    var fn = ejs.compile('<p>yay</p>');
    co(function*() {
      (yield fn()).should.equal('<p>yay</p>');
    }).catch(onerror);
  })

  it('should throw if there are syntax errors', function(){
    try {
      ejs.compile(fixture('fail.ejs'));
    } catch (err) {
      err.message.should.containEql('compiling ejs');
      try {
        ejs.compile(fixture('fail.ejs'), { filename: 'fail.ejs' });
      } catch (err) {
        err.message.should.containEql('fail.ejs');
        return;
      }
    }

    assert(false, 'compiling a file with invalid syntax should throw an exception');
  })

  it('should allow customizing delimiters', function(){
    co(function*() {
      var fn = ejs.compile('<p>{= name }</p>', { open: '{', close: '}' });
      (yield fn({ name: 'tobi' })).should.equal('<p>tobi</p>');

      var fn = ejs.compile('<p>::= name ::</p>', { open: '::', close: '::' });
      (yield fn({ name: 'tobi' })).should.equal('<p>tobi</p>');

      var fn = ejs.compile('<p>(= name )</p>', { open: '(', close: ')' });
      (yield fn({ name: 'tobi' })).should.equal('<p>tobi</p>');
    }).catch(onerror);
  })

  it('should default to using ejs.open and ejs.close', function(){
    ejs.open = '{';
    ejs.close = '}';
    co(function*() {
      var fn = ejs.compile('<p>{= name }</p>');
      (yield fn({ name: 'tobi' })).should.equal('<p>tobi</p>');

      var fn = ejs.compile('<p>|= name |</p>', { open: '|', close: '|' });
      (yield fn({ name: 'tobi' })).should.equal('<p>tobi</p>');
      delete ejs.open;
      delete ejs.close;
    }).catch(onerror);
  })

  it('should have a working client option', function(){
    var fn = ejs.compile('<p><%= foo %></p>', { client: true });
    var str = fn.toString();
    eval('var preFn = ' + str);
    co(function*() {
      (yield preFn({ foo: 'bar' })).should.equal('<p>bar</p>');
    }).catch(onerror);
  })
})

describe('ejs.render(str, options)', function(){
  it('should render the template', function(){
    co(function*() {
      (yield *ejs.render('<p>yay</p>'))
        .should.equal('<p>yay</p>');
    }).catch(onerror);
  })

  it('should accept locals', function(){
    co(function*() {
      (yield *ejs.render('<p><%= name %></p>', { name: 'tobi' }))
        .should.equal('<p>tobi</p>');
    }).catch(onerror);
  })
})

describe('ejs.renderFile(path, options, fn)', function(){
  it('should render a file', function(){
    co(function*() {
      (yield *ejs.renderFile('test/fixtures/para.ejs')).should.equal('<p>hey</p>');
    }).catch(onerror);
  })

  it('should accept locals', function(){
    var options = { name: 'tj', open: '{', close: '}' };
    co(function*() {
      (yield *ejs.renderFile('test/fixtures/user.ejs', options)).should.equal('<h1>tj</h1>');
    }).catch(onerror);
  })

  it('should not catch err threw by callback', function(){
    var options = { name: 'tj', open: '{', close: '}' };
    var counter = 0;

    co(function*() {
      yield *ejs.renderFile('test/fixtures/user.ejs', options);
      counter++;
    }).catch(function (err) {
      counter.should.equal(1);
      err.message.should.equal('Exception in callback');
    });
  })
})

describe('<%=', function(){

  it('should escape &amp;<script>', function(){
    co(function*() {
      (yield *ejs.render('<%= name %>', { name: '&nbsp;<script>' }))
        .should.equal('&amp;nbsp;&lt;script&gt;');
    }).catch(onerror);
  })

  it("should escape '", function(){
    co(function*() {
      (yield *ejs.render('<%= name %>', { name: "The Jones's" }))
        .should.equal('The Jones&#39;s');
    }).catch(onerror);
  })
  
  it("should escape &foo_bar;", function(){
    co(function*() {
      (yield *ejs.render('<%= name %>', { name: "&foo_bar;" }))
        .should.equal('&amp;foo_bar;');
    }).catch(onerror);
  })
})

describe('<%-', function(){
  it('should not escape', function(){
    co(function*() {
      (yield *ejs.render('<%- name %>', { name: '<script>' }))
        .should.equal('<script>');
    }).catch(onerror);
  })

  it('should terminate gracefully if no close tag is found', function(){
    try {
      ejs.compile('<h1>oops</h1><%- name ->')
      throw new Error('Expected parse failure');
    } catch (err) {
      err.message.should.equal('Could not find matching close tag "%>".');      
    }      
  })
})

describe('%>', function(){
  it('should produce newlines', function(){
    co(function*() {
      (yield *ejs.render(fixture('newlines.ejs'), { users: users }))
        .should.equal(fixture('newlines.html'));
    }).catch(onerror);
  })
})

describe('-%>', function(){
  it('should not produce newlines', function(){
    co(function*() {
      (yield *ejs.render(fixture('no.newlines.ejs'), { users: users }))
        .should.equal(fixture('no.newlines.html'));
    }).catch(onerror);
  })
})

describe('single quotes', function(){
  it('should not mess up the constructed function', function(){
    co(function*() {
      (yield *ejs.render(fixture('single-quote.ejs')))
        .should.equal(fixture('single-quote.html'));
    }).catch(onerror);
  })
})

describe('double quotes', function(){
  it('should not mess up the constructed function', function(){
    co(function*() {
      (yield *ejs.render(fixture('double-quote.ejs')))
        .should.equal(fixture('double-quote.html'));
    }).catch(onerror);
  })
})

describe('backslashes', function(){
  it('should escape', function(){
    co(function*() {
      (yield *ejs.render(fixture('backslash.ejs')))
        .should.equal(fixture('backslash.html'));
    }).catch(onerror);
  })
})

describe('messed up whitespace', function(){
  it('should work', function(){
    co(function*() {
      (yield *ejs.render(fixture('messed.ejs'), { users: users }))
        .should.equal(fixture('messed.html'));
    }).catch(onerror);
  })
})

describe('filters', function(){
  it('should work', function(){
    var items = ['foo', 'bar', 'baz'];
    co(function*() {
      (yield *ejs.render('<%=: items | reverse | first | reverse | capitalize %>', { items: items }))
        .should.equal('Zab');
    }).catch(onerror);
  })

  it('should accept arguments', function(){
    co(function*() {
      (yield *ejs.render('<%=: users | map:"name" | join:", " %>', { users: users }))
        .should.equal('tobi, loki, jane');
    }).catch(onerror);
  })

  it('should truncate string', function(){
    co(function*() {
      (yield *ejs.render('<%=: word | truncate: 3 %>', { word: 'World' }))
        .should.equal('Wor');
    }).catch(onerror);
  })

  it('should append string if string is longer', function(){
    co(function*() {
      (yield *ejs.render('<%=: word | truncate: 2,"..." %>', { word: 'Testing' }))
        .should.equal('Te...');
    }).catch(onerror);
  })

  it('should not append string if string is shorter', function(){
    co(function*() {
      (yield *ejs.render('<%=: word | truncate: 10,"..." %>', { word: 'Testing' }))
        .should.equal('Testing');
    }).catch(onerror);
  })

  it('should accept arguments containing :', function(){
    co(function*() {
      (yield *ejs.render('<%=: users | map:"name" | join:"::" %>', { users: users }))
        .should.equal('tobi::loki::jane');
    }).catch(onerror);
  })
})

describe('exceptions', function(){
  it('should produce useful stack traces', function(done){
    co(function*() {
      (yield *ejs.render(fixture('error.ejs'), { filename: 'error.ejs' }));
    }).catch(function (err) {
      err.path.should.equal('error.ejs');
      err.stack.split('\n').slice(0, 8).join('\n').should.equal(fixture('error.out'));
      done();
    });
  })

  it('should not include __stack if compileDebug is false', function() {
    co(function*() {
      yield *ejs.render(fixture('error.ejs'), {
        filename: 'error.ejs',
        compileDebug: false
      });
    }).catch(function (err) {
      err.should.not.have.property('path');
      err.stack.split('\n').slice(0, 8).join('\n').should.not.equal(fixture('error.out'));
    });
  });
})

describe('includes', function(){
  it('should include ejs', function(){
    var file = 'test/fixtures/include.ejs';
    co(function*() {
      (yield *ejs.render(fixture('include.ejs'), { filename: file, pets: users, open: '[[', close: ']]' }))
        .should.equal(fixture('include.html'));
    }).catch(onerror);
  })

  it('should work when nested', function(){
    var file = 'test/fixtures/menu.ejs';
    co(function*() {
      (yield *ejs.render(fixture('menu.ejs'), { filename: file, pets: users }))
        .should.equal(fixture('menu.html'));
    }).catch(onerror);
  })

  it('should include arbitrary files as-is', function(){
    var file = 'test/fixtures/include.css.ejs';
    co(function*() {
      (yield *ejs.render(fixture('include.css.ejs'), { filename: file, pets: users }))
        .should.equal(fixture('include.css.html'));
    }).catch(onerror);
  })
})

describe('comments', function() {
  it('should fully render with comments removed', function() {
    co(function*() {
      (yield *ejs.render(fixture('comments.ejs')))
        .should.equal(fixture('comments.html'));
    }).catch(onerror);
  })
})


describe('require', function() {
  it('should allow ejs templates to be required as node modules', function() {
      var file = 'test/fixtures/include.ejs'
        , template = require(__dirname + '/fixtures/menu.ejs');
      co(function*() {
        (yield template({ filename: file, pets: users }))
          .should.equal(fixture('menu.html'));
      }).catch(onerror);
  })
})
