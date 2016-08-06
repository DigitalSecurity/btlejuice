BtleJuice Framework
===================

Introduction
------------

BtleJuice is a complete framework to perform Man-in-the-Middle attacks on
Bluetooth Smart devices (also known as Bluetooth Low Energy). It is composed of:

* an interception core
* an interception proxy
* a dedicated web interface
* Python and Node.js bindings

How to install BtleJuice ?
--------------------------

Installing BtleJuice is a child's play. First of all, make sure your system uses
a recent version of *Node.js* (>=4.3.2). Then, make sure to install all the
required dependencies:

### Ubuntu/Debian/Raspbian

```
sudo apt-get install bluetooth bluez libbluetooth-dev libudev-dev
```

### Fedora / Other-RPM based

```
sudo yum install bluez bluez-libs bluez-libs-devel
```

Last, install BtleJuice using *npm*:

```
sudo npm install -g btlejuice
```

If everything went well, BtleJuice is ready to use !


How to use BtleJuice ?
----------------------

BtleJuice is composed of two main components: an interception proxy and a core.
These two components are required to run on independent machines in order to
operate simultaneously two bluetooth 4.0+ adapters.

The use of a virtual machine may help to make this framework work on a single
computer.

From your virtual machine, install *btlejuice* and make sure your USB BT4 adapter is available from the virtual machine:

```
$ sudo hciconfig
hci0:	Type: BR/EDR  Bus: USB
	BD Address: 10:02:B5:18:07:AD  ACL MTU: 1021:5  SCO MTU: 96:6
	DOWN
	RX bytes:1433 acl:0 sco:0 events:171 errors:0
	TX bytes:30206 acl:0 sco:0 commands:170 errors:0
```

Also make sure your virtual machine has an IP address reachable from the host.

Launch the proxy in your virtual machine:

```
btlejuice-proxy
```

And run the following command on your host machine:

```
# btlejuice -u <Proxy IP address> -w
```

The *-w* flag tells BtleJuice to start the web interface while the *-u* option specifies the proxy's IP address.

The Web User Interface is now available at http://localhost:8080. Note the web server port may be changed through command-line.

Installing the bindings
-----------------------

BtleJuice's Node.js bindings may be installed as well through *npm*:

```
$ sudo npm install -g btlejuice-bindings
```

More information about how to use the Node.js bindings in the [package documentation](https://www.npmjs.com/package/btlejuice-bindings).

License
-------

Copyright (c) 2016 Econocom Digital Security

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
