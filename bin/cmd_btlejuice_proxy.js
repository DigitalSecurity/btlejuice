#! /usr/bin/env node

/**
 * btlejuice
 *
 * This command-line tool may be used to launch the btlejuice core interception.
 * Available options:
 *  -i <iface>      HCI interface to use for dummy device.
 *  -p <proxy port> Proxy Port (default 8000)
 **/

var argparse = require('argparse');
var proxy = require('../proxy');
const colors = require('colors');
const util = require('util');

/**
 * Command-line tool
 **/
var parser = new argparse.ArgumentParser({
  version: '1.1.5',
  addHelp: true,
  description: 'BtleJuice proxy'
});
parser.addArgument(['-i', '--iface'], {
  help: 'Bluetooth interface to use for device connection',
});
parser.addArgument(['-p', '--port'], {
  help: 'BtleJuice proxy port (default: 8000)',
  required: false,
});
args = parser.parseArgs();


/* Define bluetooth interface. */
if (args.iface != null) {
  var iface = parseInt(args.iface);

  /* Iface not a number, consider a string. */
  if (isNaN(iface)) {
    /* String has to be hciX */
    var re = /^hci([0-9]+)$/i;
    var result = re.exec(args.iface);
    if (result != null) {
        /* Keep the interface number. */
        var iface = result[1];
    } else {
        console.log(util.format('[!] Unknown interface %s', args.iface).red);
        process.exit(-1);
    }
  }

  /* Set up BLENO_HCI_DEVICE_ID. */
  process.env.NOBLE_HCI_DEVICE_ID = iface;
} else {
  iface = 0;
}
console.log(util.format('[i] Using interface hci%d', iface).bold);

if (args.port != null) {
  var proxyPort = parseInt(args.port);
  if ((proxyPort < 0) || (proxyPort > 65535)) {
    console.log('[!] Bad proxy port provided'.red);
    process.exit(-1);
  }
} else {
  proxyPort = 8000;
}

/* Create our core. */
(new proxy({
  port: proxyPort,
})).start();
