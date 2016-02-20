// prints out Z change, starting at 5, then each multiples of 5
var target = context.target || 5;
var pattern = /G[0-1]+.*Z[0-9]+/i;

if (pattern.test(line)) {
  var words = line.split(" ");
  for (var index in words) {
    var word = words[index];
    if (word.toUpperCase().startsWith("Z")) {
      var value = Number(word.substr(1, word.length-2));
      if (value >= target) {
       console.log(value);
       context.target = (target += 5);
      }
    }
  }
}