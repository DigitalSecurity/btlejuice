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
var optional = require('optional');
var proxy = require('../proxy');
const colors = require('colors');
const util = require('util');
var btim = optional('btim');

/**
 * Command-line tool
 **/
var parser = new argparse.ArgumentParser({
  version: '1.1.7',
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

/* Add additional options if the module btim is present. */
if (btim != null) {
  parser.addArgument(['-l', '--list'], {
    help: 'List bluetooth interfaces',
    required: false,
    action: 'storeTrue',
    default: false
  });
}

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
        /* Bring up an interace only if the module btim is present. */
        if (btim != null) {
          btim.up(parseInt(iface));
        }
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

/* Add implementation of additional options if the module btim is present. */
if (btim != null) {
  if (args.list) {
    function display_interface(item) {
      for (property in item) {
        console.log(util.format('%s\tType: %s  Bus: %s  BD Address: %s  ' +
          'ACL MTU: %s  SCO MTU: %s\n\t%s\n\t' +
          'RX: bytes: %s  ACL: %s  SCO: %s  events: %s  errors: %s\n\t' +
          'TX: bytes: %s  ACL: %s  SCO: %s  events: %s  errors: %s\n',
          property,
          item[property]['type'],
          item[property]['bus'],
          item[property]['address'],
          item[property]['acl_mtu'],
          item[property]['sco_mtu'],
          item[property]['status'],
          item[property]['rx']['bytes'],
          item[property]['rx']['acl'],
          item[property]['rx']['sco'],
          item[property]['rx']['events'],
          item[property]['rx']['errors'],
          item[property]['tx']['bytes'],
          item[property]['tx']['acl'],
          item[property]['tx']['sco'],
          item[property]['tx']['events'],
          item[property]['tx']['errors']).bold);
      }
    }

    console.log(util.format('[info] Listing bluetooth interfaces...\n').green);
    var interfaces = btim.list();

    for (var i = 0; i < interfaces.length; i++) {
      display_interface(interfaces[i]);
    }
    process.exit(0);
  }
}

/* Create our core. */
(new proxy({
  port: proxyPort,
})).start();
