<template>
	<div class="dropzone" @drop.prevent="handleDrop" @dragover.prevent>
		<div class="title">{{ droppedFilename }}</div>
	</div>
</template>

<script>

export default {
	name: "DropzoneComponent",
	data() {
		return {
			droppedFilename: "Drop a file here",
		};
	},
	methods: {
		handleDrop(evt) {
			const files = evt.dataTransfer.files;
			if (files.length > 0) {
				this.droppedFilename = files[0].name;
				this.$emit("file", files[0]);
			}
		},
	},
}
</script>

<style>
.dropzone {
	box-sizing: border-box;
	background-color: #656565;
	width: 100%;
	height: 80px;
	/* margin: 20px 0px; */
	padding: 20px;
	text-align: center;
}
</style>