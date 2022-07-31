<template>
	<div class="radial-menu" ref="container">
		<canvas
			ref="canvas"
			:width="canvasWidth"
			:height="canvasHeight"
			@mousedown="handleMousedown"
			@mousemove="handleMousemove"
		></canvas>
	</div>	
</template>

<script>
import { nextTick } from "vue";
import interpolate from "color-interpolate";

export default {
	name: "RadialMenu",
	props: [ "modelValue" ],
	data() {
		return {
			canvasWidth: 100,
            canvasHeight: 100,
			mouseDown: false,
			prevMousePos: { x: null, y: null },
			inputValue: (this.modelValue !== undefined) ? this.modelValue : 0,
		}
	},
	computed: {
	},
	watch: {
		modelValue(val) {
			if (!this.mouseDown && val !== undefined) {
				this.inputValue = val;
				this.render();
			}
		}
	},
	methods: {
        resize() {
            if (this.$refs.container == null) return;

            const rect = this.$refs.container.getBoundingClientRect();
            this.canvasWidth = Math.floor(rect.width * window.devicePixelRatio);
            this.canvasHeight = Math.floor(rect.height * window.devicePixelRatio);

            nextTick(() => {
                this.render(); 
            });
        },
		render() {
			const canvas = this.$refs.canvas;
			const width = canvas.width;
			const height = canvas.height;
			// const x_margin = width/10;
			// const y_margin = height/10;
			const line_width = Math.min(width, height) / 6;
			const ctx = canvas.getContext("2d");
			ctx.clearRect(0, 0, width, height);

			const colormap = interpolate([ "#6B0F12", "#009432" ]);

			ctx.lineWidth = line_width;
			ctx.strokeStyle = colormap(this.inputValue);

			const radius = Math.min(width,height)/2 - Math.min(width,height)/10 - line_width/2;

			// draw outer circle
			ctx.beginPath();
			ctx.arc(width/2, height/2, radius, 0, Math.PI * 2);
			ctx.stroke();

			const posX = width/2 + Math.sin(-this.inputValue * Math.PI * 2) * radius;
			const posY = height/2 + Math.cos(this.inputValue * Math.PI * 2) * radius;

			// draw value display
			ctx.fillStyle = "#343434";
			ctx.strokeStyle = "#676767";
			ctx.lineWidth = 3;
			ctx.beginPath();
			ctx.arc(posX, posY, line_width/3*2, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();

			ctx.font = `${radius/3}px Arial`;
			ctx.fillStyle = "white";
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.fillText(`${Math.round(this.inputValue * 100)}`, posX, posY + 3);
		},
		handleMousedown(evt) {
			window.addEventListener("mouseup", this.handleMouseup);
			this.mouseDown = true;
			this.prevMousePos.x = null;
			this.prevMousePos.y = null;

			this.handleMouse(evt.offsetX, evt.offsetY, true);
		},
		handleMousemove(evt) {
			if (!this.mouseDown) return;

			this.handleMouse(evt.offsetX, evt.offsetY);
		},
		handleMouseup(evt) {
			this.mouseDown = false;
		},
		handleMouse(posX, posY, allowSkip = false) {
			const canvas = this.$refs.canvas;
			const width = canvas.width;
			const height = canvas.height;

			const prevValue = this.inputValue;

			let angle = -Math.atan2(posX - width/2, posY - height/2);
			angle = (angle < 0) ? angle + Math.PI * 2 : angle;

			const newValue = angle / (Math.PI * 2);

			if (prevValue > 0.5 && newValue < 0.5 && posY > height/2 && !allowSkip) {
				this.inputValue = 1;
			} else if (prevValue < 0.5 && newValue > 0.5 && posY > height/2 && !allowSkip) {
				this.inputValue = 0;
			} else {
				this.inputValue = newValue;
			}

			this.prevMousePos.x = posX;
			this.prevMousePos.y = posY;

			this.$emit("update:modelValue", this.inputValue);
			this.render();
		},
	},
	mounted() {
		this.resize();
        new ResizeObserver(this.resize).observe(this.$refs.container);
	},
};
</script>

<style lang="scss" scoped>
.radial-menu {
	font-size: 0;
	position: relative;

    canvas {
		position: absolute;
		top: 0px;
		left: 0px;
        width: 100%;
        height: 100%;
    }
}
</style>