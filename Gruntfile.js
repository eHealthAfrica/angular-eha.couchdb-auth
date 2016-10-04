module.exports = function(grunt) {

  require('load-grunt-tasks')(grunt);

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    clean: {
      dist: ['dist/'],
      tmp: ['.tmp/']
    },
    copy: {
      scripts: {
        expand: true,
        cwd: '.tmp',
        src: [
          'scripts.js',
          'scripts.template.js'
        ],
        dest: 'dist/',
        rename: function(dest, src) {
          return dest + src.replace('scripts','couchdb-auth');
        }
      }
    },
    concat: {
      scripts: {
        src: [
          'src/auth.service.js',
          'src/http-interceptor.js',
          'src/show-for-role.directive.js',
          'src/show-authenticated.directive.js',
          'src/index.js'
        ],
        dest: '.tmp/scripts.js',
        options: {
          process: function(src, path) {
            // Remove templates dependency from non-templates version if exists
            return src.replace(/,\n    'eha\.couchdb-auth\.template'/, '');
          }
        }
      },
      scriptsWithTemplateDeps:{
        src: [
          'src/**/*.js',
          '!src/**/*.spec.js'
        ],
        dest: '.tmp/scripts.template.deps.js'
      },
      template: {
        src: [
          '.tmp/template.js',
          '.tmp/scripts.template.deps.js'
        ],
        dest: '.tmp/scripts.template.js'
      }
    },
    ngAnnotate: {
      options: {
        singleQuotes: true
      },
      tmp: {
        files: [{
          expand: true,
          src: ['.tmp/**/*.js']
        }]
      }
    },
    uglify: {
      dist: {
        files: {
          'dist/couchdb-auth.template.min.js': ['.tmp/scripts.template.js'],
          'dist/couchdb-auth.min.js': ['.tmp/scripts.js']
        }
      }
    },
    html2js: {
      dist: {
        src: ['src/**/*.tpl.html'],
        dest: '.tmp/template.js',
        module: 'eha.couchdb-auth.template',
        options: {
          rename: function(moduleName) {
            var parts = moduleName.split('/');
            var index = parts.indexOf('src');
            parts = parts.slice(index + 1, parts.length);
            return 'templates/' + parts.join('/');
          }
        }
      }
    },
    karma: {
      options: {
        configFile: 'karma.conf.js'
      },
      unit: {
        singleRun: true,
        autoWatch: false
      },
      watch: {
        singleRun: false,
        autoWatch: true
      }
    },
    jscs: {
      src: ['src/**/*.js', 'tests/**/*.spec.js'],
      options: {
        config: ".jscsrc",
        requireCurlyBraces: [ "if" ]
      }
    }
  });

  grunt.registerTask('template', ['html2js']);
  grunt.registerTask('test', ['template', 'jscs', 'karma:unit']);
  grunt.registerTask('test:watch', ['karma:watch']);

  grunt.registerTask('build', function() {
    grunt.task.run([
      'clean',

      'concat:scripts',


      'ngAnnotate',
      'copy:scripts',
      'uglify:dist'
    ]);
  });

  grunt.registerTask('default', ['jscs', 'build']);
};
