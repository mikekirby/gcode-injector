var chooseFileButton = document.querySelector('#choose_file');
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
      if (theEntry) {
        SaveFile(theEntry);
      }
    }
  );
});

function SaveFile(gcodeFile) {
  var expression = document.querySelector('#gcode_expression').value;

  var saveCallback = function(gcode) {
    output.textContent = 'Saving file';
    chrome.fileSystem.chooseEntry(
      {type: 'saveFile', suggestedName: gcodeFile.name},
      function(writableEntry) {
        writeFileEntry(writableEntry, new Blob([gcode], {type: 'text/plain'}), function(e) {
          output.textContent = 'File saved';
        });
      });
  };
  
  var onLoaded = function(gcode) {
    output.textContent = 'Processing GCode';
    processGcode(gcode, {expression: expression}, saveCallback);
  };
  
  output.textContent = 'Loading file';
  chrome.storage.local.set({'chosenFile': chrome.fileSystem.retainEntry(gcodeFile)});
  gcodeFile.file(function(file) {
    var reader = new FileReader();
    reader.onerror = errorHandler;
    reader.onload = function(e) { onLoaded(e.target.result); };
    reader.readAsText(file);
  });
}

var lastListener = null;
function processGcode(gcode, context, callback) {
  var output = [];
  var index = 0;
  var lines = gcode.split("\n");
  
  if (lines.length === 0) {
    callback(gcode);
    return;
  }
  
  if (lastListener)
    window.removeEventListener('message', lastListener);
  
  window.addEventListener('message', lastListener = function(event) {
    output[output.length] = event.data.line;
    
    if (++index === lines.length) {
      callback(output.join("\n"));
    } else {
      sendLine(lines[index], event.data.context);
    }
  });
  
  sendLine(lines[index], context);
}

function sendLine(line, context) {
  document.getElementById('sandbox').contentWindow
    .postMessage({command: 'eval', line: line, context: context}, '*');
}


