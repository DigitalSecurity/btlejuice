BtleJuice - Bluetooth Man in the Middle framework
=================================================

version 1.1.3
-------------

* Fixed a bug introduced in the previous version (bad dedup)


version 1.1.2
-------------

* Improved device detection and acquisition (issue #2)

version 1.1.1
-------------

* Version numbers fixed in both btlejuice and btlejuice-proxy

version 1.1.0
-------------

* Added GATT handles duplication support (true-cloning feature that fixes bad behavior on Android)
* Optimized reconnection through local GATT cache
* Minor bugfixes


version 1.0.6
-------------

* Added export feature (JSON and text)
* Added support for auto-reconnection: when a remote device disconnects, the proxy will automatically reconnect
* Added support of hex and hexII format in the main interface
* Fixed settings dialog
* Improved bluetooth core
* Fixed other minor bugs


version 1.0.5 (initial release)
-------------------------------

* Core MITM features
* Web user interface
* Bluetooth GATT operations replay (read, write, notify)
* GATT operations sniffing (read, write, notify)
* On-the-fly data modification through user interface
