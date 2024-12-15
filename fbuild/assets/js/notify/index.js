'use strict';
var notify = $.notify('<i class="fa fa-cloud-upload"></i><strong>Loading</strong> page Do not close this page...', {
    type: 'theme',
    allow_dismiss: true,
    delay: 2000,
    timer: 300
});

setTimeout(function() {
    notify.update('message', '<i class="fa fa-cloud-upload"></i><strong>Loading</strong> Inner Data.');
}, 1000);
