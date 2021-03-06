/* jshint node: true */
module.exports = function (grunt) {
	"use strict";

	grunt.registerTask("start", "Get your party started", function (branch, override) {
		var helper = require("./helpers").init(grunt);

		var fs = require("fs");
		var cp = require("child_process");
		var path = require("path");
		var cwd = process.cwd();

		var done = this.async();

		var name = grunt.option("name") || grunt.option("N");
		var title = grunt.option("title") || grunt.option("T");

		branch = grunt.option("branch") || grunt.option("b") || branch;
		override = grunt.option("include-plugins") || grunt.option("i") || (function () {
			if (grunt.option("all") || grunt.option("A")) {
				return "all";
			} else if (grunt.option("bare") || grunt.option("B")) {
				return "bare";
			}

			return undefined;
		}()) || override;

		var pkg = require("./utils/pkg");

		// Don't require until we know we need it
		var localPkg;

		var whitelist = [];

		var prompt;
		var remote;

		var projectName = pkg.config.vars.PROJECT_NAME;
		var projectTitle = pkg.config.vars.PROJECT_TITLE;

		var options = [];

		if (!name) {
			options.push({
				name: "name",
				message: "Project namespace?",
				validator: /^([a-z]+)(\w+)$/,
				warning: "Invalid namespace. Valid characters are [a-Z]. Must start with a lowercase",
				"default": projectName || "sample"
			});
		}

		if (!title) {
			options.push({
				name: "title",
				message: "Project title?",
				"default": projectTitle || "Sample Project Title"
			});
		}

		var finalizeInstall = function () {
			grunt.log.writeln();
			grunt.log.writeln("[*] ".grey + "You should edit your package.json and fill in your project details.".magenta);
			grunt.log.writeln("[*] ".grey + "All done! Commit you changes and you're on your way.".magenta);

			done();
		};

		var initialBuild = function (cb) {
			pkg.initialized = true;

			// As of npm 1.3.2, it will complain about uppercase characters in pkg.name
			// This hack lowercases the project name, but only in package.json
			pkg.name = (pkg.name || "").toLowerCase();

			pkg.save();

			var verbose = grunt.option("verbose");
			var build = cp.spawn("grunt", ["build"], {
				stdio: verbose ? "inherit" : "pipe"
			});

			if (!verbose) {
				helper.write("Initial build.".grey);

				build.stdout.on("data", function () {
					process.stdout.write(".".grey);
				});
			}

			build.on("exit", function () {
				grunt.log.ok();
				cb();
			});
		};

		var addHooks = function () {
			var hookDir = path.join(pkg.config.dirs.config, "hooks");

			if (fs.existsSync(hookDir)) {
				grunt.log.writeln("    ".grey + "Adding git hooks.".grey);
				var gitHookDir = path.join(cwd, ".git", "hooks");

				var hooks = grunt.file.recurse(hookDir, function (abspath, root, sub, file) {
					var hook = path.join(gitHookDir, file);

					grunt.file.copy(abspath, hook);
					fs.chmodSync(hook, "755");
				});
			}
		};

		var shrinkWrap = function () {
			grunt.util.spawn({
				cmd: "npm",
				args: ["shrinkwrap"]
			}, function () {
				grunt.log.writeln();
				grunt.log.writeln("[*] ".grey + "Shrinkwrapped npm packages.".grey);

				addHooks();
				initialBuild(finalizeInstall);
			});
		};

		var resetGit = function () {
			var child = cp.spawn("git", ["reset", "--hard", "HEAD"], {
				cwd: pkg.config.dirs.robyn,
				stdio: "pipe"
			});

			child.on("exit", shrinkWrap);
		};

		var handleSettings = function (err, props, overrideProps) {
			var key;

			for (key in overrideProps) {
				props[key] = overrideProps[key];
			}

			name = name || props.name;
			title = title || props.title;

			delete props.name;
			delete props.title;

			var plugArr = whitelist;
			var i = 0;

			for (key in props) {
				var assert = helper.getAssertion(props[key]);

				if (assert) {
					plugArr.push(key);
				}
			}

			// Sort by name
			plugArr = plugArr.sort();

			helper.storeVars(name, title, function () {
				grunt.log.writeln("[*] ".grey + "Stored and updated your project variables.".grey);

				// As of npm 1.3.2, it will complain about uppercase characters in pkg.name
				// This hack lowercases the project name, but only in package.json
				pkg.name = (pkg.name || "").toLowerCase();
				pkg.save();

				(function install(count) {
					if (!plugArr[count]) {
						resetGit();
						return;
					}

					helper.installPlugin(plugArr[count], null, function (stop) {
						if (stop === true) {
							done(false);
							return;
						}

						count++;

						if (plugArr[count]) {
							install(count);
						} else {
							resetGit();
						}
					});
				}(i));

			});
		};

		var promptForSettings = function (plugins) {
			var i, j, plugin,
				installed = pkg.installedPlugins;

			if (installed) {
				var plugTitle;

				for (var key in installed) {
					if (!plugTitle) {
						grunt.log.writeln();
						grunt.log.writeln("[*] ".grey + "Installed plugins:".magenta);
						plugTitle = true;
					}

					var plug = installed[key];

					if (typeof plug !== "string") {
						grunt.log.writeln("[+] ".grey + "%n %v".replace("%n", key).replace("%v", plug.version).cyan + " (%d)".replace("%d", plug.description).grey);
					} else {
						grunt.log.writeln("[+] ".grey + key.cyan + " (%d)".replace("%d", plug).grey);
					}
				}
			}

			var pluginOpts = [];
			var overrideOpts = [];
			var overrideProps = {};

			for (i = 0, j = plugins.length; i < j; i++) {
				plugin = plugins[i];

				if (!installed || !installed[plugin.name]) {
					pluginOpts.push({
						name: plugin.name,
						message: "Would you like to add %n (%d)?".replace("%n", plugin.name).replace("%d", plugin.description),
						validator: /[y\/n]+/i,
						"default": "Y/n"
					});
				}
			}

			if (override) {
				var assert = "y";
				var isAll = (override === "all");

				if (override === "bare") {
					assert = "n";
				}

				override = override.split(",");

				for (i = 0, j = pluginOpts.length; i < j; i++) {
					assert = "n";

					if (isAll || override.indexOf(pluginOpts[i].name) !== -1) {
						assert = "y";
					}

					overrideProps[pluginOpts[i].name] = assert;
				}

				pluginOpts = [];
			}

			options = options.concat(pluginOpts);

			if (options.length) {
				grunt.log.subhead("Please answer the following:");

				prompt.get(options, function (err, props) {
					handleSettings(err, props, overrideProps);
				});
			} else {
				handleSettings(null, {}, overrideProps);
			}
		};

		var gatherArgs = function (plugins) {
			var opts = [];

			if (name) {
				opts.push("project name: %s".replace("%s", name));
			}

			if (title) {
				opts.push("project title: %s".replace("%s", title));
			}

			if (branch) {
				opts.push("on branch: %s".replace("%s", branch));
			}

			if (override) {
				opts.push("with plugins: %s".replace("%s", override));
			}

			if (opts.length) {
				grunt.log.writeln("[*]".grey + " Checking param overrides.".grey);

				helper.writeln(opts.join(", ").grey);
			}

			promptForSettings(plugins);
		};

		var gatherPlugins = function () {
			helper.checkForPlugins(true, gatherArgs);
		};

		var alreadyStarted = function () {
			grunt.log.writeln();
			grunt.log.writeln("[*] ".grey + "This party's already been started. You can install individual plugins with `grunt install`".magenta);

			done();
		};

		var getThisPartyStarted = function () {
			if (pkg.initialized) {
				addHooks();
				initialBuild(alreadyStarted);
			} else {
				prompt = require("prompt");
				prompt.start();

				prompt.message = (prompt.message !== "prompt") ? prompt.message : "[?]".white;
				prompt.delimiter = prompt.delimter || " ";

				grunt.log.writeln();

				grunt.util.spawn({
					cmd: "git",
					args: ["status"]
				}, gatherPlugins);
			}
		};

		var runInitializeScripts = function (i) {
			i = (i || 0);

			if (!pkg.scripts || !pkg.scripts.install || !pkg.scripts.install[i]) {
				return getThisPartyStarted();
			}

			var file = path.join(cwd, pkg.scripts.install[i]);

			if (fs.existsSync(file)) {
				var initializer = require(file);

				initializer(grunt, helper, function (error) {
					if (error) {
						grunt.fail.warn(error);
					}

					runInitializeScripts(++i);
				});
			} else {
				runInitializeScripts(++i);
			}
		};

		var checkIfPartyStarted = function () {
			// Make sure default paths exist
			var dirs = pkg.config.dirs,
				key, dir;

			for (key in dirs) {
				dir = path.join(cwd, dirs[key]);

				if (!fs.existsSync(dir)) {
					grunt.file.mkdir(dir);
				}
			}

			localPkg = require("./utils/local-pkg");

			var requiredPaths = pkg.config.requiredPaths,
				i, j, req;

			for (i = 0, j = requiredPaths.length; i < j; i++) {
				if (!fs.existsSync("./" + requiredPaths[i])) {
					localPkg.initialized = false;
				}
			}

			if (localPkg.initialized === true) {
				getThisPartyStarted();
			} else {
				localPkg.initialized = true;

				localPkg.save();
				runInitializeScripts();
			}
		};

		var checkSystemDependencies = function (sysDeps) {
			if (sysDeps) {
				helper.checkDependencies(sysDeps, function (name) {
					checkIfPartyStarted();
				}, function (error) {
					done(error);
				});
			} else {
				checkIfPartyStarted();
			}
		};

		(function () {
			grunt.log.writeln();
			grunt.log.writeln("[*]".grey + (" Starting the party").magenta);

			checkSystemDependencies(pkg.systemDependencies);
		}());

	});

};
