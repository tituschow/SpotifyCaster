#!/usr/bin/env python

import mimetypes
import re
import os
import threading
import io
import requests
from flask import Flask, render_template, Response, request, jsonify, send_file
app = Flask(__name__)

from spotify_mp3 import SpotifyMP3
spotify = SpotifyMP3(160)

@app.route('/')
def app_index():
    return render_template('album.html')

@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Accept-Ranges', 'bytes')
    return response

@app.route('/track/<id>.mp3')
def track_stream(id):
    track = spotify.download('spotify:track:{}'.format(id))

    range_header = request.headers.get('Range', None)

    start, end = re.search('(\d+)-(\d*)', range_header).group(1, 2)
    start = int(start)
    if end:
        end = int(end)
    else:
        end = None

    data, length = track.stream(start, end)
    resp = Response(data, 206, mimetype='audio/mpeg', direct_passthrough=True)
    resp.headers.add('Content-Range', 'bytes {0}-{1}/{2}'.format(start, start + length - 1, track.get_size()))

    return resp

@app.route('/track/<id>/metadata')
def track_metadata(id):
    track = spotify.get_track('spotify:track:{}'.format(id))
    #cover = track.get_cover(as_uri=True)

    payload = {
        'name': track.name,
        'artist': ', '.join([artist.name for artist in track.artists]),
        'album': track.album.name
    }

    return jsonify(payload)

@app.route('/track/<id>/cover')
def track_cover(id):
    track = spotify.get_track('spotify:track:{}'.format(id))
    return send_file(io.BytesIO(track.get_cover()),
                     attachment_filename='{}.jpeg'.format(id),
                     mimetype='image/jpeg')

@app.route('/playlist/<user>/<id>')
def playlist(user, id, shuffle=False):
    playlist = spotify.get_playlist('spotify:user:{}:playlist:{}'.format(user, id))

    tracks = []
    for track in playlist:
        track_info = spotify.get_track(track.link.uri)
        tracks.append({
            'name': track_info.name,
            'artist': ', '.join([artist.name for artist in track_info.artists]),
            'album': track_info.album.name,
            'cover': track_info.get_cover(as_uri=True),
            'id': track.link.uri.split(':')[-1]
        });


    return jsonify({'tracks': tracks, 'count': len(tracks)})

if __name__ == '__main__':
    import logging
    logging.basicConfig(level=logging.INFO)
    spotify.login()
    app.run(host='0.0.0.0')
    spotify.logout()