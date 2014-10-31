/*
 * GET home page.
 */
var http = require('http'),
    fs = require('fs'),
    path = require('path'),
    url = require('url'),
    crypto = require('crypto'),
    iconv = require('iconv-lite'),
    UglifyJS = require('uglify-js'),
    cleanCSS = new require('clean-css')({
        noAdvanced: true
    }),
    BufferHelper = require('bufferhelper');


//压缩js
var minify = function (code) {
    return UglifyJS.minify(code, {
        fromString: true
    })
};
//压缩css
var minicss = function (source) {
    return cleanCSS.minify(source);
    // return cleanCSS.process(code);
};
//设置页面header
var setHeader = function (res) {
    var date = new Date();

    if (!res.getHeader('Accept-Ranges')) res.setHeader('Accept-Ranges', 'bytes');
    if (!res.getHeader('ETag')) res.setHeader('ETag', date.valueOf());
    if (!res.getHeader('Date')) res.setHeader('Date', date.toUTCString());
    if (!res.getHeader('Cache-Control')) res.setHeader('Cache-Control', 'public, max-age=' + (60 * 60 * 24 * 365));
    if (!res.getHeader('Last-Modified')) res.setHeader('Last-Modified', date.toUTCString());
};
//获取生成文件名和绝对路径
var getFileName = function (name) {
    var filename = crypto.createHash('md5').update(name).digest('hex');
    var ts = parseInt(filename, 36) % 1000;
    return path.normalize('/ts/' + ts + '/' + filename);
};
//获取文件夹路径
var getFolderPath = function (filePath) {
    return path.normalize(filePath.substring(0, filePath.lastIndexOf('\\')));
};
//获取文件路径
var getFilePath = function (filename) {
    return path.normalize(__dirname.replace('routes', '') + filename);
};
//按照url获取文件内容
var getFile = function (url, callback) {
    var resultdata = '';
    url = url.split('|');
    if (url[0].indexOf('http') == 0) {
        var req = http.get(url[0], function (p_res) {
            var bfHelper = new BufferHelper();
            if (p_res.statusCode != 404) {
                p_res.on('data', function (chunk) {
                    bfHelper.concat(chunk);
                });
                p_res.on('end', function () {
                    resultdata = bfHelper.toBuffer();
                    resultdata = iconv.decode(resultdata, (url[1] || 'UTF8').toUpperCase());
                    resultdata = iconv.encode(resultdata, 'UTF8');
                    callback('/*path --' + url[0] + '*/\r\n' + resultdata, true);
                });
            }
            else {
                callback('/*Read Error --' + url[0] + '*/\r\n', false);
            }
        });
    }
    else {
        resultdata = fs.readFile(url[0], function (err, data) {
            console.log(err);
            if (!err) {
                console.log(data);
                resultdata = iconv.encode(data, 'UTF8');
                callback('/*path --' + url[0] + '*/\r\n' + resultdata, true);
            }
            else {
                callback('/*Read Error --' + url[0] + '*/\r\n', false);
            }
        });

    }
};
//合并文件
var mergeFile = function (query, type, callback) {
    var fsArray = query.file.split(',');
    var files = [],
        num = 0;
    for (file in fsArray) {
        if (query.host && fsArray[file].indexOf('http') != 0) {
            fsArray[file] = query.host + fsArray[file];
        }
        getFile(fsArray[file], function (text) {
            num++;
            files = files.concat([text]);
            if (num == fsArray.length) {
                callback(String(query.debug) !== 'undefined' ? files.join('') :
                    (type == 'js' ? minify(files.join('')).code :
                        minicss(files.join(''))));
            }
        })
    }
};
//输出内容
var writeContent = function (req, res, type) {
    // res.setHeader('Content-Type', 'text/' + (type == 'js' ? 'plain' : 'css'));
    if (!req.query || !req.query.file) {
        res.send('abort');
        return;
    }
    if (req.query) {
        if (req.query.file && req.query.file != '') {
            if (String(req.query.debug) !== 'undefined') {
                mergeFile(req.query, type, function (code) {
                    res.send(code);
                })
            }
            else {
                var filename = getFileName(req.query.file);
                var filepath = getFilePath(filename);
                fs.exists(filepath, function (exists) {
                    if (!exists) {
                        mergeFile(req.query, type, function (code) {
                            code = '/*' + filepath + '*/' + code;
                            var folderPath = getFolderPath(filepath);
                            fs.exists(folderPath, function (flag) {
                                function writeFile() {
                                    fs.writeFile(filepath, code, 'utf8', function (err) {
                                        setHeader(res);
                                        res.setHeader('nodetype', 'write');
                                        res.send(code);
                                    })
                                }
                                if (!flag) {
                                    fs.mkdir(folderPath, function () {
                                        writeFile()
                                    })
                                }
                                else {
                                    writeFile();
                                }

                            });
                        })
                    }
                    else {
                        if (req.headers['if-modified-since'] && (new Date().valueOf() - new Date(req.headers['if-modified-since']).valueOf()) < 30 * 60 * 60 * 24) {
                            //exports.removeContentHeaders(res);
                            res.setHeader('nodetype', '');
                            res.statusCode = 304;
                            res.end();
                        }
                        else {
                            setHeader(res)
                            res.setHeader('nodetype', 'read');
                            fs.readFile(filepath, 'utf8', function (err, data) {
                                res.send(data);
                            })

                        }
                    }
                })
            }

        }
    }
};

exports.index = function (req, res) {
    res.send('Js minify And Css minify');
};

exports.js = function (req, res) {
    writeContent(req, res, 'js')
}
exports.css = function (req, res) {
    writeContent(req, res, 'css')
};


//http://localhost:3000/js?file=http://x.libdd.com/farm1/a05baa/fde6509f/jquery.mousewheel-3.0.6.pack.js,http://x.libdd.com/farm1/08871e/95134743/jquery.fancybox-buttons.js
//http://localhost:3000/css?file=http://s.libdd.com/css/base/dd.$7205.css,http://s.libdd.com/css/app/tagpro.$7164.css