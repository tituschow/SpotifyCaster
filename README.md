# SpotifyCaster
This was a fun weekend project to stream and cast songs from Spotify. It was born out of frustration with Spotify's lack of Chromecast support and the unstable alternatives.

This wasn't designed to be a super clean and professional, but it works pretty well.

## To Use
Sign up for a libspotify API key and copy `spotify_appkey.key` into the folder root.

Run server.py and connect to 127.0.0.1:5000.

The server's IP address is currently hardcoded - that probably needs to be changed. Edit `MEDIA_ROOT` in `cast.js`.

My playlist is also hardcoded. Unless you want to listen to my music, replace the JSON playlist call in `app.js` with your own username and playlist uri.
