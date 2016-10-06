var build = require('gulp-build');
var fs = require('fs');

var Docker = require('dockerode');
var path = require('path');

const gulp = require('gulp');
const tar = require('gulp-tar');
const gzip = require('gulp-gzip');

var config = require('../config/config');
var docker_prefix = config.dockerPrefix;
var docker = new Docker({socketPath: '/var/run/docker.sock'});

// var docker = new Docker(
//   {
//   	host: config.dockerHost,
//   	port: config.dockerPort,
//   	ca: fs.readFileSync(config.dockerCaFile),
//   	cert: fs.readFileSync(config.dockerCertFile),
//   	key: fs.readFileSync(config.dockerKeyFile)
//   }
// );
function dockerRun(image, action, opts, res) {
    return new Promise(function (resolve, reject) {
        docker.pull(image, {authconfig: config.dockerAuthConfig}, function (err, stream) {
            if (!err) {
                stream.pipe(process.stdout);

                stream.on('end', function () {
                    var cmd_str = [action];
                    for (var k in opts) {
                        cmd_str.push('--' + k);
                        cmd_str.push(opts[k]);
                    }
                    console.log(cmd_str);
                    docker.run(image, cmd_str, [res], function (err, data, container) {
                        if (err) reject(err);
                        else {
                            container.wait(function (cerr, cdata) {
                                if (!err) {
                                    console.log('Docker Run success');
                                    resolve(data)
                                } else {
                                    console.log(cerr);
                                    reject(err)
                                }
                            })
                        }
                    })

                })
            } else {
                console.log(err);
                reject(err);
            }
        })
    })
}

function buildAndAdd(data) {
    return new Promise(function (resolve, reject) {
        gulp.src('docker/*')
            .pipe(build(data))
            .pipe(tar(data.name))
            .pipe(gzip())
            .pipe(gulp.dest('data/'))
            .on('end', function () {
                doDockerStuff(data.name, resolve, reject);
            });
    });
}

function doDockerStuff(imageName, resolve, reject) {
    buildImage(imageName).then(
        function (image) {
            pushImage(image);
        },
        function (err) {
            console.log(err);
            reject(err);
        }
    ).then(
        function () {
            console.log('Docker procedure success');
            resolve('success')
        },
        function (err) {
            console.log(err);
            reject(err)
        }
    );
}


function buildImage(imageName) {
    return new Promise(function (resolve, reject) {
        docker.buildImage('data/' + imageName + '.gz', {
            t: docker_prefix + imageName
        }, function (error, stream) {
            console.log(error);
            if (!error) {
                stream.pipe(process.stdout);

                stream.on('end', function () {
                    console.log('Data Stream ended');
                    resolve(docker_prefix + imageName)
                })

            } else {
                reject(error)
            }
        });

    })
}

function pushImage(image) {
    var authConfig = config.dockerAuthConfig;
    console.log('Pushing Image ' + image);
    return new Promise(function (resolve, reject) {
        docker.getImage(image)
            .push({authconfig: authConfig}, function (err, stream) {
                if (!err) {
                    stream.pipe(process.stdout);
                    stream.on('end', function () {
                        console.log('Data Stream ended - Pushing image');
                        resolve(image)
                    })
                } else {
                    reject(err)
                }
            })
    })
}


module.exports = {
    buildAndAdd: buildAndAdd,
    dockerRun: dockerRun
};
