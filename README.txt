This is mxcm21's events web app.
It uses a local sqlite3 database to manage events and venues.
The admin page allows the user to add new events/venues or delete existing ones.
The search page links to Eventful to show music events for the North-East,
the eventful api is linked through a get request on the server side and is processed
into two separate lists on client side.

It is hosted online using IBM Bluemix at https://mxcm21events.eu-gb.mybluemix.net/events2017
Authentication times out after two hours and uses a cookie with a fall-back to any query parameters. 

# Update
It is no longer hoster here, and as this is a personal project there is no guide to stand it up yourself, but it should be relatively intuitive.