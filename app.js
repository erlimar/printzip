// Copyright (c) E5R Development Team. All rights reserved.
// Licensed under the Apache License, Version 2.0. More license information in LICENSE.txt.

"use strict";

/* global process, __filename, __dirname */

var _fs = require('fs'),
    _path = require('path');

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
 * Zip file header on central directory structure.
 * @constructor
 * 
 * @param {Object} buffer Buffer instance
 */
function ZipCentralDirectoryFileHeader(buffer) {
    if (!(this instanceof ZipCentralDirectoryFileHeader)) {
        return new ZipCentralDirectoryFileHeader(buffer);
    }

    if (!(buffer instanceof Buffer)) {
        throw new Error('Param @buffer must be a Buffer instance');
    }

    if (buffer.length != ZipCentralDirectoryFileHeader.RECORD_SIZE) {
        throw new Error('Invalid buffer size');
    }

    // central file header signature   4 bytes  (0x02014b50)
    this._signature = buffer.readZipDWord(0);

    // version made by                 2 bytes
    this._versionMadeBy = buffer.readZipWord(4);

    // version needed to extract       2 bytes
    this._versionNeeded = buffer.readZipWord(6);

    // general purpose bit flag        2 bytes
    this._generalFlag = buffer.readZipWord(8);

    // compression method              2 bytes
    this._compressionMethod = buffer.readZipWord(10);

    // last mod file time              2 bytes
    this._lastModifyTime = buffer.readZipWord(12);

    // last mod file date              2 bytes
    this._lastModifyDate = buffer.readZipWord(14);

    // crc-32                          4 bytes
    this._crc32 = buffer.readZipDWord(16);

    // compressed size                 4 bytes
    this._compressedSize = buffer.readZipDWord(20);

    // uncompressed size               4 bytes
    this._uncompressedSize = buffer.readZipDWord(24);

    // filename length                 2 bytes
    this._fileNameLength = buffer.readZipWord(28);

    // extra field length              2 bytes
    this._extraFieldLength = buffer.readZipWord(30);

    // file comment length             2 bytes
    this._commentLength = buffer.readZipWord(32);

    // disk number start               2 bytes
    this._distNumber = buffer.readZipWord(34);

    // internal file attributes        2 bytes
    this._internalAttributes = buffer.readZipWord(36);

    // external file attributes        4 bytes
    this._externalAttributes = buffer.readZipDWord(38);

    // relative offset of local header 4 bytes
    this._relativeOffset = buffer.readZipDWord(42);

    if (this._signature !== ZipCentralDirectoryFileHeader.MAGIC_SIGNATURE) {
        throw new Error('File header on central directory signature error');
    }
}

/** @constant {number} */
ZipCentralDirectoryFileHeader.MAGIC_SIGNATURE = 0x02014b50;

/** @constant {number} */
ZipCentralDirectoryFileHeader.RECORD_SIZE = 46;

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
        stat = _fs.statSync(filePath);
    } catch (_) {
        throw new Error('Invalid file "' + filePath + '"');
    }

    if (!(this instanceof ZipExtractor)) {
        return new ZipExtractor(filePath);
    }

    this._handle = _fs.openSync(filePath, 'r');
    this._size = stat.size;
    this._files = [];
    this._directories = {};

    this.readEndOfCentralDirectory();
    this.readCentralDirectoryFiles();
}

/**
 * Map a file to directory path
 * 
 * @param {Object} file ZipCentralDirectoryFileHeader instance
 */
ZipExtractor.prototype.mapFile = function(file) {
    var dir,
        dirName,
        fileName,
        isDir = file._fileName.lastIndexOf('/') === file._fileName.length - 1;

    if (isDir) {
        dirName = _path.normalize(file._fileName);
    } else {
        dirName = _path.join(_path.dirname(_path.normalize(file._fileName)), _path.sep);
        fileName = _path.basename(file._fileName);
    }

    if (0 > Object.keys(this._directories).indexOf(dirName)) {
        dir = this._directories[dirName] = {};
    } else {
        dir = this._directories[dirName];
    }

    if (isDir) {
        dir['meta'] = file;
    } else {
        if (0 > Object.keys(dir).indexOf('files')) dir['files'] = [];

        dir['files'].push({
            'name': fileName,
            'meta': file
        });
    }
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
        read += _fs.readSync(this._handle, buffer, offset, length - read, position + read);
        offset = read - 1;
        if (offset < 0) offset = 0;
    }

    return buffer;
}

/**
 * End of central dir record from zip file 
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

    this._eocd = eocd;
}

/**
 * Read a file header list from central directory structure of ZIP file
 */
ZipExtractor.prototype.readCentralDirectoryFiles = function() {
    if (!(this._eocd instanceof ZipEndOfCentralDirectory)) {
        throw new Error('Invalid EOCD instance.');
    }

    var pos = this._eocd._offset;

    while (this._files.length < this._eocd._totalEntries) {
        var buffer = this.read(ZipCentralDirectoryFileHeader.RECORD_SIZE, pos);
        var file = new ZipCentralDirectoryFileHeader(buffer);
        pos += ZipCentralDirectoryFileHeader.RECORD_SIZE;

        // filename
        if (file._fileNameLength > 0) {
            file._fileName = this.read(file._fileNameLength, pos).toString();
            pos += file._fileNameLength;
        } else {
            file._fileName = '';
        }

        // extra fiel
        if (file._extraFieldLength > 0) {
            file._extraField = this.read(file._extraFieldLength, pos);
            pos += file._extraFieldLength;
        } else {
            file._extraField = null;
        }

        // file comment
        if (file._commentLength > 0) {
            file._comment = this.read(file._commentLength, pos).toString();
            pos += file._commentLength;
        } else {
            file._comment = '';
        }

        var count = this._files.push(file);
        this.mapFile(this._files[count - 1]);
    }

    // Ensures root directory
    var rootName = _path.normalize('./');

    if (0 > Object.keys(this._directories).indexOf(rootName)) {
        this._directories[rootName] = {};
    }
}

/**
 * Return a directory list
 */
ZipExtractor.prototype.getDirectories = function() {
    var self = this,
        list = [];

    Object.keys(this._directories).map(function(name) {
        list.push(name);
    });

    list.sort(function(a, b) {
        return a.localeCompare(b);
    });

    return list;
}


ZipExtractor.prototype.getFilesFromDirectory = function(directory) {

}

function main(args) {

    if (args.length !== 1) {
        throw new Error('Usage: $ printzip file.zip');
    }

    var extractor = new ZipExtractor(_path.resolve(args[0]));

    console.log(JSON.stringify(extractor.getDirectories(), null, 2));
}

main(process.argv.slice(2));