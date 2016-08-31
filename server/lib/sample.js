/**
 * Created by siriscac on 16/08/16.
 */

var baas = require('./baas');
var constants = require('./../constants/constants');
var registry = require('./../registry');

function createSample(entity, callback) {
    entity.in_registry = false;
    baas.post(constants.SAMPLES, entity, callback);
}

function checkID(id, sub, callback) {
    var curr_id = id;
    if (sub != -1) {
        curr_id = id + "-" + sub;
    }
    fetchSample(curr_id, function (error, entities) {
        if (error) {
            console.log(error);
            callback(error, null)
        } else {
            if (entities.length <= 0) {
                return callback(null, curr_id);
            } else {
                checkID(id, ++sub, callback);
            }
        }
    });
}

function replaceAll(str, find, replace) {
    return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
}

function escapeRegExp(str) {
    return str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
}

function fetchSample(uuid, callback) {
    baas.get(constants.SAMPLES, "select * where uuid='" + uuid + "'", callback);
}

function fetchSampleByName(name, callback) {
    baas.get(constants.SAMPLES, "select * where name='" + name + "'", callback);
}

function fetchSamples(callback) {
    baas.get(constants.SAMPLES, null, callback);
}

function deleteSample(id, callback) {
    baas.del(constants.SAMPLES, id, callback);
}

function updateSample(id, name, description, gitRepo, apiFolder, user, inRegistry, callback) {
    var data = {
        name: id,
        display_name: name,
        description: description,
        git_repo: gitRepo,
        api_folder: apiFolder,
        user: user,
        in_registry: inRegistry
    };

    baas.put(constants.SAMPLES, data, id, callback);
}

module.exports = {
    createSample: createSample,
    deleteSample: deleteSample,
    fetchSample: fetchSample,
    fetchSampleByName: fetchSampleByName,
    fetchSamples: fetchSamples,
    updateSample: updateSample
};
