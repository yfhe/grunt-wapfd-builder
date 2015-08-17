/*
 * grunt-wapbuild
 * 
 *
 * Copyright (c) 2015 
 * Licensed under the MIT license.
 */

'use strict';
var fs = require('fs')
    ,path = require('path')
    ,util = require('./lib/util.js');
module.exports = function(grunt) {

  // Please see the Grunt documentation for more information regarding task
  // creation: http://gruntjs.com/creating-tasks
  grunt.registerTask('build', 'build design for sina wap fd', function() {
    // Merge task-specific and/or target-specific options with these defaults.
    //var options = this.options({
    //  punctuation: '.',
    //  separator: ', '
    //});
    // user make
    // async
    // var buildType = grunt.option('type') || 'js'
    //     ,multi = grunt.option('multi') || false
    //     ,produce = grunt.option('produce') || false
    //     ,group = grunt.option('tarGroup') || 'article_v2';
    // if(grunt.config.data.build){
    //     smasher.refreshConf(grunt.config.data.build);
    // }
    // console.log(grunt.option.flags());
    // var done = this.async()
    // grunt.log.writeln('build  '+group+'&'+buildType+' start!');
    // smasher.build(function(file){
    //     grunt.log.writeln('build '+group+'&'+buildType+' done, fileName:'+file);
    //     done();
    // },group, buildType, multi, produce);
    var curDir = process.cwd(),
        requireOpts = [['svnRoot', 'string'], ['buildBlackList','array'], ['projectRoot','string'], ['submitDir', 'string']],
        cnf = {},
        cnfPath = '',
        buildBlackList = [],
        scanBlackList = [],
        allWorkFiles = [],
        newJs = {},
        fdCnf = {},
        fdCnfPath = null,
        loopKey = null,
        forceRefresh = false,
        tmp = null;
    //var done = this.async();
    function checkCnf(cnf){
        return requireOpts.every(function(opt){
            if(cnf.hasOwnProperty(opt[0]) && util.type(cnf[opt[0]]) === opt[1]){
                return true;
            }else{
                grunt.log.errorlns('参数 ' + opt[0] + ' 不合法！');
                return false;
            }
        })
    }
    function initfdCnf(){
        return {
            loaderVer: 1,
            scripts:{
                'base': [],
                'public': [],
                'private': []
            },
            concatCnf: {},
            alias: {}
        };
    }
    function getUserJS(fdCnf){
        var fdKeys = [], fdUids = [], loopkey, ret=[], hash='', concatCnf = {};
        for(loopkey in  fdCnf.scripts){
            (fdCnf.scripts.hasOwnProperty(loopkey) && ['base', 'public'].indexOf(loopkey) === -1) ? fdKeys=fdKeys.concat(fdCnf.scripts[loopkey]) : '';
        }
        _LOG(fdKeys);
        fdKeys.forEach(function(key){
            var loopitem = {};
            if(!fdCnf.alias.hasOwnProperty(key)){
                grunt.fail.fatal('config.js有错误，找不到必需js“'+key+'”源信息！');
            }
            loopitem = fdCnf.alias[key];
            hash = util.md5(loopitem.localPath);
            fdUids.push(hash);
            loopitem.hash = hash;
        });
        Object.keys(fdCnf.concatCnf).forEach(function(name){
            concatCnf[name] = fdCnf.concatCnf[name].map(function(key){
                return fdCnf.alias[key].hash;
            });
        });
        return {'all': fdUids, 'concat': concatCnf};
    }
    
    function _LOG(msg){
        if(util.type(msg) !== 'string'){
            msg = JSON.stringify(msg);
        }
        grunt.log.writeln(msg);
    }

    function filterUnuseJs(fdCnf, buildIn){
        var fdKeys = [], fdUids = [], loopkey, ret=[];
        for(loopkey in  fdCnf.scripts){
            fdCnf.scripts.hasOwnProperty(loopkey) ? util.extend(fdKeys, fdCnf.scripts[loopkey]) : '';
        }
        fdUids = fdKeys.map(function(key){
            if(!fdCnf.alias.hasOwnProperty(key)){
                grunt.fail.fatal('config.js有错误，找不到必需js“'+key+'”源信息！');
            }
            return fdCnf.alias.orgId;
        });
        buildIn.forEach(function(file){
            if(file.ext === 'js' && fdUids.indexOf(file.uid) === -1){
                return;
            }
            ret.push(file);
        });
        return ret;
    }

    var cmd = grunt.option('cmd') || 'init';
    var cnfname = grunt.option('cnf') || 'wapBuildCnf.js';
    forceRefresh = grunt.option('force') || false;
    grunt.log.writeln('build start');
    if(cmd === 'init'){
        grunt.log.writeln('cmd:'+cmd);
        console.log(curDir);
        if(curDir !== null && util.fileType(curDir) === 'dir'){
            grunt.log.writeln('start init!');
            cnfPath = path.join(curDir, cnfname);
            if(!fs.existsSync(cnfPath)){
                return grunt.log.errorlns('缺少配置文件 wapBuildCnf.js!');
            }
            cnf = require(cnfPath);
            if(util.type(cnf) !== 'object' || !checkCnf(cnf)){
                return grunt.log.errorlns('配置解析失败，请检查wapBuildCnf.js的完备性！');
            }

            if(!['svnRoot', 'projectRoot'].every(function(dir){
                if(util.fileType(cnf[dir]) !== 'dir'){
                    grunt.log.errorlns(dir+'目录无效或不存在！');
                    return false;
                }
                return true;
            })){
                return;
            }
            //util.extend(buildBlackList, cnf.buildBlackList);
            grunt.log.writeln('valid done!');
            //console.log(cnf.projectRoot);
            allWorkFiles = util.scanDir(cnf.projectRoot, []);
            // filter js
            cnf.originInclude = cnf.originInclude || false;
            cnf.loadedJs = cnf.loadedJs || [];
            cnf.lastBuild = cnf.lastBuild || {};
            cnf.scanBlackList = cnf.scanBlackList || [];
            cnf.minifyType = cnf.minifyType || ['js', 'css'];


            fdCnfPath = path.join(cnf.projectRoot, 'js', 'config.js');
            if(fs.existsSync(fdCnfPath)){
                fdCnf = require(fdCnfPath);
            }else{
                fdCnf = initfdCnf();
            }
            allWorkFiles.forEach(function(file){
                var uid='', basename='', relateivPath='';
                if(util.fileType(file) === 'file' && path.extname(file).toLowerCase() === '.js'){
                    relateivPath = file.replace(cnf.projectRoot, '').split(path.sep);
                    uid = relateivPath.join('_');
                    if(cnf.loadedJs.indexOf(uid) === -1 || forceRefresh){
                        cnf.loadedJs.push(uid);
                        basename = path.basename(file).replace('.js', '');
                        if(!fdCnf.alias.hasOwnProperty(uid)){
                            fdCnf.alias[basename] = {
                                uid: uid,
                                src: relateivPath.join('/'),
                                depend: [],
                                localPath: file,
                            }
                        }
                    }
                }
            });
            util.writeFile(cnfPath, 'exports=module.exports='+JSON.stringify(cnf,null,2));
            util.makeProductCnf(fdCnf, fdCnfPath);
        }

    }

    if(cmd === 'build'){
        var done = this.async(), relativeDirTree = {}, jsCnf={}, lastBuild={}, allDirs=[], buildIn = {}, submitDir = '', loopkey='', loopitem={}, tmpDir='~/tmp', submit, logDir='~/log';
        //try{
            var buildIn = {}, tmpDir;
            cnfPath = path.join(curDir, cnfname);
            cnf = require(cnfPath);
            fdCnfPath = grunt.option('fdCnf') || path.join(cnf.projectRoot, 'js', 'config.js');
            fdCnf = require(fdCnfPath);
            submit = grunt.option('submit') || false;
            tmpDir = path.join((cnf.tmpPath || curDir), 'tmp');
            logDir = path.join((cnf.logPath || curDir), 'log');
            submitDir = path.join(cnf.svnRoot, cnf.submitDir);
            buildBlackList =  buildBlackList.concat(cnf.buildBlackList);
            scanBlackList = scanBlackList.concat(cnf.scanBlackList);

            // util.rmDir(tmpDir);
            // fs.mkdirSync(tmpDir);
            //util.extend(buildBlackList, cnf.buildBlackList);
            
            //get all file
            //_LOG(buildBlackList);
            // allWorkFiles = util.scanDir(cnf.projectRoot, buildBlackList, allDirs);
            //build dir tree
            //grunt.log.writeln(JSON.stringify(scanResult));
            // allDirs.forEach(function(dir){
            //     var relativedir = dir.replace(cnf.projectRoot, '');
            //     var diritems = relativedir.split(path.sep);
            //     diritems.reduce(function(prev, cur){
            //         if(cur){
            //             !prev.hasOwnProperty(cur) ? prev[cur] = {} : '';
            //             return prev[cur];
            //         }
            //         return prev;
            //     }, relativeDirTree)
            // });
            // grunt.log.writeln('relative dir tree!'+JSON.stringify(relativeDirTree));
            //init tmp dir tree
            //util.buildDirTree(tmpDir, relativeDirTree);

            //copy work file to tmp dir
            // _LOG(cnf);
            // _LOG(cnf.lastBuild)
            lastBuild = cnf.lastBuild || {};
            //_LOG(lastBuild)
            //get use uids
            jsCnf = getUserJS(fdCnf)
            // start build!
            _LOG('start build!');
            util.rmDir(tmpDir);
            fs.mkdirSync(tmpDir);
            util.build(function(buildOut, dirTree){
                //_LOG(buildOut);
                // _LOG(dirTree);
                if(util.type(buildOut) === 'object' && Object.keys(buildOut).length >0){
                    if(submit){
                        _LOG('start submit!');
                        util.deployOnline(function(submitResult){
                            tmp = {};
                            cnf.lastBuild = lastBuild;
                            //cnf.buildResult = submitResult;
                            // make js cnf
                            var newFdCnf = {
                                loaderVer: fdCnf.loaderVer,
                                scripts: {
                                    base: fdCnf.scripts.base,
                                    public: fdCnf.scripts.public,
                                    private: []
                                },
                                alias: {}
                            };
                            //_LOG(fdCnf);
                            // var tmp = fdCnf.scripts.base;
                            // tmp.concat(fdCnf.scripts.public);
                            fdCnf.scripts.base.concat(fdCnf.scripts.public).forEach(function(name){
                                //_LOG(name);
                                if(fdCnf.alias.hasOwnProperty(name)){
                                    newFdCnf.alias[name] = fdCnf.alias[name];
                                }
                            });
                            Object.keys(submitResult).forEach(function(hash){
                                var loopitem;
                                if(submitResult.hasOwnProperty(hash)){
                                    loopitem = submitResult[hash];
                                    loopitem.modify ? tmp[loopitem.uid] = loopitem.publishLink :'';
                                    if(loopitem.concat){
                                        newFdCnf.scripts.private.push(loopitem.base);
                                        newFdCnf.alias[loopitem.base] = {
                                            src:loopitem.publishLink,
                                            depend: fdCnf.alias.hasOwnProperty(loopitem.base) ? fdCnf.alias[loopitem.base].depend : []
                                        };
                                    }
                                }
                            });

                            grunt.log.writeln(JSON.stringify(tmp, null, 2));
                            cnf.buildHistory.push(util.writeLog(logDir, [
                                {
                                    title:'打包结果:',
                                    data: JSON.stringify(buildOut, null, 2)
                                },
                                {
                                    title: '提交结果:',
                                    data: JSON.stringify(submitResult, null, 2)
                                },
                                {
                                    title: '有更新的文件:',
                                    data: JSON.stringify(tmp, null, 2)
                                }
                            ]));
                            util.writeFile(cnfPath, 'exports=module.exports='+JSON.stringify(cnf,null,2))
                            util.rmDir(tmpDir);
                            util.makeProductCnf(newFdCnf, path.join(submitDir, 'js', 'config.js'));
                            done();
                        }, tmpDir, submitDir, buildOut, lastBuild, cnf.publishPrev, cnf.svnRoot, dirTree, buildBlackList, cnf.originInclude, forceRefresh, jsCnf); //callback, workDir, onlineDir, buildIn, lastbuild, publishPrev, svnRoot
                    }
                    //util.refreshPublishLink(buildOut, cnf.svnRoot, cnf.publishPrev);
                    
                    // if(loopitem.hasOwnProperty('uid')){
                    //             cnf.lastBuildResult[loopitem.uid] = loopitem;
                    //         }
                    //grunt.log.writeln(JSON.stringify(tmp, null, 2));
                    

                    // util.writeFile(cnfPath, 'exports=module.exports='+JSON.stringify(cnf,null,2));
                    // util.rmDir(tmpDir);
                }else{
                    grunt.fail.fatal('build faile');
                }
                //done();
            }, cnf.projectRoot, tmpDir, true, scanBlackList, cnf.minifyType, jsCnf);
            // allWorkFiles.forEach(function(file){
            //     var destination = '', fileInfos = {};
            //     if(util.fileType(file) === 'file'){
            //         fileInfos = {
            //             orgfile: file,
            //             relpath: file.replace(cnf.projectRoot, '').split(path.sep),
            //             hash: util.md5(file),
            //             ext: path.extname(file).replace('.', '')
            //         }
            //         fileInfos.uid = fileInfos.relpath.join('_');
            //         fileInfos.relpath = fileInfos.relpath.join('/')
            //         // if(path.extname(file) === 'js' && useJsUids.indexOf(fileInfos.uid) === -1){
            //         //     grunt.log.writeln('ignore '+ file + ' not use!');
            //         //     return;
            //         // }
            //         if(!forceRefresh && lastBuild.hasOwnProperty(fileInfos.uid) && lastBuild[fileInfos.uid] === fileInfos.hash){
            //             _LOG('ignore ' + file +' not modify!');
            //             return;
            //         }
            //         fileInfos.base = path.basename(file).replace('.'+fileInfos.ext, '');
            //         lastBuild[fileInfos.uid] = fileInfos.hash;
            //         destination = file.replace(cnf.projectRoot, tmpDir);
            //         // destination = destination.replace(fileInfos.base, fileInfos.base+'_'+fileInfos.hash);
            //         if(util.fileCopy(file, destination)){
            //             fileInfos.file = destination;
            //             fileInfos.dir = path.dirname(destination);
            //             buildIn[fileInfos.hash] = fileInfos;
            //         }
            //     }
            // });
            //cnf.lastBuild = lastBuild;
            //_LOG(buildIn);
            // prepare  concat file conf
            //TODO

            // allWorkFiles.forEach(function(file){
            //     var fileInfos = {};
            //     if(util.fileType(file) === 'file'){
            //         util.extend(fileInfos, {
            //             'abspath': file,
            //             'ext': path.extname(file).replace('.',''),
            //             'filename': path.basename(),
            //             'absdir': path.dirname(),
            //         });
            //         fileInfos.relpath = file.replace(cnf.projectRoot, '');
            //         fileInfos.uid = fileInfos.relpath.replace(path.sep, '_');
            //         fileInfos.hash = util.md5(file);
            //         if(lastBuild.hasOwnProperty(fileInfos.uid) && lastBuild[fileInfos.uid] === fileInfos.hash){
            //             grunt.log.writeln('ignore ' + file +' not modify!');;
            //             continue;
            //         }
            //         fileInfos.minify = cnf.minifyType.indexOf(fileInfos.ext) !== -1;
            //         buildIn.push(fileInfos);
            //     }
            // });
            //_LOG(buildIn);
            // if(Object.keys(buildIn).length === 0){
            //     _LOG('no update, build ignore!');
            //     done();
            // }

            //initDirTree(submitDir, relativeDirTree);
            // setTimeout(function(){
            //     util.build(function(buildOut){
            //         //_LOG(buildOut);
            //         if(util.type(buildOut) === 'object' && Object.keys(buildOut).length >0){
            //             cnf.lastBuildResult = cnf.lastBuildResult || {};
                        
            //             //util.refreshPublishLink(buildOut, cnf.svnRoot, cnf.publishPrev);
                        
            //             // if(loopitem.hasOwnProperty('uid')){
            //             //             cnf.lastBuildResult[loopitem.uid] = loopitem;
            //             //         }
            //             //grunt.log.writeln(JSON.stringify(tmp, null, 2));
                        

            //             util.writeFile(cnfPath, 'exports=module.exports='+JSON.stringify(cnf,null,2));
            //             util.rmDir(tmpDir);
            //         }else{
            //             grunt.fail.fatal('build faile');
            //         }
            //         done();
            //     }, tmpDir, submitDir, cnf.originInclude, [], cnf.minifyType, [], buildIn);
            // },500);
            // start build  & callback, workDir, submitDir, originInclude, ignores, minifyList, concatCnf
            

            // // start minify
            // buildIn.forEach(function(fileInfo){
            //     var minifyRet = '';
            //     if(util.fileType(fileInfo.abspath) === 'file'){
            //         if(minifyType.indexOf(fileInfo.ext) !== -1){
            //             minifyRet = util.
            //         }
            //     }
            // })
            
        // }catch(err){
        //     grunt.log.errorlns(err);
        //     grunt.fail.fatal('build 失败了，请重新执行 grunt build --cmd=init');
        // }
    }
    //done();
    //grunt.log.writeln('build done!');
  });

};
