<template>
  <main>
    <Login v-if="!loggedIn" @attempt-login="pw => performLogin(boardID, pw)"></Login>
    <div v-else>
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
    }
  }
}
</script>

<style lang="scss">
@import "assets/style";
</style>
