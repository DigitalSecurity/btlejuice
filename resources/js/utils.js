var formatUUID = function(uuid) {
  if (uuid != null) {
    if (uuid.length == 4)
      return uuid;
    else if (uuid.length == 32) {
      return uuid.substr(0,8) + '-' + uuid.substr(8, 4) + '-' + uuid.substr(12, 4) + '-' + uuid.substr(16, 4) + '-' + uuid.substr(20, 12);
    }
  } else {
    return null;
  }
};

var buffer2hex = function(buf) {
  var hexdump = '';
  var bytes = new Uint8Array(buf);
  var padding = '00';
  for (var i=0; i<bytes.length; i++) {
    var byte_str = (+bytes[i]).toString(16);
    hexdump += padding.substring(0, padding.length - byte_str.length) + byte_str + ' ';
  }
  return hexdump;
};

var buffer2hexII = function(buf) {
  var hexii = '';
  var padding = '00';
  var bytes = new Uint8Array(buf);
  for (var i=0; i<bytes.length; i++) {
    var value = (+bytes[i]);
    /* Char -> ".C". */
    if ((value >= 0x30) && (value <=0x7a)) {
      hexii += '.'+String.fromCharCode(value);
    } else {
      var byte_str = (+bytes[i]).toString(16);
      hexii += padding.substring(0, padding.length - byte_str.length) + byte_str;
    }
    hexii += ' ';
  }
  console.log(hexii);
  return hexii;
}

var hexII2buffer = function(hexii) {
  /* Ensure completeness before converting. */
  var charset = '0123456789abcdef';
  var bytes = [];

  i = 0;
  while (i < hexii.length) {
    /* Is it an ASCII character ? */
    if (hexii[i] == '.') {
      bytes.push(hexii.charCodeAt(i+1));
      i += 2;

    /* Or a valid hexadecimal byte ? */
  } else if ((charset.indexOf(hexii[i].toLowerCase())>=0) && (charset.indexOf(hexii[i+1].toLowerCase())>=0)) {
      var ascii = parseInt(hexii.slice(i,i+2), 16);
      bytes.push(ascii);
      i+=2;

    /* Or a space character ? */
    } else if (hexii[i] == ' ') {
      i += 1;
    } else {
      /* Otherwise: bad value ! */
      return null;
    }
  }

  /* Convert our bytes to an arraybuffer. */
  var buffer = new ArrayBuffer(bytes.length);
  var writer = new Uint8Array(buffer);
  writer.set(bytes);
  return buffer;
}
