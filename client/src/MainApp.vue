<template>
  <main>
    <div v-if="notFound">
      <h1>This page could not be found</h1>
    </div>
    <Login v-if="!loggedIn && !notFound" @attempt-login="pw => performLogin(boardID, pw)" :errorMessage="loginError"></Login>
    <template v-if="loggedIn && !notFound">
      <div v-if="board === null"><h1>Loading...</h1></div>
      <div v-else>
        <h1>{{ board.name }}</h1>

        <h2 v-if="avatarId === null">The currently selected avatar has no controls on this board</h2>

        <template v-if="currentAvatar !== null">
          <div class="text">Avatar: <b>{{ currentAvatar.name }}</b></div>

          <div class="controls">
          </div>
        </template>
      </div>
    </template>
  </main>
</template>

<script>
import axios from "redaxios";
// import { io } from "socket.io-client";
import socket from "socket.io-client/dist/socket.io.js";

import LoginMixin from "./lib/LoginMixin";
import { SocketIoAvatarParamControl } from "./lib/SocketIoAvatarParamControl";

import Login from "./components/Login.vue";

export default {
  mixins: [ LoginMixin ],
  components: { Login },
  data() {
    return {
      board: null,
      avatarId: null,
      avatarParameterValues: {},
      controls: {},
    }
  },
  computed: {
    boardId() {
      const m = window.location.pathname.match(/^\/b\/(\w+)/);
      if (m == null) return null;
      return m[1];
    },
    currentAvatar() {
      if (this.board == null || this.avatarId == null) return null;
      return this.board.avatars[this.avatarId];
    }
  },
  methods: {
    async updateBoard() {
      const resp = await axios.get(`/api/b/${this.boardId}/full`);
      this.board = resp.data.board;
    },
    setupSocket() {
      if (this.boardId == null) return;
      this.$options.socket = io({
        query: {
          target: this.boardId,
        },
        reconnection: true,
      });

      // msg = { id }
      this.$options.socket.on("avatar", msg => {
        console.log("avatar", msg);
        this.avatarId = (msg !== null) ? msg.id : null;
        this.avatarParameterValues = {}; // reset value cache
        this.controls = {};

        if (this.avatarId !== null) {
          // create avatar parameter controls
          for (let controlId in this.board.avatars[this.avatarId].controls) {
            this.controls[controlId] = new SocketIoAvatarParamControl(this.board.avatars[this.avatarId].controls[controlId], this.avatarId);
          }
        }
      });

      // msg = { name, value, avatar }
      this.$options.socket.on("parameter", msg => {
        console.log("parameter", msg);
        this.avatarParameterValues[msg.name] = msg.value;
      });
    },
  },
  async created() {
    this.$options.socket = null;

    if (this.boardId !== null) {
      await this.checkLogin(this.boardId);
      await this.updateBoard();
      this.setupSocket();
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

h1, h2, div.text {
  margin-top: 0px;
  text-align: center;
}

.controls {
  
}
</style>
