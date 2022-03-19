<template>
	<n-space align="center" :wrap="false">
		<n-avatar v-if="value !== null" size="medium" :src="'/i/' + value" />
		<n-text>{{ label }}</n-text>
	</n-space>
</template>

<script>
export default {
	props: [ "value", "label" ]
}
</script>