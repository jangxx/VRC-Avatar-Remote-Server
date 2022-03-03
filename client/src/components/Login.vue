<template>
  <div class="basic-box login-box">
	<h1>Login</h1>
	<form @submit.prevent="$emit('attempt-login', password)">
		<input type="password" v-model="password" class="password-input" placeholder="Password" />
		<button class="button green small login-button">Login</button>
	</form>
  </div>
</template>

<script>
export default {
	props: [ "target" ],
	data() {
		return {
			password: "",
		};
	},
};
</script>

<style lang="scss" scoped>
.login-box {
	margin-left: auto;
	margin-right: auto;
	width: 400px;

	.password-input {
		width: 100%;
	}

	.login-button {
		margin-left: auto;
		margin-right: auto;
		margin-top: 20px;
		display: block;
	}
}
</style>
