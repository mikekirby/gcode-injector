/* Changes extruder temperature on Z change */
var Z_CHANGE = /G[0-1]+.*Z[0-9]+/i;

function parseNumber(word) {
  return Number(word.substr(1, word.length-2));
}

var TEMPERATURE_MAX = 260;
var TEMPERATURE_START = 230;
var TEMPERATURE_STEP = 5;
var Z_START = 5;
var Z_STEP = 5;

var zTarget = context.zTarget || Z_START;
var temperature = context.temperature || TEMPERATURE_START;
var gcode = `M109 S${Math.min(temperature, TEMPERATURE_MAX)} ;TWEAK`;

if (Z_CHANGE.test(line)) {
  var words = line.split(" ");
  for (var index in words) {
    var word = words[index].toUpperCase();
    if (word.startsWith("Z")) {
      if (parseNumber(word) >= zTarget) {
        line += "\n" + gcode;
        console.log(line);
        context.zTarget = (zTarget += Z_STEP);
        context.temperature = (temperature += TEMPERATURE_STEP);
      }
    }
  }
}