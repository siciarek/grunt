/*
 * grunt
 * http://gruntjs.com/
 *
 * Copyright (c) 2012 "Cowboy" Ben Alman
 * Licensed under the MIT license.
 * http://benalman.com/about/license/
 */

'use strict';

module.exports = function(grunt) {

  // Nodejs libs.
  var chokidar = require('chokidar');

  // ==========================================================================
  // TASKS
  // ==========================================================================

  grunt.registerTask('watch', 'Run predefined tasks whenever watched files change.', function(target) {
    this.requiresConfig('watch');
    // Build an array of files/tasks objects.
    var watch = grunt.config('watch');
    var targets = target ? [target] : Object.keys(watch).filter(function(key) {
      return typeof watch[key] !== 'string' && !Array.isArray(watch[key]);
    });
    targets = targets.map(function(target) {
      // Fail if any required config properties have been omitted.
      target = ['watch', target];
      this.requiresConfig(target.concat('files'), target.concat('tasks'));
      return grunt.config(target);
    }, this);

    // Allow "basic" non-target format.
    if (typeof watch.files === 'string' || Array.isArray(watch.files)) {
      targets.push({files: watch.files, tasks: watch.tasks});
    }

    grunt.log.write('Waiting...');

    // This task is asynchronous.
    var taskDone = this.async();
    // Get a list of files to be watched.
    var patterns = grunt.util._.chain(targets).pluck('files').flatten().uniq().value();
    var getFiles = grunt.file.expandFiles.bind(grunt.file, patterns);
    // This task's name + optional args, in string format.
    var nameArgs = this.nameArgs;
    // File changes to be logged.
    var changedFiles = {};

    // List of changed / deleted file paths.
    grunt.file.watchFiles = {changed: [], deleted: []};

    // Define an alternate fail "warn" behavior.
    grunt.fail.warnAlternate = function() {
      grunt.task.clearQueue({untilMarker: true}).run(nameArgs);
    };

    var watchFiles = getFiles();

    // init file watcher
    var watcher = chokidar.watch(watchFiles, {persistent: true});

    // Cleanup when files have changed. This is debounced to handle situations
    // where editors save multiple files "simultaneously" and should wait until
    // all the files are saved.
    var done = grunt.util._.debounce(function() {
      // Ok!
      grunt.log.ok();
      var fileArray = Object.keys(changedFiles);
      fileArray.forEach(function(filepath) {
        var status = changedFiles[filepath];
        // Log which file has changed, and how.
        grunt.log.ok('File "' + filepath + '" ' + status + '.');
        // Add filepath to grunt.file.watchFiles for grunt.file.expand* methods.
        grunt.file.watchFiles[status === 'deleted' ? 'deleted' : 'changed'].push(filepath);
        // Clear the modified file's cached require data.
        grunt.file.clearRequireCache(filepath);
      });
      // Unwatch all watched files.
      watcher.close();
      // For each specified target, test to see if any files matching that
      // target's file patterns were modified.
      targets.forEach(function(target) {
        // What files in fileArray match the target.files pattern(s)?
        var files = grunt.file.match(target.files, fileArray);
        // Enqueue specified tasks if at least one matching file was found.
        if (files.length > 0 && target.tasks) {
          grunt.task.run(target.tasks).mark();
        }
      });
      // Enqueue the watch task, so that it loops.
      grunt.task.run(nameArgs);
      // Continue task queue.
      taskDone();
    }, 250);

    // file deleted
    watcher.on('unlink', function(filepath) {
      changedFiles[filepath] = 'deleted';
      done();
    });

    // file changed
    watcher.on('change', function(filepath) {
      changedFiles[filepath] = 'changed';
      done();
    });

    // on watcher error
    watcher.on('error', function(err) {
      grunt.log.error(err.message);
    });

    // keep alive
    setInterval(function() {

      // poll if the files still exists on OSX
      // until unlink on OSX is fixed: paulmillr/chokidar#9
      if (process.platform === 'darwin') {
        watchFiles.forEach(function(filepath) {
          if (!grunt.file.exists(filepath)) {
            watchFiles = grunt.util._.without(watchFiles, filepath);
            watcher.emit('unlink', filepath);
          }
        });
      }

    }, 200);

  });

};
