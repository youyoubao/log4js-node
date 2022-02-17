const streams = require('streamroller');
const os = require('os');

const eol = os.EOL;

function openTheStream(filename, pattern, options) {
  const stream = new streams.DateRollingFileStream(
    filename,
    pattern,
    options
  );
  stream.on('error', (err) => {
    console.error('log4js.dateFileAppender - Writing to file %s, error happened ', filename, err); //eslint-disable-line
  });
  stream.on("drain", () => {
    process.emit("log4js:pause", false);
  });
  return stream;
}

/**
 * File appender that rolls files according to a date pattern.
 * @param filename base filename.
 * @param pattern the format that will be added to the end of filename when rolling,
 *          also used to check when to roll files - defaults to '.yyyy-MM-dd'
 * @param layout layout function for log messages - defaults to basicLayout
 * @param options - options to be passed to the underlying stream
 * @param timezoneOffset - optional timezone offset in minutes (default system local)
 */
function appender(
  filename,
  pattern,
  layout,
  options,
  timezoneOffset
) {
  // the options for file appender use maxLogSize, but the docs say any file appender
  // options should work for dateFile as well.
  options.maxSize = options.maxLogSize;

  const writer = openTheStream(filename, pattern, options);
  // 调整内容如下：功能
  // 1：缓冲区达到20时，刷新日志到文件
  // 2：连续10秒没有刷新时，输出到文件

  var bufferData = [];
  var interid  = 0;
  const flushlog = function(bufferData) {
    if(bufferData.length == 0) {
      return '';
    }
    var logStr = '';
    bufferData.forEach(function(item){ 
      logStr = logStr + layout(item, timezoneOffset) + eol;
    });
    if (!writer.write(logStr, "utf8")) {
      process.emit("log4js:pause", true);
    }
  }

  const app = function (logEvent) {
    if (!writer.writable) {
      return;
    }
    bufferData.push(logEvent);
    if(bufferData.length > 1000) {
      flushlog(bufferData);
      bufferData = [];
    } else {
      // 缓冲区不足，不输出
      if(interid == 0) {
        console.log('设置一次timeout')
        interid = setTimeout(function(){
            console.log('运行一次settimeout')
            interid = 0;
            flushlog(bufferData);
            bufferData = [];
        }, 30000);
      }
    }
  };
  // 调整内容over
  
  app.shutdown = function (complete) {
    writer.end('', 'utf-8', complete);
    clearInterval(interid);
  };

  return app;
}

function configure(config, layouts) {
  let layout = layouts.basicLayout;
  if (config.layout) {
    layout = layouts.layout(config.layout.type, config.layout);
  }

  if (!config.alwaysIncludePattern) {
    config.alwaysIncludePattern = false;
  }

  // security default (instead of relying on streamroller default)
  config.mode = config.mode || 0o600;

  return appender(
    config.filename,
    config.pattern,
    layout,
    config,
    config.timezoneOffset
  );
}

module.exports.configure = configure;
