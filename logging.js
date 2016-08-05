/**
 * Logging module.
 **/

var winston = require('winston');

function mockleFormatter(options) {
  if (options.level == 'info')
    return options.timestamp() + ' '+(undefined !== options.message?options.message:'');
  else
    return options.timestamp() + ' ['+options.level.toUpperCase() + '] '+(undefined !== options.message?options.message:'');
}

var getLogger = function(logfile) {
  winston.add(winston.transports.File, {
    filename: logfile,
    json: false,
    formatter: mockleFormatter,
    timestamp: function() {
        return Date.now();
      },
  });
  return winston;
}

module.exports = getLogger;
