/* jshint node: true */

module.exports = function (grunt) {
	"use strict";

	var fs = require("fs"),
		path = require("path"),
		rosy = require(path.join(__dirname, "..", "..", "rosy", "plugin.json")),
		output = path.join("project", "static", "js"),
		source = rosy.config.scope;

	// Project configuration.
	grunt.config.set("modernizr", {
		"dist": {
			// [REQUIRED] Path to the build you're using for development.
			"devFile" : path.join(source, "libs", "modernizr", "index.js"),

			// [REQUIRED] Path to save out the built file.
			"dest" : path.join(output, "libs", "modernizr", "modernizr.min.js"),

			// Based on default settings on http://modernizr.com/download/
			"options" : [
				"setClasses",
				"addTest",
				"html5printshiv",
				// "load",
				"testProp",
				"fnBind"
			],

			// By default, source is uglified before saving
			"uglify" : true,

			// Define any tests you want to impliticly include.
			"tests" : [],

			// By default, this task will crawl your project for references to Modernizr tests.
			// Set to false to disable.
			"crawl" : true,

			// When parseFiles = true, this task will crawl all *.js, *.css, *.scss files.
			// You can override this by defining a "files" array below.
			"files" : [
				path.join(source, "**", "*.js"),
				path.join(source, "..", "{sass,scss}", "**", "*.scss")
			],

			// Have custom Modernizr tests? Add paths to their location here.
			"customTests" : []
		}
	});

	grunt.config.set("build.modernizr", ["modernizr"]);

	grunt.loadNpmTasks("grunt-modernizr");

};
