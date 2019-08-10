/*

window.addEventListener('devicemotion', function (event) {
        document.getElementById("sensor").innerHTML = "Acceleration" + event.acceleration.y + "<br>";
        // console.log(event);
    }
);

window.addEventListener('deviceorientation', function (event) {
    document.getElementById("orientation").innerHTML = "Orientation: " + event.orientation_alpha + "<br>";
    // document.getElementById("orientation").innerHTML = window.DeviceOrientationEvent;
});

// if ('ondevicelight' in window) {
//     window.addEventListener('devicelight', function(event) {
//         document.getElementById("light").innerHTML = "Light: " + event.value;
//     });
// } else {
//     console.log('devicelight event not supported');
// }

// var influent = require(['js/influent']);

require(["js/influent"], function (influent) {
    influent
        .createHttpClient({
            server: [
                {
                    protocol: "https",
                    host: "193.196.37.63",
                    port: 8086
                }
            ],
            username: "",
            password: "",

            database: "db0"
        })
        .then(function (client) {
            client
                .query("show databases")
                .then(function (result) {
                    console.log(result);
                });

            // super simple point
            // client.write_data({key: "myseries", value: 10});

            // more explicit point
            client
                .write_data({
                    key: "myseries",
                    tags: {
                        some_tag: "sweet"
                    },
                    fields: {
                        some_field: 10
                    },
                    timestamp: Date.now()
                })
                .then(function () {
                    // ...
                });
        });
});
*/


// PREDICTIONS


document.getElementById('walk').style.display = 'none';
document.getElementById('prediction').style.display = 'none';
document.getElementById('calories').style.display = 'none';



document.getElementById('use_app').onchange = function () {
    if (this.checked) {


        // Write DeviceOrientation to buffer
        if (window.DeviceOrientationEvent) {
            window.addEventListener('deviceorientation', function (orientation) {
                if (!isNaN(orientation.alpha)) {
                    buf.orientation_alpha.push(orientation.alpha);
                }
                if (!isNaN(orientation.beta)) {
                    buf.orientation_beta.push(orientation.beta);
                }
                if (!isNaN(orientation.gamma)) {
                    buf.orientation_gamma.push(orientation.gamma);
                }
            }, false);
            // interval_orientation = window.setInterval(write_data, 1000 / UPLOAD_RATE);
        } else {
            document.getElementById("debug").innerHTML = "DeviceOrientation not supported."
        }

        // Write Acceleration to buffer
        if (window.DeviceMotionEvent) {
            window.addEventListener('devicemotion', function (acceleration) {
                if (!isNaN(acceleration.acceleration.x)) {
                    buf.acceleration_x.push(acceleration.acceleration.x);
                }
                if (!isNaN(acceleration.acceleration.y)) {
                    buf.acceleration_y.push(acceleration.acceleration.y);
                }
                if (!isNaN(acceleration.acceleration.y)) {
                    buf.acceleration_z.push(acceleration.acceleration.z);
                }
            }, false);
            // interval_acceleration = window.setInterval(write_acceleration, 1000 / UPLOAD_RATE);
        } else {
            document.getElementById("debug").innerHTML = "DeviceMotion not supported."
        }
        interval_write_to_array = window.setInterval(write_to_array, 1000 / UPLOAD_RATE);
    }
    // interval_orientation = window.setInterval(write_data, 1000 / UPLOAD_RATE);
    // interval_acceleration = window.setInterval(write_acceleration, 1000 / UPLOAD_RATE);

    // use one periodically called function for synchronized time stamps in DB


    else {
        // window.clearInterval(interval_orientation);
        // window.clearInterval(interval_acceleration);
        window.clearInterval(interval_write_to_array);
        rolling_buf = new RollingValues();
        count_buf = 0;
        // write_data();
        // write_acceleration();

        document.getElementById('walk').style.display = 'none';
        document.getElementById('prediction').style.display = 'none';
        document.getElementById('calories').style.display = 'none';
    }
};

function RollingValues() {
    return {
        orientation_alpha: [],
        orientation_beta: [],
        orientation_gamma: [],
        acceleration_x: [],
        acceleration_y: [],
        acceleration_z: []
    }
}

rolling_buf = new RollingValues();
count_buf = 0;

// Variables for keeping track of the run-time
var start;
var end;
var started = false;
write_to_array = function () {

    // console.log(buf);
    // TODO
    // if (buf.orientation_alpha.length > 0 && buf.acceleration_x.length > 0) {
    if (buf.orientation_alpha.length > 0) {
        // console.log('alpha', buf.orientation_alpha.length);
        // console.log('beta', buf.orientation_beta.length);
        // console.log('gamma', buf.orientation_gamma.length);
        // console.log('x', buf.acceleration_x.length);
        // console.log('y', buf.acceleration_y.length);
        // console.log('z', buf.acceleration_z.length);

        var v = buf; //copy old buffer to var to avoid async effects on write_data
        buf = new Values(); // reset buffer

        function milli_mean_int(values) {
            var sum = values.reduce(function (a, b) {
                return a + b;
            });
            return Math.floor(sum * 1000 / values.length);
        }

        // gets written 20 times a second
        count_buf++;
        rolling_buf.orientation_alpha.push(milli_mean_int(v.orientation_alpha));
        rolling_buf.orientation_beta.push(milli_mean_int(v.orientation_beta));
        rolling_buf.orientation_gamma.push(milli_mean_int(v.orientation_gamma));
        rolling_buf.acceleration_x.push(milli_mean_int(v.acceleration_x));
        rolling_buf.acceleration_y.push(milli_mean_int(v.acceleration_y));
        rolling_buf.acceleration_z.push(milli_mean_int(v.acceleration_z));


        if(count_buf > 19){
            // make POST request to openscoring server to get prediction
            // console.log(Math.min(...rolling_buf.orientation_alpha));
            // console.log(...rolling_buf.orientation_alpha);

            $.ajax({
                url: "https://193.196.37.63/ajax/openscoring/model/SupportVectorMachine",
                type: "POST",
                data: JSON.stringify({
                    "id": "record--01",
                    "arguments": {
                        "acceleration_y_rolling_max": Math.max(...rolling_buf.acceleration_y),
                        "acceleration_y_rolling_min": Math.min(...rolling_buf.acceleration_y)
                    }
                }),
                contentType: 'application/json',
                dataType: 'json',
                success: function (result) {
                    // document.getElementById("log").innerHTML = Date.now() + ':  '+ JSON.stringify(result);

                    if(result["results"]["y"] === "walking"){
                        // console.log((Date.now() - start));
                        if((end - start) > 5000){
                            document.getElementById('walk').style.display = 'none';
                            document.getElementById('prediction').style.display = 'none';
                            calories = Math.ceil((end - start) / 10000); // one calorie per 10 seconds
                            text = "You burned " + calories + "calories<br>🥳";
                            text = "<span class=\"text-no-animation\">\You burned \ "+ calories + " \calories<br>🥳</span>"
                            document.getElementById('calories-text').innerHTML = text;
                            document.getElementById('calories').style.display = 'block';
                        }
                        else {
                            start = Date.now();
                            document.getElementById('walk').style.display = 'block';
                            document.getElementById('calories').style.display = 'none';
                            document.getElementById('prediction').style.display = 'none';
                        }
                        started = false;
                    // case 'running'
                    } else {
                        if(!started){
                            start = Date.now();
                            started = true;
                        }
                        end = Date.now()
                        document.getElementById('walk').style.display = 'none';
                        document.getElementById('calories').style.display = 'none';
                        document.getElementById('prediction').style.display = 'block';
                    }

                }});


            // reset
            rolling_buf = new RollingValues();
            count_buf = 0;



        }
        // console.log(count_buf);
    } else {
        // console.log('Either no orientation or no acceleration data - nothing has been written to the DB');
    }
};


// RECORD Data

function hide(class_name) {
    var class_to_hide = document.getElementsByClassName(class_name);
    for (var i = 0; i < class_to_hide.length; i++) {
        class_to_hide[i].style.display = 'none';

    }
}

function show(class_name) {
    var class_to_show = document.getElementsByClassName(class_name);

    for (var i = 0; i < class_to_show.length; i++) {
        class_to_show[i].style.display = 'block';
    }
}

// Global variables to store current values.
var buf;
// var acceleration_buf;

//make constructor to easily initiallize all arrays
function Values() {
    return {
        orientation_alpha: [],
        orientation_beta: [],
        orientation_gamma: [],
        acceleration_x: [],
        acceleration_y: [],
        acceleration_z: []
    }
}

buf = new Values(); // start empty
// acceleration_buf = new AccelerationValues(); // start empty

// How many data points are uploaded per second?
var UPLOAD_RATE = 20;

// only created if client below is _not_ instantiated successfully
var write_data = function () {
    document.getElementById("debug").innerHTML = "DataBase not Connected!!"
};

// var write_acceleration = function () {
//     document.getElementById("debug").innerHTML = "DataBase not Connected!!"
// };

// var writePoint = function () {
//     noWrite()
// } //do not pass object reference otherwise noWrite might get overwritten ?!?

// Stop/Start uploading depending on switch.
// var interval_orientation; // Global var for setInterval setting/clearing.
// var interval_acceleration;
var interval;
document.getElementById('record').onchange = function () {
    if (this.checked) {
        show('values_debug');
        label = document.getElementById("label").value;
        subject = document.getElementById("subject").value;
        // writePoint = function () {
        //     write_data()
        // };

        if (isNaN(subject)) {
            window.clearInterval(interval);
            // window.clearInterval(interval_orientation);

            // Write DeviceOrientation to buffer
            if (window.DeviceOrientationEvent) {
                window.addEventListener('deviceorientation', function (orientation) {
                    if (!isNaN(orientation.alpha)) {
                        buf.orientation_alpha.push(orientation.alpha);
                    }
                    if (!isNaN(orientation.beta)) {
                        buf.orientation_beta.push(orientation.beta);
                    }
                    if (!isNaN(orientation.gamma)) {
                        buf.orientation_gamma.push(orientation.gamma);
                    }
                }, false);
                // interval_orientation = window.setInterval(write_data, 1000 / UPLOAD_RATE);
            } else {
                document.getElementById("debug").innerHTML = "DeviceOrientation not supported."
            }

            // Write Acceleration to buffer
            if (window.DeviceMotionEvent) {
                window.addEventListener('devicemotion', function (acceleration) {
                    if (!isNaN(acceleration.acceleration.x)) {
                        buf.acceleration_x.push(acceleration.acceleration.x);
                    }
                    if (!isNaN(acceleration.acceleration.y)) {
                        buf.acceleration_y.push(acceleration.acceleration.y);
                    }
                    if (!isNaN(acceleration.acceleration.y)) {
                        buf.acceleration_z.push(acceleration.acceleration.z);
                    }
                }, false);
                // interval_acceleration = window.setInterval(write_acceleration, 1000 / UPLOAD_RATE);
            } else {
                document.getElementById("debug").innerHTML = "DeviceMotion not supported."
            }

        } else {
            this.checked = false;
            document.getElementById("debug").innerHTML = "Enter name first."
        }
        // interval_orientation = window.setInterval(write_data, 1000 / UPLOAD_RATE);
        // interval_acceleration = window.setInterval(write_acceleration, 1000 / UPLOAD_RATE);

        // use one periodically called function for synchronized time stamps in DB
        interval = window.setInterval(write_data, 1000 / UPLOAD_RATE);

    } else {
        // window.clearInterval(interval_orientation);
        // window.clearInterval(interval_acceleration);
        window.clearInterval(interval);
        write_data();
        // write_acceleration();
        hide('values_debug');
    }
};

//use "bower install requirejs influent"
require(["js/influent"], function (influent) {
    influent
        .createHttpClient({
            server: [
                {
                    protocol: "https",
                    host: "193.196.37.63",
                    port: 8086
                }
            ],
            username: "admin",
            password: "admin",

            database: "test"
            // database: "production"
        })
        .then(function (client) {
            //set the write_data function to empty our buffer (called periodically, see above)
            write_data = function () {
                // console.log(buf);
                // TODO
                // if (buf.orientation_alpha.length > 0 && buf.acceleration_x.length > 0) {
                if (buf.orientation_alpha.length > 0) {
                    // console.log('alpha', buf.orientation_alpha.length);
                    // console.log('beta', buf.orientation_beta.length);
                    // console.log('gamma', buf.orientation_gamma.length);
                    // console.log('x', buf.acceleration_x.length);
                    // console.log('y', buf.acceleration_y.length);
                    // console.log('z', buf.acceleration_z.length);

                    var v = buf; //copy old buffer to var to avoid async effects on write_data
                    buf = new Values(); // reset buffer

                    function milli_mean_int(values) {
                        var sum = values.reduce(function (a, b) {
                            return a + b;
                        });
                        return Math.floor(sum * 1000 / values.length);
                    }

                    client.write({
                        key: "sensor",
                        tags: {
                            label: document.getElementById("label").value,
                            subject: document.getElementById("subject").value
                        },
                        fields: {
                            orientation_alpha: milli_mean_int(v.orientation_alpha), //use mean * 1000 (int for efficiency)
                            orientation_beta: milli_mean_int(v.orientation_beta),
                            orientation_gamma: milli_mean_int(v.orientation_gamma),
                            acceleration_x: milli_mean_int(v.acceleration_x),
                            acceleration_y: milli_mean_int(v.acceleration_y),
                            acceleration_z: milli_mean_int(v.acceleration_z),
                        },
                        timestamp: Date.now() * 1000000 // JavaScript records time in milliseconds, so you won't be able to get time to that precision. The smart-aleck answer is to "multiply by 1,000,000".
                    }).then(function () {
                        document.getElementById("orientation_alpha").innerHTML = "orientation_alpha: " + milli_mean_int(v.orientation_alpha);
                        document.getElementById("orientation_beta").innerHTML = "orientation_beta: " + milli_mean_int(v.orientation_beta);
                        document.getElementById("orientation_gamma").innerHTML = "orientation_gamma: " + milli_mean_int(v.orientation_gamma);
                        document.getElementById("acceleration_x").innerHTML = "acceleration_x: " + milli_mean_int(v.acceleration_x);
                        document.getElementById("acceleration_y").innerHTML = "acceleration_y: " + milli_mean_int(v.acceleration_y);
                        document.getElementById("acceleration_z").innerHTML = "acceleration_z: " + milli_mean_int(v.acceleration_z);
                    });
                } else {
                    // console.log('Either no orientation or no acceleration data - nothing has been written to the DB');
                }
            };

            // write_acceleration = function () {
            //     // console.log('bbbb');
            //     if (acceleration_buf.acceleration_x.length > 0) {
            //         var v = acceleration_buf; //copy old buffer to var to avoid async effects on write_data
            //         acceleration_buf = new AccelerationValues(); // reset buffer
            //
            //         function milli_mean_int(values) {
            //             var sum = values.reduce(function (a, b) {
            //                 return a + b;
            //             });
            //             return Math.floor(sum * 1000 / values.length);
            //         }
            //
            //         client.write({
            //             key: "acceleration",
            //             tags: {
            //                 label: document.getElementById("label").value,
            //                 subject: document.getElementById("subject").value
            //             },
            //             fields: {
            //                 acceleration_x: milli_mean_int(v.acceleration_x),
            //                 acceleration_y: milli_mean_int(v.acceleration_y),
            //                 acceleration_z: milli_mean_int(v.acceleration_z),
            //             },
            //             timestamp: Date.now() * 1000000 // JavaScript records time in milliseconds, so you won't be able to get time to that precision. The smart-aleck answer is to "multiply by 1,000,000".
            //         }).then(function () {
            //             document.getElementById("acceleration_x").innerHTML = "acceleration_x: " + milli_mean_int(v.acceleration_x);
            //             document.getElementById("acceleration_y").innerHTML = "acceleration_y: " + milli_mean_int(v.acceleration_y);
            //             document.getElementById("acceleration_z").innerHTML = "acceleration_z: " + milli_mean_int(v.acceleration_z);
            //         });
            //     }
            // };

        })
})