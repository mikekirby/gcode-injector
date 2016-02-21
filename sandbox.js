  window.addEventListener('message', function(event) {
    var context = event.data.context;
    var line = event.data.line;
    eval(context.expression);
    
    event.source
      .postMessage({line: line, context: context}, event.origin);
  });