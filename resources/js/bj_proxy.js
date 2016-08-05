var socket = io();


/* Forward writes. */
/*
socket.on('proxy_write', function(s, c, d, o, w) {
  socket.once('ble_write_resp', function(s,c,e){
    socket.emit('proxy_write_resp', s,c,e);
  });
  socket.emit('ble_write', s, c, d, o, w);
});*/


/* Forward reads. */
/*
socket.on('proxy_read', function(s,c) {
  socket.once('ble_read_resp', function(s,c,data){
    console.log('send data back to app');
    socket.emit('proxy_read_resp', s,c,data);
  });
  socket.emit('ble_read', s, c);
});*/
var interceptor = new Interceptor();
