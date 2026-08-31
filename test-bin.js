fetch("https://api.jsonbin.io/v3/b/6a934df2da38895dfe213c53/latest", {
  headers: { "X-Master-Key": "$2a$10$JRYZVNXrLzgf4ucQ1OXs5.KKMWE21fuWHbl8yTRgSnXDmk9lwmcvS" }
}).then(r => r.json()).then(console.log).catch(console.error);
