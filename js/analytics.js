var _gaq = _gaq || [];
_gaq.push(['_setAccount', 'UA-115475017-1']);
_gaq.push(['_trackPageview']);

(function() {
  var ga = document.createElement('script');
  ga.type = 'text/javascript';
  ga.async = true;
  ga.src = 'https://ssl.google-analytics.com/ga.js';
  var s = document.getElementsByTagName('script')[0];
  s.parentNode.insertBefore(ga, s);
})();

document.addEventListener('DOMContentLoaded', function () {
  var buttons = document.querySelectorAll('.tpro-analytics');
  for (var i = 0; i < buttons.length; i++) {
    buttons[i].addEventListener('click', function(e){
      _gaq.push(['_trackEvent', e.target.id, 'clicked'])
    });
  }
});
