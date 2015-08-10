#!/usr/bin/env python
import logging
import threading
import subprocess
import getpass

import spotify

from track import Track
from collections import namedtuple

class SpotifyMP3(object):
    logger = logging.getLogger(__name__)
    _pipe = None
    bitrates = {
        96: spotify.Bitrate.BITRATE_96k,
        160: spotify.Bitrate.BITRATE_160k,
        320: spotify.Bitrate.BITRATE_320k
    }

    def __init__(self, bitrate):
        self.logged_in = threading.Event()
        self.logged_out = threading.Event()
        self.logged_out.set()
        self.stopped = threading.Event()
        self.current_track = None
        self.tracks = {}

        self.session = spotify.Session()
        self.session.on(
            spotify.SessionEvent.CONNECTION_STATE_UPDATED,
            self.on_connection_state_changed)
        self.session.on(
            spotify.SessionEvent.MUSIC_DELIVERY,
            self.on_music_delivery)
        self.session.on(
            spotify.SessionEvent.END_OF_TRACK,
            self.on_end_of_track)
        self.bitrate = bitrate
        self.session.preferred_bitrate(SpotifyMP3.bitrates[bitrate])

        self.event_loop = spotify.EventLoop(self.session)
        self.event_loop.start()

    def login(self):
        try:
            self.session.relogin()
        except spotify.Error as e:
            username = raw_input('Username: ')
            password = getpass.getpass()
            self.session.login(username, password, remember_me=True)
        self.logged_in.wait()

    def logout(self):
        if self.logged_in.is_set():
            print('Logging out...')
            self.session.logout()
            self.logged_out.wait()
        self.event_loop.stop()
        print('')

    def on_connection_state_changed(self, session):
        if session.connection.state is spotify.ConnectionState.LOGGED_IN:
            self.logged_in.set()
            self.logged_out.clear()
        elif session.connection.state is spotify.ConnectionState.LOGGED_OUT:
            self.logged_in.clear()
            self.logged_out.set()

    def on_music_delivery(self, session, audio_format, frame_bytes, num_frames):
        if self._pipe:
            try:
                self._pipe.write(frame_bytes)
            except IOError:
                self.current_track.stop()
            size = (num_frames * audio_format.frame_size())
            self.current_track.update(size)
        return num_frames

    def on_end_of_track(self, session):
        self.session.player.play(False)
        if self._pipe:
            self.current_track.finish()
            self.logger.info('Song ended - {} bytes'.format(self.current_track.get_size()))
            self._pipe.flush()
            self._pipe.close()
            self._pipe = None

    def get_track(self, uri):
        track = self.tracks.get(uri, None)
        if track:
            return track

        try:
            spotify_track = self.session.get_track(uri)
            spotify_track.load()
        except (ValueError, spotify.Error) as e:
            self.logger.exception(e)

        track = Track(spotify_track, self.bitrate)
        self.tracks[uri] = track
        return track

    def download(self, uri):
        if not self.logged_in.is_set():
            self.logger.warning('You must be logged in to play')
            return

        track = self.get_track(uri)
        if self.current_track and track != self.current_track and self.current_track.state == Track.DOWNLOADING:
            self.logger.info('Stopping {}'.format(self.current_track.name))
            self.current_track.stop()
            self.session.player.unload()
            self.stopped.set()
        self.current_track = track

        if self.current_track.state == Track.DOWNLOADING or self.current_track.state == Track.DOWNLOADED:
            return self.current_track

        self.logger.info('Loading {} into player'.format(self.current_track.name))
        self.session.player.load(self.current_track.track)

        self.logger.info('Downloading track as {}'.format(self.current_track.get_path()))

        self.lame = subprocess.Popen(['lame', '--silent', '-b', str(self.bitrate), '-h', '-r', '-',
                                      self.current_track.get_path()], stdin=subprocess.PIPE)
        self._pipe = self.lame.stdin
        self.session.player.play()

        return self.current_track

    def get_playlist(self, uri):
        try:
            playlist = self.session.get_playlist(uri)
            playlist.load()
        except (ValueError, spotify.Error) as e:
            self.logger.warning(e)
            return

        return playlist.tracks


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    session = SpotifyMP3(160)
    session.login()
    track = session.download('spotify:track:4cdv3CQkDVZzZOKm0kaaZu')
    print track.stream(0, None)
    session.logout()

