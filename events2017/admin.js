$(document).ready(function() {
    $(".centre").hide(); 																						            // hide content
    $("#login").show(); 																						            // show login modal
    checkAuth();																																// runs check auth on page load

    /* checks if user is logged in or not */
    function checkAuth() {
        $.getJSON("/events2017/auth/valid", { 																	// get all venues
            dataType: 'jsonp',
            format: "json"
        }, function(resp) {
            if (resp.valid == "true") { 																				// if is logged in
                $(".centre").show(); 																						// show content
                $("#login").hide();
                loadVenues(); 																									// load page
            } else {
                $(".centre").hide(); 																						// else hide content
                $("#login").show(); 																						// show login modal
            }
        });
    }

    $("#datepicker").datetimepicker();																					// loads date picker
    var lastVenClicked = "1";																										// keeps track of which venue events are being added to
    var lastVenDel = "1";
    var lastEventDel = "1";

    function loadVenues() {
        $.getJSON("/events2017/venues", { 																			// get all venues
            dataType: 'jsonp',
            format: "json"
        }, function(resp) {
            /* get all events */
            $.getJSON("/events2017/events/search?ext=false", {
                dataType: 'jsonp',
                format: "json"
            }, function(respEv) {
                /* format response and output it to HTML body */
                var insert = "";
                var venues = resp.venues;
                var allEvents = respEv.events;
                var events = {};

                /* populate events dictionary */
                for (var key in allEvents) {
                    var ev = allEvents[key]; 																		// get event
                    var vID = ev.venue.venue_id; 																// get venue of event

                    if (vID in events) 																					// append event to vennue key in dictionary
                        events[vID] = events[vID].concat([ev]);
                    else
                        events[vID] = [ev];
                }

                if (venues.length != 0) {
                    var i = 0;
                    for (var key in venues) {
                        var venue = venues[key]; 																// extract venue from dict

                        if (i % 3 == 0)
                            insert += '<div class = "row">';

                        var venueBox = '<div class="col-sm-4"><div class="venue" id="' + key + '">' +
                            '<div class="title"><div class="inTitle">' + venue.name + '</div>' +
                            '<div class="del delVen" data-toggle="modal" data-target="#delVenue">' +
                            '<span class="glyphicon glyphicon-trash"></span></div></div>' +
                            '<div class="venueURL"><a href="' + venue.url + '">' +
                            ((venue.url == "" || venue.url == null) ? 'No URL Given' : venue.name) + '</a></div>' +
                            '<div class="town">' + ((venue.town == "" || venue.town == null) ? 'No Town Given' : venue.town) + '</div>' +
                            '<div class="postcode">' + ((venue.postcode == "" || venue.postcode == null) ? 'No Postcode Given' : venue.postcode) + '</div>' +
                            '<div class="extraInfo">';

                        /* add events for venue */
                        for (var eKey in events[key]) {
                            var ev = events[key][eKey];
                            var d = new Date(ev.date).toString().split(" "); 		// create date item
                            var dateString = d[0] + ", " + d[2] + " " + d[1] + ", " + d[4].substr(0, 5); // format date

                            venueBox += '<div class="vEvent" id="' + ev.event_id + '"><div class="left">' +
                                '<div class="evTitle">' + ev.title + '</div>' +
                                '<div class="evDate">' + dateString + '</div></div>' +
                                '<div class="del delEve" data-toggle="modal" data-target="#delEvent">' +
                                '<span class="glyphicon glyphicon-trash"></span></div>' +
                                '<div class="clear"></div></div>';
                        }

                        venueBox += '<div id="eventAdd" data-toggle="modal" data-target="#addEvents">Add Event +</div>' +
                            '</div></div></div>';
                        insert += venueBox;

                        if ((i % 3 == 2) || i == venues.length - 1)
                            insert += '</div>';

                        i++; 																										// incremenet i

                        $("#venueSpace").empty(); 															// clear venue output
                        $("#venueSpace").append(insert); 												// insert new venue output
                    }
                }
            });
        });
    }

    /* logout function */
    $("#postLogout").click(function() {
        $.post("/events2017/auth/del", {
            dataType: 'jsonp',
            format: "json"
        }, function(resp) {
            console.log("Auth deleted " + resp);
            location.href='/events2017';
        });
    });

    /* login */
    $("#subLogin").click(function() {
        var user = $("#inUser").val();																					// get user inputs
        var pass = $("#inPass").val();
        $("#logFooter").removeClass("visible"); 																// remove all warnings
        $("#userWarn").hide();
        $("#userPass").hide();

        if (user == "" || pass == "") {
            $("#logFooter").addClass("visible");
            if (user == "")
                $("#inUser").addClass("req");
            if (pass == "")
                $("#inPass").addClass("req");
        } else {
            $.post("/events2017/auth", { 																				// post auth
                dataType: 'jsonp',
                format: "json",
                username: user,
                password: pass
              }, function(resp) {                                               // if 200 returned
                  checkAuth(); 																									// check if authorised
              }).fail(function(resp) {
                if (resp.responseJSON.bad == "user") { 													// if 400 returned add warnings
                    $("#inUser").addClass("req");
                    $("#userWarn").show();
                } else {
                    $("#inPass").addClass("req");
                    $("#passWarn").show();
                }
            });
        }
    });

    /* when a venue is clicked */
    $("#venueSpace").on("click", ".venue", function(e) {
        /* stops default behaviour if delete button was clicked */
        if ($(e.target).hasClass("del"))
            return;

        /* check if already expanded */
        var tall = $(this).hasClass("tall");
        lastVenClicked = $(this).attr("id");																		// update last ven clicked

        /* collapse the currently expanded event */
        $(".tall").find(".extraInfo").animate({
            "opacity": 0
        }, function() {
            $(this).slideUp();
            $(this).parent().removeClass("tall");
        });

        /* if it wasn't already expanded when clicked, expand it */
        if (!tall) {
            $(this).find(".extraInfo").animate({
                "opacity": 1
            }, function() {
                $(this).slideDown();
            });
            $(this).addClass("tall");
        }
    });

    /* link button to form */
    $("#subEvent").click(function() {
        var eventID = $("#inEvID").val();
        var title = $("#inTitle").val();
        var date = $("#inDate").val();

        /* check required parameters are present */
        if (eventID == "" || title == "" || date == "") {
            $("#eFooter").addClass("req");
            if (eventID == "")
                $("#inEvID").addClass("req");
            if (title == "")
                $("#inTitle").addClass("req");
            if (date == "")
                $("#inDate").addClass("req");
        } else
            $("#postEvent").submit(); 																					// if all are allow form to be submitted
    });

    /* send post for new event */
    $("#postEvent").submit(function() {
        var id = $("#inEvID").val();
        var title = $("#inTitle").val();
        var date = new Date($("#inDate").val()).toISOString(); 									// format as ISO
        var url = $("#inEvURL").val();
        var venue = lastVenClicked;
        var blurb = $("#inBlurb").val();

        $.post("/events2017/events/add", {
            dataType: 'jsonp',
            format: "json",
            title: title,
            venue_id: venue,
            event_id: id,
            date: date,
            blurb: blurb,
            url: url
        }, function(resp) {
            $("#addEvents").modal("hide");
            console.log(resp);
            checkAuth(); 																												// refresh
        });
    });

    /* link button to form */
    $("#subVenue").click(function() {
        var name = $("#inName").val();

        /* check required parameters are present */
        if (name == "") {
            $("#vFooter").addClass("req");
            $("#inName").addClass("req");
        } else
            $("#postVenue").submit(); 																					// if all are allow form to be submitted
    });

    /* gets rid of red class */
    $(".modal-body").on("click", ".req", function() {
        $(this).removeClass("req");
    });

    /* gets rid of red class */
    $("#login").on("click", ".req", function() {
        $(this).removeClass("req");
    });

    /* send post for new venue */
    $("#postVenue").submit(function() {
        var name = $("#inName").val();
        var postcode = $("#inPost").val();
        var town = $("#inTown").val();
        var url = $("#inURL").val();
        var icon = $("#inIcon").val();

        $.post("/events2017/venues/add", {
            dataType: 'jsonp',
            format: "json",
            name: name,
            postcode: postcode,
            town: town,
            url: url,
            icon: icon
        }, function(resp) {
            console.log(resp);
            $("#addVenues").modal("hide");
            checkAuth(); 																												// refresh
        });
    });

    /* for deleting venue */
    $("#venueSpace").on("click", ".delVen", function() {
        lastVenDel = $(this).closest(".venue").attr('id');
    });

    /* confirm delete venue */
    $("#subDelVenue").click(function() {
        $.post("/events2017/venues/del", {
            dataType: 'jsonp',
            format: "json",
            id: lastVenDel
        }, function(resp) {
            checkAuth(); 																												// refresh
        });
    });

    /* for deleting event */
    $("#venueSpace").on("click", ".delEve", function() {
        lastEventDel = $(this).closest(".vEvent").attr('id');
        console.log(lastEventDel);
    });

    /* confirm delete event */
    $("#subDelEvent").click(function() {
        $.post("/events2017/events/del", {
            dataType: 'jsonp',
            format: "json",
            id: lastEventDel
        }, function(resp) {
            checkAuth(); 																												// refresh
        });
    });

    /* binds event key to submit buttons, depending on which one is showing */
    $(document).keypress(function(e) {
        if (e.which == 13 && $("#subVenue").is(":visible"))
            $("#subVenue").click();
        else if (e.which == 13 && $("#subEvent").is(":visible"))
            $("#subEvent").click();
        else if (e.which == 13 && $("#subLogin").is(":visible"))
            $("#subLogin").click();
    });
});
