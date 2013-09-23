/*jshint node:true*/

var fs = require('fs'),
	handlebars = require('handlebars'),
	uglify = require('uglify-js'),
	jshintcomment;

jshintcomment = '/*jshint boss:true, white:false, eqnull:true*/\n';

function compile (src, dst) {
	"use strict";

	var data = fs.readFileSync(src, 'utf8'),
		output = [],
		ast;

	console.log(src, dst);

	output.push('define(["handlebars"], function(Handlebars) {\n');
	output.push('return Handlebars.template(' + handlebars.precompile(data, {}) + ');});');

	output = output.join('\n');

	// ast = uglify.parser.parse(output);
	// ast = uglify.uglify.ast_mangle(ast);
	// ast = uglify.uglify.ast_squeeze(ast);
	// output = uglify.uglify.gen_code(ast, {
		// beautify : true,
		// indent_level : 4
	// });

	var result = uglify.minify(output, {
		fromString: true
	});

	fs.writeFileSync(dst, jshintcomment + result.code + '\n', 'utf8');
}

module.exports = function (grunt) {
	"use strict";

	/************************************
		Config
	************************************/

	grunt.config.set("handlebars", {
		dev: [
			"project/source/js/**/*.hbs"
		],
		prod: [
			"project/source/js/**/*.hbs"
		]
	});

	/************************************
		Task
	************************************/

	grunt.config.set("watch.handlebars", {
		files : grunt.config.get("handlebars").dev,
		tasks : ["handlebars:dev"]
	});

	grunt.config.set("build.handlebars", ["handlebars:prod"]);

	grunt.registerMultiTask("handlebars", "Compile handlebars templates", function () {
		this.requiresConfig("handlebars");

		var i, j, k, l,
			files = [],
			src,
			dst;

		for (i = 0, j = this.data.length; i < j; i++) {

			files = grunt.file.expand({
				filter: "isFile"
			}, this.data[i]);

			for (k = 0, l = files.length; k < l; k++) {

				src = files[k];
				dst = src.replace('.hbs', '.js');

				compile(src, dst);
			}
		}
	});

};
