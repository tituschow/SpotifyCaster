var playlist = $('#playlist'),
    song_id = -1,
    tracks = {};

Storage.prototype.setObj = function(key, obj) {
    return this.setItem(key, JSON.stringify(obj))
}

Storage.prototype.getObj = function(key) {
    return JSON.parse(this.getItem(key))
}

onMediaUpdate(function(isAlive) {
  if (currentMediaSession.playerState == chrome.cast.media.PlayerState.PLAYING &&
      currentMediaSession.currentItemId != song_id &&
      currentMediaSession.currentTime > 1 &&
      currentMediaSession.currentTime < 3) {
    console.log('Detected oddly started song! Restarting. ' + currentMediaSession.currentTime);
    setMuted(true);
    seek(function() { setMuted(false) })(0, true);
  }
  song_id = currentMediaSession.currentItemId;
});

onMediaDiscovery(function() {

});

function updateStatus() {
  if (currentMediaSession.playerState == chrome.cast.media.PlayerState.PLAYING) {
    $('#playpause').removeClass('fa-pause').addClass('fa-play');
  } else if (currentMediaSession.playerState == chrome.cast.media.PlayerState.PAUSED) {
    $('#playpause').removeClass('fa-play').addClass('fa-pause');
  }
}

function shuffleArray(array) {
  var currentIndex = array.length, temporaryValue, randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}

function shuffle() {
  if (currentMediaSession && currentMediaSession.items) {
    var queue = currentMediaSession.items.slice(0)
    shuffleArray(queue);
    currentMediaSession.queueReorderItems(queue);
  } else {
    var queue = $.map(tracks, function(track) { return track });
    shuffleArray(queue);
    queueAll(queue);
  }
}

function queueAll(tracks) {
  var initialized = false;
  var queueNext = function() {
    if (!initialized || (currentMediaSession && currentMediaSession.playerState == chrome.cast.media.PlayerState.PLAYING)) {
      initialized = true;
      addTrack(tracks.pop());
    }

    if (tracks.length > 0) {
      setTimeout(queueNext, 500);
    }
  }

  queueNext();
}

function addTrackElement(track) {
  tracks[track.id] = track;
  playlist.append($('<li>').append(
    $('<a>').attr('href', '#' + track.id).append(
      $('<img>').attr('src', track.cover)).append(
      $('<p>').attr('class', 'title').append(track.name)).append(
      $('<p>').attr('class', 'album').append(track.album)
  )));
}

function playTrack(id) {
  track = tracks[id];

  togglePlaying(true);

  loadTrack(track);
}

$.getJSON('/playlist/iliekpie/5rZsjxKt6W8Sw9j7DXH9bH', function(data) {
  for (var i = 0; i < data.count; i++) {
    addTrackElement(data.tracks[i]);
  }
});

playlist.on('click', 'a', function(e) {
  e.preventDefault();

  source = $(this).attr('href').split('#')[1];

  console.log('Playing: ' + source)

  playTrack(source);
});

$('#playpause').click(function(e) {
  e.preventDefault();

  togglePlaying();
});

$('#next').click(function(e) {
  e.preventDefault();

  currentMediaSession.queueNext();
})

$('#volume').change(function(level) {
  setVolume($(this).val());
});

// $(document).ready(function() {
//   queue = localStorage.getObj('queue') || [];

//   $(window).bind("beforeunload", function() {
//     localStorage.setObj('queue', queue);
//   });
// });
