function fileSelectHandler(e){
	let reader = new FileReader()
	reader.onload = function(event){
		let img = new Image()
		img.onload = function(){
			Mosaicify.generate(img)
				.then(({mosaicURL,executionTime})=>{
					console.log(`executionTime : ${executionTime}ms`)
				})
		}
		img.src = event.target.result
	}
	reader.readAsDataURL(e.target.files[0])
}

document.addEventListener("DOMContentLoaded", event => {
	let fileSelector = document.getElementById('fileUpload')
	fileSelector.addEventListener('change', fileSelectHandler, false)
});