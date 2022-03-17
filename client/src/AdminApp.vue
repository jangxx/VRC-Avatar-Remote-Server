<template>
  <main>
    <n-message-provider>
      <Login v-if="!loggedIn" @attempt-login="pw => performLogin('admin', pw)" :errorMessage="loginError"></Login>
      <AdminComponent v-else></AdminComponent>
    </n-message-provider>
  </main>
</template>

<script>
import { nextTick } from "vue";

import LoginMixin from "./lib/LoginMixin";

import Login from "./components/Login.vue";
import AdminComponent from "./AdminComponent.vue";

export default {
  mixins: [ LoginMixin ],
  components: { Login, AdminComponent },
  async created() {
    await this.checkLogin("admin");
  }
}
</script>

<style lang="scss">
@import "assets/style";

body {
  max-width: 1000px;
  margin-left: auto;
  margin-right: auto;
}
</style>
