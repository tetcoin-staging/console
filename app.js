if (typeof(window.parity) == 'object')
  window.parity.api.subscribe('eth_blockNumber', function (error, blockNumber) {
    if (error) {
      console.log('error', error);
      return;
    }
    refreshWatches();
  });

function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

function getAllPropertyNames(obj) {
    var props = {};
    do {
      Object.getOwnPropertyNames(obj).forEach(n => props[n] = true);
    } while (obj = Object.getPrototypeOf(obj));
    return Object.keys(props);
}

function htmlToElement(html) {
    var template = document.createElement('template');
    template.innerHTML = html;
    return template.content.firstChild;
}

function evaluate(x) {
  try {
    return eval(x);
  }
  catch (err) {
    return eval('(()=>{var x = ' + x + "; return x;})()")
  }
}

function displayReady(x) {
  if (x === undefined)
    return '<span class="undefinedType">undefined</span>';  
  if (typeof(x) == "string")
    return '"<span class="'+typeof(x)+'Type">' + escapeHtml(x) + '</span>"';
  if (Object.prototype.toString.call(x) === '[object Array]')
    return '[' + x.map(displayReady).join(', ') + ']'
  if (typeof(x) == "object") {
    if (x.toString().indexOf('[object ') != 0)
      return '<span class="' + x.constructor.name + 'Object">' + escapeHtml(x.toString()) + '</span>';
    return '<span class="objectType ' + x.constructor.name + 'Object">' + x.constructor.name + ' {' + Object.keys(x).map(f => '<span class="fieldType">' + escapeHtml(f) + '</span>: ' + displayReady(x[f])).join(', ') + "}</span>";
  }
  return '<span class="'+typeof(x)+'Type">' + escapeHtml(JSON.stringify(x)) + "</span>";
}

window.historyData = [];
window.historyIndex = 0;
window.watches = [];

function watch(name, f) {
  let status = document.getElementById("status");
  status.innerHTML += '<div class="watch" id="watch' + window.watches.length + '"><span class="expr" id="expr' + window.watches.length + '"">'+escapeHtml(name)+'</span><span class="res" id="res' + window.watches.length + '""></span></div>';
  window.watches.push(f);
}

function refreshWatches() {
  window.watches.forEach((x, i) => {
    let r = x();
    if (typeof(r) == 'object' && r.constructor.name == "Promise")
      r.then(r => document.getElementById('res' + i).innerHTML = displayReady(r));
    else
      document.getElementById('res' + i).innerHTML = displayReady(r);
  });
}

function newLog(level, text) {
  let icon = {
    debug: "&nbsp;",
    log: "&nbsp;",
    warn: "⚠",
    error: "✖",
    info: "ℹ"
  };
  pushLine('<div class="entry log ' + level + 'Level"><span class="type">' + icon[level] + '</span><span class="text">' + escapeHtml(text) + '</span></div>');  
}

function exec() {
  let command = document.getElementById("command");
  let c = command.value;
  
  if (c != '') {
    command.value = "";
    window.historyData.push(c);
    window.historyIndex = window.historyData.length;

    var html = '';
    if (c.indexOf("//") != -1) {
      x = c.split("//");
      let e = x[0];
      watch(x[1], () => evaluate(e));
      pushLine('<div class="entry command"><span class="type">&gt;</span><span class="text">' + escapeHtml(c) + '</span></div>');
      pushLine('<div class="entry addwatch"><span class="type">✓</span><span class="text">Watch added</span></div>');
    } else {
      pushLine('<div class="entry command"><span class="type">&gt;</span><span class="text">' + escapeHtml(c) + '</span></div>');
      let res;
      try {
        res = evaluate(c);
        if (typeof(res) == 'object' && res.constructor.name == "Promise") {
          let id = window.historyData.length;
          pushLine('<div class="entry result"><span class="type">&lt;</span><span class="text" id="pending' + id + '">...</span></div>');
          res.then(r => document.getElementById('pending' + id).innerHTML = displayReady(r));
        } else {
          pushLine('<div class="entry result"><span class="type">&lt;</span><span class="text">' + displayReady(res) + '</span></div>');
        }
      }
      catch (err) {
        pushLine('<div class="entry error"><span class="type">✖</span><span class="text">Unhandled exception: ' + escapeHtml(err.message) + '</span></div>');
      }
    }
  }
  refreshWatches();
}

function pushLine(l) {
  document.getElementById("history").innerHTML += l
  var h = document.getElementById("history-wrap");
  h.scrollTop = h.scrollHeight;  
}

var autocompletes = [];
var currentAuto = null;
var currentPots = [];
var currentStem = null;

document.getElementById("command").addEventListener("keydown", function(event) {
  if (event.keyCode == 38 || event.keyCode == 40) {
    event.preventDefault();
    if (currentAuto != null) {
      var i = currentPots.indexOf(currentAuto);
      document.getElementById('pot' + i).classList = ['ac-unselected'];
      if (event.keyCode == 40 && i < currentPots.length - 1)
        ++i;
      else if (event.keyCode == 38 && i > 0)
        --i;
      currentAuto = currentPots[i];
      let sel = document.getElementById('pot' + i);
      sel.classList = ['ac-selected'];
      sel.scrollIntoViewIfNeeded();
    }
  } else if (event.keyCode == 39 || event.keyCode == 9 || event.keyCode == 13) {
    if (currentAuto != null) {
      document.getElementById("command").value = (currentStem != '' ? currentStem + '.' : '') + currentAuto;
      document.getElementById("autocomplete").hidden = true;
      currentAuto = null;
      event.preventDefault();
    } 
  } else {
    setTimeout(() => {
      let t = document.getElementById("command").value.split('.');
      let last = t.pop();
      let tj = t.join('.');
      let ex = t.length > 0 ? tj : 'window';
      if (currentStem != tj) {
        autocompletes = eval('getAllPropertyNames('+ex+')');
        currentStem = tj;
      }
      let dl = document.getElementById("autocomplete");
      currentPots = autocompletes.filter(n => n.startsWith(last));
      if (currentPots.length > 0) {
        if (currentPots.indexOf(currentAuto) == -1)
          currentAuto = currentPots[0]; 
        dl.innerHTML = currentPots
//          .map(n => `${tj != '' ? tj + '.' : ''}${n}`)
          .map((n, i) => `<div id="pot${i}" class="${currentAuto == n ? 'ac-selected' : 'ac-unselected'}"><span class="ac-already">${escapeHtml(last)}</span><span class="ac-new">${escapeHtml(n.substr(last.length))}</div>`)
          .join('');
        dl.hidden = false;
      } else {
        currentAuto = null;
        dl.hidden = true;
      }
    }, 0);
  }
});

document.getElementById("command").addEventListener("keyup", function(event) {
  if (event.keyCode == 13) {
    event.preventDefault();
    exec();
  }
  if (currentAuto == null) {
    let command = document.getElementById("command");
    if (event.keyCode == 38 && window.historyIndex > 0) {
      event.preventDefault();
      window.historyIndex--;
      command.value = window.historyData[window.historyIndex];
    }
    if (event.keyCode == 40 && window.historyIndex < window.historyData.length) {
      event.preventDefault();
      window.historyIndex++;
      command.value = window.historyIndex < window.historyData.length ? window.historyData[window.historyIndex] : "";
    }
  }
});

if (typeof(window.parity) == 'object') {
  document.getElementById("command").focus();
  watch('#', () => window.web3.eth.blockNumber);
  window.web3 = web3;
  window.parity = parity;
} else {
  watch('time', () => new Date);
}

["debug", "error", "info", "log", "warn"].forEach(n => { let old = window.console[n]; window.console[n] = x => { old(x); newLog(n, x); }; });