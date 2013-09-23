/*jslint node: true */

module.exports = function (grunt, helper, cb) {
	"use strict";

	var fs = require("fs"),
		path = require("path"),
		pkgPath = path.join(__dirname, "..", "..", "plugin.json"),
		pkg = require(pkgPath),
		source = pkg.config.scope,
		cwd = process.cwd();

	var installExternalScripts = function () {
		var bower = require("bower");
		var _ = grunt.util._;

		// Change directory to js root
		if (!fs.existsSync(path.join(cwd, source))) {
			grunt.file.mkdir(path.join(cwd, source));
		}

		process.chdir(path.join(cwd, source));

		// Read .bowerrc settings into bower.config
		var rc = JSON.parse(fs.readFileSync(path.join(cwd, source, ".bowerrc")));
		_.extend(bower.config, rc);

		var title;

		// Install libs
		bower.commands.install([
			"https://github.com/jpweeks/red-backbone.git",
			"https://github.com/jpweeks/red-backbone-example.git"
		]).on("data", function (data) {
			if (grunt.option("verbose")) {
				process.stdout.write("    " + data);
			} else {
				if (!title) {
					title = "Fetching external libraries";
					process.stdout.write("    " + title.grey);
				}

				process.stdout.write(".".grey);
			}
		}).on("end", function (data) {
			if (!grunt.option("verbose")) {
				process.stdout.write("OK".green + "\n");
			}

			process.chdir(cwd);

			var libs = path.join(cwd, source, "libs");
			var project = path.join(libs, "red-backbone-example");

			if (fs.existsSync(project)) {
				var robynPkg = require(path.join(cwd, "robyn.json"));
				var localPkg = require(path.join(cwd, robynPkg.config.dirs.robyn, "tasks", "utils", "pkg"));

				// Move config.js into project directory
				var rbbConfig = path.join(libs, "red-backbone", "config.js");
				var existingConfig = path.join(cwd, source, "config.js");

				if (fs.existsSync(rbbConfig) && !fs.existsSync(existingConfig)) {
					grunt.file.copy(rbbConfig, existingConfig);
				}

				var bowerConfig = path.join(project, "bower.json");

				if (fs.existsSync(bowerConfig)) {
					fs.unlinkSync(bowerConfig);
				}

				// Copy example project from libs into project directory, remove from libs
				var projectPath = path.join(cwd, source, localPkg.config.vars.PROJECT_NAME);

				if (!fs.existsSync(projectPath)) {
					grunt.file.recurse(project, function (abspath, rootdir, subdir, filename) {
						if (subdir) {
							filename = path.join(subdir, filename);
						}

						grunt.file.copy(abspath, path.join(projectPath, filename));
					});
				}

				grunt.file.delete(project);
			}

			return ignoreTests();
		});
	};

	var ignoreTests = function () {
		var ignorepath = path.join(cwd, source),
			ignorefile = path.join(ignorepath, ".jshintignore");

		if (!fs.existsSync(ignorefile)) {
			return exit();
		}

		var newcontent = fs.readFileSync(ignorefile).toString().trim();
		var hasTest = newcontent.split("\n").filter(function (line) {
			return line.trim() === "test";
		});

		if (!hasTest) {
			newcontent += "\n" + "test" + "\n";
			fs.writeFileSync(ignorefile, newcontent);
		}

		return exit();
	};

	var exit = function (error) {
		if (cb) {
			cb(error);
		} else {
			process.exit();
		}
	};

	installExternalScripts();
};
