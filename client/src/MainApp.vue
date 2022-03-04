<template>
  <main>
    <div v-if="notFound">
      <h1>This page could not be found</h1>
    </div>
    <Login v-if="!loggedIn && !notFound" @attempt-login="pw => performLogin(boardID, pw)" :errorMessage="loginError"></Login>
    <div v-if="loggedIn && !notFound">
      <h1>main content</h1>
    </div>
  </main>
</template>

<script>
import LoginMixin from "./lib/LoginMixin";

import Login from "./components/Login.vue";

export default {
  mixins: [ LoginMixin ],
  components: { Login },
  data() {
    return {
    }
  },
  computed: {
    boardId() {
      const m = window.location.pathname.match(/^\/b\/(\w+)/);
      if (m == null) return null;
      return m[1];
    }
  },
  async created() {
    if (this.boardId !== null) {
      await this.checkLogin(this.boardId);
    } else {
      this.notFound = true;
    }
  }
}
</script>

<style lang="scss">
@import "assets/style";

main {
  display: flex;
  flex-direction: column;
  align-items: center;
}
</style>
