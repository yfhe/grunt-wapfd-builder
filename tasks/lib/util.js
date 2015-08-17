//(function(export){

	var fs = require('fs')
		,path = require('path')
		,ftp = require('ftp')
		,uglifyjs = require('uglify-js')
		,minifyCss = new (require('clean-css'))()
		,exec = require('child_process').exec
		,crypto = require('crypto')
		,debug = true;

	function log(msg, model){
		model = model in console ? model : 'log';
		if(type(msg) !== 'string'){
            msg = JSON.stringify(msg);
        }
		msg != null && debug ? console[model](msg) : '';
	}

	function copy(obj){
		return JSON.parse(JSON.stringify(obj));
	}

	function type(obj){
		var tmp;
		tmp = typeof(obj);
		if(tmp === 'object'){
			if(Object.prototype.toString.call(obj).match(/\[object (.*)\]/)){
				return RegExp.$1.toLowerCase();
			}
			return 'other';
		}
		return tmp;
	}

	function extend(tar, src){
		if(type(src) === type(src)){
			switch(type(tar)){
				case 'array':
					tar = tar.concat(src);
				break;
				case 'object':
					for(var i in src){
						src.hasOwnProperty(i) ? (tar[i]=src[i]) : '';
					}
				break;
				default:
			}
		}
	}

	function fileType(file){
		var fileStat = fs.existsSync(file) ? fs.statSync(file) : null;
		return (fileStat && ((fileStat.isDirectory() && 'dir') || (fileStat.isFile() && 'file'))) || 'unknow';
	}

	function readFile(file, code){
		return fs.statSync(file).isFile() ? fs.readFileSync(file, code || 'utf8') : '';
	}

	function writeFile(filePath, data){
		var fd = fs.openSync(filePath, 'w');
		fs.writeSync(fd, data);
		fs.closeSync(fd);
	}

	function fileCopy(src, target){
		return fileType(src) === 'file' ? fs.createReadStream(src).pipe(fs.createWriteStream(target)) : false;
	}

	function rmDir(dir){
		var fType = fileType(dir), dirItems = [];
		if(fType === 'file'){
			return fs.unlinkSync(dir);
		}
		if(fType === 'dir'){
			dirItems = fs.readdirSync(dir);
			if(dirItems.length > 0){
				dirItems.forEach(function(item){
					rmDir(path.join(dir, item));
				});
			}
			return fs.rmdirSync(dir);
		}
	}

	function shell(callback, cmd, execOpt){
		if(type(cmd) === 'string'){
			execOpt = execOpt || {};
			exec(cmd, execOpt, function(err, stdin, stdout){
				err ? console.log(err) : '';
				type(callback) === 'function' ? callback(stdout, stdin) : '';
			});
		}else{
			callback(null);
		}
	}

	function minify(callback, file, filetype, extra){
		var ret = null;
		log('minify:'+file)
		if(file && fileType(file) === 'file'){
			filetype = filetype || (file.match(/.*\.(\S+)$/) && RegExp.$1);
			switch(filetype){
				case 'js':
					ret = uglifyjs.minify(file).code;
				break;
				case 'css':
					ret = minifyCss.minify(readFile(file)).styles;
				break;
				// case 'png':
				// 	if(!extra){
				// 		console.error('minify '+type+' need "extra" params!');
				// 	}else{
				// 		return shell(callback, 'pngcrush -q -rem alla -brute -reduce ' + file + ' ' + extra.destPath);
				// 	}
				// break;
				default:
					console.error('can not support '+ filetype);
				break;
			}
			type(callback) === 'function' ? callback(ret) : '';
		}
	}

	function concatFiles(files, destPath){
		if(type(files) === 'array'){
			var fd = fs.openSync(destPath, 'w');
			files.forEach(function(file){
				if(fileType(file) === 'file'){
					fs.writeSync(fd, readFile(file));
					fs.writeSync(fd, '\n');
				};
			});
			fs.closeSync(fd);
			return true;
		}
		return false;
	}

	function findNewestTimestamp(dir){
		var allTimestamp = [];
		fs.readdirSync(dir).forEach(function(item){
			item.match(/(\d+)/) ? allTimestamp.push(RegExp.$1) : '';
		});
		allTimestamp.sort();
		return allTimestamp.length > 0 ? allTimestamp.pop() : null;
	}

	function dateFormat (date, fstr, utc) {
	  utc = utc ? 'getUTC' : 'get';
	  return fstr.replace (/%[YmdHMS]/g, function (m) {
	    switch (m) {
	    case '%Y': return date[utc + 'FullYear'] (); // no leading zeros required
	    case '%m': m = 1 + date[utc + 'Month'] (); break;
	    case '%d': m = date[utc + 'Date'] (); break;
	    case '%H': m = date[utc + 'Hours'] (); break;
	    case '%M': m = date[utc + 'Minutes'] (); break;
	    case '%S': m = date[utc + 'Seconds'] (); break;
	    default: return m.slice (1); // unknown code, remove %
	    }
	    // add leading zero if required
	    return ('0' + m).slice (-2);
	  });
	}

	function scanDir(dir, exclude, saveDir){
		var ret = [], dirItems = [], absPath = '', allDir=[];
		saveDir ? saveDir.push(dir): '';
		exclude = exclude || [];
		//exclude = (exclude && ((exclude.indexOf('.') !== -1 && exclude) || exclude.concat(['.','..']))) || ['.', '..'];
		dirItems = fs.readdirSync(dir);
		dirItems.forEach(function(item){
			if(['.', '..'].indexOf(item) === -1){
				absPath = path.join(dir,item);
				if(['file', 'dir'].indexOf(fileType(absPath)) !== -1 && exclude.every(function(tmp){return item.indexOf(tmp) === -1;})){
					ret = ret.concat(fileType(absPath) === 'dir' ? scanDir(absPath, exclude, saveDir) : absPath);
				}
			}
			
		});
		// if(!loop){
		// 	return saveDir ? {files: ret, dirs: allDir} : ret;
		// }
		return ret;
	}

	function makeDirTree(root, trees, dirs, ignores){
        var tmp;
        ignores = ignores || [];
        if(fileType(root) === 'dir'){
        	if(type(trees) !== 'object' || Object.keys(trees).length === 0){
        		trees = trees || {};
        		//dirs must be given if trees is null
        		dirs.forEach(function(dir){
	                var diritems = dir.split(path.sep);
	                diritems.reduce(function(prev, cur){
	                    if(cur){
	                        !prev.hasOwnProperty(cur) ? prev[cur] = {} : '';
	                        return prev[cur];
	                    }
	                    return prev;
	                }, trees)
	            });
        	}
        	function buildDirTree(tRoot, tTrees){
        		for(var i in tTrees){
	                if(tTrees.hasOwnProperty(i)){
	                	if(!ignores.every(function(item){
	                		return i.indexOf(item) === -1;
	                	})){
	                		continue;
	                	}
	                    tmp = path.join(tRoot, i);
	                    if(fileType(tmp) !== 'dir'){
	                        fs.mkdirSync(tmp);
	                    }
	                    if(type(tTrees[i]) === 'object' && Object.keys(tTrees[i]).length >0){
	                        buildDirTree(tmp, tTrees[i]);
	                    }
	                }
	            }
        	}
            buildDirTree(root, trees);
            return true;
        }
        return false;
    }

	function loopCall(callback, targetFunc, items){
		var taskQueue, task;
		function loopFunc(){
			if(taskQueue.length > 0){
				task = taskQueue.shift();
				targetFunc(loopFunc, task);
			}else{
				callback();
			}
		}
		if(type(items) === 'array'){
			taskQueue = copy(items);
			loopFunc();
		}else{
			targetFunc(callback, items)
		}
	}

	function buildDir(callback, workDir, submitDir, originInclude, ignores, minifyList, jsCnf, dirTree){
		var buildIndex = {
				cat: {
					js:[],
					css: [],
					other: [],
				},
				concat: jsCnf.concat,
			}
			,waitCp = []
			,needMinify = []
			,minifyIndex
			,buildOut = {}
			,loopKey = ''
			,loopItem = {}
			,tdestpath
			,tHash
			,allFiles = []
			,alldirs = []
			,buildIn = {};
		if(workDir && fileType(workDir) === 'dir'){
			log(['build start! from',workDir,'to',submitDir].join(' '));
			// ini dir tree if given
			allFiles = scanDir(workDir, ignores, alldirs);
			alldirs = alldirs.map(function(dir){
				return dir.replace(workDir, '');
			});
			//log(alldirs);
			dirTree = dirTree || {};
			makeDirTree(submitDir, dirTree, alldirs);
			//log(dirTree);
			// if(dirTree && type(dirTree)){
			// 	buildDirTree
			// }
			// dirTree && type(dirTree) === 'object' ? buildDirTree(submitDir, dirTree) : '';
			// init build input if not exist
			//concatCnf = concatCnf || [];
			
			allFiles.forEach(function(file){
				var hash = '', basename='';
				if(fileType(file) === 'file'){
					hash = md5(file);

					if(!buildIn.hasOwnProperty(hash)){
						// add new file (dup file will be ignore!)
						basename = path.basename(file);
						loopItem = {
							file: file,
							ext: path.extname(file).replace('.', ''),
							base: basename.replace(path.extname(file), ''),
							dir: path.dirname(file),
							hash: hash,
							uid: file.replace(workDir, '').split(path.sep).join('/'),
							basenames: [basename]
						};
						//filter
						if(loopItem.ext === 'js' && jsCnf && jsCnf.all.length > 0){
							if(jsCnf.all.indexOf(loopItem.hash) === -1){
								return; //ignore
							}
						}

						//build index
						buildIndex.cat[buildIndex.cat.hasOwnProperty(loopItem.ext) ? loopItem.ext : 'other'].push(loopItem.hash);
						
						buildIn[hash] = loopItem;
					}else{
						basename = path.basename(file);
						buildIn[hash].basenames.indexOf(basename) === -1 ? buildIn[hash].basenames.push(basename) : '';
					}
				}
			});
			// Object.keys(jsCnf.concat).forEach(function(name){
			// 	var tmp;
			// 	tmp = !buildIndex.concat.hasOwnProperty(name) ? (buildIndex.concat[name]={ext:cnf.ext, hashs:[]}) : buildIndex.concat[name];
			// 	buildIndex.concat[name] = jsCnf.concat.map(function(hash){
			// 		var item = buildIn[hash];
			// 		if((fileType(item.file) === 'file' && item === loopItem.file) || item === loopItem.hash){
			// 			tmp.ext == null ? tmp.ext = loopItem.ext : '';
			// 			tmp.hashs.push(loopItem.hash);
			// 		}
			// 	});
			// })
			//build index
			// for(loopKey in buildIn){
			// 	if(buildIn.hasOwnProperty(loopKey)){
			// 		loopItem = buildIn[loopKey];
					
			// 	}
			// }
			//log(buildIn);
			//log(buildIndex);
			//buildIn = scanDir(workDir, ignores);
			// combine
			for(loopKey in buildIndex.concat){
				if(buildIndex.concat.hasOwnProperty(loopKey)){
					loopItem = buildIndex.concat[loopKey];
					tdestpath = path.join(workDir, 'js', loopKey+'.js');
					log(loopItem);
					concatFiles(loopItem.map(function(hash){return buildIn[hash].file}), tdestpath);
					tHash = md5(tdestpath);
					buildIn[tHash] = {
						file: tdestpath,
						ext: 'js',
						base: loopKey,
						dir: path.join(submitDir, 'js'),
						hash: tHash,
						uid: 'js_'+loopKey+'.js',
						basenames: [loopKey+'.js'],
						concat: true
					};
					buildIndex.cat['js'].push(tHash);
				}
			}

			// get minify file and wait cp file
			minifyList.forEach(function(item){
				if(buildIndex.cat.hasOwnProperty(item)){
					tmp = buildIndex.cat[item];
					tmp.forEach(function(item){
						var obj = buildIn[item];
						if(obj.base.indexOf('min') === -1){
							needMinify.push(obj);
						}
						if(originInclude){
							obj.submitPath = obj.file.replace(workDir, submitDir);
							obj.hadMini = true;
							buildOut[item] = obj;
							waitCp.push([obj.file, obj.submitPath]);
						}
					});
				}
			});

			//add not minify file to cp list
			for(loopKey in buildIndex.cat){
				if(minifyList.indexOf(loopKey) === -1){
					loopItem = buildIndex.cat[loopKey];
					waitCp = waitCp.concat(loopItem.map(function(item){
						var tmp = buildIn[item];
						tmp.submitPath = tmp.file.replace(workDir, submitDir);
						buildOut[item] = tmp;
						return [tmp.file,tmp.submitPath];
					}));
				}
			}

			// minify
			//log(needMinify);
			log('start minify!');
			loopCall(function(){
				//copy
				log('end minify!');
				log('start migrate!');

				waitCp.forEach(function(item){
					if(type(item) === 'array' && item.length === 2) {
						try{
							fileCopy(item[0], item[1]);
						}catch(err){
							log('cp '+ item[0] + 'fail!');
						}
					}
					// fileCopy(item[0], file.replace(workDir, submitDir));
				});
				// loopCall(function(){
				// 	log('migrate done!');
				// 	log('build done!');
				// 	callback();
				// }, function(loopFunc, file){
				// 	if(fileType(file) === 'file'){
				// 		shell(function(){
				// 			loopFunc();
				// 		}, ['cp', file, file.replace(workDir, submitDir)].join(''));
				// 	}else{
				// 		loopFunc();
				// 	}
				// }, waitCp);
				setTimeout(function(){
					log('migrate done!');
					//log('build done!');
					callback(buildOut,dirTree);
				},500);
				
			}, function(loopFunc, infos){
				if(type(infos) === 'object'){
					minify(function(ret){
						var destPath, miniHash, basename;
						//log(ret);
						if(ret !== null){
							// save to min
							//log(ret);
							basename = [infos.base,'min',infos.ext].join('.');
							destPath = path.join(infos.dir.replace(workDir, submitDir), basename);
							//destPath = infos.file.replace(infos.base, infos.base + '.min').replace(workDir, submitDir);
							writeFile(destPath, ret);
							miniHash = md5(destPath);
							infos.miniHash = miniHash;
							//infos.miniSubmitPath = destPath.replace(workDir, submitDir);
							buildOut[miniHash] = {
								orgHash: infos.hash,
								file: infos.file,
								submitPath: destPath,
								ext: infos.ext,
								base: infos.base + '.min',
								hash: miniHash,
								mini: true,
								dir: path.dirname(destPath),
								uid: destPath.replace(submitDir, '').split(path.sep).join('/'),
								basenames: [basename],
								concat: infos.concat
							};
							loopFunc();
							//waitCp.push([destPath, infos.miniSubmitPath]);
						}else{
							loopFunc();
						}
					}, infos.file, infos.ext, infos);
				}else{
					loopFunc();
				}
			}, needMinify)
		}
	}
	function getUnitCode(){

	}

	function deployOnline(callback, workDir, onlineDir, buildIn, lastbuild, publishPrev, svnRoot, dirTree, ignores, originInclude, force, jsCnf){
		var buildIndex = {
			js: [],
			css: [],
			other: [],
		},
		regexp = [],
		nameMatchs = {},
		buildOut = {},
		cssRegexp = '',
		jsRegexp = '',
		tmp ;
		log(lastbuild)
		if(type(buildIn) === 'object' && fileType(workDir) === 'dir' && fileType(onlineDir) === 'dir'){
			dirTree ? makeDirTree(onlineDir, dirTree, null, ignores) : '';
			shell(function(){
				Object.keys(buildIn).forEach(function(hash){
					var loopItem = buildIn[hash], destPath = '', tmp;
					if(!ignores.every(function(item){
						return loopItem.file.indexOf(item) === -1;
					}) || !originInclude && loopItem.hadMini){
						// log('ignore '+loopItem.file);
						return;
					}
					if(!buildIndex.hasOwnProperty(loopItem.ext)){
						buildIndex['other'].push(hash);
						loopItem.modify = !lastbuild.hasOwnProperty(loopItem.uid) || lastbuild[loopItem.uid] !== hash;
						destPath = loopItem.submitPath.replace(path.basename(loopItem.submitPath), loopItem.hash+'.'+loopItem.ext).replace(workDir, onlineDir);
						if(loopItem.modify || force){
							loopItem.modify = true;
							fileCopy(loopItem.submitPath, destPath);
							loopItem.publishPath = destPath;
							lastbuild[loopItem.uid] = hash;
						}
						tmp = path.basename(loopItem.submitPath);
						nameMatchs[tmp] = [path.basename(destPath), loopItem.publishLink];
						regexp.push(tmp);
						loopItem.publishLink = (publishPrev + destPath.replace(svnRoot, '')).split(path.sep).join('/');
					}else{
						buildIndex[loopItem.ext].push(hash);
					}
					buildOut[hash] = loopItem;	
				});
				cssRegexp = new RegExp(['(', regexp.join('|'), ')'].join(''), 'g');
				jsRegexp = new RegExp(['[\'\"][^\'\"]*('+ regexp.join('|') +')?[^\'\"]*[\"\']'].join(''), 'g')
				//replace css
				buildIndex.css.forEach(function(hash){
					var loopItem = buildOut[hash], fileData='', newHash='', destPath='';
					if(!loopItem){
						return;
					}
					fileData = readFile(loopItem.submitPath).replace(cssRegexp, function(a,b){return (nameMatchs[b] && nameMatchs[b][0]) || b});
					newHash = md5(fileData);
					destPath = path.join(onlineDir, loopItem.ext, (loopItem.hadMini ? loopItem.base:newHash)+'.'+loopItem.ext);
					loopItem.modify = !lastbuild.hasOwnProperty(loopItem.uid) || lastbuild[loopItem.uid] !== newHash;
					if(loopItem.modify || force){
						loopItem.modify = true;
						writeFile(loopItem.submitPath, fileData);
						fileCopy(loopItem.submitPath, destPath);
						loopItem.hash = newHash;
						lastbuild[loopItem.uid] = newHash;
					}
					loopItem.publishLink = (publishPrev + destPath.replace(svnRoot, '')).split(path.sep).join('/');
				});
				//js
				buildIndex.js.forEach(function(hash){
					var loopItem = buildOut[hash], fileData='', newHash='', destPath='';
					if(!loopItem){
						return;
					}
					fileData = readFile(loopItem.submitPath).replace(regexp, function(a,b){
						var sep;
						if(nameMatchs[b]){
							sep = b.indexOf('"') !== -1 ? '"' : "'";
							return sep + nameMatchs[b][1] + sep;
						}
						return b;
					});
					//newHash = md5(fileData);
					newHash = loopItem.hash;
					destPath = path.join(onlineDir, loopItem.ext, (loopItem.hadMini ? loopItem.base:newHash)+'.'+loopItem.ext);
					loopItem.modify = !lastbuild.hasOwnProperty(loopItem.uid) || lastbuild[loopItem.uid] !== newHash;
					if(loopItem.modify || force){
						loopItem.modify = true;
						//writeFile(loopItem.submitPath, fileData);
						fileCopy(loopItem.submitPath, destPath);
						loopItem.hash = newHash;
						lastbuild[loopItem.uid] = newHash;
					}
					loopItem.publishLink = (publishPrev + destPath.replace(svnRoot, '')).split(path.sep).join('/');
				});
				//submit svn
				// shell(function(){
				// 	shell(function(){
				// 		callback(buildIn);
				// 	}, 'svn commit -m "auto build"');
				// }, 'svn add '+ onlineDir);
				setTimeout(function(){
					callback(buildOut);
				},500);
			}, 'svn update '+ onlineDir)
			
		}
	}

	function writeLog(logPath, data){
		var str_arr = [],
			curDate = dateFormat(new Date(), '%Y-%m-%d_%H-%M-%S'),
			logFile = path.join(logPath, curDate+'.log');
		if(type(data) === 'array'){
			data.forEach(function(item){
				switch(type(item)){
					case 'string':
						str_arr.push(item);
					break;
					case 'object':
						str_arr.push((item.title || '')+'\n');
						str_arr.push((item.data || ''));
					break;
					case 'array':
					str_arr.push(item.join('&&'));
					break;
					default:
					break;
				}
			})
		}
		writeFile(logFile, str_arr.join('\n'));
		return curDate;
	}

	function deployFtp(callback, workDir, ftpPath, ignores){
		log('deploy to ftp start!');
		var _con = new ftp(),
			buildIn = [];
		ftpPath = ftpPath || '';
		buildIn = scanDir(workDir, ignores);
		_con.on('ready', function(err, curDir){
			if(err){
				log(err);
			}else{
				_con.cwd(ftpPath, function(err){
					log(err);
					loopCall(function(){
						log('deploy ftp done !');
						callback();
					},function(loopFunc, file){
						var midDir = '', midDirs = [];
						if(fileType(file) === 'file'){
							midDir = path.dirname(file).replace(workDir, '').splite(path.seq);
							midDir.forEach(function(item){
								if(item !== ''){
									midDirs.length > 0 ? midDirs.push(path.join(midDirs[midDirs.length-1], item)) : midDirs.push(item);
								}
							});
							loopCall(function(){
								log('ftp cp '+ file);
								_con.put(file, file.replace(workDir, ''), function(err){
									log(err);
									loopFunc();
								})
							}, function(loopFunc1, dir){
								_con.mkdir(dir, function(err){
									log(err);
									loopFunc1();
								});
							}, midDirs)
						}
					}, buildIn)
				})
			}
		});
		_con.connect({
			host: '172.16.142.74',
			port: 2121,
			user: 'www',
			password:'0ecd15a9fee9dea3',
		});
	}

	function refreshPublishLink(buildOut, publishPrev, svnRoot){
		var nameMatchs = {}, cssRegexp = [];
        Object.keys(buildOut).forEach(function(key){
            var tmp = buildOut[key], tmp1 = path.basename(tmp.orgfile), tmp2 = tmp[(tmp.hasOwnProperty('mini') ? 'miniS' : 's') + 'ubmitPath'];
            tmp.publishUrl = tmp2.replace(svnRoot, publishPrev).split(path.sep).join('/');
            nameMatchs[tmp1] = [path.basename(tmp2), tmp.publishUrl];
            cssRegexp.push(tmp1.replace('.', '\.'));
        });
        cssRegexp = new RegExp('('+cssRegexp.join('|')+')','g');
        log(cssRegexp.toString());
        Object.keys(buildOut).forEach(function(key){
            var tmp = buildOut[key], tmp1 = tmp[(tmp.hasOwnProperty('mini') ? 'miniS' : 's') + 'ubmitPath'];
            if(tmp.ext === 'css'){
                writeFile(tmp1, readFile(tmp1).replace(cssRegexp, function(a,b){return (nameMatchs[b] && nameMatchs[b][0]) || b}));
            }
        });
	}

	function makeProductCnf(cnf, destPath, space){
		var ret = [];
		space = space || 2;
		if(type(cnf) === 'object'){
			ret.push('(function(){');
			ret.push('  var cnf = ');
			ret.push(JSON.stringify(cnf, null, space));
			ret.push('if(this.window){')
			ret.push('  window.scriptLoaderInit && window.scriptLoaderInit(cnf)');
			ret.push('}else{');
			ret.push('  exports = module.exports = cnf;');
			ret.push('}')
			ret.push('})();');
			if(destPath){
				writeFile(destPath, ret.join('\n'));
			}else{
				return ret.join('');
			}
		}
	}

	function md5(input, type){
		type = type || 'sha1';
		if(input.length < 100 && fileType(input) === 'file'){
			input = readFile(input);
		}
		var md5Instance = crypto.createHash(type),
			ret = null;
		try{
			md5Instance.update(input);
			ret = md5Instance.digest('hex');
		}catch(err){
			log('md5 error:'+err);
		}
		return ret;
	}

	function checkDepence(){

	}

	exports = module.exports = {
		type: type,
		minify: minify,
		concatFiles: concatFiles,
		fileType: fileType,
		fileCopy: fileCopy,
		extend: extend,
		scanDir: scanDir,
		makeProductCnf: makeProductCnf,
		writeFile: writeFile,
		md5: md5,
		build: buildDir,
		rmDir: rmDir,
		readFile: readFile,
		refreshPublishLink: refreshPublishLink,
		makeDirTree: makeDirTree,
		deployOnline: deployOnline,
		writeLog :writeLog
	};
//})(exports || module.exports || this);