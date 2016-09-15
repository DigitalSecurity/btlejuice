/* Main controller */
var BjProxy = angular.module('BjProxy', ['ui.bootstrap.contextMenu']);

/**
 * UUID filter
 **/

BjProxy.filter('makeUUID', function () {
  return function (item) {
    return formatUUID(item);
  };
});


/**
 * Transaction list controller
 **/

BjProxy.controller('TransactionListCtrl', function($scope, $rootScope, $window){
  $scope.transactions = [];
  /*
  $scope.options = [
    ['Replay', function ($itemScope) {
        console.log('replay');
        console.log($itemScope);
    }],
    ['Enable hooking', function($itemScope) {
      console.log('set hooking');
    }],
  ];*/

  $rootScope.$on('transactions.reset', function(){
    console.log('got transactions.reset');
    $scope.transactions = [];
  });

  $rootScope.$on('transactions.export.file', function(event, filename, format){

    /* Append extension. */
    if (format === 'json')
      var ext = 'json';
    else
      var ext = 'txt';
    filename += '.' + ext;

    /* Format data based on selected format. */
    switch(format) {
      case 'json':
        /* Export as JSON data, easy to process. */
        var exportData = {
          'target': interceptor.getProfile(),
          'activity': [],
        }
        for (var i in $scope.transactions) {
          var t = $scope.transactions[i];
          exportData.activity.push({
            type: t.op,
            service: formatUUID(t.service),
            characteristic: formatUUID(t.characteristic),
            data: t.dataHex.replace(/ /g,''),
          })
        }
        /* Convert to JSON. */
        exportData = angular.toJson(exportData);
        break;

      /* Text export is intended to be readable. */
      case 'text':
        var profile = interceptor.getProfile();
        var exportData = 'BtleJuice export data\n\n';
        exportData += '==< Capture Information >\n';
        exportData += ' BD Address : ' + profile.address + '\n';
        exportData += ' Device Name: ' + profile.name + '\n';
        if (profile.ad_records != null) {
          exportData += ' Adv. Data  : ' + profile.ad_records + '\n';
        }
        if (profile.scan_data != null) {
          exportData += ' Scan Data  : ' + profile.scan_data + '\n';
        }
        exportData += ' Saved on   : ' + (new Date()).toUTCString() + '\n';
        exportData += '==========================\n\n';

        for (var i in $scope.transactions) {
          var row = '';
          var t = $scope.transactions[i];
          if (t.op == 'event') {
            if (t.service == 'connect')
              row = '>>> Connection from remote device to dummy';
            else if (t.service == 'disconnect')
              row = '>>> Disconnection from dummy';
          } else {
            /* TODO: add ASCII dump. */
            switch (t.op) {
              case 'read':
                row = 'READ from '+formatUUID(t.service)+':'+formatUUID(t.characteristic)+' -- ' + t.dataHex;
                break;

              case 'write':
                row = 'WRITE to ' + formatUUID(t.service)+':'+formatUUID(t.characteristic)+' -- ' + t.dataHex;
                break;

              case 'notification':
                row = 'NOTIFICATION from ' + formatUUID(t.service)+':'+formatUUID(t.characteristic)+' -- ' + t.dataHex;
                break;
            }
          }
          exportData += row + '\n';
        }
        break;
    }

    var blob = new Blob([exportData]);
    var link = angular.element('<a></a>');
    link.attr('href', window.URL.createObjectURL(blob));
    link.attr('download',filename);
    link[0].click();
  });

  $scope.options = function(item) {
    if (item.op == 'event') {
      return [];
    } else {
      /* Check if item is already intercepted. */
      //TODO: check !
      return [
        ['Replay', function($itemScope){
          $scope.onReplayItem($itemScope.t);
        }],
        [function($itemScope){
          if (interceptor.isHooked($itemScope.t.service, $itemScope.t.characteristic)) {
            return 'Disable hook';
          } else {
            return 'Set hook';
          }
        },function($itemScope){
          if (interceptor.isHooked($itemScope.t.service, $itemScope.t.characteristic)) {
            $scope.onRemoveHook($itemScope.t);
          } else {
            $scope.onSetHook($itemScope.t);
          }
        }]
      ];
    }
  };

  $scope.dimensions = {
    'height': (window.innerHeight - 82)+'px'
  };

  $scope.addTransaction = function(transaction, disableRefresh) {
    $scope.transactions.push(transaction);
    if (!disableRefresh)
      $scope.$apply();
  };

  $scope.onSwitchDisplay = function(transaction) {
    if (transaction.data === transaction.dataHexii) {
      transaction.data = transaction.dataHex;
    } else {
      transaction.data = transaction.dataHexii;
    }
  }

  $scope.onReplayItem = function(transaction) {
    console.log('replay');
    console.log(transaction);
    $rootScope.$emit('replay', transaction);
  };

  $scope.onRemoveHook = function(transaction) {
    interceptor.removeHook(transaction.service, transaction.characteristic);
  };

  $scope.onSetHook = function(transaction) {
    interceptor.setHook(transaction.service, transaction.characteristic);
  };
})

.directive('resize', function(){
  return {
    restrict: 'A',
    link: function(scope, elem, attr)  {
      angular.element(window).on('resize', function(){
        console.log('resize');
        scope.$apply(function(){
          scope.dimensions = {
            'height': (window.innerHeight - 82)+'px'
          };
        });
      });
    }
  }
});

/**
 * Navbar controller.
 **/

BjProxy.controller('NavCtrl', function($scope, $rootScope, $element){

  $scope.state = 'disconnected';
  $scope.intercepting = interceptor.isInteractive();

  interceptor.on('status.change', function(status){
    $scope.config = interceptor.getConfig();
    $scope.state = status;
    $scope.$apply();
  });

  $scope.config = interceptor.getConfig();
  console.log($scope.config);
  $scope.target = null;

  $scope.onSelectTarget = function() {
    console.log('select target !');
    /* Reset transactions. */
    $scope.$emit('transactions.reset');
    $scope.$emit('target.select');
  };

  $scope.onDisconnect = function() {
    console.log('disconnect target');
    $scope.$emit('target.disconnect');
  };

  $scope.onSettings = function(){
    $scope.$emit('settings.show');
  };

  $scope.onServices = function(){
    $scope.$emit('profile.show');
  };

  $scope.onEnableIntercept = function(){
    interceptor.setMode(interceptor.MODE_INTERACTIVE);
    $scope.intercepting = true;
  };

  $scope.onDisableIntercept = function(){
    interceptor.setMode(interceptor.MODE_FORWARD);
    $scope.intercepting = false;
  };

  $scope.onExport = function(){
    $scope.$emit('transactions.export');
  }

  $rootScope.$on('target.connected', function(event, target){
    console.log('target is connected !');
    $scope.target = target.address;
    $scope.state = 'connected';
    $scope.$apply();
  });

})

.directive('toggle', function(){
  return {
    restrict: 'A',
    link: function(scope, element, attrs){
      if (attrs.toggle=="tooltip"){
        $(element).tooltip();
      }
      if (attrs.toggle=="popover"){
        $(element).popover();
      }
    }
  };
});

/**
 * Target selection controller.
 **/

 BjProxy.controller('TargetCtrl', function($scope, $rootScope){

   $scope.targets = [];
   $scope.seen = {};
   $scope.error = false;

   $scope.target = null;

   $scope.selectTarget = function(target) {
     $scope.target = target;
   };

   $scope.isSelected = function(target) {
     if ($scope.target == null)
      return false;
    else
      return ($scope.target.address == target.address);
   };

   console.log('register target selection');
   $rootScope.$on('target.select', function(){
     console.log('event target.select fired');

     interceptor.listDevices(function(peripheral, name, rssi){
       if (!(peripheral in $scope.seen)) {
         $scope.targets.push({
           address: peripheral,
           name: (name!=undefined)?name:'<unknown>',
           rssi: rssi
         });
         $scope.seen[peripheral] = null;
         $scope.$apply();
       }
     });

     /* Popup modal. */
     $scope.targets = [];
     $scope.seen = {};
     $('#m_target').modal();
   });

   $rootScope.$on('target.disconnect', function(){
     console.log('event target.disconnect fired');
     interceptor.disconnect();
     $scope.targets = [];
     $scope.seen = {};
   });

   $scope.onSelectClick = function(target){
     /* If a target has been selected, tell the interceptor to use it. */
     if ($scope.target != null) {
      interceptor.selectTarget($scope.target.address, function(){
        $rootScope.$emit('target.connected', $scope.target);
      });

      $('#m_target').modal('hide');
     } else {
       /* Display an error. */
       $scope.error = true;
     }
   };

   $scope.onSelectDblClick = function(target) {
     /* Select target. */
     $scope.target = target;

     /* Simulate a click on the 'Select' button. */
     $scope.onSelectClick();
   };
 });


 /**
  * Settings controller.
  **/

  BjProxy.controller('SettingsCtrl', function($scope, $rootScope){

    $scope.config = {
      reconnect: interceptor.shouldReconnect,
      keepHandles: interceptor.keepHandles,
    };

    $rootScope.$on('settings.show', function(){
      $('#m_settings').modal();
    });

    $scope.onSave = function(){
      /* Save interceptor config parameters. */
      interceptor.shouldReconnect = $scope.config.reconnect;
      interceptor.keepHandles = $scope.config.keepHandles;
      $('#m_settings').modal('hide');
    };

    $scope.onCancel = function(){
      $('#m_settings').modal('hide');
    };

  });


  /**
   * Services controller.
   **/

  BjProxy.controller('HookCtrl', function($scope, $rootScope, $element){
    $scope.title = 'Intercept:';
    $scope.action = {
      op: null,
      service: null,
      characteristic: null,
      data: null,
      offset: null,
      withoutResponse: null,
    };

    interceptor.on('hooks.write', function(service, characteristic, data, offset, withoutResponse, noRefresh){
      console.log('>>> got hooks.write');
      console.log(arguments);
      $scope.action = {
        op: 'write',
        service: service,
        characteristic: characteristic,
        data: data,
        dataHexii: buffer2hexII(data),
        dataHex: buffer2hex(data),
        offset: offset,
        withoutResponse: withoutResponse
      };
      if (noRefresh == null)
        $scope.$apply();
      $('#m_hook').modal();
    });

    interceptor.on('hooks.read', function(service, characteristic, data, noRefresh){
      console.log('>>> got hooks.read');
      $scope.action = {
        op: 'read',
        service: service,
        characteristic: characteristic,
        data: data,
        dataHexii: buffer2hexII(data),
        dataHex: buffer2hex(data)
      };
      if (noRefresh == null)
        $scope.$apply();
      $('#m_hook').modal();
    });

    interceptor.on('hooks.notify', function(service, characteristic, data, noRefresh){
      console.log('>>> got hooks.notify');
      $scope.action = {
        op: 'notify',
        service: service,
        characteristic: characteristic,
        data: data,
        dataHexii: buffer2hexII(data),
        dataHex: buffer2hex(data)
      };
      if (noRefresh == null)
        $scope.$apply();
      $('#m_hook').modal();
    });


    $scope.onForward = function(){
      /* Check if HexII is correct, and forward. */
      console.log($scope.action.dataHexii);
      var data = hexII2buffer($scope.action.dataHexii);
      if (data != null) {

        /* Forward. */
        if ($scope.action.op == 'write') {
          console.log(data);
          interceptor.deviceWrite(
            $scope.action.service,
            $scope.action.characteristic,
            data,
            $scope.action.offset,
            $scope.action.withoutResponse,

            /* Disable refresh (causes an error with angular). */
            true
          );

          /* Remove the edit popup. */
          $('#m_hook').modal('hide');

          /* Editing no more. */
          interceptor.processNextRequest();


        } else if ($scope.action.op == 'read') {
          interceptor.proxyReadResponse(
            $scope.action.service,
            $scope.action.characteristic,
            data,
            /* Disable refresh. */
            true
          );

          /* Remove the edit popup. */
          $('#m_hook').modal('hide');

          /* Editing no more. */
          interceptor.processNextRequest();
        } else if ($scope.action.op == 'notify') {
          interceptor.proxyNotifyData(
            $scope.action.service,
            $scope.action.characteristic,
            data,
            /* Disable refresh. */
            true
          );

          /* Remove the edit popup. */
          $('#m_hook').modal('hide');

          /* Editing no more. */
          interceptor.processNextRequest();
        }
      } else {
        /* TODO: notify user the hexii is incorrect. */
      }
    };

  $scope.onDismiss = function() {
    /* Dismiss. */
    if ($scope.action.op == 'write') {
      interceptor.proxyWriteResponse(
        $scope.action.service,
        $scope.action.characteristic,
        null
      );

      /* Remove the edit popup. */
      $('#m_hook').modal('hide');

      /* Editing no more. */
      interceptor.processNextRequest();
    }
  };

  });


  /**
   * Services controller.
   **/

   BjProxy.controller('ServicesCtrl', function($scope, $rootScope, $element){

     $scope.services = {};
     $scope.selectedService = null;

     interceptor.on('target.profile', function(){
       var profile = interceptor.getProfile();
       if (profile) {
         for (var i in profile.services) {
           $scope.services[profile.services[i].uuid] = [];
           for (var j in profile.services[i].characteristics) {
             $scope.services[profile.services[i].uuid].push(profile.services[i].characteristics[j].uuid);
           }
         }
         $scope.$apply();
       }
     });

     $rootScope.$on('profile.show', function(){
       $('#m_profile').modal();
     });

     $scope.onSave = function(){
       alert('proxy: '+$scope.proxy + ', device:'+$scope.hciDevice);
     };

     $scope.onCancel = function(){
       $('#m_settings').modal('hide');
     };

     $scope.onSelect = function(uuid) {
       $scope.selected = uuid;
       $scope.$apply();
     };

     $scope.onServiceSelect = function() {
       console.log($scope.selectedService);
     };

     $scope.onToggle = function(item, delay) {
       console.log(arguments);
       $('#'+item).parent().children('ul.tree').toggle(delay);
     };

   });



/**
* Replay controller
**/

BjProxy.controller('ReplayCtrl', function($scope, $rootScope, $window){
  $scope.op = null;
  $scope.service = null;
  $scope.characteristic = null;
  $scope.dataHexii = null;
  $scope.title = 'Replay'

  $rootScope.$on('replay', function(event, transaction){
    console.log(transaction);
    switch(transaction.op) {
      case 'read':
        $scope.title = 'Replay read';
        break;

      case 'write':
        $scope.title = 'Replay write';
        break;

      case 'notification':
        $scope.title = 'Replay notification';
        break;
    }
    $scope.op = transaction.op;
    $scope.service = transaction.service;
    $scope.characteristic = transaction.characteristic;
    $scope.dataHexii = transaction.data;

    $('#m_replay').modal();
  });

  $scope.onClose = function(){
    $('#m_replay').modal('hide');
  };

  $scope.onRead = function(){
    /* Read the characteristic from the device. */
    interceptor.deviceRead($scope.service, $scope.characteristic, function(service, characteristic, data){
      console.log('got data, update');
      $scope.dataHexii = buffer2hexII(data);
      $scope.$apply();
    });
  };

  $scope.onWrite = function() {
    /* Try to convert data to hexii. */
    var data = hexII2buffer($scope.dataHexii);
    if (data == null) {
      console.log('error, bad data format');
    } else {
      /* Write the data to characteristic. */
      interceptor.deviceWrite($scope.service, $scope.characteristic, data, $scope.offset, false);
    }
  };

  $scope.onNotify = function() {
    /* Try to convert data to hexii. */
    var data = hexII2buffer($scope.dataHexii);
    if (data == null) {
      console.log('error, bad data format');
    } else {
      /* Write the data to characteristic. */
      interceptor.proxyNotifyData($scope.service, $scope.characteristic, data, true);
    }
  };
});

/**
* Export controller
**/

BjProxy.controller('ExportCtrl', function($scope, $rootScope, $window){

  $scope.filename = filename;
  $scope.format = 'json';

  $rootScope.$on('transactions.export', function(){
    $scope.showExportDlg();
  });

  $scope.showExportDlg = function(){
    /* Lil' hack to get the actual number of transactions displayed. */
    var numTransactions = angular.element(document.getElementById('transactions')).scope().transactions.length;

    /* Get actual date. */
    var exportDate = (new Date())
      .toISOString()
      .replace(/T/g,'_')
      .replace(/-/g,'')
      .replace(/:/g,'')
      .slice(0,15);

    var profile = interceptor.getProfile();
    if (numTransactions === 0) {
      return;
    } else {
      var deviceAddress = profile.address.replace(/:/g,'');
      var deviceName = profile.name.replace(/ /g,'_')
        .replace(/[^\x20-\x7E]+/g, '');
      var filename = deviceAddress+'-'+deviceName+'-'+exportDate
    }
    $scope.filename = filename;
    $('#m_export').modal();
  };

  $scope.onCancel = function(){
    $('#m_export').modal('hide');
  };

  $scope.onExport = function(){
    console.log($scope.filename);
    console.log($scope.format);
    $scope.$emit('transactions.export.file', $scope.filename, $scope.format);
    $('#m_export').modal('hide');
  };

});
