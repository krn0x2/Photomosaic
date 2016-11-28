/**
 *	Mosaic Application
 * 	Author: Karan Chhabra
 *
 * 	Steps:
 *	1. Checks image if it can be equally split into specified dimension of tile(w x h)
 *		Clips the edges, keeping the image centralised.
 *	2. Creates tileArray from imageData with averages color to that of composing pixels.
 *	3. Parallely XHRs the color of a row, and renders the row on successful completion
 *		of all row colors
 *	4. Serially renders the rows of mosaic from top to bottom.
 *
 * 	Code is written in ES6 which can be used directly on latest browsers, 
 * 	but transpiled for the sake of older browsers.
 * 	./src [Original Code]  => ./js [Transpiled Code]
 * 	
 * Usage: Mosaicify.generate(img,canvas)
				.then(({mosaicURL,executionTime})=>{
					console.log(mosaicURL,executionTime)
				})
	img(required) - ImageData
	canvas(optional) - Canvas DOM to be manipulated
 *
 * HTML5 features used:
 * Localstorage: to cache SVGs, improves performace in cases with a lot background with narrow color spectrum
 * Promises: as an alternative to callbacks and to guarantee exectution of tasks in a specific order
 * 
 * Webworkers: Tried webworkers but they seem to negatively affect performance because of memory
 * 	intensive 'copy' operation to dispatch data to each webworker. May be useful when
 * 	more intensive pixel transformations are required.
 */

"use strict";

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var Mosaicify = function () {
	var DOMURL = window.URL || window.webkitURL || window;
	var pixelsPerTile = TILE_WIDTH * TILE_HEIGHT;

	/**
  * [Returns promise of imagified svg of a particular color]
  * @param  {[String]} color [hex value of color]
  * @return {[Promise]}       [imagified svg]
  */
	function requestSVG(color) {
		var storageKey = 'mosaic-' + color + '-' + TILE_WIDTH + '-' + TILE_HEIGHT;
		var storedColorSvg = localStorage.getItem(storageKey);
		if (storedColorSvg) return loadSVGtoIMG(storedColorSvg);
		return fetch('http://localhost:8765/color/' + color).then(function (response) {
			return response.text();
		}).then(function (svg) {
			try {
				localStorage.setItem(storageKey, svg);
			} catch (err) {
				clearCachedSvgs();
			}
			return loadSVGtoIMG(svg, storageKey);
		});
	}

	/**
  * [Clears svg cache stored in localStorage]
  * @return {[type]}  
  */
	function clearCachedSvgs() {
		var arr = [];
		for (var key in localStorage) {
			if (key.indexOf('mosaic-') === 0) arr.push(key);
		}
		arr.forEach(function (color) {
			return localStorage.removeItem(color);
		});
	}

	/**
  * [Gives an array of 0 to n-1]
  * @param  {[Number ]} num  
  * @return {[Array]}      
  */
	function range(num) {
		return [].concat(_toConsumableArray(Array(num).keys()));
	}

	/**
  * [Overlays mosaic in the passed canvas DOM and returns a promise of mosaicDataURL and execution time]
  * @param  {[ImageDate]} img         
  * @param  {[DOM]} canvas      
  * @param  {[Number ]} tileWidth   
  * @param  {[Number ]} tileHeight  
  * @return {[Promise]}             
  */
	function generateMosaic(img) {
		var canvas = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : document.createElement('canvas');
		var tileWidth = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : TILE_WIDTH;
		var tileHeight = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : TILE_HEIGHT;

		var startTime = performance.now();
		clearCachedSvgs();
		var displayContainer = document.getElementById('container');

		var _clipImage = clipImage(img),
		    width = _clipImage.width,
		    height = _clipImage.height,
		    offsetX = _clipImage.offsetX,
		    offsetY = _clipImage.offsetY;

		var ctx = canvas.getContext('2d');
		canvas.width = width;
		canvas.height = height;
		displayContainer.style.width = width + 'px';
		ctx.drawImage(img, offsetX, offsetY, width, height, 0, 0, width, height);
		displayContainer.insertBefore(canvas, displayContainer.childNodes[0]);
		var xTotal = width / tileWidth,
		    yTotal = height / tileHeight;

		var mosaicArray = range(yTotal).map(function (y) {
			return range(xTotal).map(function (x) {
				var tileData = ctx.getImageData(TILE_WIDTH * x, TILE_HEIGHT * y, TILE_WIDTH, TILE_HEIGHT).data;
				return tileData.reduce(totalColor, [0, 0, 0]).map(average).map(toHex).join('');
			});
		});
		return renderMosaic(mosaicArray, ctx).then(function () {
			var _ref = [canvas.toDataURL(), performance.now() - startTime],
			    mosaicURL = _ref[0],
			    executionTime = _ref[1];

			return Promise.resolve({ mosaicURL: mosaicURL, executionTime: executionTime });
		});
	}

	/**
  * [If an image can't be split into equal tiles, new width,height and offsets are returned to clip the image]
  * @param  {[ImageData]} img  
  * @return {[Object]}      
  */
	function clipImage(img) {
		return {
			width: img.width - img.width % TILE_WIDTH,
			height: img.height - img.height % TILE_HEIGHT,
			offsetX: Math.floor(img.width % TILE_WIDTH / 2),
			offsetY: Math.floor(img.height % TILE_HEIGHT / 2)
		};
	}

	/**
  * [Renders the mosaicData to provided canvas context, Serially renders rows of
  * 	mosaic from top to bottom]
  * @param  {[Array]} mosaic  
  * @param  {[CanvasContext]} ctx     
  * @return {[Promise]}         
  */
	function renderMosaic(mosaic, ctx) {
		return mosaic.reduce(function (p, row, rowNum) {
			return p.then(function () {
				return renderRow(row, rowNum, ctx);
			});
		}, Promise.resolve());
	}

	/**
  * [Parallely requests the tiles of a row and renders the only when all tiles are fetched ]
  * @param  {[Array]} tileRow  
  * @param  {[Number]} rowNum   
  * @param  {[CanvasContext]} ctx      
  * @return {[Promise]}          
  */
	function renderRow(tileRow, rowNum, ctx) {
		return Promise.all(tileRow.map(function (color) {
			return requestSVG(color);
		})).then(function (svgs) {
			svgs.reduce(function (ctx, svg, colNum) {
				ctx.clearRect(colNum * TILE_WIDTH, rowNum * TILE_HEIGHT, TILE_WIDTH, TILE_HEIGHT);
				ctx.drawImage(svg, colNum * TILE_WIDTH, rowNum * TILE_HEIGHT);
				return ctx;
			}, ctx);
			return Promise.resolve();
		});
	}

	/**
  * [Summation of tilecolor with composing pixel colors. Ex [2000,3000,4000] + [255,128,64] =>  [2255,3128,4064] ]
  * @param  {[Number]} [r          
  * @param  {[Number]} g           
  * @param  {[Number]} b]          
  * @param  {[Number]} colorValue  
  * @param  {[Number]} index       
  * @return {[Array]}             
  */
	function totalColor(_ref2, colorValue, index) {
		var _ref3 = _slicedToArray(_ref2, 3),
		    r = _ref3[0],
		    g = _ref3[1],
		    b = _ref3[2];

		var color = [r, g, b];
		if (index % 4 === 3) return color;
		color[index % 4] += colorValue;
		return color;
	}

	/**
  * [Averages a number with a frequency supplied. Ex: 900/30 =>30]
  * @param  {[Float]} total  
  * @return {[Number]}        
  */
	function average(total) {
		return Math.floor(total / pixelsPerTile);
	}

	/**
  * [Converts decimal to hex, Ex: 255 => 'ff']
  * @param  {[Number]} dec  
  * @return {[String]}      
  */
	function toHex(dec) {
		var hex = Math.floor(dec).toString(16);
		hex = hex.length === 1 ? '0' + hex : hex;
		return hex;
	}

	/**
  * [Converts svg String to image element to be used in incremental drawing of canvas]
  * @param  {[String]} svg  
  * @return {[Promise]}      
  */
	function loadSVGtoIMG(svg) {
		return new Promise(function (resolve, reject) {
			var img = new Image();
			var svgBlob = new Blob([svg], { type: 'image/svg+xml' });
			var url = DOMURL.createObjectURL(svgBlob);
			img.onload = function () {
				DOMURL.revokeObjectURL(url);
				resolve(img);
			};
			img.src = url;
		});
	}

	/**
  * Creates a module with a 'generate' API fn which mosaicifies the canvas, and provides (mosaicURL,execTime)
  * on completion of rendering
  */
	return {
		generate: generateMosaic
	};
}();

exports = Mosaicify;