var build=require('gulp-build')
var fs = require('fs')

var Docker = require('dockerode')
var path = require('path')

const gulp = require('gulp');
const tar = require('gulp-tar');
const gzip = require('gulp-gzip');

var config = require('../config/config')
var docker_prefix = config.dockerPrefix
var docker = new Docker({socketPath: '/var/run/docker.sock'});
var request= require('request')

function dockerRun(image,action,opts,res){

	return new Promise(function(resolve,reject){
		console.log(opts)
		var pod = getPodTemplate()
		console.log(opts)
		var cmd_str= [action]
		for (var k in opts) {
			cmd_str.push( '--' + k);
			cmd_str.push(opts[k]);
		}
		console.log("Command String = " + cmd_str)
		var name = action + '-' + opts.org + '-' +  opts.env + '-' + new Date().getTime()
		pod.metadata.name = name
		var container = {
			"name": name ,
			"image": image,
			"args": cmd_str
		}
		pod.spec.containers = [container]
		console.log(JSON.stringify(pod))
		var kubectlUrl = config.kubectlUrl
		request({
			url:kubectlUrl,
			method:'POST',
			json: true,
			body: pod
		},function(err,response,body){
			if(!err){				
				var podname = body.metadata.name				
				console.log(podname)
				resolve(podname)
			}else{
				console.log(err)
				reject('deploy could not start')
			}
		})
	})
	

	// return new Promise(function(resolve,reject){
	// 	docker.pull(image, {authconfig:config.dockerAuthConfig},function(err, stream) {			
	// 		if(!err)
	// 		{
	// 			stream.pipe(process.stdout)

	// 			stream.on('end',function(){
	// 				var cmd_str= [action]
	// 				for (var k in opts) {
	// 					cmd_str.push( '--' + k);
	// 					cmd_str.push(opts[k]);
	// 			    }
	// 		    	console.log(cmd_str)
	// 		    	docker.run(image, cmd_str, [res],function(err,data,container){			
	// 				if(err) reject(err)
	// 				else{	
	// 					container.wait(function(cerr,cdata){
	// 						if(!err){
	// 							console.log('docker run success')
	// 							resolve(data)
	// 						}else{
	// 							console.log(cerr)
	// 							reject(err)
	// 						}
	// 					})
	// 				}
	// 				})	

	// 			})
	// 		}else{
	// 			console.log(err)
	// 			reject(err)
	// 		}
	// })
	// })	
}

function buildAndAdd(data){
	return new Promise(function(resolve,reject){
		gulp.src('docker/*')
		.pipe(build(data))
		.pipe(tar(data.name))
		.pipe(gzip())
		.pipe(gulp.dest('data/'))
		.on('end',function(){
			doDockerStuff(data.name,resolve,reject)
		})
	})	
}

function doDockerStuff(imageName,resolve,reject){
	buildImage(imageName).
		then(function(image){pushImage(image)},function(err){console.log(err);reject(err);})
		.then(function(){console.log('success');resolve('success')},
				function(err){console.log(err); reject(err)})
}


function buildImage(imageName){
	return new Promise(function(resolve,reject){		
		docker.buildImage('data/'  + imageName + '.gz', {
				 t: docker_prefix + imageName
		}, function(error, stream) {
			console.log(error)
			if(!error)
			{
			  stream
			  	.pipe(process.stdout)

			  stream.on('end',function(){
			  		console.log('stream ended ' )
			  		resolve(docker_prefix + imageName)		
			  	})	
			  
			}else{ reject(error)}			 		
			});		
			
		})	
}

function pushImage(image){
	var authConfig = config.dockerAuthConfig
	console.log('Pushing Image ' + image)
	return new Promise(function(resolve,reject){
		docker.getImage(image)
			.push({authconfig:authConfig},function(err,stream){
				if(!err){
					stream.pipe(process.stdout)
					stream.on('end',function(){
						console.log('stream ended - push image')
						resolve(image)
					})					
				}else{
					reject(err)
				}
			})
	})
}

function getPodTemplate(name, container){
	var temp = new Object()
	temp.apiVersion = "v1"
	temp.kind = "Pod"
	temp.metadata = {name:name},
	temp.spec = {"restartPolicy": "Never", containers:[container]}
	return temp
}

module.exports = {
	buildAndAdd: buildAndAdd,
	dockerRun: dockerRun
}
