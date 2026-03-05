// Make highlight stand out when permalinked
var activateHighlight = function (hash) {
  var highlight = document.getElementById(hash);
  highlight.className += " highlight--active";
  let highlightList = highlight.querySelectorAll(
    (className = ".highlight__text")
  );

  for (let i = 0; i < highlightList.length; i++) {
    let highlightText = highlightList[i];
    if (i === highlightList.length - 1) {
      highlightText.innerHTML =
        "<mark>" +
        highlightText.innerHTML +
        `</mark> <button id="js-clearHighlight" class="btn--clear" title="Clear highlight permalink"><svg focusable="false" viewBox="0 0 20 20" width="20" height="20"><use href="#clear"></use></svg></button>`;
    } else {
      highlightText.innerHTML = "<mark>" + highlightText.innerHTML + "</mark> ";
    }
  }
  // for (var i = 0; i < highlight.childNodes.length; i++) {
  //   if (highlight.childNodes[i].className == "highlight__text") {
  //     if (i == highlight.childNodes.length - 1) {
  //       var highlightText = highlight.childNodes[i];
  //       highlightText.innerHTML =
  //         "<mark>" +
  //         highlightText.innerHTML +
  //         `</mark> <button id="js-clearHighlight" class="btn--clear" title="Clear highlight permalink"><svg focusable="false" viewBox="0 0 20 20" width="20" height="20"><use href="#clear"></use></svg></button>`;
  //       highlightText.innerHTML =
  //         "<mark>" + highlightText.innerHTML + "</mark> ";
  //     } else {
  //       var highlightText = highlight.childNodes[i];
  //       highlightText.innerHTML =
  //         "<mark>" + highlightText.innerHTML + "</mark> ";
  //     }
  //   }
  // }
  highlight.focus();
};

var smoothUpdateURL = function (hash, highlight) {
  var hashIndex = window.location.href.indexOf("#");
  if (hashIndex === -1) {
    var hashlessURL = window.location.href;
  } else {
    var hashlessURL = window.location.href.slice(0, hashIndex);
  }
  highlight.scrollIntoView({ behavior: "smooth" });
  history.replaceState(null, null, hashlessURL + "#" + hash);
};

var removeHighlight = function () {
  var highlighted = document.querySelector(".highlight--active");
  if (highlighted !== null) {
    var highlightTextNodes = highlighted.querySelectorAll(".highlight__text");
    highlighted.className = "highlight";
    for (let i = 0; i < highlightTextNodes.length; i++) {
      highlightTextNodes[i].innerHTML = highlightTextNodes[i].innerText;
    }
    if (document.getElementById("js-clearHighlight")) {
      this.remove();
    }
  }
};

var highlightSwitch = function (e) {
  var targetLink = e.currentTarget.href.toString();
  if (targetLink && targetLink.indexOf("#") > -1) {
    var hash = targetLink.substr(targetLink.indexOf("#") + 1);
    var highlight = document.getElementById(hash);
    if (highlight.className.indexOf("highlight--active") === -1) {
      removeHighlight();
      activateHighlight(hash);
      e.preventDefault();
      smoothUpdateURL(hash, highlight);
    }
  }
};

if (window.location.hash) {
  var hash = window.location.hash.replace("#", "");
  if (document.getElementById(hash)) {
    activateHighlight(hash);
  }
}

var permalinks = document.querySelectorAll(".highlight__link");
for (var i = 0; i < permalinks.length; i++) {
  permalinks[i].addEventListener("click", highlightSwitch, true);
}

// Clear featured highlight
var clickClear = function (e) {
  if (
    e.target.id === "js-clearHighlight" ||
    e.target.parentNode.id === "js-clearHighlight"
  ) {
    removeHighlight();
    var hashIndex = window.location.href.indexOf("#");
    var hashlessURL = window.location.href.slice(0, hashIndex);
    history.replaceState(null, null, hashlessURL);
  }
};

window.addEventListener("click", clickClear, false);
