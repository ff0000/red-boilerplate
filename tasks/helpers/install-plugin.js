/*global module:false*/
module.exports = function (grunt) {

	grunt.registerHelper("install_plugin", function (plug, isUpdate, cb) {
		var fs = require("fs");
		var cp = require("child_process");
		var path = require("path");

		var pkg = require("../utils/pkg");
		var pristinePkg = require(pkg.dirs.robyn + "/package.json");
		var localPkg = require("../utils/local-pkg");

		var branch;
		var bits = plug.split("@");

		if (bits.length === 1) {
			plug = bits[0];
		} else {
			plug = bits[0];
			branch = bits[1];
		}

		var wrench = require("wrench");

		var bpName = pkg.name;

		var plugSrcPkg;

		var completeInstall = function (plug, plugPkg, cb) {
			var plugPath = path.join(pkg.dirs.robyn, plug);

			if (fs.existsSync(plugPath)) {
				wrench.rmdirSyncRecursive(plugPath);
			}

			var plugInitScript = (plugPkg.scripts || {}).install;
			var install;

			if (plugInitScript) {
				pkg.scripts = pkg.scripts || {};
				pkg.scripts.install = pkg.scripts.install || {};

				install = pkg.scripts.install;

				if (install && install.length) {
					if (install.indexOf(plugInitScript) === -1) {
						pkg.scripts.install.push(plugInitScript);
					}
				} else {
					pkg.scripts.install = [plugInitScript];
				}
			}

			if (plugSrcPkg) {
				plugPkg.version = plugSrcPkg.version || plugPkg.version;
				plugPkg.description = plugSrcPkg.description || plugPkg.description;
			}

			pkg.installedPlugins[plug] = {
				version : plugPkg.version,
				description : plugPkg.description
			};

			pkg.save();

			if (cb) {
				cb();
			}
		};

		var runInstaller = function (plug, plugPkg, cb) {
			var install = (plugPkg.scripts || {}).install;

			if (!isUpdate && install) {
				var args = install.split(" "),
					cmd = args.shift(),
					pluginDir = path.join(pkg.dirs.robyn, pristinePkg.config.dirs.plugins),
					file = path.join(pluginDir, plug, args.join(""));

				plugPkg.scripts.install = [cmd, file].join(" ");

				if (cmd === "node" && fs.existsSync(file)) {
					var initializer = require(fs.realpathSync(file));

					initializer.run(function (error) {
						if (error) {
							grunt.fail.warn(error);
						}

						completeInstall(plug, plugPkg, cb);
					});
				} else {
					completeInstall(plug, plugPkg, cb);
				}
			} else {
				completeInstall(plug, plugPkg, cb);
			}
		};

		var copyFiles = function (plug, plugPkg, cb) {
			var scope = (plugPkg.config || {}).scope || "";
			var plugDir = path.join(pkg.dirs.robyn, plug);
			var repoPaths = grunt.file.expandFiles(plugDir + "/**/*");
			var i, j, file, newFile;

			var exclude = [
				"package.json",
				".gitignore",
				"README.md"
			];

			if (isUpdate) {
				exclude.push("**/__" + "PROJECT_NAME" + "__/**/*");
			}

			for (i = 0, j = repoPaths.length; i < j; i++) {
				file = repoPaths[i];

				if (!grunt.file.isMatch(exclude, file) && fs.existsSync(file)) {
					newFile = file.replace(plug, path.join("../", scope)).replace(/\/\//g, "/");

					grunt.log.writeln(("Adding " + newFile.replace(pkg.dirs.robyn + "/../", "")).grey);
					grunt.file.copy(file, newFile);
				}
			}

			var localFiles = plugPkg.config.localFiles || "defaults";
			var pluginDir = path.join(pkg.dirs.robyn, pristinePkg.config.dirs.plugins);
			var localDir = path.join(pluginDir, plug, localFiles);

			if (fs.existsSync(localDir)) {
				var localPaths = grunt.file.expandFiles({
					dot : true
				}, localDir + "/**/*");

				for (i = 0, j = localPaths.length; i < j; i++) {
					file = localPaths[i];

					if (!grunt.file.isMatch(exclude, file) && fs.existsSync(file)) {
						newFile = file.replace(localDir + "/", "");
						grunt.log.writeln(("Adding " + newFile).grey);
						grunt.file.copy(file, newFile);
					}
				}

				var gitIgnore = localDir + "/.gitignore";
				if (fs.existsSync(gitIgnore)) {
					var currGitIgnore = process.cwd() + "/.gitignore";
					grunt.log.writeln("Updating .gitignore".grey);

					if (fs.existsSync(currGitIgnore)) {
						grunt.file.write(currGitIgnore, [
							grunt.file.read(currGitIgnore),
							grunt.file.read(gitIgnore)
						].join("\n"));
					} else {
						grunt.file.copy(gitIgnore, currGitIgnore);
					}
				}
			}

			runInstaller(plug, plugPkg, cb);
		};

		var doReplacement = function (plug, plugPkg, cb) {
			var doReplacement = plugPkg.config.replaceVars;

			// Replace variables
			if (doReplacement) {
				var plugDir = path.join(pkg.dirs.robyn, plug);

				grunt.helper("replace_in_files", function () {
					copyFiles(plug, plugPkg, cb);
				}, {
					root : plugDir,
					config : {
						dot : true
					}
				});
			} else {
				copyFiles(plug, plugPkg, cb);
			}
		};

		var savePaths = function (plugPkg) {
			var i, j;

			var reqPaths = pkg.requiredPaths || [];
			var plugReqPaths = plugPkg.config.requiredPaths || [];

			for (i = 0, j = plugReqPaths.length; i < j; i++) {
				if (reqPaths.indexOf(plugReqPaths[i]) === -1) {
					reqPaths.push(plugReqPaths[i]);
				}
			}

			var excPaths = pkg.excludedPaths || [];
			var plugExcPaths = plugPkg.config.excludedPaths || [];

			for (i = 0, j = plugExcPaths.length; i < j; i++) {
				if (excPaths.indexOf(plugExcPaths[i]) === -1) {
					excPaths.push(plugExcPaths[i]);
				}
			}

			pkg.requiredPaths = reqPaths;
			pkg.excludedPaths = excPaths;
		};

		var findLocalPaths = function (plug, plugPkg, cb) {
			if (plugPkg.config.requiredPaths || plugPkg.config.excludedPaths) {
				savePaths(plugPkg);
			}

			doReplacement(plug, plugPkg, cb);
		};

		var installDependencies = function (plug, plugPkg, cb) {
			var callUpdate;
			var dep;
			var projectPkg = require("package.json");
			var pluginDeps = [];

			for (dep in plugPkg.dependencies) {
				if (!projectPkg.dependencies[dep] || projectPkg.dependencies[dep] !== plugPkg.dependencies[dep]) {
					projectPkg.dependencies[dep] = plugPkg.dependencies[dep];
					pluginDeps.push(dep + "@" + plugPkg.dependencies[dep]);

					callUpdate = true;
				}
			}

			for (dep in plugPkg.devDependencies) {
				if (!projectPkg.devDependencies[dep] || projectPkg.devDependencies[dep] !== plugPkg.devDependencies[dep]) {
					projectPkg.devDependencies[dep] = plugPkg.devDependencies[dep];
				}
			}

			grunt.file.write("package.json", JSON.stringify(projectPkg, null, "\t") + "\n");

			var plugSrcPath = "%r/%p/package.json".replace("%r", pkg.dirs.robyn).replace("%p", plug);

			if (fs.existsSync("./" + plugSrcPath)) {
				plugSrcPkg = require(fs.realpathSync(plugSrcPath));
			}

			if (callUpdate) {
				var child = cp.spawn("npm", ["install"].concat(pluginDeps), {
					env: null,
					setsid: true,
					stdio: "inherit"
				});

				child.on("exit", function () {
					findLocalPaths(plug, plugPkg, cb);
				});

				return;
			} else {
				findLocalPaths(plug, plugPkg, cb);
			}
		};

		var saveSystemDependencies = function (plug, plugPkg, cb) {
			var plugSysDeps = plugPkg.systemDependencies,
				currSysDeps = pkg.systemDependencies || {},
				regexp = /(?:([<>=]+)?(?:\s+)?)([\d\.]+)/,
				plugDep, currDep, plugMatch, currMatch;

			for (var dep in plugSysDeps) {
				plugDep = plugSysDeps[dep];
				currDep = currSysDeps[dep];

				if (currDep) {
					plugMatch = plugDep.match(regexp);
					currMatch = currDep.match(regexp);

					if (plugMatch[2] > currMatch[2]) {
						currSysDeps[dep] = plugDep;
					}
				} else {
					currSysDeps[dep] = plugDep;
				}
			}

			pkg.systemDependencies = currSysDeps;
			pkg.save();

			installDependencies(plug, plugPkg, cb);
		};

		var checkSystemDependencies = function (plug, plugPkg, cb) {
			if (plugPkg && plugPkg.systemDependencies) {
				grunt.helper("check_dependencies", plugPkg, function () {
					saveSystemDependencies(plug, plugPkg, cb);
				}, function (error) {
					cb(error);
				});
			} else {
				installDependencies(plug, plugPkg, cb);
			}
		};

		var installPlugin = function (plug, cb) {
			var pluginDir = path.join(pkg.dirs.robyn, pristinePkg.config.dirs.plugins);
			var plugDir = path.join(pluginDir, plug);

			if (fs.existsSync(plugDir)) {
				var plugPkg = grunt.file.readJSON(plugDir + "/package.json");
				var plugRepo = plugPkg.repository;
				var source = (plugRepo ? plugRepo.url : plugDir);

				grunt.log.writeln();
				grunt.log.writeln(("[!]".magenta + (" Installing " + plugPkg.name + " from " + source).grey).bold);

				if (plugRepo) {
					var plugBranch = branch || plugRepo.branch || "master";
					var plugPath = path.join(pkg.dirs.robyn, plug);

					grunt.file.mkdir(plugPath);

					var child = cp.spawn("git", [
						"clone",
						"--depth", "1",
						"--branch", plugBranch,
						plugRepo.url,
						plugPath
					], {
						env: null,
						setsid: true,
						stdio: "inherit"
					});

					child.on("exit", function () {
						checkSystemDependencies(plug, plugPkg, cb);
					});
				} else {
					checkSystemDependencies(plug, plugPkg, cb);
				}
			} else if (cb) {
				cb(true);
			}
		};

		if (!isUpdate && pkg.installedPlugins[plug]) {
			grunt.log.writeln("You've already installed %s!".yellow.replace("%s", plug));

			if (cb) {
				cb();
			}
			return;
		} else {
			installPlugin(plug, cb);
		}
	});

};
