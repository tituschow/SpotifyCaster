"""
Example that shows how the new Python 2 socket client can be used.
"""

from __future__ import print_function
import time
import logging
import urllib
import json

import pychromecast
import pychromecast.controllers.youtube as youtube

logging.basicConfig(level=logging.INFO)

cast = pychromecast.get_chromecast()

if not cast.is_idle:
    print('Killing current running app')
    cast.quit_app()
    time.sleep(5)

track = '4SBqydJCEhcroni09XgT2c'

print('Playing media')
metadata = json.loads(urllib.urlopen('http://192.168.1.43:5000/track/{}/metadata'.format(track)).read())
cast.play_media('http://192.168.1.43:5000/track/{}.mp3'.format(track), 'audio/mpeg',
                title=metadata['name'], thumb='http://192.168.1.43:5000/track/{}/cover'.format(track))

time.sleep(10)

from pprint import pprint
pprint(cast.media_controller.status)
cast.media_controller.pause()