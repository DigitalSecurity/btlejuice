/**
 * Main interceptor module.
 *
 * This is BtleJuice UI main controller, handling intercepted requests and forwarding them.
 **/

var Interceptor = function(){
  this.MODE_CONFIG = 'config';
  this.MODE_FORWARD = 'forward';
  this.MODE_INTERACTIVE = 'interactive';
  this.STATE_IDLING = 0;
  this.STATE_EDITING = 1;

  this.config = {
    status: 'disconnected',
    proxy: '',
    deviceId: '',
    devices: [],
    profile:null,
  };

  /* Current state. */
  this.state = this.STATE_IDLING;

  /* Options. */
  this.shouldReconnect = true;
  this.keepHandles = true;

  /* Registered hooks. */
  this.hooks = {};

  /* Pending requests. */
  this.pendingRequests = [];

  /* Forward everything by default. */
  this.mode = this.MODE_FORWARD;

  /* Main socket. */
  this.socket = io();
  this.socket.removeAllListeners();

  /* Transactions controller. */
  this.transactions = null;

  /* Event manager. */
  this.listeners = {};

  this.socket.on('app.status', function(status){
    console.log('got status notif:' + status);
    this.onStatusChange(status);
  }.bind(this));

  /* Install handlers. */
  this.setup();

  /* Ensure proxy is not connected to another device. */
  this.disconnect();
};

/**
 * setup()
 *
 * Installs event handlers.
 **/

Interceptor.prototype.setup = function() {
  /* Forward writes. */
  this.socket.on('proxy_write', function(s, c, d, o, w) {
    this.onProxyWrite(s, c, d, o, w);
  }.bind(this));


  /* Forward reads. */
  this.socket.on('proxy_read', function(s,c) {
    this.onProxyRead(s,c);
  }.bind(this));

  this.socket.on('proxy_notify', function(s, c, enable){
    this.onProxyNotify(s,c,enable);
  }.bind(this));

  this.socket.on('data', function(s,c,d){
    this.onNotification(s,c,d);
  }.bind(this));

  this.socket.on('app.target', function(target){
    this.onTargetChange(target);
  }.bind(this));

  this.socket.on('app.proxy', function(proxy){
    this.onProxyChange(proxy);
  }.bind(this));

  this.socket.on('target.profile', function(profile){
    this.onProfileChange(profile);
  }.bind(this));

  this.socket.on('app.connect', function(client){
    this.onClientConnect();
  }.bind(this));

  this.socket.on('app.disconnect', function(client){
    this.onClientDisconnect();
  }.bind(this));

  this.socket.on('device.disconnect', function(target){
    this.onRemoteDeviceDisconnected(target);
  }.bind(this));
}


Interceptor.prototype.clear = function() {
  this.socket.removeAllListeners();
};

/**
 * transaction()
 *
 * Keep track of a transaction (read, write, notify).
 **/

Interceptor.prototype.transaction = function(action, service, characteristic, data, disableRefresh) {
  if (this.transactions == null)
    this.transactions = angular.element(document.getElementById('transactions')).scope();

  this.transactions.addTransaction({
    op: action,
    service: service,
    characteristic: characteristic,
    data: buffer2hexII(data),
    dataHexii: buffer2hexII(data),
    dataHex: buffer2hex(data)
  }, disableRefresh);
};

Interceptor.prototype.setHook = function(service, characteristic, callback) {
  var key = service+':'+characteristic;
  this.hooks[key] = callback;
};

Interceptor.prototype.isHooked = function(service, characteristic) {
  var key = service+':'+characteristic;
  return (key in this.hooks);
};

Interceptor.prototype.removeHook = function(service, characteristic) {
  var key = service+':'+characteristic;
  if (key in this.hooks)
    delete this.hooks[key];
};

/**
 * proxyWriteResponse()
 *
 * Send write response to the proxy.
 **/

Interceptor.prototype.proxyWriteResponse = function(service, characteristic, error) {
  this.socket.emit('proxy_write_resp', service, characteristic, error);
};


/**
 * proxyReadResponse()
 *
 * Send read response to the proxy.
 **/

Interceptor.prototype.proxyReadResponse = function(service, characteristic, data, disableRefresh) {
  this.transaction('read', service, characteristic, data, disableRefresh);
  this.socket.emit('proxy_read_resp', service, characteristic, data);
};


/**
 * deviceWrite()
 *
 * Send the device a write request.
 **/

Interceptor.prototype.deviceWrite = function(service, characteristic, data, offset, withoutResponse, disableRefresh)  {
  /* Register our callback to send the response to the engine. */
  this.socket.once('ble_write_resp', function(s,c,e){
    this.socket.emit('proxy_write_resp', s,c,e);
  }.bind(this));

  /* Ask the proxy to perform the BLE write. */
  this.socket.emit('ble_write', service, characteristic, data, offset, withoutResponse);

  /* Add a transaction. */
  this.transaction('write', service, characteristic, data, disableRefresh);
};


/**
 * onProxyWrite()
 *
 * Event handler called when the proxy asks for a write request.
 **/

Interceptor.prototype.onProxyWrite = function(service, characteristic, data, offset, withoutResponse) {
  /* Forward mode ? */
  if (this.mode == this.MODE_FORWARD) {

    /* Should the request be edited before processing ? */
    var key = service+':'+characteristic;
    console.log(key);
    if (key in this.hooks) {
      if (this.hooks[key] == null) {
        console.log('>> manual hook found for '+key);
        if (this.state == this.STATE_EDITING) {
          this.pendingRequests.push({
            'action': 'write',
            'service': service,
            'characteristic': characteristic,
            'data': data,
            'offset': offset,
            'withoutResponse': withoutResponse
          });
        } else {
          /* Mark as editing. */
          this.state = this.STATE_EDITING;

          /* Open our edit box. */
          this.emit('hooks.write', service, characteristic, data, offset, withoutResponse);
        }
      } else {
        /* Apply our modifying function. */
        data = this.hooks[key](data);

        /* Send write to device. */
        this.deviceWrite(service, characteristic, data, offset, withoutResponse);
      }
    } else {
      console.log('>> forwarding write');
      this.deviceWrite(service, characteristic, data, offset, withoutResponse);
    }
  } else {
    if (this.state == this.STATE_EDITING) {
      this.pendingRequests.push({
        'action': 'write',
        'service': service,
        'characteristic': characteristic,
        'data': data,
        'offset': offset,
        'withoutResponse': withoutResponse
      });
    } else {
      /* Mark as editing. */
      this.state = this.STATE_EDITING;

      /* Open our edit box. */
      this.emit('hooks.write', service, characteristic, data, offset, withoutResponse);
    }
  }
}

/**
 * deviceRead()
 *
 * Send a read request to the target device.
 **/

Interceptor.prototype.deviceRead = function(service, characteristic, callback) {
  this.socket.once('ble_read_resp', function(s,c,data){
    /* Call the modifying callback. */
    callback(s, c, data);
  });
  this.socket.emit('ble_read', service, characteristic);
};


/**
 * onProxyRead()
 *
 * Event handler called when the proxy asks for a read request.
 **/

Interceptor.prototype.onProxyRead = function(service, characteristic) {
  /* Forward mode ? */
  if (this.mode == this.MODE_FORWARD) {
    console.log('>> forwarding read');
    this.deviceRead(service, characteristic, function(service, characteristic, data){

      /* Should we edit the data ? */
      var key = service+':'+characteristic;
      console.log(key);
      if (key in this.hooks) {
        if (this.hooks[key] == null) {
          if (this.state == this.STATE_EDITING)  {
            this.pendingRequests.push({
              'action': 'read',
              'service': service,
              'characteristic': characteristic,
              'data': data,
            });
          } else {
            /* Mark as editing. */
            this.state = this.STATE_EDITING;

            /* Ask the user to modify and forward. */
            this.emit('hooks.read', service, characteristic, data);
          }
        } else {
          data = this.hooks[key](data);
          this.proxyReadResponse(service, characteristic, data);
        }
      } else {
        /* Send response to our fake device. */
        this.proxyReadResponse(service, characteristic, data);
      }
    }.bind(this));
  } else {
    /* Send read to device. */
    this.deviceRead(service, characteristic, function(service, characteristic, data){
      if (this.state == this.STATE_EDITING)  {
        this.pendingRequests.push({
          'action': 'read',
          'service': service,
          'characteristic': characteristic,
          'data': data,
        });
      } else {
        /* Mark as editing. */
        this.state = this.STATE_EDITING;

        /* Ask the user to modify and forward. */
        this.emit('hooks.read', service, characteristic, data);
      }
    }.bind(this));
  }
};

/**
 * deviceNotify()
 *
 * Send a notify request to the target device.
 **/

Interceptor.prototype.deviceNotify = function(service, characteristic, enabled) {
  this.socket.once('ble_notify_resp', function(s,c,e){
    console.log('got notify_resp');

    /* Call the modifying callback. */
    this.socket.emit('proxy_notify_resp', s, c, e);
  }.bind(this));
  this.socket.emit('ble_notify', service, characteristic, enabled);
};

/**
 * onProxyNotify()
 *
 * Event handler called when the proxy registers for a notification.
 **/

Interceptor.prototype.onProxyNotify = function(service, characteristic, enabled) {
  console.log('>> forwarding notify');
  this.deviceNotify(service, characteristic, enabled);
};


/**
 * proxyNotifyData()
 *
 * Send a data notification to connected devices.
 **/

Interceptor.prototype.proxyNotifyData = function(service, characteristic, data, disableRefresh) {
  this.transaction('notification', service, characteristic, data, disableRefresh);
  this.socket.emit('proxy_data', service, characteristic, data);
};


/**
 * onNotification()
 *
 * Event handler called when the device sends a notification.
 **/

Interceptor.prototype.onNotification = function(service, characteristic, data) {
  console.log('>> got notification data');
  /* Forward mode ? */
  if (this.mode == this.MODE_FORWARD) {

    /* Should we edit the data ? */
    var key = service+':'+characteristic;
    console.log(key);
    if (key in this.hooks) {
      if (this.hooks[key] == null) {
        if (this.state == this.STATE_EDITING)  {
          this.pendingRequests.push({
            'action': 'notify',
            'service': service,
            'characteristic': characteristic,
            'data': data,
          });
        } else {
          /* Mark as editing. */
          this.state = this.STATE_EDITING;

          /* Ask the user to modify and forward. */
          this.emit('hooks.notify', service, characteristic, data);
        }
      } else {
        data = this.hooks[key](data);
        this.proxyNotifyData(service, characteristic, data);
      }
    } else {
      /* No hook, forward data. */
      console.log('>> forwarding data notification');
      this.proxyNotifyData(service, characteristic, data);
    }
  } else {
    if (this.state == this.STATE_EDITING)  {
      this.pendingRequests.push({
        'action': 'notify',
        'service': service,
        'characteristic': characteristic,
        'data': data,
      });
    } else {
      /* Mark as editing. */
      this.state = this.STATE_EDITING;

      /* Ask the user to modify and forward. */
      this.emit('hooks.notify', service, characteristic, data);
    }
  }
};

/**
 * processNextRequest()
 *
 **/
Interceptor.prototype.processNextRequest = function() {
  if (this.pendingRequests.length > 0) {
    if (this.mode == this.MODE_INTERACTIVE) {
      /* Send event to ask for modification. */
      var nextReq = this.pendingRequests.pop();

      /* Mark as editing. */
      this.state = this.STATE_EDITING;

      switch(nextReq.action) {
        case 'read':
          this.emit('hooks.read',
            nextReq.service,
            nextReq.characteristic,
            nextReq.data,
            true
          );
          break;

        case 'write':
          this.emit(
            'hooks.write',
            nextReq.service,
            nextReq.characteristic,
            nextReq.data,
            nextReq.offset,
            nextReqwithoutResponse,
            true
          );
          break;

        case 'notify':
          this.emit(
            'hooks.notify',
            nextReq.service,
            nextReq.characteristic,
            nextReq.data,
            true
          );
          break
      }
    } else {
      for (var req_idx in this.pendingRequests) {
        var req = this.pendingRequests[req_idx];
        if (req.action == 'write') {
          this.deviceWrite(
            req.service,
            req.characteristic,
            req.data,
            req.offset,
            req.withoutResponse
          );
        } else if (req.action == 'read') {
          this.proxyReadResponse(req.service, req.characteristic, req.data);
        } else if (req.action == 'notify') {
          this.proxyNotifyData(req.service, req.characteristic, req.data);
        }
      }
      /* No more pending requests. */
      this.pendingRequests = [];
      /* Mark as editing. */
      this.state = this.STATE_EDITING;
    }
  } else {
    this.state = this.STATE_IDLING;
  }
};


/**
 * setMode()
 *
 * Set the interceptor mode.
 **/

Interceptor.prototype.setMode = function(mode) {
  this.mode = mode;
};


/**
 * getMode()
 *
 * Get the interceptor mode.
 **/
Interceptor.prototype.getMode = function() {
  return this.mode;
};

Interceptor.prototype.isInteractive = function() {
  return (this.mode == this.MODE_INTERACTIVE);
}

/**
 * scanDevices()
 *
 * Set the interceptor in config mode and lists devices.
 **/
Interceptor.prototype.listDevices = function(callback) {
  this.clear();
  this.socket.on('peripheral', function(p, name, rssi){
      console.log('got peripheral');
      callback(p, name, rssi);
  });
  this.socket.emit('scan_devices');
};

/**
 * selectTarget()
 *
 * Select a given device as a target.
 **/
Interceptor.prototype.selectTarget = function(target, callback) {
  this.clear();

  this.socket.on('app.status', function(status){
    console.log('got status notif:' + status);
    this.onStatusChange(status);
  }.bind(this));

  this.socket.once('profile', function(profile){
    this.onProfileChange(profile);
  }.bind(this));


  /* We wait until the proxy is ready. */
  this.socket.once('ready', function(){
    /* Notify we're connected to the selected target. */
    callback(true);

    /* Setup the interceptor. */
    this.setup();
  }.bind(this));

  /* Asks the proxy to select the correct target with correct options. */
  this.socket.emit('target', target, this.keepHandles);
};

Interceptor.prototype.disconnect = function() {
  this.socket.emit('stop');
  this.emit('app.status', 'disconnected');
};

Interceptor.prototype.getConfig = function(){
  return this.config;
};

Interceptor.prototype.getProfile = function() {
  return this.config.profile;
};

Interceptor.prototype.onProfileChange = function(profile) {
  /* Save profile. */
  this.config.profile = profile;

  /* Notify listerners. */
  this.emit('target.profile', profile);
};

Interceptor.prototype.onStatusChange = function(status) {
  /* Save status. */
  this.config.status = status;

  /* Notify listeners. */
  this.emit('status.change', status);
};

Interceptor.prototype.onTargetChange = function(target) {
  /* Save status. */
  this.config.target = target;

  /* Notify listeners. */
  this.emit('target.change', target);
};

Interceptor.prototype.onProxyChange = function(proxy) {
  /* Save status. */
  this.config.proxy = proxy;

  /* Notify listeners. */
  this.emit('proxy.change', proxy);
};

Interceptor.prototype.on = function() {
  return this.config;
};

Interceptor.prototype.onClientConnect = function(clientAddress) {
  this.transaction('event','connect', clientAddress);
};

Interceptor.prototype.onClientDisconnect = function(clientAddress) {
  this.transaction('event','disconnect', clientAddress);
};

Interceptor.prototype.onRemoteDeviceDisconnected = function(target) {
  /* Client has been disconnected for sure :) */
  this.transaction('event','disconnect', null);

  /* Based on settings, asks the proxy to connect again. */
  if (this.shouldReconnect) {
    this.selectTarget(target,function(){
      console.log('Target reselected !');
    });
  }
};

Interceptor.prototype.on = function(queueName, callback) {
  if (!(queueName in this.listeners))
    this.listeners[queueName] = [];
  this.listeners[queueName].push(callback);
};

Interceptor.prototype.emit = function() {
  var queueName = arguments[0];
  for (var listener in this.listeners[queueName]) {
    var callback = this.listeners[queueName][listener];
    callback.apply(callback, Array.from(arguments).splice(1,arguments.length));
  }
};

var interceptor = new Interceptor();
