'use strict';

function fileSelectHandler(e) {
	var reader = new FileReader();
	reader.onload = function (event) {
		var img = new Image();
		img.onload = function () {
			Mosaicify.generate(img).then(function (_ref) {
				var mosaicURL = _ref.mosaicURL,
				    executionTime = _ref.executionTime;

				console.log('executionTime : ' + executionTime + 'ms');
			});
		};
		img.src = event.target.result;
	};
	reader.readAsDataURL(e.target.files[0]);
}

document.addEventListener("DOMContentLoaded", function (event) {
	var fileSelector = document.getElementById('fileUpload');
	fileSelector.addEventListener('change', fileSelectHandler, false);
});