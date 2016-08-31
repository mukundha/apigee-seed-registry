/**
 * Created by siriscac on 31/08/16.
 */

var showdown = require('showdown');
var converter = new showdown.Converter();
converter.setOption('headerLevelStart', '4');

module.exports = {
    toHTML: function (text) {
        var html = converter.makeHtml(text);
        return html;
    }
};