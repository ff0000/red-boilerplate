/*jslint node: true */

module.exports = function (grunt, helper, cb) {
	"use strict";

	var fs = require("fs"),
		cwd = process.cwd(),
		path = require("path"),
		pkgPath = path.join(__dirname, "..", "..", "plugin.json");

	var removeConfig = function () {
		if (fs.existsSync(pkgPath)) {
			var pkg = require(pkgPath),
				rbPath = path.join(cwd, pkg.config.scope, "config.rb");

			if (fs.existsSync(rbPath)) {
				fs.unlinkSync(rbPath);
				return exit();
			} else {
				return exit();
			}
		} else {
			return exit();
		}
	};

	var installGems = function () {
		helper.spawn({
			cmd: "bundle",
			args: ["install", "--path", ".bundle"],
			title: "Installing Ruby gem bundle. This may take a minute",
			complete: function (code) {
				if (code !== 0) {
					return exit("No executable named bundle found.");
				}

				removeConfig();
			}
		});
	};

	var moveGemfileToRoot = function () {
		var gempath = path.join(__dirname, "..", "Gemfile");
		var existingpath = path.join(cwd, "Gemfile");

		if (fs.existsSync(gempath) && !fs.existsSync(existingpath)) {
			grunt.file.copy(gempath, existingpath);
		}

		if (fs.existsSync(gempath + ".lock") && !fs.existsSync(existingpath + ".lock")) {
			grunt.file.copy(gempath + ".lock", existingpath + ".lock");
		}

		installGems();
	};

	var removeCabooseTests = function () {
		if (fs.existsSync(pkgPath)) {
			var pkg = require(pkgPath),
				testpath = path.join(cwd, pkg.config.scope, "test");

			if (fs.existsSync(testpath)) {
				grunt.file.delete(testpath);
			}
		}

		moveGemfileToRoot();
	};

	var moveAssetsToImageDir = function () {
		if (fs.existsSync(pkgPath)) {
			var pkg = require(pkgPath),
				file = "boxsizing.htc",
				imgpath = path.join(cwd, pkg.config.scope, "img"),
				dirpath = path.join(cwd, pkg.config.scope, "images"),
				htcpath = path.join(dirpath, file);

			if (fs.existsSync(dirpath) && fs.existsSync(htcpath)) {
				grunt.file.copy(htcpath, path.join(imgpath, file));

				grunt.file.delete(htcpath);
				grunt.file.delete(dirpath);
			}

			var caboosePath = path.join(cwd, pkg.config.scope, "scss", "caboose");
			var cfPath = path.join(caboosePath, "rosy", "google-chrome-frame", "images", "global");

			if (fs.existsSync(cfPath)) {
				grunt.file.recurse(cfPath, function (abspath, rootdir, subdir, filename) {
					if (subdir) {
						filename = path.join(subdir, filename);
					}

					grunt.file.copy(abspath, path.join(imgpath, "global", filename));
				});
			}
		}

		return removeCabooseTests();
	};

	var exit = function (error) {
		if (cb) {
			cb(error);
		} else {
			process.exit();
		}
	};

	moveAssetsToImageDir();

};
