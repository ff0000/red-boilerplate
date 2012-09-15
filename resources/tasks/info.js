module.exports = function(grunt) {

	grunt.registerTask("info", "List project info", function () {

		var done = this.async();
		var path = require("path");
		var colors = require("colors");
		var hasInitialized;

		grunt.helper("check_initialized", function (initialized) {
			hasInitialized = initialized;

			if (!initialized) {
				grunt.task.run("start");
			}
		});

		var pkg = require("./utils/pkg");
		var org = pkg.config.org;

		var keys = ["name", "version", "author", "description"];
		var i, j;

		grunt.log.writeln();

		for (i = 0, j = keys.length; i < j; i++) {
			if (pkg[keys[i]]) {
				grunt.log.writeln((i === 0 ? "[*] " : "    ").cyan + "Project %k:".replace("%k", keys[i]).grey + " %v".replace("%v", pkg[keys[i]]));
			}
		}

		if (pkg.repository) {
			grunt.log.writeln("    " + "Project repository:".grey + " %s".replace("%s", pkg.repository.url));
		}

		grunt.log.writeln();
		grunt.log.writeln("[*] ".cyan + "Boilerplate version: %s".replace("%s", org.version).magenta);
		grunt.log.writeln("    via %u @ branch %b".grey.replace("%u", org.repository.url).replace("%b", org.repository.branch));
		grunt.log.writeln();

		var plugTitle;

		for (var key in pkg.config.installedPlugins) {
			if (!plugTitle) {
				grunt.log.writeln("[*] ".cyan + "Installed plugins:".magenta);
				plugTitle = true;
			}

			var plug = pkg.config.installedPlugins[key];

			if (typeof plug !== "string") {
				grunt.log.writeln("[+] ".grey + "%n %v".replace("%n", key).replace("%v", plug.version).cyan + " (%d)".replace("%d", plug.description).grey);
			} else {
				grunt.log.writeln("[+] ".grey + key.cyan + " (%d)".replace("%d", plug).grey);
			}
		}

		if (pkg.config.warnings) {
			grunt.log.writeln();
			grunt.log.writeln("[!] The following warnings were ignored:".yellow);

			var warnings = pkg.config.warnings;
			var warn, k;

			for (j = 0, k = warnings.length; j < k; j++) {
				warn = warnings[j];
				console.warn("[!] ".yellow + warn.plugin.cyan + " requires " + (warn.bin + " " + warn.version).magenta +
				". " + (warn.error || "You are on version " + warn.installedVersion.red.bold + "."));
			}
		}

		done();
	});

};