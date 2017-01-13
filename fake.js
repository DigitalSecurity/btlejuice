/**
 * BtleJuice fake device
 *
 * This module provides the FakeDevice class that simulates an existing
 * device based on its profile (as detected by the proxy), and allows
 * interaction with real-world applications and other devices.
 **/

var bleno = require('bleno');
var async = require('async');
var events = require('events');
var util = require('util');
var colors = require('colors');
var winston = require('winston');

var FakeDevice = function(profile, keepHandles) {
  events.EventEmitter.call(this);

  /* Save logger if any. */
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
    trace: 'magenta',
    input: 'grey',
    verbose: 'cyan',
    prompt: 'grey',
    debug: 'blue',
    info: 'green',
    data: 'grey',
    help: 'cyan',
    warn: 'yellow',
    error: 'red'
  });

  /* Update callbacks. */
  this.subsCallbacks = {};

  /* Propagate bleno constants. */
  this.RESULT_SUCCESS = bleno.Characteristic.RESULT_SUCCESS;
  this.RESULT_INVALID_OFFSET = bleno.Characteristic.RESULT_INVALID_OFFSET;
  this.RESULT_INVALID_ATTRIBUTE_LENGTH = bleno.Characteristic.RESULT_INVALID_ATTRIBUTE_LENGTH;
  this.RESULT_UNLIKELY_ERROR = bleno.Characteristic.RESULT_UNLIKELY_ERROR;

  /* Remove all bleno listeners. */
  bleno.removeAllListeners('advertisingStart');
  bleno.removeAllListeners('accept');
  bleno.removeAllListeners('disconnect');
  bleno.removeAllListeners('stateChange');

  /* Keep handles option. */
  if ((keepHandles != null) && (keepHandles != false))
    this.keepHandles = true;

  /* Set services as described in config file. */
  this.services = [];
  for (var service in profile['services']) {
    /* Get service information. */
    var _service = profile['services'][service];

    /* Create the service structure. */
    var service_details = {
      uuid: _service['uuid'],
      characteristics: [],
    };

    /* Add characteristics. */
    for (var charac in _service['characteristics']) {
      var service_char_item = {};
      service_char_item['uuid'] = _service['characteristics'][charac]['uuid'];
      service_char_item['properties'] = _service['characteristics'][charac]['properties'];
      service_char_item['descriptors'] = [];
      for (var desc in _service['characteristics'][charac]['descriptors']) {
        service_char_item['descriptors'].push(
          new bleno.Descriptor({
            uuid: _service['characteristics'][charac]['descriptors'][desc].uuid
          })
        );
      }

      /* Install characteristic read callback if required. */
      if (service_char_item['properties'].indexOf('read') > -1) {
        service_char_item['onReadRequest'] = (function(_this, service, characteristic){
          return function(offset, callback) {
            _this.onRead(service, characteristic, offset, callback);
          }
        })(this, _service['uuid'], _service['characteristics'][charac]['uuid']);
      }

      /* Install characteristic write callback if required. */
      if ((service_char_item['properties'].indexOf('write') > -1)) {
        service_char_item['onWriteRequest'] = (function(_this, service, characteristic){
          return function(data, offset, withoutResponse, callback){
            _this.onWrite(service, characteristic, data, offset, withoutResponse, callback);
          }
        })(this, _service['uuid'], _service['characteristics'][charac]['uuid']);
      }

      /* Install characteristic write callback if required. */
      if ((service_char_item['properties'].indexOf('writeWithoutResponse') > -1)) {
        service_char_item['onWriteRequest'] = (function(_this, service, characteristic){
          return function(data, offset, withoutResponse, callback){
            _this.onWrite(service, characteristic, data, offset, withoutResponse, callback);
          }
        })(this, _service['uuid'], _service['characteristics'][charac]['uuid']);
      }


      /* Install characteristic notify callback if required. */
      if (service_char_item['properties'].indexOf('notify') > -1) {
        service_char_item['onSubscribe'] = (function(_this, service, characteristic){
          return function(maxValueSize, updateValueCallback){
            _this.onSubscribe(service, characteristic, maxValueSize, updateValueCallback);
          }
        })(this, _service['uuid'], _service['characteristics'][charac]['uuid']);
        service_char_item['onUnsubscribe'] = (function(_this, service, characteristic){
          return function(){
            _this.onUnsubscribe(service, characteristic);
          }
        })(this, _service['uuid'], _service['characteristics'][charac]['uuid']);
        service_char_item['onNotify'] = (function(_this, service, characteristic){
          return function(maxValueSize, updateValueCallback){
            _this.onNotify(service, characteristic);
          }
        })(this, _service['characteristics'][charac]['uuid']);
      }

      /* Register the service in bleno. */
      service_details['characteristics'].push(
        new bleno.Characteristic(service_char_item)
      );
    }

    this.services.push(new bleno.PrimaryService(service_details));
  }

  /* Advertise our mocked device. */
  if (profile['scan_data'] != null) {
    var scan_data = new Buffer(profile['scan_data'], 'hex');
  } else {
    var scan_data = null;
  }

  bleno.on('advertisingStart', (function(_this){
    return function(error){
      if (!error) {
        //console.log('[setup] services registered'.yellow);
        _this.logger.info('BTLE services registered');

        /* Register services. */
        bleno.setServices(_this.services);

        /* Fix handles. */
        if (_this.keepHandles) {
          _this.logger.info('Fixing Bleno handles ...');
          _this.fixBlenoHandles(profile, _this.services);
        }

      } else {
        //console.log('[setup] error while registering services !'.red);
        _this.logger.error('cannot register services !');
      }
    };
  })(this));

  // Notify the console that we've accepted a connection
  bleno.on('accept', function(clientAddress) {
      //console.log(("[ mock] accepted connection from address: " + clientAddress).green);
      this.logger.info('dummy: accepted connection from address: %s', clientAddress);
      this.emit('connect', clientAddress);
  }.bind(this));

  // Notify the console that we have disconnected from a client
  bleno.on('disconnect', function(clientAddress) {
      this.logger.info('dummy: disconnected from address: %s', clientAddress);

      /* Remove existing notification related callbacks. */
      this.subsCallbacks = {};

      /* Notify disconnection. */
      this.emit('disconnect', clientAddress);
  }.bind(this));


  /* Monitor state change. */
  bleno.on('stateChange', (function(_this, adv_data, scan_data){
    return function(state){
      if (state === 'poweredOn') {
        //console.log('Start advertising ...'.bold);
        _this.logger.debug('start advertising');
        bleno.startAdvertisingWithEIRData(adv_data, scan_data);
      } else {
        bleno.stopAdvertising();
      }
    };
  })(this, new Buffer(profile['ad_records'], 'hex'), scan_data));

  /* If already poweredOn, then start advertising. */
  if (bleno.state === 'poweredOn') {
    //console.log('Start advertising ...'.bold);
    this.logger.debug('start advertising');
    bleno.startAdvertisingWithEIRData(new Buffer(profile['ad_records'], 'hex'), scan_data);
  } else {
    bleno.stopAdvertising();
  }

  this.on('data', function(service, characteristic, data){
    var uvCallback = this.getCallback(service, characteristic);
    if (uvCallback != null) {
      this.logger.info(('!! ['+service+':'+characteristic+']>> '+new Buffer(data).toString('hex')));
      uvCallback(data);
  } else {
      this.logger.info(('/!\\ Callback not found !').red);
  }

  }.bind(this));

};

util.inherits(FakeDevice, events.EventEmitter);

/**
 * fixBlenoHandles()
 *
 * Fix bleno handles in order to avoid Gatt Cache issues.
 */
FakeDevice.prototype.fixBlenoHandles = function(profile, services) {
  /* Target handles array. */
  var patchedHandles = [];

  /* Find services' start and end handles. */
  for (var i=0; i < profile.services.length; i++) {
    var service = profile.services[i];
    var p_service = services[i];

    patchedHandles[service.startHandle] = {
      type: 'service',
      uuid: service.uuid,
      attribute: services[i],
      startHandle: service.startHandle,
      endHandle: service.endHandle
    };

    for (var j=0; j<service.characteristics.length; j++) {
      var characteristic = service.characteristics[j];
      var p_characteristic = services[i].characteristics[j];

      var properties = 0;
      var secure = 0;

      if (p_characteristic.properties.indexOf('read') !== -1) {
        properties |= 0x02;

        if (p_characteristic.secure.indexOf('read') !== -1) {
          secure |= 0x02;
        }
      }

      if (p_characteristic.properties.indexOf('writeWithoutResponse') !== -1) {
        properties |= 0x04;

        if (p_characteristic.secure.indexOf('writeWithoutResponse') !== -1) {
          secure |= 0x04;
        }
      }

      if (p_characteristic.properties.indexOf('write') !== -1) {
        properties |= 0x08;

        if (p_characteristic.secure.indexOf('write') !== -1) {
          secure |= 0x08;
        }
      }

      if (p_characteristic.properties.indexOf('notify') !== -1) {
        properties |= 0x10;

        if (p_characteristic.secure.indexOf('notify') !== -1) {
          secure |= 0x10;
        }
      }

      if (p_characteristic.properties.indexOf('indicate') !== -1) {
        properties |= 0x20;

        if (p_characteristic.secure.indexOf('indicate') !== -1) {
          secure |= 0x20;
        }
      }

      patchedHandles[characteristic.startHandle] = {
        type: 'characteristic',
        uuid: characteristic.uuid,
        properties: properties,
        secure: secure,
        attribute: p_characteristic,
        startHandle: characteristic.startHandle,
        valueHandle: characteristic.valueHandle,
        endHandle: characteristic.endHandle
      };

      patchedHandles[characteristic.valueHandle] = {
        type: 'characteristicValue',
        handle: characteristic.valueHandle,
        value: characteristic.value
      };

      /**
       * Reorder descriptors to fit the structure expected by Bleno.
       *
       * Some descriptors may see their handles changed and it could cause
       * some trouble for an Android GATT cache, but it is limited to
       * notifications.
       **/
      var descriptorsHandles = [];
      var descriptorsObjects = [];


      /* First, split descriptor handles and objects. */
      for (var k = 0; k < characteristic.descriptors.length; k++) {
        var descriptor = characteristic.descriptors[k];
        var p_descriptor = services[i].characteristics[j].descriptors[k];

        descriptorsHandles.push(descriptor.handle);
        if (descriptor.uuid == '2902') {
            var descObject = {
                type: 'descriptor',
                handle: null,
                uuid: '2902',
                attribute: p_characteristic,
                properties: (0x02 | 0x04 | 0x08), // read/write
                secure: (secure & 0x10) ? (0x02 | 0x04 | 0x08) : 0,
                value: new Buffer([0x00, 0x00])
            };
            descriptorsObjects.unshift(descObject);
        } else {
            var descObject = {
                type: 'descriptor',
                handle: null,
                uuid: descriptor.uuid,
                attribute: p_descriptor,
                properties: 0x02, // read only
                secure: 0x00,
                value: descriptor.value
            };
            descriptorsObjects.push(descObject);
        }
      }

      /* Then re-associate handles. */
      for (var k = 0; k < characteristic.descriptors.length; k++) {
          descriptorsObjects[k].handle = descriptorsHandles[k];
          patchedHandles[descriptorsHandles[k]] = descriptorsObjects[k];
      }

    }
  }

  bleno._bindings._gatt._handles = patchedHandles;
}



/**
 * stop()
 *
 * Stop fake device.
 **/

FakeDevice.prototype.stop = function() {
  bleno.stopAdvertising();
  this.removeAllListeners();
  bleno.disconnect();
};


/**
 * FakeDevice default handlers.
 **/

FakeDevice.prototype.onRead = function(service, characteristic, offset, callback) {
  this.logger.info('[READ][%s][%s]', service, characteristic);

  /* Install a callback to propagate the response. */
  this.once('read_resp', function(_service, _characteristic, _data){
    if ((_service == service) && (_characteristic == characteristic)) {
      //this.logger.debug('Read value: %s', _data);
      callback(this.RESULT_SUCCESS, _data);
    }
  }.bind(this));

  /* Notify that a read operation has occured. */
  this.emit('read', service, characteristic, offset);
};

/**
 * onWrite()
 *
 * Called when a connected device asks for a write operation.
 **/

FakeDevice.prototype.onWrite = function(service, characteristic, data, offset, withoutResponse, callback) {
  this.logger.info('[WRITE][%s][%s]', service, characteristic);

  /* Install a callback to propagate the response. */
  this.once('write_resp', function(_service, _characteristic, error){
    if ((_service == service) && (_characteristic == characteristic)) {
      if ((error == null) && !withoutResponse)
        callback(this.RESULT_SUCCESS);
      else if ((error != null) && !withoutResponse)
        callback(this.RESULT_UNLIKELY_ERROR);
    }
  }.bind(this));

  /* Notify that a write operation has occured. */
  this.emit('write', service, characteristic, new Buffer(data), offset, withoutResponse);
};

/**
 * onSubscribe()
 *
 * Called when a connected device subscribes for notification to a specific
 * characteristic
 */

FakeDevice.prototype.onSubscribe = function(service, characteristic, maxValueSize, updateValueCallback) {
  this.logger.info('[NOTIFY][%s][%s]', service, characteristic);

  /* Install a callback to propagate the response. */
  this.registerNotifyCallback(service, characteristic, updateValueCallback);

  /* Notify a notify operation has occured. */
  this.emit('notify', service, characteristic, true);
};

/**
 * onUnsubscribe()
 *
 * Called when a connected device unsubscribes for notification.
 **/

FakeDevice.prototype.onUnsubscribe = function(service, characteristic) {
  /* Install a callback to propagate the response. */
  this.once('notify_resp', function(_service, _characteristic){
    if ((_service == service) && (_characteristic == characteristic)) {
      /* Remove handlers. */
      this.removeAllListeners('data');

      /* Remove callback. */
      this.unregisterNotifyCallback(service, characteristic);
    }
  }.bind(this));

  /* Notify a notify operation has occured. */
  this.emit('notify', service, characteristic, false);
};

/**
 * onNotify()
 *
 * Called when the device provides a notification to the connected device.
 **/

FakeDevice.prototype.onNotify = function(service, characteristic) {
};


/**
 * registerNotifyCallback()
 *
 * Registers a notification callback for a given service and characteristic.
 **/

FakeDevice.prototype.registerNotifyCallback = function(service, characteristic, callback) {
  this.logger.debug('register callback for %s:%s', service, characteristic);
  if (!(service in this.subsCallbacks)) {
    this.subsCallbacks[service] = {};
  }
  this.subsCallbacks[service][characteristic] = callback;
}

/**
 * getCallback()
 *
 * Retrieve the registered notification callback for a given service
 * and characteristic.
 **/

FakeDevice.prototype.getCallback = function(service, characteristic) {
  if (service in this.subsCallbacks) {
    if (characteristic in this.subsCallbacks[service]) {
      /* Callback exists, return. */
      return this.subsCallbacks[service][characteristic];
    }
  }

  /* No callback found. */
  return null;
}

/**
 * unregisterNotifyCallback()
 *
 * Unregister a previously registered notification callback.
 **/

FakeDevice.prototype.unregisterNotifyCallback = function(service, characteristic, callback) {
  if (service in this.subsCallbacks) {
    if (characteristic in this.subsCallbacks[service]) {
      this.subsCallbacks[service][characteristic] = null;
    }
  }
}

if (!module.parent) {
  var profile = {"ad_records":"0201051107fb6db3e637446f84e4115b5d0100e094","scan_data":"0c094d6173746572204c6f636b11ff4b018e7b000032db3d240000982e2556","name":"Master Lock","services":[{"uuid":"180a","characteristics":[{"uuid":"2a29","properties":["read"],"descriptors":[]}]},{"uuid":"94e000015d5b11e4846f4437e6b36dfb","characteristics":[{"uuid":"94e000025d5b11e4846f4437e6b36dfb","properties":["read","writeWithoutResponse","write","notify"],"descriptors":["2902"]}]}],"address":"54:4a:16:6d:3d:23"}
  var fake = new FakeDevice(profile);
} else {
  module.exports = FakeDevice;
}
