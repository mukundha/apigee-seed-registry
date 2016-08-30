/**
 * Created by siriscac on 16/08/16.
 */

var baas = require('./baas');
var constants = require('./../constants/constants');

function createUser(name, user_uuid, email, callback) {
    var data = {
        name: name,
        user_uuid: user_uuid,
        email: email
    };

    baas.post(constants.USERS, data, callback);
}

function fetchUser(email, callback) {
    baas.get(constants.USERS, "select * where email=" + email, callback);
}

function updateUser(name, user_uuid, email, id, callback) {
    var data = {
        name: name,
        user_uuid: user_uuid,
        email: email
    };

    baas.put(constants.USERS, data, id, callback);
}

module.exports = {
    createUser: createUser,
    fetchUser: fetchUser,
    updateUser: updateUser
};