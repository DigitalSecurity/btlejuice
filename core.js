/**
 * BtleJuice Core module
 *
 * The App class takes a device profile in input and create a pure NodeJS
 * clone uppon which high-level behaviors may be implemented.
 **/
var async = require('async');
var events = require('events');
var util = require('util');
var colors = require('colors');
const winston = require('winston');
var io = require('socket.io-client');
var logging = require('./logging');
const path = require('path');
const express = require('express');
const http = require('http');
const exec = require('child_process').exec;

/**
 * Core app.
 **/

var App = function(proxyUrl, enableWebServer, webServerPort, iface) {
  events.EventEmitter.call(this);

  /* Save status. */
  this.status = 'disconnected';
  this.target = null;
  this.profile = null;
  this.server = null;

  /* Web server options. */
  this.webEnabled = (enableWebServer === true);
  if (webServerPort != null)
    this.webServerPort = webServerPort;
  else
    this.webServerPort = 8080;

  /* Save proxy URL */
  this.proxyUrl = proxyUrl;
  this.connectProxy();

  /* Logger */
  this.logger = new (winston.Logger)({
    transports: [
      new (winston.transports.Console)({
        level: 'debug',
        colorize: true,
        timestamp: true,
        prettyPrint: true
      })
    ]
  });
  winston.addColors({
    info: 'green',
    warning: 'orange',
    error: 'red',
    debug: 'purple'
  });

  /* Disable the bluetooth service if it is enabled. */
  this.disableBluetoothService(iface);

};

util.inherits(App, events.EventEmitter);

App.prototype.createServer = function() {
  var app = express();
  var server = http.Server(app);

  /* Check server */
  if (this.server != null) {
    this.server.close();
  }
  this.server = require('socket.io')(server);

  this.clients = [];

  /* Basic webserver. */
  if (this.webEnabled) {
    app.set('view engine','ejs');
    app.set('views', __dirname + '/views');
    app.use(express.static(__dirname + '/resources'))
      .get('/', function(req, res){
        res.render('index.ejs');
      });
  }
  server.listen(this.webServerPort);

  /* Handles client connection. */
  this.server.sockets.on('connection', function(socket){
    this.onClientConnection(socket);
  }.bind(this));

};


App.prototype.onClientConnection = function(client) {
  /**
   * Forward scan_devices to proxy.
   **/

  /* Save client. */
  this.clients.push(client);

  /* Notify client of our current config. */
  this.setProxy(this.proxyUrl);
  this.setStatus(this.status);
  this.setTarget(this.target);
  this.setProfile(this.profile);

  /* Disconnection handler. */
  client.on('disconnect', (function(t, c){
    return function(){
      c.removeAllListeners();
      var index = t.clients.indexOf(c);
      if (index > -1)
        t.clients.splice(index);
    };
  })(this, client));

  client.on('scan_devices', function(){
    /* Install device discovery handler. */
    this.proxy.removeAllListeners('discover');
    this.proxy.on('discover', function(p, name, rssi){
      client.emit('peripheral', p, name, rssi);
    }.bind(this));

    /* Ask for devices discovery. */
    this.proxy.emit('scan_devices');
  }.bind(this));


  /**
   * Forward status to proxy.
   **/

  client.on('status', function(){
    this.proxy.emit('status');
  }.bind(this));


  /**
   * Handles target connection.
   **/

  client.on('target', function(target, keepHandles){
    this.setStatus('connecting');
    this.setTarget(target);
    this.send('app.status', 'connecting');

    /* Set the keepHandles option internally. */
    this.keepHandles = keepHandles;

    /* Forward to target, create mock on callback. */
    this.proxy.emit('target', target);
  }.bind(this));

  /**
   * Handles stop.
   **/

  client.on('stop', function(){
    this.setStatus('disconnected');

    /* Forward to target, create mock on callback. */
    if (this.fake != null) {
      this.fake.stop();
      this.fake = null;
    }
    this.proxy.emit('stop');
    client.emit('app.status', 'disconnected');
  }.bind(this));

  /**
   * Forward profile data to app.
   **/
  this.proxy.removeAllListeners('profile');
  this.proxy.on('profile', function(p){
    this.profile = p;
    client.emit('profile', p);

    this.createFakeDevice(p);
  }.bind(this));

  this.proxy.on('stopped', function(){
    this.setStatus('disconnected');

    /* Forward to target, create mock on callback. */
    if (this.fake != null) {
      this.fake.stop();
      this.fake = null;
    }

    client.emit('app.status', 'disconnected');
  }.bind(this));

  /**
   * Forward ready message to app.
   **/

  this.proxy.removeAllListeners('ready');
  this.proxy.on('ready', function(){
    this.status = 'connected';

    this.logger.info('proxy set up and ready to use =)');
    client.emit('ready');
    client.emit('app.status', 'connected');
    client.emit('app.target', this.target);
  }.bind(this));

  this.proxy.on('ble_data', function(service, characteristic, data){
    this.logger.debug('Data notification for service %s and charac. %s (ble_data)', service, characteristic);
    client.emit('data', service, characteristic, data);
  }.bind(this));

  /**
   * Forward write message to proxy.
   **/
  client.on('ble_write', function(service, characteristic, data){
    this.proxy.once('ble_write_resp', function(s,c, error){
      client.emit('ble_write_resp', service, characteristic, error);
    }.bind(this));
    this.proxy.emit('ble_write', service, characteristic, data, false)
  }.bind(this));

  /**
   * Forward read message to proxy
   **/
  client.on('ble_read', function(service, characteristic){
    this.proxy.once('ble_read_resp', function(s, c, data){
      client.emit('ble_read_resp', service, characteristic, data);
    }.bind(this));

    this.proxy.emit('ble_read', service, characteristic, 0);
  }.bind(this));

  /**
   * Forward notify message to proxy
   **/
  client.on('ble_notify', function(service, characteristic, enabled){
    this.proxy.once('ble_notify_resp', function(){
      client.emit('ble_notify_resp', service, characteristic);
    }.bind(this));
    this.proxy.emit('ble_notify', service, characteristic, enabled);
  }.bind(this));

  /*
  client.on('data', function(service, characteristic, data){
    this.logger.debug('Forward data notification for service %s and charac. %s (data)', s, c);
    this.fake.emit('data', service, characteristic, data);
});*/

  client.on('proxy_notify_resp', function(s,c, error) {
    this.fake.emit('notify_resp', s, c, error);
  }.bind(this));

  client.on('proxy_data', function(s,c,d){
    this.logger.debug('Forward data notification for service %s and charac. %s (proxy_data)', s, c);
    this.fake.emit('data', s,c,d);
  }.bind(this));

  client.on('proxy_read_resp', function(s, c, data) {
    this.fake.emit('read_resp', s, c, data);
  }.bind(this));

  client.on('proxy_write_resp', function(s, c, error) {
    this.fake.emit('write_resp', s, c, error);
  }.bind(this));

};

/**
 * Send message to clients.
 **/

App.prototype.send = function(){
  for (var client in this.clients) {
    this.clients[client].emit.apply(
      this.clients[client],
      arguments
    );
  }
};

/**
 * connectProxy()
 *
 * Connect the mock to a given proxy in order to relay services and
 * characteristics.
 */

App.prototype.connectProxy = function(){
  /* Connect to the proxy. */
  this.proxy = io(this.proxyUrl);
  this.proxy.on('connect', function(){
    this.logger.info('successfully connected to proxy');

    /* Create local server. */
    this.createServer();

  }.bind(this));

  /* Error message if connection fails. */
  this.proxy.on('connect_error', function(){
    this.logger.error('cannot connect to proxy.');
    process.exit(-1);
  }.bind(this));

  /* Error message if remote device disconnects. */
  this.proxy.on('device.disconnect', function(target){
    this.logger.warn('remote device has disconnected.');
    this.onRemoteDeviceDisconnected(target);
  }.bind(this));
};

App.prototype.createFakeDevice = function(profile) {
  const fake = require('./fake');
  this.fake = new fake(profile, this.keepHandles);

  /* Listen for events on this fake device, and notify the web interface. */
  this.fake.on('write', function(service, characteristic, data, offset, withoutResponse){
    /* Notify our client we got a write request. */
    this.send('proxy_write', service, characteristic, data, offset, withoutResponse);
  }.bind(this));

  /* Listen for events on this fake device, and notify the web interface. */
  this.fake.on('read', function(service, characteristic, offset){
    /* Notify our client we got a write request. */
    this.send('proxy_read', service, characteristic, offset);
  }.bind(this));

  this.fake.on('notify', function(service, characteristic, enable){
    this.send('proxy_notify', service, characteristic, enable);
  }.bind(this));

  this.fake.on('connect', function(client) {
    this.send('app.connect', client);
  }.bind(this));

  this.fake.on('disconnect', function(client) {
    this.send('app.disconnect', client);
  }.bind(this));

};

App.prototype.setStatus = function(status) {
  /* Save status. */
  this.status = status;

  /* Notify status change to clients. */
  this.send('app.status', status);
};

App.prototype.setTarget = function(target) {
  this.send('app.target', target);
  this.target = target;
};

App.prototype.setProxy = function(proxy) {
  this.send('app.proxy', proxy);
};

App.prototype.setProfile = function(profile) {
  this.send('target.profile', profile);
};

App.prototype.disableBluetoothService = function(iface) {
  /* First, check if the service exists and is running. */
  exec('service bluetooth status', function(error, stdout, stderr){
    if (stdout.indexOf(': active') >= 0) {
      /* Service is active, shut it down. */
      this.logger.info('Stopping BT service ...');
      exec('service bluetooth stop', function(error, stdout, stderr){
        setTimeout(function(){
          /* Re-enable our HCI interface. */
          if (iface == null)
            iface = 0;
          this.logger.info('Making sure interface hci%d is up ...', iface);
          exec(util.format('hciconfig hci%d up', iface));
        }.bind(this), 2000);
      }.bind(this));
    }
  }.bind(this));
};

App.prototype.onRemoteDeviceDisconnected = function(target) {
  this.setStatus('disconnected');

  /* Forward to target, create mock on callback. */
  if (this.fake != null) {
    this.fake.stop();
    this.fake = null;
  }
  this.proxy.emit('stop');
  this.send('app.status', 'disconnected');

  /* Notify client. */
  this.send('device.disconnect', target);
};

if (!module.parent) {
  var b = new App('http://127.0.0.1:8000', true, 8080);
} else {
module.exports = App;
}
