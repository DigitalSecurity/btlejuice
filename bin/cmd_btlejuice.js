#! /usr/bin/env node

/**
 * btlejuice
 *
 * This command-line tool may be used to launch the btlejuice core interception.
 * Available options:
 *  -i <iface>      HCI interface to use for dummy device.
 *  -u <proxy url>  Proxy hostname/IP address (default: localhost)
 *  -f              Follow disconnection
 *  -p <proxy port> Proxy Port (default 8000)
 *  -w              Enable Web UI
 *  -s <web port>   Web UI port
 **/

var argparse = require('argparse');
var BtleJuiceCore = require('../core');
const colors = require('colors');
const util = require('util');
var btim = require('btim');

/**
 * Release version
 **/

/**
 * Command-line tool
 **/
var parser = new argparse.ArgumentParser({
  version: '1.1.4',
  addHelp: true,
  description: 'BtleJuice core & web interface'
});
parser.addArgument(['-i', '--iface'], {
  help: 'Bluetooth interface to use for device emulation (hciX or the interface number)',
});
parser.addArgument(['-u', '--proxy'], {
  help: 'Target BtleJuice proxy IP or hostname (default: localhost)',
  required: false,
});
parser.addArgument(['-p', '--port'], {
  help: 'Target BtleJuice proxy port (default: 8000)',
  required: false,
});
parser.addArgument(['-w', '--web'], {
  help: 'Enable web UI',
  required: false,
  action: 'storeTrue',
  default: false
});
parser.addArgument(['-s', '--web-port'], {
  help: 'Specify Web UI port',
  required: false,
  default: 8080
});
parser.addArgument(['-m', '--mac'], {
  help: 'Spoof the MAC address with a new one',
  required: false,
});

args = parser.parseArgs();

console.log('   ___ _   _       __        _          ');
console.log('  / __\\ |_| | ___  \\ \\ _   _(_) ___ ___ ');
console.log(' /__\\// __| |/ _ \\  \\ \\ | | | |/ __/ _ \\');
console.log('/ \\/  \\ |_| |  __/\\_/ / |_| | | (_|  __/');
console.log('\\_____/\\__|_|\\___\\___/ \\__,_|_|\\___\\___|');
console.log('');

/* Build proxy URL. */
var proxyUrl = 'http://';
if (args.proxy != null) {
  proxyUrl += args.proxy;
} else {
  proxyUrl += 'localhost';
}
if (args.port != null) {
  var proxyPort = parseInt(args.port);
  if ((proxyPort < 0) || (proxyPort > 65535)) {
    console.log('[!] Bad proxy port provided'.red);
    process.exit(-1);
  }
  proxyUrl += ':'+parseInt(args.port);
} else {
  proxyUrl += ':8000';
}
console.log(util.format('[i] Using proxy %s', proxyUrl).bold);

/* Select web UI port */
if (args.web_port != null) {
    var uiPort = parseInt(args.web_port);
} else {
    var uiPort = 8080;
}

var iface; /* Globally defined to use it also for mac spoofing */

/* Define bluetooth interface. */
if (args.iface != null) {
  iface = parseInt(args.iface);

  /* Iface not a number, consider a string. */
  if (isNaN(iface)) {
    /* String has to be hciX */
    var re = /^hci([0-9]+)$/i;
    var result = re.exec(args.iface);
    if (result != null) {
        /* Keep the interface number. */
        var iface = result[1];
        btim.up(parseInt(iface));
    } else {
        console.log(util.format('[!] Unknown interface %s', args.iface).red);
        process.exit(-1);
    }
  }

  /* Set up BLENO_HCI_DEVICE_ID. */
  process.env.BLENO_HCI_DEVICE_ID = iface;
} else {
  iface = 0;
}
console.log(util.format('[i] Using interface hci%d', iface).bold);

if (args.mac != null && args.iface != null) {
  var mac_regex = /^(([A-Fa-f0-9]{2}[:]){5}[A-Fa-f0-9]{2}[,]?)+$/;
  if (mac_regex.test(args.mac)) {
      iface = parseInt(iface);
      if (btim.up(iface) != 0) {
          console.log(util.format('[!] The interface wasn\'t brought up: %s', args.iface).red);
          process.exit(-1);
      }
      if (btim.spoof_mac(iface, args.mac) != 0) {
          console.log(util.format('[!] The MAC address wasn\'t successfully spoofed: %s', args.mac).red);
          process.exit(-1);
      }
      console.log(util.format('[i] MAC address successfully spoofed: %s', args.mac).bold);
  } else {
      console.log(util.format('[!] The provided MAC address isn\t valid: %s', args.mac).red);
      process.exit(-1);
  }
}

/* Set advertisement interval to minimum value (20ms). */
process.env.BLENO_ADVERTISING_INTERVAL = 20;

/* Create our core. */
var enableWebServer = args.web;
var core = new BtleJuiceCore(proxyUrl, enableWebServer, uiPort, iface);
