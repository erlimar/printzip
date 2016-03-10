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
 * Zip file end of central directory record
 * @constructor
 * 
 * @param {Object} buffer Buffer instance
 */
function ZipEndOfCentralDirectory(buffer) {
    if (!(this instanceof ZipEndOfCentralDirectory)) {
        return new ZipEndOfCentralDirectory(buffer);
    }

    if (!(buffer instanceof Buffer)) {
        throw new Error('Param @buffer must be a Buffer instance');
    }

    if (buffer.length != ZipEndOfCentralDirectory.RECORD_SIZE) {
        throw new Error('Invalid buffer size');
    }

    // end of central dir signature    4 bytes  (0x06054b50)
    this._signature = buffer.readZipDWord(0);

    // number of this disk             2 bytes
    this._diskNumber = buffer.readZipWord(4);

    // number of the disk with the
    // start of the central directory  2 bytes
    this._distStartNumber = buffer.readZipWord(6);

    // total number of entries in
    // the central dir on this disk    2 bytes
    this._totalEntries = buffer.readZipWord(8);

    // total number of entries in
    // the central dir                 2 bytes
    this._totalAllEntries = buffer.readZipWord(10);

    // size of the central directory   4 bytes
    this._size = buffer.readZipDWord(12);

    // offset of start of central
    // directory with respect to
    // the starting disk number        4 bytes
    this._offset = buffer.readZipDWord(16);

    // zipfile comment length          2 bytes
    this._commentLength = buffer.readZipWord(20);

    if (this._signature !== ZipEndOfCentralDirectory.MAGIC_SIGNATURE) {
        throw new Error('End of central directory signature error');
    }
}

/** @constant {number} */
ZipEndOfCentralDirectory.MAGIC_SIGNATURE = 0x06054b50;

/** @constant {number} */
ZipEndOfCentralDirectory.RECORD_SIZE = 22;

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
    this._size = stat.size;

    var eocd = this.readEndOfCentralDirectory();

    console.log(JSON.stringify(eocd, null, 4));

    // Central directory structure
    // [eocd._offset] to [eocd._offset + eocd._size]
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
 * End of central dir record from zip file
 * 
 * @return {Object} ZipEndOfCentralDirectory instance 
 */
ZipExtractor.prototype.readEndOfCentralDirectory = function() {
    var eocd_pos = this._size - 4;

    while (eocd_pos > 0) {
        var magic = this.read(4, eocd_pos).readZipDWord(0);
        if (magic == ZipEndOfCentralDirectory.MAGIC_SIGNATURE) break;
        --eocd_pos;
    }

    if (eocd_pos === 0) {
        throw new Error('Invalid ZIP file. End of central directory record not found.');
    }

    var buffer = this.read(ZipEndOfCentralDirectory.RECORD_SIZE, eocd_pos);
    var eocd = new ZipEndOfCentralDirectory(buffer);

    if (eocd._commentLength > 0) {
        var buffer_comment = this.read(eocd._commentLength, eocd_pos + ZipEndOfCentralDirectory.RECORD_SIZE);
        eocd._comment = buffer_comment.toString();
    } else {
        eocd._comment = '';
    }

    /** @todo: Implement support multiple disks (files) */
    if (eocd._diskNumber !== eocd._distStartNumber ||
        eocd._diskNumber !== 0 ||
        eocd._totalEntries !== eocd._totalAllEntries) {
        throw new Error('TODO: Support multiple disks (files) not implemented.');
    }

    if (eocd_pos !== eocd._offset + eocd._size) {
        throw new Error('ZIP file corrupted. End of central directory record not found.');
    }

    return eocd;
}

function main(args) {

    if (args.length !== 1) {
        throw new Error('Usage: $ printzip file.zip');
    }

    var extractor = new ZipExtractor(path.resolve(args[0]));
}

main(process.argv.slice(2));