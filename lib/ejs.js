/**
 * Module dependencies.
 */

var utils = require('./utils')
  , path = require('path')
  , dirname = path.dirname
  , extname = path.extname
  , join = path.join
  , read = require('fs').readFileSync;

var merge = require('merge-descriptors');

/**
 * Filters.
 *
 * @type Object
 */

var filters = exports.filters = require('./filters');

/**
 * default render options
 * @type {Object}
 */

var defaultSettings = {
  cache: true,
  layout: 'layout',
  viewExt: '.html',
  open: '<%',
  close: '%>',
  filters: {},
  locals: {},
  debug: false,
  writeResp: true
};

/**
 * Intermediate js cache.
 *
 * @type Object
 */

var cache = {};

/**
 * Clear intermediate js cache.
 *
 * @api public
 */

exports.clearCache = function () {
  cache = {};
};

/**
 * Translate filtered code into function calls.
 *
 * @param {String} js
 * @return {String}
 * @api private
 */

function filtered(js) {
  return js.substr(1).split('|').reduce(function (js, filter) {
    var parts = filter.split(':')
      , name = parts.shift()
      , args = parts.join(':') || '';
    if (args) args = ', ' + args;
    return js + ', [filters.' + name + args + ']';
  });
};

/**
 * Re-throw the given `err` in context to the
 * `str` of ejs, `filename`, and `lineno`.
 *
 * @param {Error} err
 * @param {String} str
 * @param {String} filename
 * @param {String} lineno
 * @api private
 */

function rethrow(err, str, filename, lineno) {
  console.log(arguments)
  lineno = err.lineno || lineno;
  filename = err.filename || filename;
  str = err.input || str;
  var lines = str.split('\n')
    , start = Math.max(lineno - 3, 0)
    , end = Math.min(lines.length, lineno + 3);

  // Error context
  var context = lines.slice(start, end).map(function (line, i) {
    var curr = i + start + 1;
    return (curr == lineno ? ' >> ' : '    ')
      + curr
      + '| '
      + line;
  }).join('\n');

  // Alter exception message
  err.path = filename;
  err.message = (filename || 'ejs') + ':'
    + lineno + '\n'
    + context + '\n\n'
    + err.message;

  throw err;
}

/**
 * pass and keep current context, return a generatorFunction.
 *
 * @param {String} file content
 * @param {String} filename
 * @param {String} lineno
 * @return {generatorFunction}
 * @api private
 */

function exec(input, filename, lineno) {
  return function* (obj) {
    var result = obj;

    while (('function' === typeof result) || (result && ('function' === typeof result.next) && ('function' === typeof result.throw))) {
      result = yield result;
    }

    try {
      for (var i = 1; i < arguments.length; i++) {
        result = arguments[i][0].apply(result, [result].concat(arguments[i].slice(1)))
      };
    } catch (e) {
      e.input = input;
      e.filename = filename;
      e.lineno = lineno;
      throw e;
    }

    return result;
  };
}

exports = module.exports = function (app, settings) {
  if (!settings || !settings.root) {
    throw new Error('settings.root required');
  }

  settings.root = path.resolve(process.cwd(), settings.root);
  merge(settings, defaultSettings, false);

  settings.viewExt = settings.viewExt
      ? '.' + settings.viewExt.replace(/^\./, '')
      : '';

  merge(filters, settings.filters);
  settings.filters = filters;

  app.context.render = function *(view, options) {
    options = yield (options || {});
    merge(options, settings, false);
    options['$this'] = this;

    var html = yield *renderFile(view, options);
    if (options.layout) {
      // if using layout
      options.body = html;
      html = yield *renderFile(options.layout, options);
    }

    if (options.writeResp) {
      //normal operation
      this.type = 'html';
      this.body = html;
    } else {
      //only return the html
      return html;
    }
  };

  // just export for app.use
  return function* ejs(next) {
    yield* next;
  };
};


/**
 * Parse the given `str` of ejs, returning the function body.
 *
 * @param {String} str
 * @return {String}
 * @api public
 */

var parse = exports.parse = function(str, options, isInclude, parentStr, parentFilename) {
  var options = options || {}
    , open = options.open || exports.open || '<%'
    , close = options.close || exports.close || '%>'
    , filename = options.filename
    , buf = '';

  if (!isInclude) buf += 'var buf = [];';
  if (false !== options._with) buf += '\nwith (locals || {}) {';
  buf += '\n buf.push(\'';

  var lineno = 1;
  var consumeEOL = false;
  for (var i = 0, len = str.length; i < len; ++i) {
    var stri = str[i];
    if (str.slice(i, open.length + i) == open) {
      i += open.length;

      var prefix, postfix, line = '';
      line += '__stack.lineno=' + lineno;
      if (lineno === 1) {
        line += ', __stack.filename="' + filename + '"';
        line += ', __stack.input=' + JSON.stringify(str);
      }
      switch (str[i]) {
        case '=':
          prefix = "', (" + line + ", exec(__stack.input, __stack.filename, __stack.lineno)(";
          postfix = ", [escape])), '";
          ++i;
          break;
        case '-':
          prefix = "', (" + line + ", exec(__stack.input, __stack.filename, __stack.lineno)(";
          postfix = ")), '";
          ++i;
          break;
        default:
          prefix = "');" + line + ";";
          postfix = "; buf.push('";
      }

      var end = str.indexOf(close, i);

      if (end < 0) {
        throw new Error('Could not find matching close tag "' + close + '".');
      }

      var js = str.substring(i, end)
        , start = i
        , include = null
        , n = 0;

      if ('-' == js[js.length-1]) {
        js = js.substring(0, js.length - 2);
        consumeEOL = true;
      }

      if (0 == js.trim().indexOf('include')) {
        var name = js.trim().slice(7).trim();
        if (!filename) throw new Error('filename option is required for includes');
        var path = resolveInclude(name, filename, options.viewExt);
        path = join(options.root, path);

        include = read(path, 'utf8');
        include = parse(include, { filename: path, _with: false, open: open, close: close}, true, str, filename);
        buf += "'); yield (function*(){" + include + "')})();buf.push('";
        js = '';
      }

      while (~(n = js.indexOf("\n", n))) n++, lineno++;
      if (js.substr(0, 1) == ':') js = filtered(js);
      if (js) {
        if (js.lastIndexOf('//') > js.lastIndexOf('\n')) js += '\n';
        buf += prefix;
        buf += js;
        buf += postfix;
      }
      i += end - start + close.length - 1;

    } else if (stri == "\\") {
      buf += "\\\\";
    } else if (stri == "'") {
      buf += "\\'";
    } else if (stri == "\r") {
      // ignore
    } else if (stri == "\n") {
      if (consumeEOL) {
        consumeEOL = false;
      } else {
        buf += "\\n";
        lineno++;
      }
    } else {
      buf += stri;
    }
  }

  if (!isInclude) {
    if (false !== options._with) buf += "');\nreturn (yield buf).join('');\n}";
    else buf += "');\nreturn (yield buf).join('');";
  } else {
    buf += "', (__stack.filename='" + parentFilename + "', __stack.input=" + JSON.stringify(parentStr) + ",''),'"
  }

  return buf;
};

/**
 * Compile the given `str` of ejs into a `Function`.
 *
 * @param {String} str
 * @param {Object} options
 * @return {Function}
 * @api public
 */

var compile = exports.compile = function(str, options) {
  options = options || {};
  var escape = options.escape || utils.escape;

  var input = JSON.stringify(str)
    , client = options.client
    , filename = options.filename
        ? JSON.stringify(options.filename)
        : 'undefined';

  str = [
    'var __stack = { lineno: 1, input: ' + input + ', filename: ' + filename + ' };',
    rethrow.toString(),
    exec.toString(),
    'try {',
    parse(str, options),
    '} catch (err) {',
    '  rethrow(err, __stack.input, __stack.filename, __stack.lineno);',
    '}'
  ].join("\n");

  if (options.debug) console.log(str);
  if (client) str = 'escape = escape || ' + escape.toString() + ';\n' + str;

  try {
    var fn = (new Function('locals, filters, escape, rethrow', 'return function*(){' + str + '}'));
  } catch (err) {
    if ('SyntaxError' == err.name) {
      err.message += options.filename
        ? ' in ' + filename
        : ' while compiling ejs';
    }
    throw err;
  }

  if (client) return fn;

  return function (locals) {
    return fn.call(this, locals, filters, escape, rethrow);
  }
};

/**
 * Render the given `str` of ejs.
 *
 * Options:
 *
 *   - `locals`          Local variables object
 *   - `cache`           Compiled functions are cached, requires `filename`
 *   - `filename`        Used by `cache` to key caches
 *   - `scope`           Function execution context
 *   - `debug`           Output generated function body
 *   - `open`            Open tag, defaulting to "<%"
 *   - `close`           Closing tag, defaulting to "%>"
 *
 * @param {String} str
 * @param {Object} options
 * @return {String}
 * @api public
 */

var render = exports.render = function*(str, options) {
  var fn
    , options = options || {};

  if (options.cache) {
    if (options.filename) {
      fn = cache[options.filename] || (cache[options.filename] = compile(str, options));
    } else {
      throw new Error('"cache" option requires "filename".');
    }
  } else {
    fn = compile(str, options);
  }
  options.__proto__ = options.locals;
  return yield fn.call(options.scope, options);
};

/**
 * Render an EJS file at the given `path` and `options`.
 *
 * @param {String} path
 * @param {Object} options
 * @api public
 */

var renderFile = exports.renderFile = function*(path, options) {
  options = options || {};
  var key = path + ':string';
  options.filename = path + (options.viewExt || defaultSettings.viewExt);
  options.root = options.root || process.cwd();

  path = join(options.root, options.filename);

  var str = options.cache
      ? cache[key] || (cache[key] = read(path, 'utf8'))
      : read(path, 'utf8');

  return yield *render(str, options);
};

/**
 * Resolve include `name` relative to `filename`.
 *
 * @param {String} name
 * @param {String} filename
 * @return {String}
 * @api private
 */

function resolveInclude(name, filename, viewExt) {
  var path = join(dirname(filename), name);
  var ext = extname(name);
  if (!ext) path += viewExt;
  return path;
}