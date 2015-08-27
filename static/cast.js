/**
 * Cast initialization timer delay
 **/
var CAST_API_INITIALIZATION_DELAY = 1000;
/**
 * Progress bar update timer delay
 **/
var PROGRESS_BAR_UPDATE_DELAY = 1000;
/**
 * Session idle time out in miliseconds
 **/
var SESSION_IDLE_TIMEOUT = 300000;
var MAX_QUEUE_LENGTH = 160;
/**
 * global variables
 */
var currentMediaSession = null;
var session = null;
var MEDIA_ROOT = 'http://192.168.1.8:5000';

var timer = null;

var mediaUpdateCallback = function(isAlive) { console.log('mediaUpdateCallback not set.') };
var mediaDiscoveryCallback = function() { console.log('mediaDiscoveryCallback not set.') };

/**
 * Call initialization
 */
if (!chrome.cast || !chrome.cast.isAvailable) {
  setTimeout(initializeCastApi, CAST_API_INITIALIZATION_DELAY);
}

/**
 * initialization
 */
function initializeCastApi() {
  // default app ID to the default media receiver app
  // optional: you may change it to your own app ID/receiver
  var applicationIDs = [
      chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID
    ];


  // auto join policy can be one of the following three
  // 1) no auto join
  // 2) same appID, same URL, same tab
  // 3) same appID and same origin URL
  var autoJoinPolicyArray = [
      chrome.cast.AutoJoinPolicy.PAGE_SCOPED,
      chrome.cast.AutoJoinPolicy.TAB_AND_ORIGIN_SCOPED,
      chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
    ];

  // request session
  var sessionRequest = new chrome.cast.SessionRequest(applicationIDs[0]);
  var apiConfig = new chrome.cast.ApiConfig(sessionRequest,
    sessionListener,
    receiverListener,
    autoJoinPolicyArray[2]);

  chrome.cast.initialize(apiConfig, onInitSuccess, onError);
}

function onInitSuccess() {
  console.log('init success');
}

/**
 * generic error callback
 * @param {Object} e A chrome.cast.Error object.
 */
function onError(e) {
  console.log('Error' + e);
}

/**
 * generic success callback
 * @param {string} message from callback
 */
function onSuccess(message) {
  console.log(message);
}

/**
 * callback on success for stopping app
 */
function onStopAppSuccess() {
  console.log('Session stopped');
}

/**
 * session listener during initialization
 * @param {Object} e session object
 * @this sessionListener
 */
function sessionListener(e) {
  console.log('New session ID: ' + e.sessionId);
  session = e;
  if (session.media.length != 0) {
    onMediaDiscovered('sessionListener', session.media[0]);
  }
  session.addMediaListener(
    onMediaDiscovered.bind(this, 'addMediaListener'));
}

/**
 * receiver listener during initialization
 * @param {string} e status string from callback
 */
function receiverListener(e) {
  if (e === 'available') {
    console.log('receiver found');
  }
  else {
    console.log('receiver list empty');
  }
}

/**
 * launch app and request session
 */
function launchApp() {
  console.log('launching app...');
    chrome.cast.requestSession(onRequestSessionSuccess, onLaunchError);
  if (timer) {
    clearInterval(timer);
  }
}

/**
 * callback on success for requestSession call
 * @param {Object} e A non-null new session.
 * @this onRequestSesionSuccess
 */
function onRequestSessionSuccess(e) {
  console.log('session success: ' + e.sessionId);
    saveSessionID(e.sessionId);
  session = e;
  document.getElementById('casticon').src = CAST_ICON_THUMB_ACTIVE;
  if (session.media.length != 0) {
    onMediaDiscovered('onRequestSession', session.media[0]);
  }
  session.addMediaListener(
    onMediaDiscovered.bind(this, 'addMediaListener'));
}

/**
 * callback on launch error
 */
function onLaunchError() {
  console.log('launch error');
}

function getTrackInfo(track) {
  var mediaInfo = new chrome.cast.media.MediaInfo(MEDIA_ROOT + '/track/' + track.id + '.mp3');

  mediaInfo.metadata = new chrome.cast.media.GenericMediaMetadata();
  mediaInfo.metadata.metadataType = chrome.cast.media.MetadataType.GENERIC;
  mediaInfo.contentType = 'audio/mpeg';

  mediaInfo.metadata.title = track.name;
  mediaInfo.metadata.albumName = track.album;
  mediaInfo.metadata.artist = track.artist;
  mediaInfo.metadata.images = [{'url': MEDIA_ROOT + '/track/' + track.id + '/cover'}];

  mediaInfo.metadata.customData = {};
  mediaInfo.metadata.customData.id = track.id;

  return mediaInfo;
}

function queueTrack(track) {
  var mediaInfo = getTrackInfo(track);

  var item = new chrome.cast.media.QueueItem(mediaInfo);
  item.autoplay = true;
  item.preloadTime = 15;
  item.startTime = 0;

  currentMediaSession.queueAppendItem(item);
}

function loadTrack(track) {
  if (!session) {
    console.log('no session');
        return;
  }

  var mediaInfo = getTrackInfo(track);

  var request = new chrome.cast.media.LoadRequest(mediaInfo);
  request.autoplay = true;
  request.currentTime = 0;

  session.loadMedia(request,
    onMediaDiscovered.bind(this, 'loadMedia'),
    onMediaError);
}

function addTrack(track) {
  if (!currentMediaSession) {
    loadTrack(track);
  } else {
    queueTrack(track);
  }
}

/**
 * callback on success for loading media
 * @param {string} how info string from callback
 * @param {Object} mediaSession media session object
 * @this onMediaDiscovered
 */
function onMediaDiscovered(how, mediaSession) {
  currentMediaSession = mediaSession;
  mediaDiscoveryCallback();
  currentMediaSession.addUpdateListener(mediaUpdateCallback);
}

/**
 * callback on media loading error
 * @param {Object} e A non-null media object
 */
function onMediaError(e) {
  console.log('media error');
  console.log(e);
  if (currentMediaSession && currentMediaSession.items) {
    currentMediaSession.queueNext();
  }
}

/**
 * get media status initiated by sender when necessary
 * currentMediaSession gets updated
 * @this getMediaStatus
 */
function getMediaStatus() {
  if (!session || !currentMediaSession) {
    return;
  }

  currentMediaSession.getStatus(null,
      mediaCommandSuccessCallback.bind(this, 'got media status'),
      onError);
}

function setVolume(level) {
  if (session) {
    session.setReceiverVolumeLevel(level / 100);
  }
}

function setMuted(muted) {
  if (session) {
    session.setReceiverMuted(muted);
  }
}

function setMediaVolume(level, muted) {
  var volume = new chrome.cast.Volume();
  if (arguments[0]) {
    volume.level = level / 100;
  }
  if (arguments.length > 1) {
    volume.muted = muted;
  }

  var request = new chrome.cast.media.VolumeRequest(volume);

  currentMediaSession.setVolume(request);
}

function seek(onSuccess) {
  return function(time, play) {
    var request = new chrome.cast.media.SeekRequest();
    request.currentTime = time;
    if (arguments.length > 1) {
      request.resumeState = (play) ? chrome.cast.media.ResumeState.PLAYBACK_START : chrome.cast.media.ResumeState.PLAYBACK_STOP;
    }

    currentMediaSession.seek(request, onSuccess);
  };
}

function onMediaUpdate(callback) {
  mediaUpdateCallback = callback;
}

function onMediaDiscovery(callback) {
  mediaDiscoveryCallback = callback;
}
