var gcodeFile = null;

var chooseFileButton = document.querySelector('#choose_file');
var saveFileButton = document.querySelector('#save_file');
var processButton = document.querySelector('#process_gcode');
var output = document.querySelector('output');

function errorHandler(e) {
  console.error(e);
}

function writeFileEntry(writableEntry, blob, callback) {
  if (!writableEntry) {
    output.textContent = 'Nothing selected.';
    return;
  }

  writableEntry.createWriter(function(writer) {
    writer.onerror = errorHandler;
    writer.onwriteend = callback;
    writer.truncate(blob.size);
    waitForIO(writer, function() {
      writer.seek(0);
      writer.write(blob);
    });
  }, errorHandler);
}

function waitForIO(writer, callback) {
  var start = Date.now();
  var reentrant = function() {
    if (writer.readyState===writer.WRITING && Date.now()-start<30000) {
      setTimeout(reentrant, 100);
      return;
    }
    
    if (writer.readyState===writer.WRITING) {
      console.error("Write operation taking too long, aborting!"+
        " (current writer readyState is "+writer.readyState+")");
      writer.abort();
    } else {
      callback();
    }
  };
  
  setTimeout(reentrant, 100);
}

chooseFileButton.addEventListener('click', function(e) {
  chrome.fileSystem.chooseEntry(
    { type: 'openFile', accepts: [{ mimeTypes: ['text/*'], extensions: ['gcode'] }]},
    function(theEntry) {
      gcodeFile = theEntry ? theEntry : null;
      saveFileButton.disabled = (gcodeFile === null);
    }
  );
});

saveFileButton.addEventListener('click', function(e) {
  var prefix = document.querySelector('#gcode_prefix').value;
  var postfix = document.querySelector('#gcode_postfix').value;
  var baseValue = document.querySelector('#gcode_base_value').value;
  var bumpSize = document.querySelector('#gcode_bump_value').value;
  var zFirstBoundary = document.querySelector('#gcode_zstart').value;
  var zBoundarySize = document.querySelector('#gcode_zboundary').value;
  
  var onLoaded = function(gcode) {
    output.textContent = 'Processing GCode';
    gcode = processGcode(gcode, Number(zFirstBoundary), Number(zBoundarySize), function(counter) {
      return prefix + `${Number(baseValue) + (Number(counter) * Number(bumpSize))}` + postfix;
    });
    
    output.textContent = 'Saving file';
    chrome.fileSystem.chooseEntry(
      {type: 'saveFile', suggestedName: gcodeFile.name},
      function(writableEntry) {
        writeFileEntry(writableEntry, new Blob([gcode], {type: 'text/plain'}), function(e) {
          output.textContent = 'File saved';
        });
      });
  };
  
  output.textContent = 'Loading file';
  chrome.storage.local.set({'chosenFile': chrome.fileSystem.retainEntry(gcodeFile)});
  gcodeFile.file(function(file) {
    var reader = new FileReader();
    reader.onerror = errorHandler;
    reader.onload = function(e) { onLoaded(e.target.result); };
    reader.readAsText(file);
  });
});

function processGcode(gcode, zBoundary, zBoundarySize, onBoundary) {
  var counter = 0;
  var zValue = 0;
  var pattern = /G[0-1]+.*Z[0-9]+/i;
  var lines = gcode.split("\n");
  for (var line=0; line < lines.length; ++line) {
    if (pattern.test(lines[line])) {
      var words = lines[line].split(" ");
      for (var word in words) {
        if (words[word].toUpperCase().startsWith('Z')) {
          zValue = getAxisValue(words[word]);
          break;
        }
      }
    }
    
    if (Number(zValue) >= Number(zBoundary)) {
      lines[line] = lines[line] + "\n" + onBoundary(counter++, lines[line]);
      zBoundary += zBoundarySize;
    }
  }
  
  return lines.join("\n");
}

function getAxisValue(word) {
  return Number(word.substr(1, word.length - 2));
}
