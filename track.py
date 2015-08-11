import logging
import time
import os

from hashlib import md5
from collections import namedtuple


class TrackTimeoutException(Exception):
    pass


class Track(object):
    CACHE_DIR = 'cache'
    MIN_CHUNK_SIZE = 2048

    UNLOADED = 'UNLOADED'
    DOWNLOADING = 'DOWNLOADING'
    DOWNLOADED = 'DOWNLOADED'
    STOPPED = 'STOPPED'

    def __init__(self, track, bitrate):
        self.state = Track.UNLOADED
        self.track = track
        self.bitrate = bitrate

        self.name = track.name.encode('utf-8')
        self.album = track.album
        self.artists = track.artists

        self.logger = logging.getLogger(__name__)
        self.load_file()

    def load_file(self):
        try:
            size = os.path.getsize(self.get_path())
        except OSError:
            return

        if abs(self._estimated_size(self.bitrate) - size) <= 10000:
            self.state = Track.DOWNLOADED

    def get_cover(self, as_uri=False):
        cover = self.track.album.cover()
        cover.load()
        if as_uri:
            return cover.data_uri
        else:
            return cover.data

    def _estimated_size(self, bitrate):
        return int(bitrate * self.track.duration) / 8

    def _get_size(self):
        try:
            return os.path.getsize(self.get_path())
        except OSError:
            return 0

    def get_size(self):
        if self.state == Track.DOWNLOADED:
            return self._get_size()
        else:
            return self._estimated_size(self.bitrate)

    def get_hash(self):
        return md5(self.track.link.uri).hexdigest()

    def get_path(self):
        return Track.CACHE_DIR + '/' + self.get_hash() + '.mp3'

    def _get_chunk_size(self, start, end):
        if end and end <= self._get_size():
            return end - start

        length = self._get_size() - start
        if length < Track.MIN_CHUNK_SIZE:
            self.logger.info('{} bytes - chunk too small (wanted {}-{}, total {})'.format(length, start, end, self._get_size()))
            time.sleep(1)
            return self._get_chunk_size(start, end)
        else:
            return length

    def stream(self, start, end=None, count=0):
        TrackData = namedtuple('TrackData', 'data size')

        if count > 3:
            self.logger.info('Requested {}-{}, but total size is {}'.format(start, end, self._get_size()))
            self.logger.warning('Exceeded max wait: raising error')
            raise TrackTimeoutException('Exceeded max wait')
        if start >= self._get_size() or self.state == Track.UNLOADED:
            time.sleep(3);
            return self.stream(start, end, count + 1)

        length = self._get_chunk_size(start, end)
        self.logger.info('Requested {}-{} - sent {}/{} [{}]'.format(start, end, length, self._get_size(), self.state))

        path = self.get_path()

        data = None
        with open(path, 'rb') as f:
            f.seek(start)
            data = f.read(length)

        return TrackData(data, length)

    def update(self, bytes):
        self.state = Track.DOWNLOADING

    def finish(self):
        self.state = Track.DOWNLOADED

    def stop(self):
        self.state = Track.STOPPED
