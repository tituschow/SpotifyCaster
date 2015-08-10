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
  console.log('Media ' + currentMediaSession.playerState + ' @ ' + currentMediaSession.currentTime);
  updateStatus();
  if (currentMediaSession.playerState == chrome.cast.media.PlayerState.PLAYING) {
    song_id = currentMediaSession.currentItemId;
  }
});

onMediaDiscovery(function() {
  console.log('media discovered');
  updateStatus();
});

function play(id) {
  var track = tracks[id];
  if (!currentMediaSession || currentMediaSession.items) {
    loadTrack(track);
  } else {
    var item = $.grep(currentMediaSession.items, function(element) {
      return element.itemId == currentMediaSession.currentItemId;
    })[0];

    var next_index = currentMediaSession.items.indexOf(item) + 1;
    if (next_index >= currentMediaSession.items.length) {
      next_index = null;
    }

    var mediaInfo = getTrackInfo(track);

    var item = new chrome.cast.media.QueueItem(mediaInfo);
    item.autoplay = true;
    item.preloadTime = 15;
    item.startTime = 0;

    var request = new chrome.cast.media.QueueInsertItemsRequest([item]);
    request.insertBefore = next_index;

    currentMediaSession.queueInsertItems(request, function() {
      currentMediaSession.queueNext();
    });
  }
}

function updateStatus() {
  if (currentMediaSession.playerState == chrome.cast.media.PlayerState.PLAYING) {
    $('#playpause').removeClass('fa-play').addClass('fa-pause');
  } else if (currentMediaSession.playerState == chrome.cast.media.PlayerState.PAUSED) {
    $('#playpause').removeClass('fa-pause').addClass('fa-play');
  }

  var media = {title: 'Start a song!', albumName: ''};
  if (currentMediaSession.items) {
    var item = $.grep(currentMediaSession.items, function(element) {
      return element.itemId == currentMediaSession.currentItemId;
    })[0];
    media = item.media.metadata;

    var next_index = currentMediaSession.items.indexOf(item) + 1;
    if (next_index < currentMediaSession.items.length) {
      var next = currentMediaSession.items[next_index].media.metadata;
      $('#next-up').text('Next: ' + next.title + ' - ' + next.albumName);
    }
  } else if (currentMediaSession.media) {
    media = currentMediaSession.media.metadata;
  }
  $('#now-playing').text('Now playing: ' + media.title + ' - ' + media.albumName);
  $('#volume').val(session.receiver.volume.level * 100);
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

$.getJSON('/playlist/iliekpie/5rZsjxKt6W8Sw9j7DXH9bH', function(data) {
  for (var i = 0; i < data.count; i++) {
    addTrackElement(data.tracks[i]);
  }
});

playlist.on('click', 'a', function(e) {
  e.preventDefault();

  var id = $(this).attr('href').split('#')[1];

  console.log('Playing: ' + id)

  play(id);
});

$('#playpause').click(function(e) {
  e.preventDefault();

  if (currentMediaSession) {
    if (currentMediaSession.playerState == chrome.cast.media.PlayerState.PLAYING) {
      currentMediaSession.pause();
    } else {
      currentMediaSession.play();
    }
  } else {
    loadTrack(tracks[Object.keys(tracks)[0]]);
  }
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
