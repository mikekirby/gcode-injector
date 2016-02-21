var gcodeEditor = CodeMirror(document.body, {
  lineWiseCopyCut: true
});

var jsEditor = CodeMirror(document.body, {
  mode: "javascript",
  lineNumbers: true,
  lineWiseCopyCut: true
});

var lastFileName = null;

function errorHandler(e) {
  console.error(e);
}

function notify(message) {
  document.querySelector('output').textContent = message || '';
}

function writeFileEntry(writableEntry, blob, callback) {
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

document.querySelector('#run_script')
  .addEventListener('click', function(e) {
    notify('Running Script');
    var onComplete = function(output) {
      notify('Loading...');
      gcodeEditor.setValue(output.join("\n"));
      notify();
    };
    
    var context = { expression: jsEditor.getValue() };
    processGcode(gcodeEditor, context, onComplete);
  });

document.querySelector('#choose_file')
  .addEventListener('click', function(e) {
    chrome.fileSystem.chooseEntry(
      { type: 'openFile', accepts: [{ mimeTypes: ['text/*'], extensions: ['gcode'] }]},
      function(theEntry) {
        if (theEntry) {
          lastFileName = theEntry.name;
          notify(`Loading file: ${lastFileName}`);
          loadFile(theEntry, function(text) {
            gcodeEditor.setValue(text);
            notify(`Loaded: ${lastFileName}`);
          });
        }
      }
    );
  });

document.querySelector('#save_gcode')
  .addEventListener('click', function(e) {
    chrome.fileSystem.chooseEntry(
      {type: 'saveFile', suggestedName: lastFileName || "out.gcode"},
      function(writableEntry) {
        if (writableEntry) {
          notify(`Saving: ${writableEntry.name}`);
          var gcode = gcodeEditor.getValue();
          writeFileEntry(
            writableEntry,
            new Blob([gcode], {type: 'text/plain'}),
            function(e) {notify(`Saved: ${writableEntry.name}`);});
        }
      });
  });

function loadFile(gcodeFile, callback) {
  chrome.storage.local.set({'chosenFile': chrome.fileSystem.retainEntry(gcodeFile)});
  gcodeFile.file(function(file) {
    var reader = new FileReader();
    reader.onerror = errorHandler;
    reader.onload = function(e) { callback(e.target.result); };
    reader.readAsText(file);
  });
}

var lastListener = null;
function processGcode(doc, context, callback) {
  if (doc.lineCount() === 0) {
    callback([]);
    return;
  }
  
  var lineCount = doc.lineCount();
  var output = [];
  var index = 0;
  
  if (lastListener)
    window.removeEventListener('message', lastListener);
  
  window.addEventListener('message', lastListener = function(event) {
    if (_.isArray(event.data.line)) {
      _.each(event.data.line, function(value) { output[output.length] = value; });
    } else if (event.data.line) {
      output[output.length] = event.data.line;
    }
    
    if (++index === lineCount) {
      callback(output);
    } else {
      sendLine(doc.getLine(index), event.data.context);
    }
  });
  
  sendLine(doc.getLine(index), context);
}

function sendLine(line, context) {
  document.getElementById('sandbox').contentWindow
    .postMessage({command: 'eval', line: line, context: context}, '*');
}
