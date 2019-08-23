$(document).ready(function() {

    /* launch datepicker */
    $(".datepicker").datepicker();

    /* when search button clicked */
    $("#search").click(function() {
        /* extract data and send get request */
        var name = $("#nameInput").val();
        var date = $("#dateInput").val();

        if (date != "") { 																											// format date
            date = date.split("/");
            var formatDate = date[2] + "-" + date[0] + "-" + date[1];
        }

        var search = "/events2017/events/search?"; 															// create get request string
        search += (name != "") ? "search=" + name : "";
        search += (name != "" && date != "") ? "&" : "";
        search += (date != "") ? "date=" + formatDate : "";

        $.getJSON(search, { 																										// get events
            dataType: 'jsonp',
            format: "json"
        }, function(resp) {
            /* format response and output it to HTML body */
            var insert = "";
            var insertExt = "<div id='title'>External Events</div>";
            var events = resp.events;
            var ext = 0;
            var local = 0;

            if (events.length != 0)
                for (var i = 0; i < events.length; i++) {
                    var eventItem = events[i];
                    var venue = eventItem.venue;
                    var external = eventItem.external || false;                 // sees if event is external or not
                    var d = new Date(eventItem.date).toString().split(" "); 		// create date item
                    var dateString = d[0] + ", " + d[2] + " " + d[1] + ", " + d[4].substr(0, 5); // format date

                    if (!external && local % 2 == 0)
                        insert += '<div class = "row">';
                    else if (external && ext % 2 == 0)
                        insertExt += '<div class = "row">';

                    var eventBox = '<div class="col-sm-5 event">' +
                        '<div class="title">' + eventItem.title + '</div>' +
                        '<div class="eventDate">' + dateString + '</div>' +
                        '<div class="venueName">' + venue.name + '</div> ' +
                        '<div class="extraInfo">' +
                        ((eventItem.blurb == "" || eventItem.blurb == null) ? '' : '' +
                            '	<div class="blurb">' + eventItem.blurb + '</div> ') +
                        ((eventItem.url == "" || eventItem.url == null) ? '' : '' +
                            '	<div class="eventURL"><a href=' + eventItem.url + '>Get Tickets for this Event</a></div> ') +
                        '	<div class="venueURL">' +
                        ((venue.url == "" || venue.url == null) ? '' : '' +
                            '<a href="' + venue.url + '">' + venue.name + ": " + '</a>') +
                        ((venue.town == "" || venue.town == null || venue.postcode == "" || venue.postcode == null) ? '' : '' + venue.town + ", " + venue.postcode) +
                        '</div> ' +
                        ((venue.postcode == "" || venue.postcode == null) ? '' : '' +
                            '	<iframe class="map" width="600" height="250" frameborder="0" style="border:0"' +
                            '	src="https://www.google.com/maps/embed/v1/place?key=AIzaSyAN9OmZnGx-pDckb_vfsp8aGAfdn1kfEvU' +
                            '	&q=' + venue.postcode + '" allowfullscreen></iframe>') +
                        ((venue.icon == "" || venue.icon == null) ? '' : '<div class="icon"><img src="' + venue.icon + '"/></div> ') +
                        '</div></div>';

                    if (external) {
                      insertExt += eventBox;
                      ext += 1;
                    } else {
                      insert += eventBox;
                      local += 1;
                    }

                    if (!external && local % 2 == 0)
                        insert += '</div>';
                    else if (external && ext % 2 == 0)
                        insertExt += '</div>';

                    if (i == events.length - 1 && local > 1)
                        insert += '</div>';
                    if (i == events.length - 1 && ext > 1)
                        insertExt += '</div>';
                }

            if (insert == "")                                                   // message if no events shown
                insert = '<div class = "row"><div class="col-sm-10 event" id="showAll">No events to show, try another search or Click Here for a list of all events.</div></div>';

            if (insertExt == "<div id='title'>External Events</div>")
              insertExt += '<div class = "row"><div class="col-sm-10 event ext" id="show">No external events to show, try another search.</div></div>';

            $("#eventSpace").empty(); 																					// clear event output
            $("#eventSpace").append(insert);																		// insert new event output
            $("#eventExternalSpace").empty(); 															    // clear external event output
            $("#eventExternalSpace").append(insertExt); 												// insert external new event output
        });
    });

    /* when an event is clicked */
    $(".eventSpace").on("click", ".event", function() {
        /* check if already expanded */
        var tall = $(this).hasClass("tall");

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

    /* for show all event */
    $(".eventSpace").on("click", "#showAll", function() {
        $("#nameInput").val(""); 																								// clear inputs
        $("#dateInput").val("");
        $("#search").click(); 																									// get all events
    });

    /* to redirect from error page */
    $("#error").click(function() {
        window.location.href = "/events2017";
    });

    /* binds event key to search button */
    $(document).keypress(function(e) {
        if (e.which == 13 && $("#search").length > 0) {
            $("#search").click();
        }
    });

    $("#search").click(); 																											// load all events to start with
});
