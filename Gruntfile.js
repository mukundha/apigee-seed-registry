/**
 * Created by siriscac on 19/08/16.
 */

module.exports = function (grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        watch: {
            express: {
                files: ['**/*.js'],
                tasks: ['build'],
                options: {
                    spawn: false // for grunt-contrib-watch v0.5.0+ and "nospawn: true" for lower versions
                }
            }
        },
        grunt: {},
        shell: {
            options: {
                stderr: false
            }
        },
        copy: {
            configdev: {
                src: 'config/config.dev.js',
                dest: 'config/config.js'
            },
            configprod: {
                src: 'config/config.prod.js',
                dest: 'config/config.js'
            }
        },
        express: {
            options: {
                // Override defaults here
            },
            dev: {
                options: {
                    script: 'app.js',
                    port: 5000
                }
            },
            prod: {
                options: {
                    script: 'app.js',
                    node_env: 'production',
                    port: 80
                }
            }
        }
    });

    grunt.loadNpmTasks('grunt-express-server');
    grunt.loadNpmTasks('grunt-grunt');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-copy');
    require('load-grunt-tasks')(grunt);

    grunt.registerTask('env', 'change environment to run the app', function (target) {
        target = target || 'dev';

        grunt.task.run([
            'copy:config' + target
        ])
    });

    grunt.registerTask('build', 'change environment to run the app', function (target) {
        target = target || 'dev';

        if (target === 'prod') {
            grunt.task.run([
                'env:prod',
                'express:prod'
            ])
        } else {
            grunt.task.run([
                'env:dev',
                'express:dev',
                'watch'
            ])
        }
    });
};
