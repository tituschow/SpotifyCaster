#!/usr/bin/env python

import mimetypes
import re
import os
import threading
import io
import requests
import json

from tornado.wsgi import WSGIContainer
from tornado.httpserver import HTTPServer
from tornado.ioloop import IOLoop
from flask import Flask, render_template, Response, request, jsonify, send_file
app = Flask(__name__)

from spotify_mp3 import SpotifyMP3
from track import TrackTimeoutException
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

    try:
        data, length = track.stream(start, end)
    except TrackTimeoutException:
        data = b'\x00'
        length = 1

    resp = Response(data, 206, mimetype='audio/mpeg', direct_passthrough=True)
    resp.headers.add('Content-Range', 'bytes {0}-{1}/{2}'.format(start, start + length - 1, track.get_size()))

    return resp

@app.route('/track/<id>/metadata')
def track_metadata(id):
    track = spotify.get_track('spotify:track:{}'.format(id))

    return jsonify(track.as_payload())

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
        payload = track_info.as_payload(with_cover=True)
        tracks.append(payload)


    return jsonify({'tracks': tracks, 'count': len(tracks)})

@app.route('/search/<query>')
@app.route('/search/<query>/<int:count>')
def search(query, count=20):
    results = spotify.search(query, count)

    def get_tracks():
        yield '{ "tracks": ['
        for track in results:
            track_info = spotify.get_track(track.link.uri)
            payload = track_info.as_payload(with_cover=True)
            if track == results[-1]:
                yield json.dumps(payload)
            else:
                yield json.dumps(payload) + ', '
        yield '], "count": ' + str(len(results)) + '}'

    return Response(get_tracks(), mimetype='application/json')

if __name__ == '__main__':
    import logging
    logging.basicConfig(level=logging.INFO)
    spotify.login()
    http_server = HTTPServer(WSGIContainer(app))
    http_server.listen(5000)
    IOLoop.instance().start()
    spotify.logout()