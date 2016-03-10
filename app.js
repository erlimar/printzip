// Copyright (c) E5R Development Team. All rights reserved.
// Licensed under the Apache License, Version 2.0. More license information in LICENSE.txt.

/* global process, __filename, __dirname */

var fs = require('fs'),
    path = require('path');

/**
 * Read a BYTE (8bits) from buffer
 * 
 * @param {number} position
 * 
 * @return {number} 
 */
Buffer.prototype.readZipByte = function(position) {
    if (!(this instanceof Buffer)) {
        throw new Error('This must be a Buffer instance');
    }
    /** @todo: Ver se ZIP usa signed ou unsigned */
    return this.slice(position, position + 1).readUIntLE(0, 1);
}

/**
 * Read a WORD (16bits) from buffer
 * 
 * @param {number} position
 * 
 * @return {number} 
 */
Buffer.prototype.readZipWord = function(position) {
    if (!(this instanceof Buffer)) {
        throw new Error('This must be a Buffer instance');
    }
    /** @todo: Ver se ZIP usa signed ou unsigned */
    return this.slice(position, position + 2).readUIntLE(0, 2);
}

/**
 * Read a DWORD (32bits) from buffer
 * 
 * @param {number} position
 * 
 * @return {number} 
 */
Buffer.prototype.readZipDWord = function(position) {
    if (!(this instanceof Buffer)) {
        throw new Error('This must be a Buffer instance');
    }
    /** @todo: Ver se ZIP usa signed ou unsigned */
    return this.slice(position, position + 4).readUIntLE(0, 4);
}

/**
 * ZipLocalFileHeader
 * @constructor
 *
 * Zip file header record
 */
function ZipLocalFileHeader(buffer) {
    if (!(this instanceof ZipLocalFileHeader)) {
        return new ZipLocalFileHeader(buffer);
    }

    if (!(buffer instanceof Buffer)) {
        throw new Error('Param @buffer must be a Buffer instance');
    }

    if (buffer.length != ZipLocalFileHeader.RECORD_SIZE) {
        throw new Error('Invalid buffer size');
    }

    this._signature = buffer.readZipDWord(0);           //4 bytes  (0x04034b50)
    this._versionNeeded = buffer.readZipWord(4);        //2 bytes
    this._generalFlag = buffer.readZipWord(6);          //2 bytes
    this._compressionMethod = buffer.readZipWord(8);    //2 bytes
    this._time = buffer.readZipWord(10);                //2 bytes
    this._date = buffer.readZipWord(12);                //2 bytes
    this._crc = buffer.readZipWord(14);                 //4 bytes
    this._compressedSize = buffer.readZipWord(18);      //4 bytes
    this._uncompressedSize = buffer.readZipWord(22);    //4 bytes
    this._fileNameLength = buffer.readZipWord(26);      //2 bytes
    this._extraFieldLength = buffer.readZipWord(28);    //2 bytes

    console.log('  >', this._signature.toString(16), ':', this._generalFlag.toString(2));
    console.log('  >', JSON.stringify(this, null, 8));

    if (this._signature !== ZipLocalFileHeader.MAGIC_SIGNATURE) {
        var _signB1 = buffer.readZipByte(0);
        var _signB2 = buffer.readZipByte(1);
        var _signB3 = buffer.readZipByte(2);
        var _signB4 = buffer.readZipByte(3);
        console.log('File signature error:',
            _signB1 + ':' + String.fromCharCode(_signB1),
            _signB2 + ':' + String.fromCharCode(_signB2),
            _signB3 + ':' + String.fromCharCode(_signB3),
            _signB4 + ':' + String.fromCharCode(_signB4),
            '<0x' + this._signature.toString(16) + '>');
        //throw new Error('File signature error');
    }
};

/** @constant {number} */
ZipLocalFileHeader.MAGIC_SIGNATURE = 0x04034b50; // <P.K.3.4>

/** @constant {number} */
ZipLocalFileHeader.RECORD_SIZE = 30;

/**
 * ZipDataDescriptor
 * @constructor
 *
 * Zip file data descriptor record
 */
function ZipDataDescriptor(buffer) {
    if (!(this instanceof ZipDataDescriptor)) {
        return new ZipDataDescriptor(buffer);
    }

    if (!(buffer instanceof Buffer)) {
        throw new Error('Param @buffer must be a Buffer instance');
    }

    if (buffer.length != ZipDataDescriptor.RECORD_SIZE) {
        throw new Error('Invalid buffer size');
    }

    this._crc = buffer.readZipWord(0);                 //4 bytes
    this._compressedSize = buffer.readZipWord(4);      //4 bytes
    this._uncompressedSize = buffer.readZipWord(8);    //4 bytes
}

/** @constant {number} */
ZipDataDescriptor.FLAG_ENABLED = 0x2000;

/** @constant {number} */
ZipDataDescriptor.RECORD_SIZE = 12;

/**
 * Zip file end of central directory record
 * @constructor
 */
function ZipEndOfCentralDirectory() {

}

/** @constant {number} */
ZipEndOfCentralDirectory.MAGIC_SIGNATURE = 0x06054b50;

/**
 * Extract a zip file
 * 
 * @note: http://www.fileformat.info/info/mimetype/application/zip/index.htm
 * 
 * @constructor
 * 
 * @param {string} filePath
 */
function ZipExtractor(filePath) {
    var stat;

    try {
        stat = fs.statSync(filePath);
    } catch (_) {
        throw new Error('Invalid file "' + filePath + '"');
    }

    if (!(this instanceof ZipExtractor)) {
        return new ZipExtractor(filePath);
    }

    this._handle = fs.openSync(filePath, 'r');

    var eocd_pos = stat.size - 4;

    while (eocd_pos > 0) {
        var magic = this.read(4, eocd_pos).readZipDWord(0);
        if (magic == ZipEndOfCentralDirectory.MAGIC_SIGNATURE) break;
        --eocd_pos;
    }

    if (eocd_pos === 0) {
        throw new Error('Invalid file "' + filePath + '"');
    }
    
    console.log("Valid ZIP!");

    // while (pos < stat.size) {
    //     var header = this.readLocalFileHeader(pos);
    //     var data_descriptor;
    //     var flag = header._generalFlag & ZipDataDescriptor.FLAG_ENABLED;

    //     if (flag === ZipDataDescriptor.FLAG_ENABLED) {
    //         console.log('ZipDataDescriptor.FLAG_ENABLED');
    //         data_descriptor = this.readDataDescriptor(pos + ZipLocalFileHeader.RECORD_SIZE + header._fileNameLength + header._extraFieldLength);
    //         console.log('>>>', JSON.stringify(data_descriptor, null, 4));

    //         var __fileDataSize = typeof (data_descriptor) !== 'undefined'
    //             ? data_descriptor._compressedSize
    //             : header._compressedSize;

    //         var __dataDescriptorSize = typeof (data_descriptor) !== 'undefined'
    //             ? ZipDataDescriptor.RECORD_SIZE
    //             : 0;

    //         console.log('__fileDataSize:', __fileDataSize);
    //         console.log('__dataDescriptorSize:', __dataDescriptorSize);
    //         //console.log('Extra>>', header._extraField.toString());

    //         //break;
    //     }

    //     console.log('# name:', header._filename);

    //     var fileDataSize = typeof (data_descriptor) !== 'undefined'
    //         ? data_descriptor._compressedSize
    //         : header._compressedSize;

    //     var dataDescriptorSize = typeof (data_descriptor) !== 'undefined'
    //         ? ZipDataDescriptor.RECORD_SIZE
    //         : 0;

    //     pos += ZipLocalFileHeader.RECORD_SIZE
    //         + header._fileNameLength
    //         + header._extraFieldLength
    //         + fileDataSize
    //         + dataDescriptorSize;

    //     //console.log('New pos:', pos);
    // }
}

/**
 * Read a file content block
 * 
 * @param {number} length
 * @param {number} position
 * 
 * @return {Object} Content Buffer 
 */
ZipExtractor.prototype.read = function(length, position) {

    if (!Number.isInteger(length) || length < 1) {
        throw new Error('Param @length must be a positive number');
    }

    if (!Number.isInteger(position) || position < 0) {
        throw new Error('Param @position must be a integer number');
    }

    var buffer = new Buffer(length),
        offset = 0,
        read = 0;

    while (read < length) {
        read += fs.readSync(this._handle, buffer, offset, length - read, position + read);
        offset = read - 1;
        if (offset < 0) offset = 0;
    }

    return buffer;
}

/**
 * Read a local file header from zip file
 * 
 * @param {number} position
 * 
 * @return {Object} ZipLocalFileHeader instance 
 */
ZipExtractor.prototype.readLocalFileHeader = function(position) {
    var buffer = this.read(ZipLocalFileHeader.RECORD_SIZE, position);
    var header = new ZipLocalFileHeader(buffer);
    var buffer_name = this.read(header._fileNameLength, position + ZipLocalFileHeader.RECORD_SIZE);
    var buffer_extra = this.read(header._extraFieldLength, position + ZipLocalFileHeader.RECORD_SIZE + header._fileNameLength);

    header._filename = buffer_name.toString();
    header._extraField = buffer_extra;

    return header;
}

/**
 * Read a data descriptor from zip file
 * 
 * @param {number} position
 * 
 * @return {Object} ZipDataDescriptor instance 
 */
ZipExtractor.prototype.readDataDescriptor = function(position) {
    var buffer = this.read(ZipDataDescriptor.RECORD_SIZE, position);
    return new ZipDataDescriptor(buffer);
}

function main(args) {

    if (args.length !== 1) {
        throw new Error('Usage: $ printzip file.zip');
    }

    var extractor = new ZipExtractor(path.resolve(args[0]));
}

main(process.argv.slice(2));