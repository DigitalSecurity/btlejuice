
function BinBuf(len) {
    'use strict';
    this.uuid = generateUUID();
    this.buffer = [];
    this.marked = [];
    this.name = "unnamed";
    this.changed = 1;

    this.offset = 0;
    this.current = 0;
    this.nibble = 0;

    this.selectionStart = -1;
    this.selectionStop = -1;
    if (len) {
        this.buffer = new Uint8Array(len);
        this.colors = new Uint8Array(len);
        this.marked = new Uint8Array(len);

    }
}
BinBuf.prototype = {

    setName: function(name) { // set name
        this.name = name;
    },
    getName: function() {
      return this.name;
    },

    length: function() { // leng
        return this.buffer.length;
    },

    loadDataFromFile: function (data) { // load data from binary blob
        var binobj = new jBinary(data);
        this.buffer = binobj.read(['blob', binobj.view.byteLength ], 0);
        var len = this.length()
        this.colors = new Uint8Array(len);
        this.marked = new Uint8Array(len);

        return 1;
    },

    loadDataFromLocalStorage: function(data) { // load from localstorage

        if (data.data) {
            this.buffer = data.data;
            this.unpackLS(data.data);
            this.marked = new Uint8Array(this.length());

            if (data.colors) {
                this.colors = data.colors;
            } else {
                this.colors = new Uint8Array(len);
            }
            this.uuid= data.uuid;
            return 1;
        }
        return 0;

    },

    saveToDict: function () {
        this.changed=0;
        var data =  {
            name:  this.getName(),
            colors:this.colors,
            data:  this.toBuffer(),
            uuid: this.uuid
        };
        return data;

    },
    getByte: function(adr) {
        return this.buffer[adr];
    },

    getByteHex: function(adr) {
        return toHex(this.buffer[adr],2);
    },

    getColoredRegion : function (adr) { // if hovering colored region, get regions extents
        var color  = this.colors[adr]
        var startadr = adr;
        var endadr = adr;
        if (color === 0) {
            return undefined; // threris no color chunk under cursor
        } else {

            for (var i=adr;i<this.length();i++) {
                if (this.colors[i] != color) {

                    break;
                }
                endadr = i;
            }
            for (var i=adr;i>=0;i--) {
                if (this.colors[i] != color) {

                    break;
                }
                startadr = i;
            }
            return {start:startadr,end:endadr}
        }
    },
    compareToBuffer : function (target) {

        for (var i=0;i<this.length();i++) {
           // this.marked[i]=0;
            var targ = target.buffer[i]
            if (typeof targ != "undefined") {
                if (this.buffer[i]!=targ) {
                    target.marked[i] = 1;
                }
            }
        }

    },

    getRangeHex: function(start,end) {
        var res = ""
        for (var i=start;i<end;i++) {
            res += getByteHex(i);
        }
        return res;
    },
    getRangeHexInv: function(start,end) {
        var res = ""
        for (var i=start;i<end;i++) {
            res += getByteHex(i)^0xFF;
        }
        return res;
    },
    getBytePrintableChar: function(adr) {
        return number <= 32 ? ' ' : String.fromCharCode(number);
    },

    setByte: function(adr,val) {
        this.buffer[adr] = val & 0xFF;
        this.marked[adr] = 1;
        this.changed = 1;
    },
    setColor: function(adr,color) {
        this.colors[adr] = color;
        this.changed = 1;
    },
    clearMarkers: function () {
        for (var i=0;i<this.length();i++) {
            this.marked[i]=0;
        }
    },
    swapBytes: function() {

        var len = this.length()
        if ((len % 2) !=0 ) len--;  // not swap last odd byted
        for (var i=0;i<len;i+=2) {
            var t = this.getByte(i)
            this.setByte(i,this.getByte(i+1))
            this.setByte(i+1,t);
            if ((this.getByte(i)==this.getByte(i+1))) {
                this.marked[i]=0;
                this.marked[i+1]=0;
            }

        }

    },

    pasteSequence: function(data,pos) {
        data = data.replace(/[^0-9a-fA-F]/g,"")
        var bytelist = data.match(/.{1,2}/g);
        var n = 0;
        for (var i in bytelist) {
            this.setByte(pos++,parseInt(bytelist[i],16))
            n++;
        }
        return n;
    },

    toString: function () {
        var out = ""
        for (var i=0;i<this.length();i++) {
            out += this.getByteHex(i)+" "
        }
        return out;

    },
    getSelection: function () {
        var out = ""
        if (this.selectionStart < this.selectionEnd) return "Selection error";
        if (this.selectionStart == -1) return "Selection error";
        if (this.selectionStop == -1) return "Selection error";
        for (var i=this.selectionStart;i<=this.selectionStop;i++) {
            out += this.getByteHex(i)+" "
        }
        return out;

    },

    toBuffer: function() {
        var out = ""
        for (var i=0;i<this.length();i++) {
            out += this.getByteHex(i);
        }
        return out;
    },

    fromBuffer: function (buffer) {

        if (typeof buffer === "string") {
            var pos = 0;
            var data = buffer.replace(/[^0-9a-fA-F]/g,"")
            var bytelist = data.match(/.{1,2}/g);
            for (var i in bytelist) {
                var intval = parseInt(bytelist[i],16);
                if (this.getByte(i) !== intval) {
                    this.setByte(i, intval);
                }
            }
        }


    },

    // deserialize buffer from string
    unpackLS: function (buffer) {

        var start = new Date().getTime();

        if (typeof buffer === "string") {
            var pos = 0;
            this.buffer = new Uint8Array(buffer.length/2);
            //var bytelist = buffer.match(/.{1,2}/g);
            var j = 0;
            for (var i=0;i<buffer.length;i+=2) {
                this.buffer[j++] =  parseInt(buffer[i]+buffer[i+1],16) & 0xFF;
            }
        } else {
           console.log("This buffer is fucking shit!")
        }

        var end = new Date().getTime();
        var time = end - start;
         console.log('Loading time: ' + time);


    },
    selectRange: function(start,end) {
        if (start > end) {
            var t = start;
            start = end;
            end = t;
        }
        this.selectionStart = start;
        this.selectionStop = end;

    },
    isSelected: function (index) {
      if (this.selectionStart < 0) return false;
        if (this.selectionStop < 0) return false;
        if((index >= this.selectionStart) && (index <=this.selectionStop)) {
            return true;
        }
        return false
    },
    fillWithSequence: function (start,end,sequence,xor) {

        var slen = sequence.length;
        if (slen === 0) return;
        var seqpos=0;

        for (var i=start;i<=end;i++) {
            var sval = sequence[seqpos++];
            if (seqpos >= slen) seqpos=0;
            if (xor) {
                sval = (this.getByte(i) ^ sval) & 0xFF;
            }
            this.setByte(i,sval);
        }

    }


};
