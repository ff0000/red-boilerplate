/*jshint node: true */
module.exports = function (grunt) {
	"use strict";

	var fs = require("fs"),
		path = require("path"),
		cwd = process.cwd(),
		source = path.join("project", "source", "js");

	var logPlugins = function (filtered) {
		for (var i = 0, j = filtered.length; i < j; i++) {
			var plug = filtered[i];
			grunt.log.writeln("[+] ".grey + "%n".replace("%n", plug.shortname).cyan);
		}
	};

	grunt.config.set("watch.backbone", {
		files: [
			path.join(source, "*.js"),
			path.join(source, grunt.template.process("<%= meta.projectName %>"), "**", "*.js")
		],
		options: {
			interrupt: true,
			livereload: true,
			debounceDelay: 250
		}
	});

};
