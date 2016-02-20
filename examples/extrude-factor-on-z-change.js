/* Changes extrud factor on Z change */
var Z_CHANGE = /G[0-1]+.*Z[0-9]+/i;

function parseNumber(word) {
  return Number(word.substr(1, word.length-2));
}

var EXTRUDE_MAX = 110;
var EXTRUDE_START = 80;
var EXTRUDE_STEP = 2;
var Z_START = 5;
var Z_STEP = 5;

var zTarget = context.zTarget || Z_START;
var extrude = context.extrude || EXTRUDE_START;
var gcode = `M221 S${Math.min(extrude, EXTRUDE_MAX)} ;TWEAK`;

if (Z_CHANGE.test(line)) {
  var words = line.split(" ");
  for (var index in words) {
    var word = words[index].toUpperCase();
    if (word.startsWith("Z")) {
      if (parseNumber(word) >= zTarget) {
        line += "\n" + gcode;
        console.log(line);
        context.zTarget = (zTarget += Z_STEP);
        context.extrude = (extrude += EXTRUDE_STEP);
      }
    }
  }
}