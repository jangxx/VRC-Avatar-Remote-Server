<template>
	<div class="radial-menu" ref="container">
		<canvas ref="canvas" :width="canvasWidth" :height="canvasHeight"></canvas>
	</div>	
</template>

<script>
import { nextTick } from "vue";
import interpolate from "color-interpolate";

export default {
	name: "RadialMenu",
	props: [ "value" ],
	data() {
		return {
			canvasWidth: 100,
            canvasHeight: 100,
		}
	},
	computed: {
		displayValue() {
			return this.value !== undefined ? this.value : 0;
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
			const x_margin = width/10;
			const y_margin = height/10;
			const line_width = Math.min(width, height) / 6;
			const ctx = canvas.getContext("2d");
			ctx.clearRect(0, 0, width, height);

			const colormap = interpolate([ "#6B0F12", "#009432" ]);

			ctx.lineWidth = line_width;
			ctx.strokeStyle = colormap(this.displayValue);

			const radius = Math.min(width,height)/2 - Math.min(width,height)/10 - line_width/2;

			// draw outer circle
			ctx.beginPath();
			ctx.arc(width/2, height/2, radius, 0, Math.PI * 2);
			ctx.stroke();

			const posX = width/2 + Math.sin(this.displayValue * Math.PI * 2) * radius;
			const posY = height/2 + Math.cos(this.displayValue * Math.PI * 2) * radius;

			// draw value display
			ctx.fillStyle = "#343434";
			ctx.strokeStyle = "#676767";
			ctx.lineWidth = 3;
			ctx.beginPath();
			ctx.arc(posX, posY, line_width/3*2, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();

			// TODO: add text
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